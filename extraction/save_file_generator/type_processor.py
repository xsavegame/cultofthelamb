import json
import os
from datetime import datetime

from .shared import (
    Enum,
    KEY_OVERRIDES,
    Reflection,
    SCRIPT_NAME,
    STATIC_LIST_OWNER_CLASS_NAMES,
    TYPE_MAP,
    UNITY_STRUCT_NAMES,
    System,
    get_clean_name,
    get_key,
    get_list_element_type,
    get_union_entries,
    is_list_like_type,
    is_nullable_value_type,
    should_ignore,
)
from .inventory_item_methods import (
    collect_inventory_item_method_maps,
    get_inventory_item_method_enum_types,
    render_inventory_item_method_maps,
)
from .cooking_data_methods import (
    collect_cooking_data_method_implementations,
    get_cooking_data_method_dependency_types,
    render_cooking_data_methods,
)
from .custom_methods import render_custom_class_methods
from .focus_config import (
    is_focused_class,
    should_include_member,
    should_include_static_list_member,
)


class TypeProcessor:
    def __init__(self):
        self.registry = {}
        self.queue = []
        self.processed = set()
        self.union_defs = {}

    def discover(self, root_name):
        root = None
        for asm in System.AppDomain.CurrentDomain.GetAssemblies():
            t = asm.GetType(root_name)
            if t:
                root = t
                break
        if not root:
            for asm in System.AppDomain.CurrentDomain.GetAssemblies():
                try:
                    for t in asm.GetTypes():
                        if t.Name == root_name:
                            root = t
                            break
                except Exception:
                    continue

        if not root:
            raise Exception(f"Class {root_name} not found")
        self.add_to_queue(root)
        while self.queue:
            t = self.queue.pop(0)
            name = get_clean_name(t)
            if name in self.processed:
                continue
            self.processed.add(name)
            self.registry[name] = t
            self.scan_union_metadata(t)
            self.scan_dependencies(t)

    def get_member_key(self, class_name, member):
        override_map = KEY_OVERRIDES.get(class_name, {})
        if member.Name in override_map:
            return override_map[member.Name]
        return get_key(member)

    def add_to_queue(self, t):
        if not t:
            return
        if t.IsArray:
            return self.add_to_queue(t.GetElementType())
        if t.IsGenericType:
            for arg in t.GetGenericArguments():
                self.add_to_queue(arg)
            return

        ns = t.Namespace
        if ns and (ns.startswith("System") or ns.startswith("UnityEngine")):
            return
        if t.IsPrimitive or t.FullName in TYPE_MAP:
            return

        # Only pull the declaring type for nested references when that outer class
        # is explicitly allowed for static list export.
        if t.IsNested and t.DeclaringType is not None:
            declaring_name = get_clean_name(t.DeclaringType)
            if declaring_name in STATIC_LIST_OWNER_CLASS_NAMES:
                self.add_to_queue(t.DeclaringType)

        name = get_clean_name(t)
        if name not in self.processed:
            self.queue.append(t)

    def scan_dependencies(self, t):
        if t.IsEnum:
            return
        class_name = get_clean_name(t)
        self.add_to_queue(t.BaseType)
        has_messagepack_object = False
        for attr in t.GetCustomAttributesData():
            if "MessagePackObjectAttribute" in attr.AttributeType.Name:
                has_messagepack_object = True
                break

        members = []
        flags = (
            Reflection.BindingFlags.Public
            | Reflection.BindingFlags.NonPublic
            | Reflection.BindingFlags.Instance
            | Reflection.BindingFlags.DeclaredOnly
        )
        members.extend(t.GetFields(flags))
        members.extend(t.GetProperties(flags))
        for m in members:
            if should_ignore(m):
                continue
            if not should_include_member(class_name, m.Name):
                continue
            if has_messagepack_object:
                if get_key(m) is None:
                    continue
            else:
                if isinstance(m, Reflection.FieldInfo):
                    if not m.IsPublic or m.IsStatic:
                        continue
                else:
                    getter = m.GetGetMethod(True)
                    setter = m.GetSetMethod(True)
                    has_public_accessor = (
                        (getter is not None and getter.IsPublic)
                        or (setter is not None and setter.IsPublic)
                    )
                    if not has_public_accessor or m.GetIndexParameters().Length > 0:
                        continue

            m_t = m.FieldType if isinstance(m, Reflection.FieldInfo) else m.PropertyType
            self.add_to_queue(m_t)

        # Include public static list/array members (e.g. InventoryItem.AllBrokenWeapons).
        if class_name in STATIC_LIST_OWNER_CLASS_NAMES:
            static_flags = (
                Reflection.BindingFlags.Public
                | Reflection.BindingFlags.Static
                | Reflection.BindingFlags.DeclaredOnly
            )
            for sf in t.GetFields(static_flags):
                if should_ignore(sf):
                    continue
                if not should_include_static_list_member(class_name, sf.Name):
                    continue
                if is_list_like_type(sf.FieldType):
                    self.add_to_queue(sf.FieldType)

            for sp in t.GetProperties(static_flags):
                if should_ignore(sp):
                    continue
                if not should_include_static_list_member(class_name, sp.Name):
                    continue
                getter = sp.GetGetMethod()
                if getter is None or not getter.IsPublic or not getter.IsStatic:
                    continue
                if sp.GetIndexParameters().Length > 0:
                    continue
                if is_list_like_type(sp.PropertyType):
                    self.add_to_queue(sp.PropertyType)

        for enum_t in get_inventory_item_method_enum_types(t):
            self.add_to_queue(enum_t)
        for dep_t in get_cooking_data_method_dependency_types(t):
            self.add_to_queue(dep_t)

    def scan_union_metadata(self, t):
        base_name = get_clean_name(t)
        entries = get_union_entries(t)
        if not entries:
            return

        existing = self.union_defs.get(base_name, [])
        for tag, sub_t in entries:
            sub_clean = get_clean_name(sub_t)
            if all(
                prev_tag != tag or prev_sub != sub_clean
                for prev_tag, prev_sub in existing
            ):
                existing.append((tag, sub_clean))
            self.add_to_queue(sub_t)
        self.union_defs[base_name] = existing

    def get_ts_config(self, t):
        """Returns (TsType, InitVal, OptionsDict)."""
        t_name = t.FullName or t.Name

        if t_name in TYPE_MAP:
            ts, init, _ = TYPE_MAP[t_name]
            int_type_map = {
                "System.SByte": "'i8'",
                "System.Byte": "'u8'",
                "System.Int16": "'i16'",
                "System.UInt16": "'u16'",
                "System.Int32": "'i32'",
                "System.UInt32": "'u32'",
                "System.Int64": "'i64'",
                "System.UInt64": "'u64'",
                "System.Single": "'f32'",
                "System.Double": "'f64'",
            }
            int_type = int_type_map.get(t_name)

            opts = {}
            if int_type is not None:
                opts["intType"] = int_type
            return ts, init, opts

        if is_nullable_value_type(t):
            inner_t = t.GetGenericArguments()[0]
            return self.get_ts_config(inner_t)

        if t.IsArray or (t.IsGenericType and "List`" in t.Name):
            elem_t = t.GetElementType() if t.IsArray else t.GetGenericArguments()[0]
            ts_sub, _, elem_opts = self.get_ts_config(elem_t)

            generic_ref = "Object"
            if elem_t.IsEnum:
                generic_ref = "Number"
            elif ts_sub == "number" or ts_sub == "bigint":
                generic_ref = "Number"
            elif ts_sub == "string":
                generic_ref = "String"
            elif ts_sub == "boolean":
                generic_ref = "Boolean"
            else:
                generic_ref = get_clean_name(elem_t)

            if generic_ref in ["Number", "String", "Boolean", "Object"]:
                opts = {"generic": f"[{generic_ref}]"}
            else:
                opts = {"generic": f"[() => {generic_ref}]"}
            if "intType" in elem_opts:
                opts["intType"] = elem_opts["intType"]
            return f"{ts_sub}[]", "[]", opts

        clean = get_clean_name(t)
        if t.IsEnum:
            try:
                names = Enum.GetNames(t)
                init = f"{clean}.{names[0]}" if len(names) > 0 else "0"
            except Exception:
                init = "0"
            return clean, init, {"intType": "'i32'"}

        if clean not in self.registry:
            return "any", "null", {}

        return clean, f"new {clean}()", {"type": f"() => {clean}"}

    def can_be_null(self, t):
        if t is None:
            return False
        if is_nullable_value_type(t):
            return True
        return not t.IsValueType

    def add_member_imports(self, ts_t, opts, class_name, imports):
        clean = ts_t.replace("[]", "").replace("Record<string, ", "").replace(">", "").strip()
        if clean in self.registry or clean in UNITY_STRUCT_NAMES:
            if clean != class_name:
                imports.add(clean)

        if "generic" in opts:
            gen_content = (
                opts["generic"]
                .replace("[", "")
                .replace("]", "")
                .replace("() =>", "")
                .strip()
            )
            if gen_content not in ["Number", "String", "Boolean", "Object"]:
                if gen_content in self.registry or gen_content in UNITY_STRUCT_NAMES:
                    if gen_content != class_name:
                        imports.add(gen_content)

    def to_ts_literal(self, value, value_type):
        if value is None:
            return "null"

        if is_nullable_value_type(value_type):
            inner_type = value_type.GetGenericArguments()[0]
            return self.to_ts_literal(value, inner_type)

        if value_type.IsEnum:
            enum_name = get_clean_name(value_type)
            enum_member = Enum.GetName(value_type, value)
            if enum_member is not None:
                return f"{enum_name}.{enum_member}"
            return str(int(value))

        value_type_name = value_type.FullName or value_type.Name
        if value_type_name in [
            "System.SByte",
            "System.Byte",
            "System.Int16",
            "System.UInt16",
            "System.Int32",
            "System.UInt32",
        ]:
            return str(int(value))
        if value_type_name in ["System.Int64", "System.UInt64"]:
            return f"{int(value)}n"
        if value_type_name in ["System.Single", "System.Double"]:
            return str(float(value))
        if value_type_name == "System.Boolean":
            return "true" if bool(value) else "false"
        if value_type_name == "System.String":
            return '"' + str(value).replace("\\", "\\\\").replace('"', '\\"') + '"'

        return None

    def write_static_list_member(self, lines, class_name, member_name, member_type, raw_value, imports):
        if not is_list_like_type(member_type):
            return

        elem_type = get_list_element_type(member_type)
        if elem_type is None:
            return

        ts_t, _, opts = self.get_ts_config(member_type)
        if ts_t == "any[]":
            return

        if raw_value is None:
            items = []
        else:
            items = [v for v in raw_value]

        literals = []
        for item in items:
            lit = self.to_ts_literal(item, elem_type)
            if lit is None:
                return
            literals.append(lit)

        self.add_member_imports(ts_t, opts, class_name, imports)

        lines.append(f"  public static {member_name}: {ts_t} = [")
        for lit in literals:
            lines.append(f"    {lit},")
        lines.append("  ];")

    def generate_all(self, output_dir):
        for name in sorted(self.registry.keys()):
            t = self.registry[name]
            try:
                self.write_file(name, t, output_dir)
            except Exception as e:
                print(f"[!] Failed to generate {name}: {e}")
        self.write_union_registry(output_dir)

    def write_json_schema(self, output_dir, root_name):
        defs = {}
        self._append_unity_struct_defs(defs)

        for name in sorted(self.registry.keys()):
            t = self.registry[name]
            defs[name] = self._build_schema_for_registered_type(t)

        if root_name not in defs:
            raise Exception(f"Schema root {root_name} not found in discovered registry")

        schema = {
            "$schema": "http://json-schema.org/draft-07/schema#",
            "$id": f"{root_name}.schema.json",
            "$ref": f"#/$defs/{root_name}",
            "$defs": defs,
        }

        os.makedirs(output_dir, exist_ok=True)
        with open(
            os.path.join(output_dir, f"{root_name}.schema.json"),
            "w",
            encoding="utf-8",
        ) as f:
            json.dump(schema, f, ensure_ascii=False, separators=(",", ":"))
            f.write("\n")

    def _append_unity_struct_defs(self, defs):
        defs["Vector2"] = {
            "type": "object",
            "properties": {
                "x": {"type": "number"},
                "y": {"type": "number"},
            },
            "additionalProperties": False,
            "patternProperties": {"^__UNKNOWN_": {}},
        }
        defs["Vector3"] = {
            "type": "object",
            "properties": {
                "x": {"type": "number"},
                "y": {"type": "number"},
                "z": {"type": "number"},
            },
            "additionalProperties": False,
            "patternProperties": {"^__UNKNOWN_": {}},
        }
        defs["Vector2Int"] = {
            "type": "object",
            "properties": {
                "x": {"type": "integer"},
                "y": {"type": "integer"},
            },
            "additionalProperties": False,
            "patternProperties": {"^__UNKNOWN_": {}},
        }
        defs["Vector3Int"] = {
            "type": "object",
            "properties": {
                "x": {"type": "integer"},
                "y": {"type": "integer"},
                "z": {"type": "integer"},
            },
            "additionalProperties": False,
            "patternProperties": {"^__UNKNOWN_": {}},
        }

    def _build_schema_for_registered_type(self, t):
        class_name = get_clean_name(t)
        if t.IsEnum:
            values = []
            for value in Enum.GetValues(t):
                try:
                    values.append(int(value))
                except Exception:
                    continue
            values = sorted(set(values))
            return {
                "type": "integer",
                "enum": values,
            }

        has_messagepack_object, is_map_mode = self._get_messagepack_object_config(t)
        properties = {}
        members = self._iter_serializable_members_for_schema(t, has_messagepack_object)
        numeric_member_keys = set()
        for member in members:
            m_t = (
                member.FieldType
                if isinstance(member, Reflection.FieldInfo)
                else member.PropertyType
            )
            member_schema = self._build_schema_for_member_type(m_t)
            if self.can_be_null(m_t):
                member_schema = self._to_nullable_schema(member_schema)
            properties[member.Name] = member_schema

            if has_messagepack_object and not is_map_mode:
                key = self.get_member_key(class_name, member)
                if isinstance(key, str):
                    continue
                try:
                    numeric_key = int(key)
                    if numeric_key >= 0:
                        numeric_member_keys.add(numeric_key)
                except Exception:
                    continue

        if (
            has_messagepack_object
            and not is_map_mode
            and numeric_member_keys
            and not is_focused_class(class_name)
        ):
            for missing_index in self._find_missing_indexes(numeric_member_keys):
                properties[f"__missingIndex{missing_index}"] = {}

        schema = {
            "type": "object",
            "properties": properties,
        }

        if has_messagepack_object:
            schema["additionalProperties"] = False
            schema["patternProperties"] = {"^__UNKNOWN_": {}}

        return self._wrap_schema_with_union_variants(
            t, schema, has_messagepack_object
        )

    def _collect_inheritance_variant_names(self, base_t):
        base_name = get_clean_name(base_t)
        variants = []
        for candidate_name, candidate_t in sorted(self.registry.items()):
            if candidate_name == base_name:
                continue
            try:
                if candidate_t.IsSubclassOf(base_t):
                    variants.append(candidate_name)
            except Exception:
                continue
        return variants

    def _wrap_schema_with_union_variants(
        self, base_t, base_schema, include_inheritance_variants
    ):
        base_name = get_clean_name(base_t)
        union_entries = sorted(self.union_defs.get(base_name, []), key=lambda entry: entry[0])
        variant_names = []
        seen = set()

        def add_variant(name):
            if name in seen:
                return
            if name == base_name:
                return
            if name not in self.registry:
                return
            seen.add(name)
            variant_names.append(name)

        for _, subtype_name in union_entries:
            add_variant(subtype_name)

        if include_inheritance_variants and not union_entries:
            for subtype_name in self._collect_inheritance_variant_names(base_t):
                add_variant(subtype_name)

        if not variant_names:
            return base_schema
        any_of = [base_schema]
        any_of.extend({"$ref": f"#/$defs/{name}"} for name in variant_names)
        return {"anyOf": any_of}

    def _get_messagepack_object_config(self, t):
        has_messagepack_object = False
        is_map_mode = False
        for attr in t.GetCustomAttributesData():
            if "MessagePackObjectAttribute" in attr.AttributeType.Name:
                has_messagepack_object = True
                if attr.ConstructorArguments.Count > 0:
                    val = attr.ConstructorArguments[0].Value
                    if isinstance(val, bool):
                        is_map_mode = val
                break
        return has_messagepack_object, is_map_mode

    def _find_missing_indexes(self, numeric_member_keys):
        sorted_keys = sorted(numeric_member_keys)
        missing_indexes = []
        for idx in range(len(sorted_keys) - 1):
            current_key = sorted_keys[idx]
            next_key = sorted_keys[idx + 1]
            if next_key > current_key + 1:
                missing_indexes.extend(range(current_key + 1, next_key))
        return missing_indexes

    def _iter_serializable_members_for_schema(self, t, has_messagepack_object):
        class_name = get_clean_name(t)
        flags = (
            Reflection.BindingFlags.Public
            | Reflection.BindingFlags.NonPublic
            | Reflection.BindingFlags.Instance
        )
        members = []
        members.extend(t.GetFields(flags))
        members.extend(t.GetProperties(flags))

        filtered = []
        for m in members:
            if should_ignore(m):
                continue
            if not should_include_member(class_name, m.Name):
                continue
            if has_messagepack_object:
                if self.get_member_key(class_name, m) is None:
                    continue
            else:
                if isinstance(m, Reflection.FieldInfo):
                    if not m.IsPublic or m.IsStatic:
                        continue
                else:
                    getter = m.GetGetMethod(True)
                    setter = m.GetSetMethod(True)
                    has_public_accessor = (
                        (getter is not None and getter.IsPublic)
                        or (setter is not None and setter.IsPublic)
                    )
                    if not has_public_accessor or m.GetIndexParameters().Length > 0:
                        continue
            filtered.append(m)

        return filtered

    def _build_schema_for_member_type(self, t):
        if t is None:
            return {}

        if is_nullable_value_type(t):
            inner_t = t.GetGenericArguments()[0]
            return self._build_schema_for_member_type(inner_t)

        if t.IsArray or (t.IsGenericType and "List`" in t.Name):
            elem_t = t.GetElementType() if t.IsArray else t.GetGenericArguments()[0]
            return {
                "type": "array",
                "items": self._build_schema_for_member_type(elem_t),
            }

        t_name = t.FullName or t.Name
        primitive_schema = {
            "System.SByte": {"type": "integer"},
            "System.Byte": {"type": "integer"},
            "System.Int16": {"type": "integer"},
            "System.UInt16": {"type": "integer"},
            "System.Int32": {"type": "integer"},
            "System.UInt32": {"type": "integer"},
            "System.Int64": {
                "anyOf": [
                    {"type": "integer"},
                    {"type": "string", "pattern": "^-?\\d+$"},
                ]
            },
            "System.UInt64": {
                "anyOf": [
                    {"type": "integer", "minimum": 0},
                    {"type": "string", "pattern": "^\\d+$"},
                ]
            },
            "System.Single": {"type": "number"},
            "System.Double": {"type": "number"},
            "System.String": {"type": "string"},
            "System.Boolean": {"type": "boolean"},
            "System.DateTime": {"type": "string"},
        }

        if t_name in primitive_schema:
            return primitive_schema[t_name]

        if t.IsEnum:
            return {"$ref": f"#/$defs/{get_clean_name(t)}"}

        clean = get_clean_name(t)
        if clean in self.registry or clean in UNITY_STRUCT_NAMES:
            return {"$ref": f"#/$defs/{clean}"}

        return {}

    def _to_nullable_schema(self, schema):
        if "$ref" in schema:
            return {"anyOf": [schema, {"type": "null"}]}

        copied = dict(schema)
        existing_type = copied.get("type")
        if isinstance(existing_type, list):
            if "null" not in existing_type:
                copied["type"] = existing_type + ["null"]
            return copied
        if isinstance(existing_type, str):
            copied["type"] = [existing_type, "null"]
            return copied

        return {"anyOf": [schema, {"type": "null"}]}

    def write_union_registry(self, output_dir):
        lines = [
            f"/* Auto-generated by {SCRIPT_NAME} at {datetime.now().isoformat()} */",
            "",
            "import { Union } from './MessagePackBase';",
        ]

        import_set = set()
        registration_lines = []

        for base_name in sorted(self.union_defs.keys()):
            entries = sorted(self.union_defs[base_name], key=lambda x: x[0])
            if not entries:
                continue
            import_set.add(base_name)
            for tag, subtype_name in entries:
                if subtype_name not in self.registry:
                    continue
                import_set.add(subtype_name)
                registration_lines.append(f"Union({tag}, () => {subtype_name})({base_name});")

        for dep in sorted(import_set):
            lines.append(f"import {{ {dep} }} from './{dep}';")

        if lines[-1] != "":
            lines.append("")

        if registration_lines:
            lines.extend(registration_lines)
        else:
            lines.append("export {};")
        lines.append("")

        with open(os.path.join(output_dir, "UnionRegistry.ts"), "w", encoding="utf-8") as f:
            f.write("\n".join(lines))

    def write_file(self, name, t, output_dir):
        imports = set()

        if t.IsEnum:
            names, vals = Enum.GetNames(t), Enum.GetValues(t)
            lines = [
                f"/* Auto-generated by {SCRIPT_NAME} at {datetime.now().isoformat()} */",
                f"/* C# enum: {t.FullName} */",
                f"export enum {name} {{",
            ]
            for i in range(len(names)):
                lines.append(f"  {names[i]} = {int(vals[i])},")
            lines.append("}")
            lines.append("")

            with open(os.path.join(output_dir, f"{name}.ts"), "w", encoding="utf-8") as f:
                f.write("\n".join(lines))
            return

        is_map_mode = False
        has_messagepack_object = False
        for attr in t.GetCustomAttributesData():
            if "MessagePackObjectAttribute" in attr.AttributeType.Name:
                has_messagepack_object = True
                if attr.ConstructorArguments.Count > 0:
                    val = attr.ConstructorArguments[0].Value
                    if isinstance(val, bool):
                        is_map_mode = val

        base_name = None
        if t.BaseType is not None:
            maybe_base = get_clean_name(t.BaseType)
            if maybe_base in self.registry and maybe_base != name:
                base_name = maybe_base
                imports.add(maybe_base)

        class_keyword = "class"
        extends_name = (
            base_name
            if base_name
            else ("MessagePackObject" if has_messagepack_object else "ExportedClass")
        )
        has_key_decorators = False

        lines = []
        lines.append(f"/* C# class: {t.FullName} */")
        extends_clause = f" extends {extends_name}" if extends_name else ""
        lines.append(f"export {class_keyword} {name}{extends_clause} {{")
        if has_messagepack_object:
            lines.append(f"  protected static _isMapMode = {str(is_map_mode).lower()};")

        flags = (
            Reflection.BindingFlags.Public
            | Reflection.BindingFlags.NonPublic
            | Reflection.BindingFlags.Instance
        )
        if base_name is not None:
            flags = flags | Reflection.BindingFlags.DeclaredOnly
        members = []
        members.extend(t.GetFields(flags))
        members.extend(t.GetProperties(flags))
        numeric_member_keys = set()

        for m in members:
            if should_ignore(m):
                continue
            if not should_include_member(name, m.Name):
                continue
            key = self.get_member_key(name, m)
            if has_messagepack_object and key is None:
                continue
            if not has_messagepack_object:
                if isinstance(m, Reflection.FieldInfo):
                    if not m.IsPublic or m.IsStatic:
                        continue
                else:
                    getter = m.GetGetMethod(True)
                    setter = m.GetSetMethod(True)
                    has_public_accessor = (
                        (getter is not None and getter.IsPublic)
                        or (setter is not None and setter.IsPublic)
                    )
                    if not has_public_accessor or m.GetIndexParameters().Length > 0:
                        continue

            m_t = m.FieldType if isinstance(m, Reflection.FieldInfo) else m.PropertyType
            ts_t, _, opts = self.get_ts_config(m_t)
            can_be_null = self.can_be_null(m_t)
            ts_decl_t = f"{ts_t} | null" if can_be_null else ts_t
            if can_be_null:
                opts["nullable"] = "true"

            if has_messagepack_object:
                opt_str_parts = []
                for k, v in opts.items():
                    opt_str_parts.append(f"{k}: {v}")

                k_val = f'"{key}"' if isinstance(key, str) else key
                if opt_str_parts:
                    lines.append(f"  @Key({k_val}, {{ {', '.join(opt_str_parts)} }})")
                else:
                    lines.append(f"  @Key({k_val})")
                has_key_decorators = True
                if not is_map_mode and not isinstance(key, str):
                    try:
                        numeric_key = int(key)
                        if numeric_key >= 0:
                            numeric_member_keys.add(numeric_key)
                    except Exception:
                        pass

            lines.append(f"  public {m.Name}!: {ts_decl_t};")
            self.add_member_imports(ts_t, opts, name, imports)

        if (
            has_messagepack_object
            and not is_map_mode
            and numeric_member_keys
            and not is_focused_class(name)
        ):
            sorted_keys = sorted(numeric_member_keys)
            missing_indexes = []
            for idx in range(len(sorted_keys) - 1):
                current_key = sorted_keys[idx]
                next_key = sorted_keys[idx + 1]
                if next_key > current_key + 1:
                    missing_indexes.extend(range(current_key + 1, next_key))

            for missing_index in missing_indexes:
                lines.append("  /**")
                lines.append(
                    f"   * @deprecated Reserved MessagePack index {missing_index} for data preservation."
                )
                lines.append("   */")
                lines.append(f"  @Key({missing_index})")
                lines.append(f"  public readonly __missingIndex{missing_index}!: any;")
                has_key_decorators = True

        static_members = []
        if name in STATIC_LIST_OWNER_CLASS_NAMES:
            static_flags = (
                Reflection.BindingFlags.Public
                | Reflection.BindingFlags.Static
                | Reflection.BindingFlags.DeclaredOnly
            )
            for field in t.GetFields(static_flags):
                static_members.append(("field", field, field.MetadataToken))
            for prop in t.GetProperties(static_flags):
                getter = prop.GetGetMethod()
                if getter is None or not getter.IsPublic or not getter.IsStatic:
                    continue
                if prop.GetIndexParameters().Length > 0:
                    continue
                if not is_list_like_type(prop.PropertyType):
                    continue
                static_members.append(("property", prop, prop.MetadataToken))
        static_members.sort(key=lambda entry: entry[2])

        for kind, member, _ in static_members:
            if should_ignore(member):
                continue
            if not should_include_static_list_member(name, member.Name):
                continue

            try:
                if kind == "field":
                    self.write_static_list_member(
                        lines=lines,
                        class_name=name,
                        member_name=member.Name,
                        member_type=member.FieldType,
                        raw_value=member.GetValue(None),
                        imports=imports,
                    )
                else:
                    self.write_static_list_member(
                        lines=lines,
                        class_name=name,
                        member_name=member.Name,
                        member_type=member.PropertyType,
                        raw_value=member.GetValue(None, None),
                        imports=imports,
                    )
            except Exception:
                continue

        method_maps = collect_inventory_item_method_maps(t)
        for method_map in method_maps:
            if method_map.param_enum_name != name:
                imports.add(method_map.param_enum_name)
            if method_map.return_enum_name != name:
                imports.add(method_map.return_enum_name)
        lines.extend(render_inventory_item_method_maps(name, method_maps))

        cooking_method_impls = collect_cooking_data_method_implementations(t)
        for impl in cooking_method_impls:
            for dep_name in impl.required_type_names:
                if dep_name != name:
                    imports.add(dep_name)
        lines.extend(render_cooking_data_methods(cooking_method_impls))
        custom_method_lines = render_custom_class_methods(name)
        lines.extend(custom_method_lines)
        needs_messagepack_object_import = any(
            "MessagePackObject" in line for line in custom_method_lines
        )

        lines.append("}")
        lines.append("")

        with open(os.path.join(output_dir, f"{name}.ts"), "w", encoding="utf-8") as f:
            f.write(f"/* Auto-generated by {SCRIPT_NAME} at {datetime.now().isoformat()} */\n")
            base_imports = []
            if has_key_decorators:
                base_imports.append("Key")
            if extends_name == "MessagePackObject" or needs_messagepack_object_import:
                base_imports.append("MessagePackObject")
            if base_imports:
                f.write(f"import {{ {', '.join(base_imports)} }} from './MessagePackBase';\n")
            if extends_name == "ExportedClass":
                f.write("import { ExportedClass } from './ExportedClass';\n")

            used_structs = [s for s in UNITY_STRUCT_NAMES if s in imports]
            if used_structs:
                f.write(f"import {{ {', '.join(used_structs)} }} from './UnityStructs';\n")

            for dep in sorted(imports):
                if dep not in UNITY_STRUCT_NAMES:
                    f.write(f"import {{ {dep} }} from './{dep}';\n")

            f.write("\n")
            f.write("\n".join(lines))

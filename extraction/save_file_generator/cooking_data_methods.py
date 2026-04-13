from dataclasses import dataclass, field

from .shared import (
    Enum,
    Reflection,
    TYPE_MAP,
    System,
    get_clean_name,
    get_list_element_type,
    is_nullable_value_type,
    is_list_like_type,
    should_ignore,
)


TARGET_CLASS_NAME = "CookingData"
DATA_MANAGER_CLASS_NAME = "DataManager"
SUPPORTED_METHODS = {
    "GetRecipe",
    "IsRecipeDLC",
    "GetMealEffects",
    "GetAllDrinks",
    "GettAllWinterDrinks",
    "GetAllGoodMeals",
    "GetAllGreatMeals",
    "GetAllMeals",
    "GetIngredientFromMealType",
}
INVENTORY_ITEM_TYPE_ENUM_CACHE = None


@dataclass
class CookingMethodImplementation:
    method_name: str
    return_ts_type: str
    param_ts_type: str | None = None
    uses_data_manager_param: bool = False
    cases: list[tuple[str, str]] = field(default_factory=list)
    default_return_literal: str | None = None
    no_arg_return_literal: str | None = None
    required_type_names: set[str] = field(default_factory=set)


def _get_method_flags():
    return (
        Reflection.BindingFlags.Public
        | Reflection.BindingFlags.Static
        | Reflection.BindingFlags.DeclaredOnly
    )


def _find_type_by_name(type_name):
    for asm in System.AppDomain.CurrentDomain.GetAssemblies():
        t = asm.GetType(type_name)
        if t is not None:
            return t

    for asm in System.AppDomain.CurrentDomain.GetAssemblies():
        try:
            for t in asm.GetTypes():
                if t.Name == type_name:
                    return t
        except Exception:
            continue

    return None


def _find_inventory_item_type_enum():
    global INVENTORY_ITEM_TYPE_ENUM_CACHE
    if INVENTORY_ITEM_TYPE_ENUM_CACHE is not None:
        return INVENTORY_ITEM_TYPE_ENUM_CACHE or None

    for asm in System.AppDomain.CurrentDomain.GetAssemblies():
        try:
            for t in asm.GetTypes():
                if not t.IsEnum:
                    continue
                full_name = t.FullName or ""
                if full_name.endswith("InventoryItem+ITEM_TYPE"):
                    INVENTORY_ITEM_TYPE_ENUM_CACHE = t
                    return t
                if get_clean_name(t) == "InventoryItem_ITEM_TYPE":
                    INVENTORY_ITEM_TYPE_ENUM_CACHE = t
                    return t
        except Exception:
            continue

    INVENTORY_ITEM_TYPE_ENUM_CACHE = False
    return None


def _iter_supported_methods(cooking_data_type):
    if get_clean_name(cooking_data_type) != TARGET_CLASS_NAME:
        return

    for method in cooking_data_type.GetMethods(_get_method_flags()):
        if method.Name in SUPPORTED_METHODS:
            yield method


def _collect_type_names_for_import(t, result):
    if t is None:
        return
    if is_nullable_value_type(t):
        _collect_type_names_for_import(t.GetGenericArguments()[0], result)
        return
    if is_list_like_type(t):
        _collect_type_names_for_import(get_list_element_type(t), result)
        return

    ns = t.Namespace
    if t.IsEnum:
        result.add(get_clean_name(t))
        return
    if ns and (ns.startswith("System") or ns.startswith("UnityEngine")):
        return
    result.add(get_clean_name(t))


def _to_ts_type(t):
    if t is None:
        return "void"

    if is_nullable_value_type(t):
        return _to_ts_type(t.GetGenericArguments()[0])

    t_name = t.FullName or t.Name
    if t_name in TYPE_MAP:
        return TYPE_MAP[t_name][0]

    if is_list_like_type(t):
        elem_t = get_list_element_type(t)
        elem_ts = _to_ts_type(elem_t) if elem_t is not None else "any"
        return f"{elem_ts}[]"

    return get_clean_name(t)


def _enum_literal(value, enum_type):
    enum_name = get_clean_name(enum_type)
    enum_member = Enum.GetName(enum_type, value)
    if enum_member is not None:
        return f"{enum_name}.{enum_member}"

    try:
        return str(int(value))
    except Exception:
        return "0"


def _get_serializable_members(t):
    field_flags = Reflection.BindingFlags.Public | Reflection.BindingFlags.Instance
    prop_flags = Reflection.BindingFlags.Public | Reflection.BindingFlags.Instance
    members = []
    for field in t.GetFields(field_flags):
        if field.IsStatic:
            continue
        members.append(("field", field, field.MetadataToken))
    for prop in t.GetProperties(prop_flags):
        if prop.GetIndexParameters().Length > 0:
            continue
        getter = prop.GetGetMethod(True)
        if getter is None:
            continue
        if getter.IsStatic:
            continue
        members.append(("property", prop, prop.MetadataToken))
    members.sort(key=lambda x: x[2])
    return members


def _is_default_scalar_value(value, value_type):
    if value is None:
        return True

    if is_nullable_value_type(value_type):
        inner_type = value_type.GetGenericArguments()[0]
        return _is_default_scalar_value(value, inner_type)

    t_name = value_type.FullName or value_type.Name
    if value_type.IsEnum:
        try:
            return int(value) == 0
        except Exception:
            return False
    if t_name in [
        "System.SByte",
        "System.Byte",
        "System.Int16",
        "System.UInt16",
        "System.Int32",
        "System.UInt32",
        "System.Int64",
        "System.UInt64",
    ]:
        try:
            return int(value) == 0
        except Exception:
            return False
    if t_name in ["System.Single", "System.Double"]:
        try:
            return float(value) == 0.0
        except Exception:
            return False
    if t_name == "System.Boolean":
        return not bool(value)
    if t_name == "System.String":
        return str(value) == ""

    return False


def _try_serialize_enum_backed_member(
    container_type, member_name, member_value, member_type, required_type_names
):
    if get_clean_name(container_type) != "InventoryItem":
        return None
    if member_name.lower() != "type":
        return None

    member_type_name = member_type.FullName or member_type.Name
    if member_type_name not in [
        "System.SByte",
        "System.Byte",
        "System.Int16",
        "System.UInt16",
        "System.Int32",
        "System.UInt32",
    ]:
        return None

    enum_type = _find_inventory_item_type_enum()
    if enum_type is None:
        return None

    try:
        enum_value = Enum.ToObject(enum_type, int(member_value))
        enum_name = Enum.GetName(enum_type, enum_value)
        if enum_name is None:
            return None
        clean_enum_name = get_clean_name(enum_type)
        required_type_names.add(clean_enum_name)
        return f"{clean_enum_name}.{enum_name}"
    except Exception:
        return None


def _serialize_value(value, value_type, required_type_names):
    if value is None:
        return "null"

    if is_nullable_value_type(value_type):
        inner_type = value_type.GetGenericArguments()[0]
        return _serialize_value(value, inner_type, required_type_names)

    t_name = value_type.FullName or value_type.Name

    if value_type.IsEnum:
        required_type_names.add(get_clean_name(value_type))
        return _enum_literal(value, value_type)

    if t_name in [
        "System.SByte",
        "System.Byte",
        "System.Int16",
        "System.UInt16",
        "System.Int32",
        "System.UInt32",
    ]:
        return str(int(value))
    if t_name in ["System.Int64", "System.UInt64"]:
        return f"{int(value)}n"
    if t_name in ["System.Single", "System.Double"]:
        return str(float(value))
    if t_name == "System.Boolean":
        return "true" if bool(value) else "false"
    if t_name == "System.String":
        return '"' + str(value).replace("\\", "\\\\").replace('"', '\\"') + '"'

    if is_list_like_type(value_type):
        elem_type = get_list_element_type(value_type)
        if elem_type is None:
            return "[]"
        items = []
        for item in value:
            item_lit = _serialize_value(item, elem_type, required_type_names)
            if item_lit is None:
                return None
            items.append(item_lit)
        return "[" + ", ".join(items) + "]"

    class_name = get_clean_name(value_type)
    required_type_names.add(class_name)
    assignments = []
    for kind, member, _ in _get_serializable_members(value_type):
        if should_ignore(member):
            continue

        try:
            if kind == "field":
                member_type = member.FieldType
                member_value = member.GetValue(value)
            else:
                getter = member.GetGetMethod(True)
                if getter is None:
                    continue
                member_type = member.PropertyType
                member_value = member.GetValue(value, None)
        except Exception:
            continue

        if _is_default_scalar_value(member_value, member_type):
            continue

        enum_backed_literal = _try_serialize_enum_backed_member(
            container_type=value_type,
            member_name=member.Name,
            member_value=member_value,
            member_type=member_type,
            required_type_names=required_type_names,
        )
        member_literal = (
            enum_backed_literal
            if enum_backed_literal is not None
            else _serialize_value(member_value, member_type, required_type_names)
        )
        if member_literal is None:
            continue
        assignments.append(f"{member.Name}: {member_literal}")

    if not assignments:
        return f"new {class_name}()"

    return f"{class_name}.fromObject({{ {', '.join(assignments)} }})"


def _get_data_manager_instance_tokens(data_manager_type):
    if data_manager_type is None:
        return set()

    tokens = set()
    flags = (
        Reflection.BindingFlags.Public
        | Reflection.BindingFlags.NonPublic
        | Reflection.BindingFlags.Static
    )

    for method in data_manager_type.GetMethods(flags):
        if method.Name == "get_Instance":
            tokens.add(method.MetadataToken)
    for field in data_manager_type.GetFields(flags):
        if field.Name == "Instance":
            tokens.add(field.MetadataToken)

    return tokens


def _uses_data_manager_instance(method, data_manager_instance_tokens):
    if not data_manager_instance_tokens:
        return False

    body = method.GetMethodBody()
    if body is None:
        return False

    il = bytes(body.GetILAsByteArray())
    token_opcodes = {0x28, 0x6F, 0x7E, 0x7F, 0x80}
    for i in range(1, len(il) - 4):
        if il[i - 1] not in token_opcodes:
            continue
        token = int.from_bytes(il[i : i + 4], byteorder="little", signed=False)
        if token in data_manager_instance_tokens:
            return True
    return False


def _get_default_case_literal(method, param_type, return_type, required_type_names):
    try:
        none_value = Enum.Parse(param_type, "NONE")
        result = method.Invoke(None, [none_value])
        return _serialize_value(result, return_type, required_type_names)
    except Exception:
        pass

    try:
        values = Enum.GetValues(param_type)
        if len(values) > 0:
            result = method.Invoke(None, [values[0]])
            return _serialize_value(result, return_type, required_type_names)
    except Exception:
        pass

    if return_type.IsEnum:
        enum_values = Enum.GetValues(return_type)
        if len(enum_values) > 0:
            return _enum_literal(enum_values[0], return_type)

    t_name = return_type.FullName or return_type.Name
    if t_name in [
        "System.SByte",
        "System.Byte",
        "System.Int16",
        "System.UInt16",
        "System.Int32",
        "System.UInt32",
    ]:
        return "0"
    if t_name in ["System.Int64", "System.UInt64"]:
        return "0n"
    if t_name in ["System.Single", "System.Double"]:
        return "0"
    if t_name == "System.Boolean":
        return "false"
    if t_name == "System.String":
        return '""'
    if is_list_like_type(return_type):
        return "[]"
    return "null"


def get_cooking_data_method_dependency_types(cooking_data_type):
    dependency_types = []
    for method in _iter_supported_methods(cooking_data_type):
        dependency_types.append(method.ReturnType)
        for param in method.GetParameters():
            dependency_types.append(param.ParameterType)

    if get_clean_name(cooking_data_type) == TARGET_CLASS_NAME:
        data_manager_type = _find_type_by_name(DATA_MANAGER_CLASS_NAME)
        if data_manager_type is not None:
            dependency_types.append(data_manager_type)

    return dependency_types


def collect_cooking_data_method_implementations(cooking_data_type):
    implementations = []

    if get_clean_name(cooking_data_type) != TARGET_CLASS_NAME:
        return implementations

    data_manager_type = _find_type_by_name(DATA_MANAGER_CLASS_NAME)
    data_manager_instance_tokens = _get_data_manager_instance_tokens(data_manager_type)

    methods = sorted(_iter_supported_methods(cooking_data_type), key=lambda x: x.MetadataToken)
    for method in methods:
        params = method.GetParameters()
        return_type = method.ReturnType
        required_type_names = set()
        _collect_type_names_for_import(return_type, required_type_names)

        uses_data_manager_param = _uses_data_manager_instance(method, data_manager_instance_tokens)
        if uses_data_manager_param:
            required_type_names.add(DATA_MANAGER_CLASS_NAME)

        if params.Length == 0:
            try:
                result = method.Invoke(None, None)
            except Exception:
                continue

            return_literal = _serialize_value(result, return_type, required_type_names)
            if return_literal is None:
                continue

            implementations.append(
                CookingMethodImplementation(
                    method_name=method.Name,
                    return_ts_type=_to_ts_type(return_type),
                    uses_data_manager_param=uses_data_manager_param,
                    no_arg_return_literal=return_literal,
                    required_type_names=required_type_names,
                )
            )
            continue

        if params.Length == 1 and params[0].ParameterType.IsEnum:
            param_type = params[0].ParameterType
            _collect_type_names_for_import(param_type, required_type_names)
            default_literal = _get_default_case_literal(
                method=method,
                param_type=param_type,
                return_type=return_type,
                required_type_names=required_type_names,
            )

            cases = []
            for value in Enum.GetValues(param_type):
                try:
                    result = method.Invoke(None, [value])
                except Exception:
                    continue
                case_literal = _serialize_value(result, return_type, required_type_names)
                if case_literal is None:
                    continue
                cases.append((_enum_literal(value, param_type), case_literal))

            implementations.append(
                CookingMethodImplementation(
                    method_name=method.Name,
                    return_ts_type=_to_ts_type(return_type),
                    param_ts_type=_to_ts_type(param_type),
                    uses_data_manager_param=uses_data_manager_param,
                    cases=cases,
                    default_return_literal=default_literal,
                    required_type_names=required_type_names,
                )
            )

    return implementations


def render_cooking_data_methods(method_implementations):
    lines = []

    for impl in method_implementations:
        params = []
        if impl.uses_data_manager_param:
            params.append("dataManager: DataManager")
        if impl.param_ts_type is not None:
            params.append(f"type: {impl.param_ts_type}")
        param_sig = ", ".join(params)

        lines.append(
            f"  public static {impl.method_name}({param_sig}): {impl.return_ts_type} {{"
        )

        if impl.uses_data_manager_param:
            fallback = (
                impl.default_return_literal
                if impl.param_ts_type is not None
                else impl.no_arg_return_literal
            )
            lines.append(f"    if (!dataManager) return {fallback};")

        if impl.param_ts_type is not None:
            lines.append("    switch (type) {")
            for case_literal, return_literal in impl.cases:
                lines.append(f"      case {case_literal}:")
                lines.append(f"        return {return_literal};")
            lines.append("      default:")
            lines.append(f"        return {impl.default_return_literal};")
            lines.append("    }")
        else:
            lines.append(f"    return {impl.no_arg_return_literal};")

        lines.append("  }")
        lines.append("")

    return lines

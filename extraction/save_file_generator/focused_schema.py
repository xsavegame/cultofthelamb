import copy
import json
from typing import Dict, Iterable, List, Set, Tuple

from .focus_config import FOCUSED_CLASS_MEMBERS

FOCUSED_SCHEMA_PROPERTIES: Dict[str, Set[str]] = FOCUSED_CLASS_MEMBERS


def _def_name_from_ref(ref: str) -> str | None:
    prefix = "#/$defs/"
    if not isinstance(ref, str) or not ref.startswith(prefix):
        return None
    return ref[len(prefix) :]


def _iter_object_variants(schema: dict) -> Iterable[dict]:
    if not isinstance(schema, dict):
        return
    if isinstance(schema.get("properties"), dict):
        yield schema
        return
    any_of = schema.get("anyOf")
    if not isinstance(any_of, list):
        return
    for entry in any_of:
        if isinstance(entry, dict) and isinstance(entry.get("properties"), dict):
            yield entry


def _prune_definition(def_name: str, schema: dict) -> Tuple[dict, List[str]]:
    out = copy.deepcopy(schema)
    missing: List[str] = []
    allowed_props = FOCUSED_SCHEMA_PROPERTIES.get(def_name)
    if not allowed_props:
        return out, missing

    for variant in _iter_object_variants(out):
        props = variant.get("properties", {})
        if not isinstance(props, dict):
            continue
        next_props = {}
        for key in sorted(allowed_props):
            if key in props:
                next_props[key] = props[key]
            else:
                missing.append(key)
        variant["properties"] = next_props
        variant["additionalProperties"] = True
        variant.pop("patternProperties", None)

    return out, missing


def _collect_ref_names(node: object, out: Set[str]) -> None:
    if isinstance(node, dict):
        ref_name = _def_name_from_ref(node.get("$ref"))
        if ref_name is not None:
            out.add(ref_name)
        for value in node.values():
            _collect_ref_names(value, out)
        return
    if isinstance(node, list):
        for item in node:
            _collect_ref_names(item, out)


def apply_focused_schema(schema: dict, root_name: str) -> dict:
    defs = schema.get("$defs")
    if not isinstance(defs, dict):
        return schema
    if root_name not in defs:
        return schema

    next_defs: Dict[str, object] = {}
    queue = [root_name]
    visited: Set[str] = set()
    missing_by_def: Dict[str, List[str]] = {}

    while queue:
        name = queue.pop()
        if name in visited:
            continue
        visited.add(name)

        source = defs.get(name)
        if not isinstance(source, dict):
            continue

        pruned, missing = _prune_definition(name, source)
        if missing:
            missing_by_def[name] = missing
        next_defs[name] = pruned

        refs: Set[str] = set()
        _collect_ref_names(pruned, refs)
        for ref_name in sorted(refs):
            if ref_name in defs and ref_name not in visited:
                queue.append(ref_name)

    if missing_by_def:
        for def_name, missing in sorted(missing_by_def.items()):
            missing_keys = ", ".join(sorted(set(missing)))
            print(f"[!] Focused schema: missing keys in {def_name}: {missing_keys}")

    out = dict(schema)
    out["$defs"] = next_defs
    return out


def apply_focused_schema_file(schema_path: str, root_name: str) -> None:
    with open(schema_path, "r", encoding="utf-8") as f:
        schema = json.load(f)

    focused = apply_focused_schema(schema, root_name)
    with open(schema_path, "w", encoding="utf-8") as f:
        json.dump(focused, f, ensure_ascii=False, separators=(",", ":"))
        f.write("\n")

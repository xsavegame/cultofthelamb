from dataclasses import dataclass

from .shared import Enum, Reflection, get_clean_name


TARGET_CLASS_NAME = "InventoryItem"
SUPPORTED_METHODS = {"GetItemCategory", "GetSeedType"}


@dataclass
class EnumMap:
    method_name: str
    param_enum_name: str
    return_enum_name: str
    default_literal: str
    entries: list[tuple[str, str]]


def _get_method_flags():
    return (
        Reflection.BindingFlags.Public
        | Reflection.BindingFlags.Static
        | Reflection.BindingFlags.DeclaredOnly
    )


def _get_enum_literal(value, enum_type):
    enum_name = get_clean_name(enum_type)
    enum_member = Enum.GetName(enum_type, value)
    if enum_member is not None:
        return f"{enum_name}.{enum_member}"

    try:
        return str(int(value))
    except Exception:
        return "0"


def _get_default_literal(enum_type):
    try:
        none_value = Enum.Parse(enum_type, "NONE")
        none_name = Enum.GetName(enum_type, none_value)
        if none_name is not None:
            return f"{get_clean_name(enum_type)}.{none_name}"
    except Exception:
        pass

    try:
        values = Enum.GetValues(enum_type)
        if len(values) > 0:
            return _get_enum_literal(values[0], enum_type)
    except Exception:
        pass

    return "0"


def _iter_supported_methods(inventory_item_type):
    if get_clean_name(inventory_item_type) != TARGET_CLASS_NAME:
        return

    methods = inventory_item_type.GetMethods(_get_method_flags())
    for method in methods:
        if method.Name not in SUPPORTED_METHODS:
            continue
        params = method.GetParameters()
        if params.Length != 1:
            continue

        param_type = params[0].ParameterType
        return_type = method.ReturnType
        if not param_type.IsEnum or not return_type.IsEnum:
            continue
        yield method


def get_inventory_item_method_enum_types(inventory_item_type):
    enum_types = []
    for method in _iter_supported_methods(inventory_item_type):
        param_type = method.GetParameters()[0].ParameterType
        return_type = method.ReturnType
        enum_types.append(param_type)
        enum_types.append(return_type)
    return enum_types


def collect_inventory_item_method_maps(inventory_item_type):
    maps = []

    for method in sorted(_iter_supported_methods(inventory_item_type), key=lambda x: x.MetadataToken):
        param_type = method.GetParameters()[0].ParameterType
        return_type = method.ReturnType
        default_literal = _get_default_literal(return_type)

        entries = []
        for value in Enum.GetValues(param_type):
            try:
                result = method.Invoke(None, [value])
            except Exception:
                continue

            key_literal = _get_enum_literal(value, param_type)
            value_literal = _get_enum_literal(result, return_type)
            if value_literal != default_literal:
                entries.append((key_literal, value_literal))

        maps.append(
            EnumMap(
                method_name=method.Name,
                param_enum_name=get_clean_name(param_type),
                return_enum_name=get_clean_name(return_type),
                default_literal=default_literal,
                entries=entries,
            )
        )

    return maps


def render_inventory_item_method_maps(class_name, method_maps):
    lines = []

    for method_map in method_maps:
        lines.append(
            f"  public static {method_map.method_name}(type: {method_map.param_enum_name}): {method_map.return_enum_name} {{"
        )
        lines.append("    switch (type) {")

        grouped_cases = {}
        for key_literal, value_literal in method_map.entries:
            grouped_cases.setdefault(value_literal, []).append(key_literal)

        for value_literal, key_literals in grouped_cases.items():
            for key_literal in key_literals:
                lines.append(f"      case {key_literal}:")
            lines.append(f"        return {value_literal};")

        lines.append("      default:")
        lines.append(f"        return {method_map.default_literal};")
        lines.append("    }")
        lines.append("  }")
        lines.append("")

    return lines

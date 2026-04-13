import glob
import os
import sys

try:
    import clr
    import System
    from System import Reflection, Enum, Byte, Array
except ImportError:
    print("[-] Error: pythonnet is not installed. Run: pip install pythonnet")
    sys.exit(1)

SCRIPT_NAME = "extraction/cli.py save-file"
ROOT_CLASS_NAME = "DataManager"
EXTRA_ROOT_CLASS_NAMES = ["CookingData"]
METHOD_OWNER_CLASS_NAMES = {"InventoryItem", "CookingData"}
EXTRA_STATIC_LIST_OWNER_CLASS_NAMES = {"TarotCards"}
STATIC_LIST_OWNER_CLASS_NAMES = set(
    [ROOT_CLASS_NAME.split(".")[-1]]
    + [name.split(".")[-1] for name in EXTRA_ROOT_CLASS_NAMES]
    + list(METHOD_OWNER_CLASS_NAMES)
    + list(EXTRA_STATIC_LIST_OWNER_CLASS_NAMES)
)

# Optional key remapping for edge-case MessagePack layouts.
KEY_OVERRIDES = {}

OUTPUT_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "src", "generated", "classes")
)
SCHEMA_OUTPUT_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "src", "generated", "schema")
)

TYPE_MAP = {
    "System.SByte": ("number", "0", True),
    "System.Byte": ("number", "0", True),
    "System.Int16": ("number", "0", True),
    "System.UInt16": ("number", "0", True),
    "System.Int32": ("number", "0", True),
    "System.UInt32": ("number", "0", True),
    "System.Int64": ("bigint", "0n", True),
    "System.UInt64": ("bigint", "0n", True),
    "System.Single": ("number", "0", True),
    "System.Double": ("number", "0", True),
    "System.String": ("string", '""', True),
    "System.Boolean": ("boolean", "false", True),
    "System.DateTime": ("Date", "new Date()", True),
    "UnityEngine.Vector2": ("Vector2", "new Vector2()", False),
    "UnityEngine.Vector3": ("Vector3", "new Vector3()", False),
    "UnityEngine.Vector2Int": ("Vector2Int", "new Vector2Int()", False),
    "UnityEngine.Vector3Int": ("Vector3Int", "new Vector3Int()", False),
}

UNITY_STRUCT_NAMES = ["Vector2", "Vector3", "Vector2Int", "Vector3Int"]

THIS_DIR = os.path.dirname(os.path.abspath(__file__))
GENERATORS_DIR = os.path.dirname(THIS_DIR)
TEMPLATE_DIR = os.path.join(GENERATORS_DIR, "templates")
BASE_TS_PATH = os.path.join(TEMPLATE_DIR, "MessagePackBase.ts")
CODEC_TS_PATH = os.path.join(TEMPLATE_DIR, "MessagePackCodec.ts")
UNITY_STRUCTS_TS_PATH = os.path.join(TEMPLATE_DIR, "UnityStructs.ts")
EXPORTED_CLASS_TS_PATH = os.path.join(TEMPLATE_DIR, "ExportedClass.ts")


def load_ts_template(path: str, label: str) -> str:
    if not os.path.exists(path):
        raise FileNotFoundError(f"Missing {label} template at: {path}")
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


BASE_CONTENT = load_ts_template(BASE_TS_PATH, "MessagePackBase.ts")
CODEC_CONTENT = load_ts_template(CODEC_TS_PATH, "MessagePackCodec.ts")
UNITY_STRUCTS_CONTENT = load_ts_template(UNITY_STRUCTS_TS_PATH, "UnityStructs.ts")
EXPORTED_CLASS_CONTENT = load_ts_template(EXPORTED_CLASS_TS_PATH, "ExportedClass.ts")


def load_dll_unsafe(path):
    if not os.path.exists(path):
        return False
    try:
        with open(path, "rb") as f:
            dll_bytes = f.read()
        Reflection.Assembly.Load(Array[Byte](dll_bytes))
        return True
    except Exception:
        try:
            Reflection.Assembly.LoadFrom(path)
            return True
        except Exception:
            return False


def load_assemblies(game_path):
    if "Managed" not in game_path:
        candidates = glob.glob(os.path.join(game_path, "*_Data", "Managed"))
        if not candidates:
            raise Exception("Could not locate 'Managed' folder.")
        managed_path = candidates[0]
    else:
        managed_path = game_path

    sys.path.append(managed_path)
    print(f"[*] Analysis Path: {managed_path}")

    priority = [
        "netstandard.dll",
        "System.Memory.dll",
        "Newtonsoft.Json.dll",
        "UnityEngine.CoreModule.dll",
        "MessagePack.dll",
        "MessagePack.Annotations.dll",
    ]
    for dll in priority:
        load_dll_unsafe(os.path.join(managed_path, dll))
    load_dll_unsafe(os.path.join(managed_path, "Assembly-CSharp.dll"))
    for dll in glob.glob(os.path.join(managed_path, "*.dll")):
        if os.path.basename(dll) not in priority:
            load_dll_unsafe(dll)


def get_clean_name(t):
    if t.IsGenericType:
        base = t.Name.split("`")[0]
        if t.IsNested:
            return get_clean_name(t.DeclaringType) + "_" + base
        return base
    if t.IsNested:
        return get_clean_name(t.DeclaringType) + "_" + t.Name
    return t.Name.replace("[]", "")


def get_key(m):
    for d in m.GetCustomAttributesData():
        if "KeyAttribute" in d.AttributeType.Name and d.ConstructorArguments.Count > 0:
            return d.ConstructorArguments[0].Value
    return None


def should_ignore(m):
    for d in m.GetCustomAttributesData():
        if d.AttributeType.Name in [
            "IgnoreMemberAttribute",
            "NonSerializedAttribute",
            "XmlIgnoreAttribute",
        ]:
            return True
    return False


def get_union_entries(t):
    entries = []
    for d in t.GetCustomAttributesData():
        if d.AttributeType.Name != "UnionAttribute":
            continue
        if d.ConstructorArguments.Count < 2:
            continue
        try:
            tag = int(d.ConstructorArguments[0].Value)
            sub_t = d.ConstructorArguments[1].Value
            if sub_t is not None:
                entries.append((tag, sub_t))
        except Exception:
            continue
    return entries


def is_nullable_value_type(t):
    try:
        return (
            t.IsGenericType
            and t.GetGenericTypeDefinition().FullName == "System.Nullable`1"
        )
    except Exception:
        return False


def is_list_like_type(t):
    if t is None:
        return False
    if t.IsArray:
        return True
    return t.IsGenericType and "List`" in t.Name


def get_list_element_type(t):
    if t is None:
        return None
    if t.IsArray:
        return t.GetElementType()
    if t.IsGenericType and "List`" in t.Name:
        args = t.GetGenericArguments()
        if args.Length > 0:
            return args[0]
    return None

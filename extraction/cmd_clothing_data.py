from __future__ import annotations

import argparse
import os
from dataclasses import dataclass
from pathlib import Path
from typing import List, Optional, Tuple, cast

import UnityPy
import UnityPy.classes

ENV_GAME_KEYS = ["UNITY_GAME_PATH", "GAME_PATH", "UNITY_GAME_DIR"]
DEFAULT_OUTPUT_DIR = Path("src/generated/data/clothing")
TARGET_SCRIPT_CLASS = "ClothingData"
TARGET_SCRIPT_ASSEMBLY = "Assembly-CSharp"
FALLBACK_SIGNATURES = (
    b"Clothes/",
    b"BODY_TOP",
    b"SLEEVE_RIGHT_TOP",
)


@dataclass(frozen=True)
class ClothingEntry:
    name: str
    path_id: int
    raw_data: bytes


def resolve_game_path(arg_game: Optional[str]) -> Path:
    if arg_game:
        path = Path(arg_game).expanduser()
        if not path.exists():
            raise SystemExit(f"ERROR: --game path does not exist: {path}")
        return path

    for key in ENV_GAME_KEYS:
        value = os.environ.get(key)
        if not value:
            continue
        path = Path(value).expanduser()
        if path.exists():
            return path

    raise SystemExit(
        "ERROR: Game path not provided.\n"
        "Provide --game <path> OR set one of these env vars:\n  - "
        + "\n  - ".join(ENV_GAME_KEYS)
    )


def normalize_game_root_or_data_folder(path: Path) -> Path:
    path = path.resolve()
    if path.name.endswith("_Data") and path.is_dir():
        return path.parent
    return path


def resolve_resources_assets(game_root_or_data: Path) -> Path:
    path = game_root_or_data.expanduser().resolve()

    if path.is_file():
        if path.name.lower() != "resources.assets":
            raise SystemExit(
                f"ERROR: Expected resources.assets file, got: {path.name}"
            )
        return path

    if not path.exists() or not path.is_dir():
        raise SystemExit(f"ERROR: Invalid game path: {path}")

    game_root = normalize_game_root_or_data_folder(path)
    direct_candidate = game_root / "Cult Of The Lamb_Data" / "resources.assets"
    if direct_candidate.exists():
        return direct_candidate

    data_folder_candidate = game_root / f"{game_root.name}_Data" / "resources.assets"
    if data_folder_candidate.exists():
        return data_folder_candidate

    fallback_candidates: List[Path] = []
    for candidate in game_root.rglob("resources.assets"):
        parent_name = candidate.parent.name
        if parent_name.endswith("_Data"):
            fallback_candidates.append(candidate)

    if len(fallback_candidates) == 1:
        return fallback_candidates[0]

    if len(fallback_candidates) > 1:
        preferred = [
            candidate
            for candidate in fallback_candidates
            if "cult of the lamb" in str(candidate).lower()
        ]
        if len(preferred) == 1:
            return preferred[0]
        raise SystemExit(
            "ERROR: Multiple resources.assets files found. "
            "Pass --resources-assets explicitly.\n"
            + "\n".join(f"  - {candidate}" for candidate in fallback_candidates)
        )

    raise SystemExit(
        f"ERROR: Could not locate resources.assets under: {game_root}\n"
        "Pass --resources-assets explicitly."
    )


def get_script_metadata(
    data: UnityPy.classes.MonoBehaviour,
) -> Tuple[str, str]:
    script = cast(UnityPy.classes.PPtr, data.m_Script)
    if int(script.m_PathID) == 0:
        return "", ""

    try:
        mono_script = script.deref().read(check_read=False)
    except Exception:
        return "", ""

    class_name = getattr(mono_script, "m_ClassName", "") or ""
    assembly_name = getattr(mono_script, "m_AssemblyName", "") or ""
    return class_name, assembly_name


def is_fallback_clothing(data: UnityPy.classes.MonoBehaviour, raw_data: bytes) -> bool:
    name = (data.m_Name or "").lower()
    has_name_hint = "clothing" in name or "robe" in name
    has_signatures = all(signature in raw_data for signature in FALLBACK_SIGNATURES)
    return has_name_hint and has_signatures


def extract_clothing_entries(
    resources_assets_path: Path,
) -> List[ClothingEntry]:
    env = UnityPy.load(str(resources_assets_path))

    by_script: List[ClothingEntry] = []
    by_fallback: List[ClothingEntry] = []

    for obj in env.objects:
        if obj.type.name != "MonoBehaviour":
            continue

        data = cast(UnityPy.classes.MonoBehaviour, obj.read(check_read=False))
        raw_data = obj.get_raw_data()
        default_name = f"MonoBehaviour_{obj.path_id}"
        entry_name = (data.m_Name or "").strip() or default_name
        entry = ClothingEntry(name=entry_name, path_id=int(obj.path_id), raw_data=raw_data)

        class_name, assembly_name = get_script_metadata(data)
        if class_name == TARGET_SCRIPT_CLASS and (
            not assembly_name or assembly_name == TARGET_SCRIPT_ASSEMBLY
        ):
            by_script.append(entry)
            continue

        if is_fallback_clothing(data, raw_data):
            by_fallback.append(entry)

    if by_script:
        return sorted(by_script, key=lambda entry: (entry.name.lower(), entry.path_id))

    if by_fallback:
        return sorted(by_fallback, key=lambda entry: (entry.name.lower(), entry.path_id))

    raise SystemExit(
        "ERROR: Could not find ClothingData MonoBehaviours in resources.assets "
        "(no script class match and no fallback signature match)."
    )


def sanitize_filename_stem(value: str) -> str:
    sanitized = value.strip().replace("/", "_").replace("\\", "_")
    for char in '<>:"|?*':
        sanitized = sanitized.replace(char, "_")
    sanitized = "_".join(part for part in sanitized.split() if part)
    return sanitized or "unnamed"


def write_entries(entries: List[ClothingEntry], out_dir: Path, clean: bool) -> List[Path]:
    out_dir.mkdir(parents=True, exist_ok=True)

    if clean:
        for existing in out_dir.glob("*.dat"):
            existing.unlink()

    written_paths: List[Path] = []
    used_names: set[str] = set()
    for entry in entries:
        stem = sanitize_filename_stem(entry.name)
        if stem in used_names:
            stem = f"{stem}_{entry.path_id}"
        used_names.add(stem)

        output_path = out_dir / f"{stem}.dat"
        output_path.write_bytes(entry.raw_data)
        written_paths.append(output_path)

    return written_paths


def run(
    *,
    game: Path,
    out_dir: Path,
    clean: bool = False,
    resources_assets: Path | None = None,
) -> None:
    if resources_assets is not None:
        resources_assets_path = resources_assets.expanduser().resolve()
    else:
        resources_assets_path = resolve_resources_assets(game)

    if not resources_assets_path.exists():
        raise SystemExit(
            f"ERROR: resources.assets does not exist: {resources_assets_path}"
        )

    out_dir = out_dir.expanduser().resolve()
    entries = extract_clothing_entries(resources_assets_path)
    written_paths = write_entries(entries, out_dir, clean=clean)

    print(f"Extracted {len(entries)} clothing entries")
    print(f"Source : {resources_assets_path}")
    print(f"Output : {out_dir}")
    if written_paths:
        print("Sample files:")
        for path in written_paths[:5]:
            print(f"  - {path.name}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Extract clothing .dat files from Unity resources.assets "
            "without relying on script/path IDs."
        )
    )
    parser.add_argument(
        "--game",
        default=None,
        help=(
            "Game root or *_Data folder. "
            "If omitted, reads UNITY_GAME_PATH/GAME_PATH/UNITY_GAME_DIR."
        ),
    )
    parser.add_argument(
        "--resources-assets",
        default=None,
        help="Explicit path to resources.assets (overrides --game).",
    )
    parser.add_argument(
        "--out-dir",
        default=str(DEFAULT_OUTPUT_DIR),
        help=f"Output directory for .dat files (default: {DEFAULT_OUTPUT_DIR.as_posix()})",
    )
    parser.add_argument(
        "--clean",
        action="store_true",
        help="Delete existing *.dat files in --out-dir before writing new files.",
    )
    args = parser.parse_args()

    if args.resources_assets:
        resources_assets_path = Path(args.resources_assets).expanduser().resolve()
    else:
        game_path = resolve_game_path(args.game)
        resources_assets_path = resolve_resources_assets(game_path)

    if not resources_assets_path.exists():
        raise SystemExit(
            f"ERROR: resources.assets does not exist: {resources_assets_path}"
        )

    out_dir = Path(args.out_dir).expanduser().resolve()
    entries = extract_clothing_entries(resources_assets_path)
    written_paths = write_entries(entries, out_dir, clean=bool(args.clean))

    print(f"Extracted {len(entries)} clothing entries")
    print(f"Source : {resources_assets_path}")
    print(f"Output : {out_dir}")
    if written_paths:
        print("Sample files:")
        for path in written_paths[:5]:
            print(f"  - {path.name}")


if __name__ == "__main__":
    main()

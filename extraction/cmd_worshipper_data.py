from __future__ import annotations

import argparse
import os
from pathlib import Path
from typing import List, Optional, cast

import UnityPy
import UnityPy.classes

ENV_GAME_KEYS = ["UNITY_GAME_PATH", "GAME_PATH", "UNITY_GAME_DIR"]
TARGET_GAMEOBJECT_NAME = "Worshipper Data"
DEFAULT_OUTPUT_PATH = Path("src/generated/data/Worshipper_Data.dat")
FALLBACK_SIGNATURES = (
    b"HEAD_SKIN_TOP",
    b"HEAD_SKIN_BTM",
    b"BODY_NAKED",
    b"ARM_LEFT_SKIN",
    b"ARM_RIGHT_SKIN",
    b"LEG_LEFT_SKIN",
    b"LEG_RIGHT_SKIN",
)


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


def extract_by_gameobject_name(env: UnityPy.environment.Environment) -> Optional[bytes]:
    for obj in env.objects:
        if obj.type.name != "GameObject":
            continue

        game_object = cast(UnityPy.classes.GameObject, obj.read())
        if game_object.m_Name != TARGET_GAMEOBJECT_NAME:
            continue

        components = cast(List[UnityPy.classes.ComponentPair], game_object.m_Component)
        for pair in components:
            component = pair.component
            if component.type.name != "MonoBehaviour":
                continue
            return component.deref().get_raw_data()

    return None


def extract_by_signature(env: UnityPy.environment.Environment) -> Optional[bytes]:
    for obj in env.objects:
        if obj.type.name != "MonoBehaviour":
            continue
        raw_data = obj.get_raw_data()
        if all(signature in raw_data for signature in FALLBACK_SIGNATURES):
            return raw_data
    return None


def extract_worshipper_data(resources_assets_path: Path) -> bytes:
    env = UnityPy.load(str(resources_assets_path))

    raw_data = extract_by_gameobject_name(env)
    if raw_data is not None:
        return raw_data

    raw_data = extract_by_signature(env)
    if raw_data is not None:
        return raw_data

    raise SystemExit(
        "ERROR: Could not find WorshipperData MonoBehaviour in resources.assets "
        "(no name match and no fallback signature match)."
    )


def run(
    *,
    game: Path,
    output_path: Path,
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

    output_path = output_path.expanduser().resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    raw_data = extract_worshipper_data(resources_assets_path)
    output_path.write_bytes(raw_data)

    print(f"Extracted {len(raw_data)} bytes")
    print(f"Source : {resources_assets_path}")
    print(f"Output : {output_path}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Extract Worshipper_Data.dat from Unity resources.assets "
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
        "--out",
        default=str(DEFAULT_OUTPUT_PATH),
        help=f"Output file path (default: {DEFAULT_OUTPUT_PATH.as_posix()})",
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

    output_path = Path(args.out).expanduser().resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    raw_data = extract_worshipper_data(resources_assets_path)
    output_path.write_bytes(raw_data)

    print(f"Extracted {len(raw_data)} bytes")
    print(f"Source : {resources_assets_path}")
    print(f"Output : {output_path}")


if __name__ == "__main__":
    main()

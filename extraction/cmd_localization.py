#!/usr/bin/env python3
"""
Parse I2 Localization Google Sheets web service response format.

This script replicates the parsing logic from LanguageSourceData.cs:Import_Google_Result()
to extract categories and their I2CSV data from the Google Sheets web service response,
then exports the data as JSON files organized by language.
"""

import argparse
from datetime import datetime, timezone
import os
import re
import json
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import requests

ENV_GAME_KEYS = ["UNITY_GAME_PATH", "GAME_PATH", "UNITY_GAME_DIR"]
WEB_SERVICE_URL_RE = re.compile(
    r"https?://script\.google\.com/macros/s/[A-Za-z0-9_-]+/exec"
)
SPREADSHEET_KEY_RE = re.compile(r"[A-Za-z0-9_-]{30,}")
SCRIPT_DEPLOYMENT_ID_RE = re.compile(r"/s/([A-Za-z0-9_-]+)/exec")
TARGET_LANGUAGE_SOURCE_NAME = "I2Languages"
TARGET_SCRIPT_CLASS = "LanguageSourceAsset"
TARGET_SCRIPT_NAMESPACE = "I2.Loc"
TARGET_SCRIPT_ASSEMBLY = "Assembly-CSharp"


def resolve_game_path(arg_game: Optional[str]) -> Optional[Path]:
    """Resolve game path from CLI arg or environment variables."""
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

    return None


def normalize_game_root_or_data_folder(path: Path) -> Path:
    path = path.resolve()
    if path.name.endswith("_Data") and path.is_dir():
        return path.parent
    return path


def resolve_resources_assets(game_root_or_data: Path) -> Path:
    path = game_root_or_data.expanduser().resolve()

    if path.is_file():
        if path.name.lower() != "resources.assets":
            raise SystemExit(f"ERROR: Expected resources.assets file, got: {path.name}")
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
        if candidate.parent.name.endswith("_Data"):
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


def _extract_ascii_runs(raw_data: bytes) -> List[str]:
    return [
        m.group(0).decode("ascii", errors="ignore")
        for m in re.finditer(rb"[\x20-\x7e]{4,}", raw_data)
    ]


def _extract_script_deployment_id(web_service_url: str) -> Optional[str]:
    match = SCRIPT_DEPLOYMENT_ID_RE.search(web_service_url)
    if not match:
        return None
    return match.group(1)


def _extract_sheet_key_candidates(
    text: str, script_deployment_id: Optional[str]
) -> List[str]:
    candidates: List[str] = []
    seen = set()

    for match in SPREADSHEET_KEY_RE.finditer(text):
        token = match.group(0)
        if script_deployment_id and token == script_deployment_id:
            continue
        if token not in seen:
            seen.add(token)
            candidates.append(token)

    return candidates


def _extract_source_from_raw_data(raw_data: bytes) -> Optional[Tuple[str, str]]:
    runs = _extract_ascii_runs(raw_data)
    for i, run in enumerate(runs):
        url_match = WEB_SERVICE_URL_RE.search(run)
        if not url_match:
            continue

        web_service_url = url_match.group(0)
        script_deployment_id = _extract_script_deployment_id(web_service_url)

        # In this asset, key is usually right after the URL run.
        for offset in range(1, 8):
            idx = i + offset
            if idx >= len(runs):
                break
            key_match = SPREADSHEET_KEY_RE.search(runs[idx])
            if not key_match:
                continue

            spreadsheet_key = key_match.group(0)
            if script_deployment_id and spreadsheet_key == script_deployment_id:
                continue
            return web_service_url, spreadsheet_key

        # Fallback: search a small byte window after URL for key-shaped tokens.
        encoded_url = web_service_url.encode("ascii")
        pos = raw_data.find(encoded_url)
        if pos >= 0:
            window_text = raw_data[pos : pos + 768].decode("ascii", errors="ignore")

            # Prefer an immediate "<url>,<sheet_key>#..." pattern if present.
            immediate_pattern = re.compile(
                re.escape(web_service_url)
                + r"[,\s]+([A-Za-z0-9_-]{30,})(?:[#,\s]|$)"
            )
            immediate_match = immediate_pattern.search(window_text)
            if immediate_match:
                spreadsheet_key = immediate_match.group(1)
                if not (script_deployment_id and spreadsheet_key == script_deployment_id):
                    return web_service_url, spreadsheet_key

            for spreadsheet_key in _extract_sheet_key_candidates(
                window_text, script_deployment_id
            ):
                return web_service_url, spreadsheet_key

    return None


def _is_target_language_source_asset(obj: object) -> bool:
    """
    Identify I2 localization source object by Unity object name + script metadata.

    We use check_read=False because this specific object can be huge and UnityPy's
    strict read check fails on some game builds.
    """
    try:
        behaviour = obj.read(check_read=False)
    except Exception:
        return False

    if getattr(behaviour, "m_Name", None) != TARGET_LANGUAGE_SOURCE_NAME:
        return False

    try:
        script_reader = behaviour.m_Script.deref()
        script = script_reader.read(check_read=False)
    except Exception:
        # Name match is still a strong signal; keep it as a valid target.
        return True

    return (
        getattr(script, "m_ClassName", None) == TARGET_SCRIPT_CLASS
        and getattr(script, "m_Namespace", None) == TARGET_SCRIPT_NAMESPACE
        and getattr(script, "m_AssemblyName", None) == TARGET_SCRIPT_ASSEMBLY
    )


def discover_localization_source(resources_assets_path: Path) -> Tuple[str, str]:
    """Discover web service URL + spreadsheet key from I2Languages data in resources.assets."""
    try:
        import UnityPy
    except ImportError as exc:
        raise RuntimeError(
            "UnityPy is required for automatic source discovery. "
            "Install it in your Python environment with: pip install UnityPy"
        ) from exc

    env = UnityPy.load(str(resources_assets_path))

    # Preferred path: look at the known I2 localization source object first.
    for obj in env.objects:
        if obj.type.name != "MonoBehaviour":
            continue
        if not _is_target_language_source_asset(obj):
            continue

        try:
            raw_data = obj.get_raw_data()
        except Exception:
            continue

        source = _extract_source_from_raw_data(raw_data)
        if source is not None:
            return source

    # Fallback: broad scan if target object detection fails on a future build.
    for obj in env.objects:
        if obj.type.name != "MonoBehaviour":
            continue
        try:
            raw_data = obj.get_raw_data()
        except Exception:
            continue
        source = _extract_source_from_raw_data(raw_data)
        if source is not None:
            return source

    raise RuntimeError(
        "Could not discover localization source from resources.assets. "
        "Pass --web-service-url and --spreadsheet-key explicitly."
    )


def resolve_localization_source(
    web_service_url: Optional[str],
    spreadsheet_key: Optional[str],
    game_path_arg: Optional[str],
    resources_assets_arg: Optional[str],
) -> Tuple[str, str, Optional[Path], str]:
    """
    Resolve URL/key from CLI args and/or auto-discovery from game files.

    Returns:
        (web_service_url, spreadsheet_key, discovered_from, source_kind)
    """
    discovered_from: Optional[Path] = None

    if web_service_url and spreadsheet_key:
        return web_service_url, spreadsheet_key, discovered_from, "explicit"

    resources_assets_path: Optional[Path] = None
    if resources_assets_arg:
        resources_assets_path = Path(resources_assets_arg).expanduser().resolve()
        if not resources_assets_path.exists():
            raise SystemExit(
                f"ERROR: --resources-assets does not exist: {resources_assets_path}"
            )
    else:
        game_path = resolve_game_path(game_path_arg)
        if game_path is not None:
            resources_assets_path = resolve_resources_assets(game_path)

    if resources_assets_path is not None:
        auto_url, auto_key = discover_localization_source(resources_assets_path)
        discovered_from = resources_assets_path
        if not web_service_url:
            web_service_url = auto_url
        if not spreadsheet_key:
            spreadsheet_key = auto_key

    missing_parts: List[str] = []
    if not web_service_url:
        missing_parts.append("web_service_url")
    if not spreadsheet_key:
        missing_parts.append("spreadsheet_key")

    if missing_parts:
        raise SystemExit(
            "ERROR: Could not resolve localization source (missing: "
            + ", ".join(missing_parts)
            + ").\n"
            "Provide both --web-service-url and --spreadsheet-key OR provide "
            "--game/--resources-assets (or env vars: "
            + ", ".join(ENV_GAME_KEYS)
            + ") for auto-discovery."
        )

    source_kind = "auto-discovered" if discovered_from else "explicit"
    return web_service_url, spreadsheet_key, discovered_from, source_kind


def fetch_i2_blob(web_service_url: str, spreadsheet_key: str, version: str = "0") -> str:
    """Fetch the I2 localization data blob from Google Sheets web service."""
    params = {
        "key": spreadsheet_key,
        "action": "GetLanguageSource",
        "version": version,
    }
    response = requests.get(
        web_service_url, params=params, timeout=300, allow_redirects=True
    )
    response.raise_for_status()
    return response.text


def parse_i2_response(json_string: str) -> Tuple[str, int, Dict[str, str]]:
    """
    Parse the I2 Google Sheets response format.

    Returns:
        Tuple of (version, script_version, categories_dict)
        where categories_dict maps category names to their I2CSV data
    """
    if not json_string or json_string == '""':
        raise ValueError("Empty or invalid response")

    version_match = re.search(r"version=([^,]+)", json_string)
    if not version_match:
        raise ValueError("Invalid Response: missing 'version=' field")
    version = version_match.group(1)

    script_version_match = re.search(r"script_version=([^,]+)", json_string)
    if not script_version_match:
        raise ValueError("Invalid Response: missing 'script_version=' field")
    script_version = int(script_version_match.group(1))

    if len(version) > 19:
        version = ""

    categories: Dict[str, str] = {}
    pos = 0

    while True:
        category_start = json_string.find("[i2category]", pos)
        if category_start < 0:
            break

        category_name_start = category_start + len("[i2category]")
        category_name_end = json_string.find("[/i2category]", category_name_start)
        if category_name_end < 0:
            break

        category_name = json_string[category_name_start:category_name_end]

        csv_data_start = category_name_end + len("[/i2category]")
        csv_data_end = json_string.find("[/i2csv]", csv_data_start)
        if csv_data_end < 0:
            break

        csv_data = json_string[csv_data_start:csv_data_end]
        categories[category_name] = csv_data

        pos = csv_data_end + len("[/i2csv]")

    return version, script_version, categories


def parse_i2csv_line(line: str) -> List[str]:
    """Parse a single I2CSV line using [*] as separator."""
    return line.split("[*]")


def parse_i2csv_data(i2csv_string: str) -> List[List[str]]:
    """Parse I2CSV data format (uses [*] for columns and [ln] for rows)."""
    rows: List[List[str]] = []
    lines = i2csv_string.split("[ln]")
    for line in lines:
        if line.strip():
            row = parse_i2csv_line(line)
            rows.append(row)
    return rows


def extract_languages_and_terms(
    categories: Dict[str, str],
) -> Tuple[Dict[str, str], Dict[str, Dict[str, Dict[str, str]]]]:
    """
    Extract language information and terms from all categories.

    Returns:
        Tuple of (languages_dict, terms_by_language_dict)
        where languages_dict maps language code to language name
        and terms_by_language_dict maps language name to {category: {term: translation}}
    """
    languages: Dict[str, str] = {}
    terms_by_language: Dict[str, Dict[str, Dict[str, str]]] = {}

    for category_name, csv_data in categories.items():
        rows = parse_i2csv_data(csv_data)
        if not rows:
            continue

        header = rows[0]
        language_indices: Dict[int, str] = {}

        for col_idx in range(3, len(header)):
            lang_code = header[col_idx].strip()
            if not lang_code:
                continue

            if lang_code.startswith("$"):
                lang_code = lang_code[1:]

            if lang_code not in languages:
                languages[lang_code] = lang_code

            language_indices[col_idx] = lang_code

        for row in rows[1:]:
            if not row or not row[0].strip():
                continue

            term_key = row[0].strip()

            for col_idx, lang_name in language_indices.items():
                if col_idx >= len(row):
                    continue

                translation = row[col_idx].strip()
                if not translation or translation == "-":
                    continue

                if lang_name not in terms_by_language:
                    terms_by_language[lang_name] = {}

                if category_name not in terms_by_language[lang_name]:
                    terms_by_language[lang_name][category_name] = {}

                terms_by_language[lang_name][category_name][term_key] = translation

    return languages, terms_by_language


def save_language_json_files(
    terms_by_language: Dict[str, Dict[str, Dict[str, str]]], output_dir: Path
) -> None:
    """Save each language's terms to a separate JSON file."""
    output_dir.mkdir(parents=True, exist_ok=True)

    for lang_name, categories_data in terms_by_language.items():
        safe_name = re.sub(r'[<>:"/\\|?*]', "_", lang_name)
        output_file = output_dir / f"{safe_name}.json"

        flattened_data: Dict[str, str] = {}
        for category_name, terms in categories_data.items():
            for term_key, translation in terms.items():
                flattened_data[f"{category_name}/{term_key}"] = translation

        flattened_data["___exportedAt"] = datetime.now(timezone.utc).isoformat()

        with output_file.open("w", encoding="utf-8") as f:
            json.dump(flattened_data, f, ensure_ascii=False, indent=2, sort_keys=True)

        total_terms = sum(len(terms) for terms in categories_data.values())
        print(f"Saved: {output_file} ({total_terms} terms)")


def run(
    *,
    game: Path,
    output_dir: Path,
    web_service_url: str | None = None,
    spreadsheet_key: str | None = None,
    version: str = "0",
    print_source_only: bool = False,
    resources_assets: Path | None = None,
) -> None:
    output_dir = output_dir.expanduser().resolve()
    resources_assets_arg = (
        str(resources_assets.expanduser().resolve()) if resources_assets is not None else None
    )

    resolved_url, resolved_key, discovered_from, source_kind = resolve_localization_source(
        web_service_url,
        spreadsheet_key,
        str(game),
        resources_assets_arg,
    )

    print("Localization source:")
    print(f"  web_service_url : {resolved_url}")
    print(f"  spreadsheet_key : {resolved_key}")
    if discovered_from:
        print(f"  discovered_from : {discovered_from}")
    else:
        print(f"  source_mode     : {source_kind}")

    if print_source_only:
        return

    print("Fetching data from Google Sheets...")
    blob = fetch_i2_blob(resolved_url, resolved_key, version=version)

    print(f"Parsing response ({len(blob)} bytes)...")
    parsed_version, script_version, categories = parse_i2_response(blob)

    print(f"Version: {parsed_version}")
    print(f"Script Version: {script_version}")
    print(f"Categories found: {len(categories)}")
    for cat_name in categories.keys():
        print(f"  - {cat_name}")

    print("\nExtracting languages and terms...")
    languages, terms_by_language = extract_languages_and_terms(categories)

    print(f"Languages found: {len(languages)}")
    for lang_name in sorted(languages.keys()):
        print(f"  - {lang_name}")

    print(f"\nSaving JSON files to {output_dir}...")
    save_language_json_files(terms_by_language, output_dir)
    print("Done!")


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Download and parse I2 localization data from Cult of the Lamb Google "
            "Sheets service, then export per-language JSON files."
        )
    )
    parser.add_argument(
        "output_dir",
        nargs="?",
        default=".",
        help="Directory to save JSON files (default: current directory).",
    )
    parser.add_argument(
        "--game",
        default=None,
        help=(
            "Game root or *_Data folder. If omitted, reads "
            "UNITY_GAME_PATH/GAME_PATH/UNITY_GAME_DIR."
        ),
    )
    parser.add_argument(
        "--resources-assets",
        default=None,
        help="Explicit path to resources.assets (overrides --game).",
    )
    parser.add_argument(
        "--web-service-url",
        default=None,
        help="Override I2 Google Apps Script URL.",
    )
    parser.add_argument(
        "--spreadsheet-key",
        default=None,
        help="Override I2 Google Spreadsheet key.",
    )
    parser.add_argument(
        "--version",
        default="0",
        help="Version parameter passed to GetLanguageSource (default: 0).",
    )
    parser.add_argument(
        "--print-source-only",
        action="store_true",
        help="Resolve and print source URL/key, then exit.",
    )
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    web_service_url, spreadsheet_key, discovered_from, source_kind = (
        resolve_localization_source(
            args.web_service_url,
            args.spreadsheet_key,
            args.game,
            args.resources_assets,
        )
    )

    print("Localization source:")
    print(f"  web_service_url : {web_service_url}")
    print(f"  spreadsheet_key : {spreadsheet_key}")
    if discovered_from:
        print(f"  discovered_from : {discovered_from}")
    else:
        print(f"  source_mode     : {source_kind}")

    if args.print_source_only:
        return

    print("Fetching data from Google Sheets...")
    blob = fetch_i2_blob(web_service_url, spreadsheet_key, version=args.version)

    print(f"Parsing response ({len(blob)} bytes)...")
    version, script_version, categories = parse_i2_response(blob)

    print(f"Version: {version}")
    print(f"Script Version: {script_version}")
    print(f"Categories found: {len(categories)}")
    for cat_name in categories.keys():
        print(f"  - {cat_name}")

    print("\nExtracting languages and terms...")
    languages, terms_by_language = extract_languages_and_terms(categories)

    print(f"Languages found: {len(languages)}")
    for lang_name in sorted(languages.keys()):
        print(f"  - {lang_name}")

    print(f"\nSaving JSON files to {output_dir}...")
    save_language_json_files(terms_by_language, output_dir)
    print("Done!")


if __name__ == "__main__":
    main()

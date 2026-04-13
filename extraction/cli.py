from __future__ import annotations

import argparse
from pathlib import Path

from parser_generator import generate_parsers

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_OUTPUT_ROOT = (SCRIPT_DIR / ".." / "src" / "generated").resolve()


def resolve_existing_path(value: str) -> Path:
    path = Path(value).expanduser().resolve()
    if not path.exists():
        raise SystemExit(f"ERROR: path does not exist: {path}")
    return path


def resolve_optional_path(value: str | None) -> Path | None:
    if value is None:
        return None
    return Path(value).expanduser().resolve()


def get_output_root(raw_output_root: str) -> Path:
    return Path(raw_output_root).expanduser().resolve()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Unified extraction/generation CLI for Cult of the Lamb data."
    )
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument(
        "--game",
        required=True,
        help="Game root path or *_Data folder path (required).",
    )
    common.add_argument(
        "--output-root",
        default=str(DEFAULT_OUTPUT_ROOT),
        help=(
            "Base output directory used by subcommand defaults "
            f"(default: {DEFAULT_OUTPUT_ROOT})"
        ),
    )

    subparsers = parser.add_subparsers(dest="command", required=True)

    save_file = subparsers.add_parser(
        "save-file",
        parents=[common],
        help="Generate TypeScript classes and schema (compact mode by default).",
    )
    save_file.add_argument(
        "--full-schema",
        action="store_true",
        help="Generate full schema without focused pruning.",
    )
    save_file.add_argument(
        "--full-classes",
        action="store_true",
        help="Generate full classes without focused member filtering.",
    )
    save_file.add_argument(
        "--classes-dir",
        default=None,
        help="Override classes output directory (default: <output-root>/classes).",
    )
    save_file.add_argument(
        "--schema-dir",
        default=None,
        help="Override schema output directory (default: <output-root>/schema).",
    )

    assets = subparsers.add_parser(
        "assets",
        parents=[common],
        help="Extract text assets and atlas-referenced textures.",
    )
    assets.add_argument(
        "--output-dir",
        default=None,
        help="Override output directory (default: <output-root>/data/assets).",
    )

    worshipper = subparsers.add_parser(
        "worshipper",
        parents=[common],
        help="Extract Worshipper_Data.dat.",
    )
    worshipper.add_argument(
        "--resources-assets",
        default=None,
        help="Explicit path to resources.assets (overrides game path resolution).",
    )
    worshipper.add_argument(
        "--out",
        default=None,
        help="Output file path (default: <output-root>/data/Worshipper_Data.dat).",
    )

    clothing = subparsers.add_parser(
        "clothing",
        parents=[common],
        help="Extract clothing .dat files.",
    )
    clothing.add_argument(
        "--resources-assets",
        default=None,
        help="Explicit path to resources.assets (overrides game path resolution).",
    )
    clothing.add_argument(
        "--out-dir",
        default=None,
        help="Output directory (default: <output-root>/data/clothing).",
    )
    clothing.add_argument(
        "--clean",
        action="store_true",
        help="Delete existing *.dat files in output dir before writing.",
    )

    localization = subparsers.add_parser(
        "localization",
        parents=[common],
        help="Download/parse localization and export per-language JSON files.",
    )
    localization.add_argument(
        "output_dir",
        nargs="?",
        default=None,
        help="Output directory (default: <output-root>/translations).",
    )
    localization.add_argument(
        "--output-dir",
        dest="output_dir_override",
        default=None,
        help="Output directory override (same effect as positional output_dir).",
    )
    localization.add_argument(
        "--resources-assets",
        default=None,
        help="Explicit path to resources.assets (overrides game path resolution).",
    )
    localization.add_argument(
        "--web-service-url",
        default=None,
        help="Override I2 Google Apps Script URL.",
    )
    localization.add_argument(
        "--spreadsheet-key",
        default=None,
        help="Override I2 Google Spreadsheet key.",
    )
    localization.add_argument(
        "--version",
        default="0",
        help="Version parameter passed to GetLanguageSource (default: 0).",
    )
    localization.add_argument(
        "--print-source-only",
        action="store_true",
        help="Resolve and print source URL/key, then exit.",
    )

    parsers = subparsers.add_parser(
        "parsers",
        parents=[common],
        help="Generate shared parser files under generated/parser.",
    )
    parsers.add_argument(
        "--output-dir",
        default=None,
        help="Output directory (default: <output-root>/parser).",
    )

    subparsers.add_parser(
        "all",
        parents=[common],
        help="Run save-file (compact) + worshipper + clothing + assets + localization + parsers.",
    )

    return parser


def cmd_save_file(args: argparse.Namespace, game: Path, output_root: Path) -> None:
    from save_file_generator.cli import run as run_save_file

    classes_dir = (
        Path(args.classes_dir).expanduser().resolve()
        if args.classes_dir
        else (output_root / "classes").resolve()
    )
    schema_dir = (
        Path(args.schema_dir).expanduser().resolve()
        if args.schema_dir
        else (output_root / "schema").resolve()
    )
    run_save_file(
        game=game,
        output_dir=classes_dir,
        schema_output_dir=schema_dir,
        full_schema=bool(args.full_schema),
        full_classes=bool(args.full_classes),
    )


def cmd_assets(args: argparse.Namespace, game: Path, output_root: Path) -> None:
    from cmd_assets import run as run_assets

    output_dir = (
        Path(args.output_dir).expanduser().resolve()
        if args.output_dir
        else (output_root / "data" / "assets").resolve()
    )
    run_assets(game=game, output_dir=output_dir, generated_root=output_root)


def cmd_worshipper(args: argparse.Namespace, game: Path, output_root: Path) -> None:
    from cmd_worshipper_data import run as run_worshipper

    output_path = (
        Path(args.out).expanduser().resolve()
        if args.out
        else (output_root / "data" / "Worshipper_Data.dat").resolve()
    )
    resources_assets = resolve_optional_path(args.resources_assets)
    run_worshipper(
        game=game,
        output_path=output_path,
        resources_assets=resources_assets,
    )


def cmd_clothing(args: argparse.Namespace, game: Path, output_root: Path) -> None:
    from cmd_clothing_data import run as run_clothing

    out_dir = (
        Path(args.out_dir).expanduser().resolve()
        if args.out_dir
        else (output_root / "data" / "clothing").resolve()
    )
    resources_assets = resolve_optional_path(args.resources_assets)
    run_clothing(
        game=game,
        out_dir=out_dir,
        clean=bool(args.clean),
        resources_assets=resources_assets,
    )


def cmd_localization(args: argparse.Namespace, game: Path, output_root: Path) -> None:
    from cmd_localization import run as run_localization

    raw_output_dir = args.output_dir_override or args.output_dir
    output_dir = (
        Path(raw_output_dir).expanduser().resolve()
        if raw_output_dir
        else (output_root / "translations").resolve()
    )
    resources_assets = resolve_optional_path(args.resources_assets)
    run_localization(
        game=game,
        output_dir=output_dir,
        web_service_url=args.web_service_url,
        spreadsheet_key=args.spreadsheet_key,
        version=args.version,
        print_source_only=bool(args.print_source_only),
        resources_assets=resources_assets,
    )


def cmd_parsers(args: argparse.Namespace, output_root: Path) -> None:
    output_dir = (
        Path(args.output_dir).expanduser().resolve()
        if args.output_dir
        else (output_root / "parser").resolve()
    )
    written = generate_parsers(output_dir)
    print(f"Generated {len(written)} parser files in {output_dir}")
    for path in written:
        print(f"  - {path.name}")


def cmd_all(args: argparse.Namespace, game: Path, output_root: Path) -> None:
    from cmd_assets import run as run_assets
    from cmd_clothing_data import run as run_clothing
    from cmd_localization import run as run_localization
    from cmd_worshipper_data import run as run_worshipper
    from save_file_generator.cli import run as run_save_file

    run_save_file(
        game=game,
        output_dir=(output_root / "classes").resolve(),
        schema_output_dir=(output_root / "schema").resolve(),
        full_schema=False,
        full_classes=False,
    )
    run_worshipper(
        game=game,
        output_path=(output_root / "data" / "Worshipper_Data.dat").resolve(),
        resources_assets=None,
    )
    run_clothing(
        game=game,
        out_dir=(output_root / "data" / "clothing").resolve(),
        clean=False,
        resources_assets=None,
    )
    run_assets(
        game=game,
        output_dir=(output_root / "data" / "assets").resolve(),
        generated_root=output_root,
    )
    run_localization(
        game=game,
        output_dir=(output_root / "translations").resolve(),
    )
    cmd_parsers(
        argparse.Namespace(output_dir=str((output_root / "parser").resolve())),
        output_root,
    )


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    game = resolve_existing_path(args.game)
    output_root = get_output_root(args.output_root)
    output_root.mkdir(parents=True, exist_ok=True)

    if args.command == "save-file":
        cmd_save_file(args, game, output_root)
        return
    if args.command == "assets":
        cmd_assets(args, game, output_root)
        return
    if args.command == "worshipper":
        cmd_worshipper(args, game, output_root)
        return
    if args.command == "clothing":
        cmd_clothing(args, game, output_root)
        return
    if args.command == "localization":
        cmd_localization(args, game, output_root)
        return
    if args.command == "parsers":
        cmd_parsers(args, output_root)
        return
    if args.command == "all":
        cmd_all(args, game, output_root)
        return

    raise SystemExit(f"Unknown command: {args.command}")


if __name__ == "__main__":
    main()

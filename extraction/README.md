# Unified Extraction CLI

All extraction/generation commands are now consolidated in `extraction/cli.py`.

## Python Environment

Use the local `.py` virtual environment:

```powershell
.py\Scripts\python extraction\cli.py --help
```

## Required Argument

All subcommands require `--game` and do not use environment/default game paths.

## Commands

- `save-file` (compact/focused by default)
- `assets`
- `worshipper`
- `clothing`
- `localization`
- `parsers`
- `all`

## Examples

```powershell
.py\Scripts\python extraction\cli.py save-file --game "path to the game"
.py\Scripts\python extraction\cli.py parsers --game "path to the game"
.py\Scripts\python extraction\cli.py all --game "path to the game"
```

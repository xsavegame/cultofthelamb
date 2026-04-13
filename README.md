# Cult of the Lamb Save Editor

A fan-made web save editor for **Cult of the Lamb** built with Vue 3 + Vuetify.
Load your save file, edit key game data, then export and place the updated file
back into your save folder.

> [!WARNING]
> Always back up your original save before editing.

## Inspiration

This project is inspired by:

- [xhayper/Cult-of-the-Lamb-Save-Editor](https://github.com/xhayper/Cult-of-the-Lamb-Save-Editor)
- [osoclos/cultivis](https://github.com/osoclos/cultivis)

## Features

- Main Data editor
  - Cult name and current day
  - Heart stats (red, blue, black, spirit, and DLC hearts when available)
  - Cult traits/doctrines
  - Cooking recipe discovery
- Inventory editor
  - Search by name/enum/type
  - Add, edit, remove items
  - Duplicate item merge and quantity safeguards
- Followers editor
  - Edit follower profile, stats, traits, and appearance
  - Create new followers
  - Move followers between alive/recruit/dead collections
  - Revive dead followers
- Tarot cards editor
  - Search and toggle unlock state
- Save import/export
  - Supports modern save files (`slot_{index}.mp`)

## Getting Started

### Requirements

- Node.js 22+
- pnpm

### Install

```bash
pnpm install
```

### Run in development

```bash
pnpm dev
```

Default dev server: `http://localhost:3000`

### Build and preview

```bash
pnpm build
pnpm preview
```

### Lint

```bash
pnpm lint
pnpm lint:fix
```

## Usage

1. Start the app and upload your save file.
2. Edit data across Main Data, Inventory, Followers, and Tarot Cards.
3. Click the save/export button in the top bar to download the updated file.
4. Replace your original save in the game save directory.

Save directory hints:

- Windows: `%USERPROFILE%\AppData\LocalLow\Massive Monster\Cult Of The Lamb\saves`
- macOS: `~/Library/Application Support/Massive Monster/Cult Of The Lamb/saves`

## Generate Assets

This project includes a unified extraction CLI under `extraction/` to regenerate
game-derived files (assets, parsers, classes, schema, and translations).

### Python setup (Bash)

```bash
python3 -m venv .py
./.py/bin/python -m pip install -r extraction/requirements.txt
```

### Generate only assets

```bash
./.py/bin/python extraction/cli.py assets --game "/path/to/Cult of the Lamb"
```

Default output:

- `src/generated/data/assets/` (text assets, atlas-related textures)
- `src/generated/version.ts` (extracted game version)

### Generate everything in one command

```bash
./.py/bin/python extraction/cli.py all --game "/path/to/Cult of the Lamb"
```

This runs:

- `save-file`
- `worshipper`
- `clothing`
- `assets`
- `localization`
- `parsers`

## Optional App Metadata

You can set `.env` values to show build/repo metadata in the app info dialog:

```env
VITE_APP_BASE_URL=
VITE_APP_OWNER=
VITE_APP_REPOSITORY_URL=
VITE_APP_COMMIT_HASH=
VITE_APP_VERSION=
VITE_APP_BUILT_DATE=
```

## Disclaimer

This project is unofficial and is not affiliated with Massive Monster or
Devolver Digital.

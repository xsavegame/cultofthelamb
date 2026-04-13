from __future__ import annotations

import sys


def main() -> int:
    print(
        "ERROR: extraction/extract_enum.py has been removed from the unified workflow.",
        file=sys.stderr,
    )
    print(
        "Use extraction/cli.py save-file for generation tasks.",
        file=sys.stderr,
    )
    return 2


if __name__ == "__main__":
    raise SystemExit(main())

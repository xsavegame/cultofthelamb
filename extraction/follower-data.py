from __future__ import annotations

import sys


def main() -> int:
    print(
        "ERROR: extraction/follower-data.py has been removed.",
        file=sys.stderr,
    )
    print(
        "Use extraction/cli.py worshipper instead.",
        file=sys.stderr,
    )
    return 2


if __name__ == "__main__":
    raise SystemExit(main())

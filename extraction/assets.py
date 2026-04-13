from __future__ import annotations

import subprocess
import sys
from pathlib import Path


def main() -> int:
    print(
        "DEPRECATED: extraction/assets.py is deprecated. "
        "Use extraction/cli.py assets instead.",
        file=sys.stderr,
    )
    cli_path = Path(__file__).resolve().with_name("cli.py")
    cmd = [sys.executable, str(cli_path), "assets", *sys.argv[1:]]
    return subprocess.call(cmd)


if __name__ == "__main__":
    raise SystemExit(main())

"""``python -m automation <command>`` entry point."""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from romdisco.cli import main  # noqa: E402

if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Entry point: python rom_discovery.py <command>

  discover --device "Xiaomi Pad 5" --codename nabu
  validate
  export roms.json
  inspect-source xdaforums.com
  test
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from romdisco.cli import main  # noqa: E402

if __name__ == "__main__":
    raise SystemExit(main())

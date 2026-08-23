"""Field extraction: ROM family, Android version, ROM version, build date.

Rules: never guess. Numbers only become an Android version when they appear next
to explicit Android markers (or in the XDA ``[13]`` tag convention); a ROM
version only counts when adjacent to its family name.
"""

from __future__ import annotations

import re
from typing import Optional

from .models import ALLOWED_FAMILIES

ANDROID_MAX = 17

FAMILY_ALIASES: dict[str, str] = {
    "lineageos": "LineageOS", "lineage": "LineageOS", "los": "LineageOS",
    "cyanogenmod": "LineageOS",
    "crdroid": "crDroid",
    "pixelexperience": "Pixel Experience",
    "evolutionx": "Evolution X", "evox": "Evolution X",
    "arrowos": "ArrowOS",
    "pixelos": "PixelOS",
    "derpfest": "DerpFest",
    "projectelixir": "Project Elixir", "elixiros": "Project Elixir",
    "risingos": "RisingOS",
    "voltageos": "VoltageOS",
    "superioros": "SuperiorOS",
    "resurrectionremix": "Resurrection Remix",
    "havocos": "Havoc-OS", "havoc": "Havoc-OS",
    "paranoidandroid": "Paranoid Android", "aospa": "Paranoid Android",
    "calyxos": "CalyxOS",
    "grapheneos": "GrapheneOS",
    "eos": "/e/OS", "efoundation": "/e/OS",
    "iodeos": "iodeOS", "iode": "iodeOS",
    "divestos": "DivestOS",
    "oneui": "One UI",
    "hyperos": "HyperOS",
    "miui": "MIUI",
    "coloros": "ColorOS",
    "oxygenos": "OxygenOS", "oos": "OxygenOS",
    "realmeui": "Realme UI",
    "funtouchos": "Funtouch OS",
    "originos": "OriginOS",
    "nothingos": "Nothing OS",
    "magicos": "MagicOS",
}

_LEGACY = {
    "2.3": "Android 2.3 Gingerbread", "3.0": "Android 3.0 Honeycomb",
    "4.0": "Android 4.0 Ice Cream Sandwich", "4.1": "Android 4.1 Jelly Bean",
    "4.4": "Android 4.4 KitKat", "5.0": "Android 5.0 Lollipop",
    "6.0": "Android 6.0 Marshmallow", "7.0": "Android 7.0 Nougat",
    "8.0": "Android 8.0 Oreo", "9.0": "Android 9 Pie",
}

_NAMED = [
    (r"gingerbread", "Android 2.3 Gingerbread"),
    (r"honeycomb", "Android 3.0 Honeycomb"),
    (r"ice ?cream ?sandwich", "Android 4.0 Ice Cream Sandwich"),
    (r"jelly ?bean", "Android 4.1 Jelly Bean"),
    (r"kit ?kat", "Android 4.4 KitKat"),
    (r"lollipop", "Android 5.0 Lollipop"),
    (r"marshmallow", "Android 6.0 Marshmallow"),
    (r"nougat", "Android 7.0 Nougat"),
    (r"oreo", "Android 8.0 Oreo"),
    (r"\bpie\b", "Android 9 Pie"),
]


def _key(text: str) -> str:
    return re.sub(r"[^a-z0-9]", "", text.lower())


def normalize_family(text: Optional[str]) -> Optional[str]:
    """Map free text onto one of ALLOWED_FAMILIES, else None (never invents)."""
    if not text:
        return None
    k = _key(text)
    if not k:
        return None
    if k in FAMILY_ALIASES:
        return FAMILY_ALIASES[k]
    for family in ALLOWED_FAMILIES:
        if k == _key(family):
            return family
    best, best_len = None, 0
    for alias, family in FAMILY_ALIASES.items():
        if len(alias) >= 4 and len(alias) > best_len and alias in k:
            best, best_len = family, len(alias)
    if best:
        return best
    for family in ALLOWED_FAMILIES:
        fk = _key(family)
        if len(fk) >= 5 and fk in k and len(fk) > best_len:
            best, best_len = family, len(fk)
    return best


def parse_android_version(text: Optional[str]) -> Optional[str]:
    if not text:
        return None
    t = re.sub(r"\s+", " ", text)
    m = re.search(r"\bandroid[\s\-_]*(?:os[\s\-_]*)?v?(\d{1,2})(?:\.(\d))?", t, re.I)
    if m:
        major, minor = int(m.group(1)), int(m.group(2) or 0)
        if 1 <= major <= ANDROID_MAX:
            if major <= 9:
                legacy = _LEGACY.get(f"{major}.{minor}")
                if legacy:
                    return legacy
            else:
                return f"Android {major}"
    for pattern, label in _NAMED:
        if re.search(pattern, t, re.I):
            return label
    m = re.search(r"\[(\d{1,2})(?:\.0)?\]", t)
    if m:
        major = int(m.group(1))
        if 10 <= major <= ANDROID_MAX:
            return f"Android {major}"
    return None


def parse_rom_version(text: Optional[str], family: Optional[str]) -> Optional[str]:
    if not text or not family:
        return None
    t = re.sub(r"\s+", " ", text)
    letters = [c for c in family if c.isalnum()]
    pattern = "".join(f"{re.escape(c)}[^a-z0-9]*" for c in letters)
    m = re.search(rf"{pattern}\s*v?(\d{{1,2}}(?:\.\d{{1,3}}){{0,2}})", t, re.I)
    if not m:
        return None
    before = t[max(0, m.start() - 12):m.start()].lower()
    if "android" in before:
        return None
    return m.group(1)


def parse_build_date(text: Optional[str]) -> Optional[str]:
    """Return an ISO date when a build date is explicitly present."""
    if not text:
        return None
    m = re.search(r"\b(20\d{2})[-/.](\d{2})[-/.](\d{2})\b", text)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    m = re.search(r"\b(20\d{2})(\d{2})(\d{2})\b", text)
    if m:
        y, mo, d = m.groups()
        if 1 <= int(mo) <= 12 and 1 <= int(d) <= 31:
            return f"{y}-{mo}-{d}"
    return None


ARTIFACT_RE = re.compile(
    r"https?://[^\s\"'<>]+?\.(?:zip|img|tar(?:\.md5)?|apk|xz|gz)(?:\?[^\s\"'<>]*)?", re.I
)


def find_artifacts(text: Optional[str]) -> list[str]:
    if not text:
        return []
    out: list[str] = []
    for url in ARTIFACT_RE.findall(text):
        if url not in out:
            out.append(url)
    return out

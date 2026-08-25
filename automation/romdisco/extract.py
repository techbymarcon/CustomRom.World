"""Field extraction: ROM family, Android version, ROM version, build date.

Rules: never guess. Numbers only become an Android version when they appear next
to explicit Android markers (or in the XDA ``[13]`` tag convention); a ROM
version only counts when adjacent to its family name.
"""

from __future__ import annotations

import re
from typing import Optional

from .models import ALLOWED_FAMILIES

ANDROID_MAX = 18

LINEAGE_TO_ANDROID: dict[int, str] = {
    24: "Android 17",
    23: "Android 16",
    22: "Android 15",
    21: "Android 14",
    20: "Android 13",
    19: "Android 12",
    18: "Android 11",
    17: "Android 10",
    16: "Android 9 Pie",
    15: "Android 8.0 Oreo",
    14: "Android 7.0 Nougat",
    13: "Android 6.0 Marshmallow",
    12: "Android 5.0 Lollipop",
    11: "Android 4.4 KitKat",
}

CRDROID_TO_ANDROID: dict[int, str] = {
    13: "Android 17",
    12: "Android 16",
    11: "Android 15",
    10: "Android 14",
    9: "Android 13",
    8: "Android 12",
    7: "Android 11",
    6: "Android 10",
    5: "Android 9 Pie",
    4: "Android 8.0 Oreo",
}

EVOLUTION_TO_ANDROID: dict[int, str] = {
    12: "Android 17",
    11: "Android 16",
    10: "Android 15",
    9: "Android 14",
    8: "Android 13",
    7: "Android 12",
    6: "Android 11",
}

HAVOC_TO_ANDROID: dict[int, str] = {
    5: "Android 12",
    4: "Android 11",
    3: "Android 10",
    2: "Android 9 Pie",
}

RESURRECTION_REMIX_TO_ANDROID: dict[int, str] = {
    8: "Android 10",
    7: "Android 9 Pie",
    6: "Android 8.0 Oreo",
    5: "Android 7.0 Nougat",
}

FAMILY_ALIASES: dict[str, str] = {
    "lineageos": "LineageOS", "lineage": "LineageOS", "los": "LineageOS",
    "cyanogenmod": "LineageOS",
    "crdroid": "crDroid", "crdroidandroid": "crDroid",
    "pixelexperience": "Pixel Experience", "pe": "Pixel Experience",
    "evolutionx": "Evolution X", "evox": "Evolution X",
    "arrowos": "ArrowOS",
    "pixelos": "PixelOS",
    "derpfest": "DerpFest",
    "projectelixir": "Project Elixir", "elixiros": "Project Elixir",
    "risingos": "RisingOS",
    "voltageos": "VoltageOS",
    "superioros": "SuperiorOS",
    "resurrectionremix": "Resurrection Remix", "rr": "Resurrection Remix",
    "havocos": "Havoc-OS", "havoc": "Havoc-OS",
    "paranoidandroid": "Paranoid Android", "aospa": "Paranoid Android",
    "calyxos": "CalyxOS", "calyx": "CalyxOS",
    "grapheneos": "GrapheneOS", "graphene": "GrapheneOS",
    "eos": "/e/OS", "efoundation": "/e/OS",
    "iodeos": "iodeOS", "iode": "iodeOS",
    "divestos": "DivestOS",
    "namelessaosp": "Nameless-AOSP", "nameless": "Nameless-AOSP",
    "projectmatrixx": "ProjectMatrixx", "matrixx": "ProjectMatrixx",
    "ancientos": "AncientOS", "ancientrom": "AncientOS", "ancient": "AncientOS",
    "infinityx": "Infinity-X",
    "pixelextended": "Pixel Extended", "peextended": "Pixel Extended",
    "alphadroid": "AlphaDroid",
    "projectblaze": "ProjectBlaze", "blaze": "ProjectBlaze",
    "mokee": "MoKee", "mokeedev": "MoKee",
    "aicp": "AICP",
    "omnirom": "OmniROM", "omni": "OmniROM",
    "xiaomieu": "Xiaomi.eu", "eu": "Xiaomi.eu",
    "neotericos": "Neoteric-OS", "neoteric": "Neoteric-OS",
    "jaguarrom": "Jaguar ROM", "jaguar": "Jaguar ROM",
    "oneui": "One UI", "oneuiport": "One UI",
    "hyperos": "HyperOS", "hyperosport": "HyperOS",
    "miui": "MIUI", "miuiport": "MIUI",
    "coloros": "ColorOS", "colorosport": "ColorOS",
    "oxygenos": "OxygenOS", "oos": "OxygenOS", "oxygenosport": "OxygenOS",
    "realmeui": "Realme UI",
    "funtouchos": "Funtouch OS",
    "originos": "OriginOS",
    "nothingos": "Nothing OS",
    "magicos": "MagicOS",
    "zenui": "ZenUI",
    "flyme": "Flyme", "flymeos": "Flyme",
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

def parse_android_version(text: Optional[str], family: Optional[str] = None) -> Optional[str]:
    if not text:
        return None
    t = re.sub(r"\s+", " ", text)

    # 1. Direct explicit "Android <N>"
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

    # 2. Named releases (Pie, Oreo, Nougat, etc.)
    for pattern, label in _NAMED:
        if re.search(pattern, t, re.I):
            return label

    # 3. XDA bracket convention: [13], [14], [15], [16], [11.0], [12.1]
    m = re.search(r"\[(\d{1,2})(?:\.(\d))?\]", t)
    if m:
        major = int(m.group(1))
        if 10 <= major <= ANDROID_MAX:
            return f"Android {major}"

    # 4. Recognized ROM artifact filename version patterns
    m = re.search(r"\b(?:PixelExperience|PixelOS|crDroidAndroid|EvolutionX|RisingOS|DerpFest|ArrowOS|VoltageOS|SuperiorOS|ProjectElixir|Nameless-AOSP|PixelExtended|Infinity-X|AlphaDroid)[\w\.\-]*?[_\-](\d{1,2})\.0[\w\.\-]*?\.(?:zip|img)\b", t, re.I)
    if m:
        major = int(m.group(1))
        if 10 <= major <= ANDROID_MAX:
            return f"Android {major}"

    # DerpFest direct release: DerpFest-16.2-*, DerpFest-15.1-*, DerpFest-14-*
    m = re.search(r"\bDerpFest[-_](\d{1,2})(?:\.\d)?[-_]", t, re.I)
    if m:
        major = int(m.group(1))
        if 10 <= major <= ANDROID_MAX:
            return f"Android {major}"

    # Infinity-X direct release: Infinity-X-15.*, Infinity-X-14.*
    m = re.search(r"\bInfinity[-_]X[-_](\d{1,2})(?:\.\d)?[-_]", t, re.I)
    if m:
        major = int(m.group(1))
        if 10 <= major <= ANDROID_MAX:
            return f"Android {major}"

    # Nameless-AOSP direct release: Nameless-AOSP_sweet-14.0-*, Nameless-AOSP_sweet-13.0-*
    m = re.search(r"\bNameless[-_]AOSP[\w\.\-]*?[-_](\d{1,2})\.(\d)", t, re.I)
    if m:
        major = int(m.group(1))
        if 10 <= major <= ANDROID_MAX:
            return f"Android {major}"

    # AncientOS version number mapping: 8.x -> Android 14, 7.x -> Android 13, 6.x -> Android 12, 5.x -> Android 11
    m = re.search(r"\bAncient(?:OS|ROM)[\w\.\-]*?[-_]v?(\d)(?:\.\d+)*[-_]", t, re.I)
    if m:
        ancient_ver = int(m.group(1))
        ancient_map = {8: "Android 14", 7: "Android 13", 6: "Android 12", 5: "Android 11"}
        if ancient_ver in ancient_map:
            return ancient_map[ancient_ver]

    # AncientOS letter/version: AncientOS-R-* (11), AncientOS-S-* (12), AncientOS-T-* (13), AncientOS-U-* (14)
    if re.search(r"\bAncient(?:OS|ROM)[-_]R[-_]", t, re.I):
        return "Android 11"
    if re.search(r"\bAncient(?:OS|ROM)[-_]S[-_]", t, re.I):
        return "Android 12"
    if re.search(r"\bAncient(?:OS|ROM)[-_]T[-_]", t, re.I):
        return "Android 13"
    if re.search(r"\bAncient(?:OS|ROM)[-_]U[-_]", t, re.I):
        return "Android 14"

    # Xiaomi.eu HyperOS / MIUI version patterns in zip name:
    # xiaomi.eu_multi_*_OS2.0* -> Android 15, OS1.0* -> Android 14, V14.0* -> Android 13, V13.0* -> Android 12
    if re.search(r"\bxiaomi\.eu_multi_[\w\.\-]+?_OS2\.", t, re.I):
        return "Android 15"
    if re.search(r"\bxiaomi\.eu_multi_[\w\.\-]+?_OS1\.", t, re.I):
        return "Android 14"
    if re.search(r"\bxiaomi\.eu_multi_[\w\.\-]+?_V14\.", t, re.I):
        return "Android 13"
    if re.search(r"\bxiaomi\.eu_multi_[\w\.\-]+?_V13\.", t, re.I):
        return "Android 12"
    if re.search(r"\bxiaomi\.eu_multi_[\w\.\-]+?_V12\.5", t, re.I):
        return "Android 11"

    m = re.search(r"[-_](\d{1,2})\.0[-_][\w\.\-]*?\.(?:zip|img)\b", t, re.I)
    if m:
        major = int(m.group(1))
        if 10 <= major <= ANDROID_MAX:
            return f"Android {major}"

    # 5. LineageOS version token in filename or text (lineage-23.2, LineageOS 21.0)
    m = re.search(r"\blineage(?:os)?[\s\-_]*v?(\d{2})(?:\.(\d))?", t, re.I)
    if m:
        major = int(m.group(1))
        if major in LINEAGE_TO_ANDROID:
            return LINEAGE_TO_ANDROID[major]

    # 6. crDroid version token in filename or text (crDroid v12, crDroid 10)
    m = re.search(r"\bcrdroid(?:android)?[\s\-_]*v?(\d{1,2})\b", t, re.I)
    if m:
        major = int(m.group(1))
        if major in CRDROID_TO_ANDROID:
            return CRDROID_TO_ANDROID[major]

    # 7. Evolution X version token in filename or text (Evolution X 10.3, Evox 9.6)
    if family == "Evolution X":
        m = re.search(r"\b(?:evolution[\s\-_]*x|evox)[\s\-_]*v?(\d{1,2})(?:\.(\d))?\b", t, re.I)
        if m:
            major = int(m.group(1))
            if major in EVOLUTION_TO_ANDROID:
                return EVOLUTION_TO_ANDROID[major]

    # Havoc-OS version token (Havoc-OS-v3.12, Havoc 4.5)
    if family == "Havoc-OS":
        m = re.search(r"\b(?:havoc[\s\-_]*os|havoc)[\s\-_]*v?(\d)(?:\.(\d+))?\b", t, re.I)
        if m:
            major = int(m.group(1))
            if major in HAVOC_TO_ANDROID:
                return HAVOC_TO_ANDROID[major]

    # Resurrection Remix version token (RR-N-v5.8, RR-v7.0, RR-v8.6)
    if family == "Resurrection Remix":
        m = re.search(r"\b(?:resurrection[\s\-_]*remix|rr)[\w\.\-]*?[-_]v?(\d)(?:\.(\d+))?\b", t, re.I)
        if m:
            major = int(m.group(1))
            if major in RESURRECTION_REMIX_TO_ANDROID:
                return RESURRECTION_REMIX_TO_ANDROID[major]

    # 8. Explicit "Version: 13.0" or "Version : 13" on release pages
    m = re.search(r"\b(?:version|ver)[\s:]*v?(\d{1,2})(?:\.(\d))?\b", t, re.I)
    if m:
        major = int(m.group(1))
        if family == "LineageOS" and major in LINEAGE_TO_ANDROID:
            return LINEAGE_TO_ANDROID[major]
        if family == "crDroid" and major in CRDROID_TO_ANDROID:
            return CRDROID_TO_ANDROID[major]
        if family == "Evolution X" and major in EVOLUTION_TO_ANDROID:
            return EVOLUTION_TO_ANDROID[major]
        if family == "Havoc-OS" and major in HAVOC_TO_ANDROID:
            return HAVOC_TO_ANDROID[major]
        if family == "Resurrection Remix" and major in RESURRECTION_REMIX_TO_ANDROID:
            return RESURRECTION_REMIX_TO_ANDROID[major]
        if 10 <= major <= ANDROID_MAX:
            return f"Android {major}"

    return None


def parse_rom_version(text: Optional[str], family: Optional[str]) -> Optional[str]:
    if not text or not family:
        return None
    t = re.sub(r"\s+", " ", text)

    # 1. Trailing or tokenized -vX.Y in artifact filenames (e.g. -v12.5.zip, -v5.7-beyond1lte)
    m = re.search(r"[-_]v(\d{1,2}(?:\.\d{1,3}){0,2})(?:[-_\.]|\.zip)", t, re.I)
    if m:
        return m.group(1)

    # 2. Family name directly followed by version (e.g. "crDroid 12.5", "One UI 6.1", "Evolution X 10.3")
    letters = [c for c in family if c.isalnum()]
    pattern = "".join(f"{re.escape(c)}[^a-z0-9]*" for c in letters)
    m = re.search(rf"{pattern}\s*v?(\d{{1,2}}(?:\.\d{{1,3}}){{0,2}})", t, re.I)
    if m:
        before = t[max(0, m.start() - 12):m.start()].lower()
        if "android" not in before:
            return m.group(1)

    # 3. Explicit Version: X.X on family release pages
    m = re.search(r"\b(?:version|ver)[\s:]*v?(\d{1,2}(?:\.\d{1,3}){0,2})\b", t, re.I)
    if m:
        return m.group(1)

    return None


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

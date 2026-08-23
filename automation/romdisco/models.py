"""Data model / JSON schema for the ROM discovery database.

The shapes here mirror what CustomRom World consumes (see src/lib/rom-import.ts):
family/name, ROM version and Android version are separate fields and unknown
values stay ``None`` instead of being guessed.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Any, Literal, Optional

SCHEMA_VERSION = 2

RomType = Literal["custom_rom", "stock_skin", "gsi", "other"]
RomStatus = Literal["verified", "unverified"]

# Families that own an icon on the site. Never invent one outside this list.
ALLOWED_FAMILIES: tuple[str, ...] = (
    "LineageOS", "crDroid", "Pixel Experience", "Evolution X", "ArrowOS",
    "PixelOS", "DerpFest", "Project Elixir", "RisingOS", "VoltageOS",
    "SuperiorOS", "Resurrection Remix", "Havoc-OS", "Paranoid Android",
    "CalyxOS", "GrapheneOS", "/e/OS", "iodeOS", "DivestOS",
    "One UI", "HyperOS", "MIUI", "ColorOS", "OxygenOS", "Realme UI",
    "Funtouch OS", "OriginOS", "Nothing OS", "MagicOS",
)

SKIN_FAMILIES = frozenset({
    "One UI", "HyperOS", "MIUI", "ColorOS", "OxygenOS", "Realme UI",
    "Funtouch OS", "OriginOS", "Nothing OS", "MagicOS",
})


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def rom_type_for_family(family: str) -> RomType:
    return "stock_skin" if family in SKIN_FAMILIES else "custom_rom"


@dataclass(frozen=True)
class Device:
    name: str
    codename: str
    manufacturer: str
    aliases: tuple[str, ...] = ()

    @property
    def id(self) -> str:
        return f"{self.manufacturer}:{self.codename}".lower().replace(" ", "-")

    def to_json(self) -> dict[str, Any]:
        d = asdict(self)
        d["aliases"] = list(self.aliases)
        d["id"] = self.id
        return d


@dataclass
class Evidence:
    """One concrete signal that supports (or weakens) a candidate."""

    kind: str          # e.g. "codename_match", "artifact_link", "build_date"
    detail: str
    source_id: str
    url: Optional[str] = None

    def to_json(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class Candidate:
    """Raw discovery output before validation."""

    url: str
    title: str = ""
    text: str = ""
    source_id: Optional[str] = None
    download_url: Optional[str] = None
    download_links: list[str] = field(default_factory=list)
    query: Optional[str] = None

    def to_json(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class Rom:
    id: str
    name: str
    type: RomType
    device: str
    codename: str
    android_version: Optional[str]
    rom_version: Optional[str]
    build_date: Optional[str]
    status: RomStatus
    source_url: str
    download_url: Optional[str]
    source_id: str
    evidence: list[Evidence] = field(default_factory=list)
    discovered_at: str = field(default_factory=now_iso)
    updated_at: str = field(default_factory=now_iso)

    @staticmethod
    def make_id(codename: str, name: str, rom_version: Optional[str],
                android_version: Optional[str], build_date: Optional[str]) -> str:
        raw = "|".join([
            codename.lower().strip(),
            name.lower().strip(),
            (rom_version or "").lower().strip(),
            (android_version or "").lower().strip(),
            (build_date or "").strip(),
        ])
        return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:16]

    @property
    def identity(self) -> str:
        return self.make_id(self.codename, self.name, self.rom_version,
                            self.android_version, self.build_date)

    def to_json(self) -> dict[str, Any]:
        d = asdict(self)
        d["evidence"] = [e if isinstance(e, dict) else e.to_json() for e in self.evidence]
        return d


@dataclass
class Rejection:
    url: str
    reason: str

    def to_json(self) -> dict[str, Any]:
        return asdict(self)

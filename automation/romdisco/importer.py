"""Supabase importer & adapter for discovered ROM records."""

from __future__ import annotations

import json
import os
import re
import urllib.parse
from typing import Any, Optional

from .catalog import DEFAULT_CATALOG_PATH, load_catalog
from .models import ALLOWED_FAMILIES

# Canonical ROM/skin families from src/lib/rom-import.ts
ALLOWED_ROM_FAMILIES = (
    "LineageOS",
    "crDroid",
    "Pixel Experience",
    "Evolution X",
    "ArrowOS",
    "PixelOS",
    "DerpFest",
    "Project Elixir",
    "RisingOS",
    "VoltageOS",
    "SuperiorOS",
    "Resurrection Remix",
    "Havoc-OS",
    "Paranoid Android",
    "CalyxOS",
    "GrapheneOS",
    "/e/OS",
    "/ e / OS",
    "iodéOS",
    "DivestOS",
    "Nameless-AOSP",
    "ProjectMatrixx",
    "AncientOS",
    "Infinity-X",
    "Pixel Extended",
    "AlphaDroid",
    "ProjectBlaze",
    "MoKee",
    "AICP",
    "OmniROM",
    "Xiaomi.eu",
    "Neoteric-OS",
    "Jaguar ROM",
    "One UI",
    "HyperOS",
    "MIUI",
    "ColorOS",
    "OxygenOS",
    "Realme UI",
    "Funtouch OS",
    "OriginOS",
    "Nothing OS",
    "MagicOS",
    "ZenUI",
    "Flyme",
)

SKIN_FAMILIES = {
    "One UI",
    "HyperOS",
    "MIUI",
    "ColorOS",
    "OxygenOS",
    "Realme UI",
    "Funtouch OS",
    "OriginOS",
    "Nothing OS",
    "MagicOS",
    "ZenUI",
    "Flyme",
    "Xiaomi.eu",
}

# Normalization mapping matching src/lib/rom-import.ts
FAMILY_ALIASES = {
    "lineageos": "LineageOS",
    "lineage": "LineageOS",
    "los": "LineageOS",
    "cyanogenmod": "LineageOS",
    "crdroid": "crDroid",
    "crdroidandroid": "crDroid",
    "pixelexperience": "Pixel Experience",
    "pe": "Pixel Experience",
    "evolutionx": "Evolution X",
    "evox": "Evolution X",
    "arrowos": "ArrowOS",
    "arrow": "ArrowOS",
    "pixelos": "PixelOS",
    "derpfest": "DerpFest",
    "projectelixir": "Project Elixir",
    "elixir": "Project Elixir",
    "risingos": "RisingOS",
    "rising": "RisingOS",
    "voltageos": "VoltageOS",
    "superioros": "SuperiorOS",
    "resurrectionremix": "Resurrection Remix",
    "rr": "Resurrection Remix",
    "havocos": "Havoc-OS",
    "havoc": "Havoc-OS",
    "paranoidandroid": "Paranoid Android",
    "aospa": "Paranoid Android",
    "calyxos": "CalyxOS",
    "grapheneos": "GrapheneOS",
    "eos": "/e/OS",
    "e-os": "/e/OS",
    "eosrom": "/e/OS",
    "/e/os": "/e/OS",
    "/ e / os": "/e/OS",
    "iodeos": "iodéOS",
    "iode": "iodéOS",
    "iodéos": "iodéOS",
    "divestos": "DivestOS",
    "namelessaosp": "Nameless-AOSP",
    "nameless": "Nameless-AOSP",
    "projectmatrixx": "ProjectMatrixx",
    "matrixx": "ProjectMatrixx",
    "ancientos": "AncientOS",
    "ancientrom": "AncientOS",
    "ancient": "AncientOS",
    "infinityx": "Infinity-X",
    "pixelextended": "Pixel Extended",
    "peextended": "Pixel Extended",
    "alphadroid": "AlphaDroid",
    "projectblaze": "ProjectBlaze",
    "blaze": "ProjectBlaze",
    "mokee": "MoKee",
    "mokeedev": "MoKee",
    "aicp": "AICP",
    "omnirom": "OmniROM",
    "omni": "OmniROM",
    "xiaomieu": "Xiaomi.eu",
    "eu": "Xiaomi.eu",
    "neotericos": "Neoteric-OS",
    "neoteric": "Neoteric-OS",
    "jaguarrom": "Jaguar ROM",
    "jaguar": "Jaguar ROM",
    "oneui": "One UI",
    "samsungexperience": "One UI",
    "oneuiport": "One UI",
    "hyperos": "HyperOS",
    "xiaomihyperos": "HyperOS",
    "hyperosport": "HyperOS",
    "miui": "MIUI",
    "miuiport": "MIUI",
    "coloros": "ColorOS",
    "colorosport": "ColorOS",
    "oxygenos": "OxygenOS",
    "oos": "OxygenOS",
    "oxygenosport": "OxygenOS",
    "realmeui": "Realme UI",
    "funtouchos": "Funtouch OS",
    "funtouch": "Funtouch OS",
    "originos": "OriginOS",
    "nothingos": "Nothing OS",
    "magicos": "MagicOS",
    "zenui": "ZenUI",
    "flyme": "Flyme",
    "flymeos": "Flyme",
}


def normalize_family(name: Optional[str]) -> Optional[str]:
    if not name:
        return None
    k = re.sub(r"[^a-z0-9]", "", name.lower())
    if k in FAMILY_ALIASES:
        return FAMILY_ALIASES[k]
    for fam in ALLOWED_ROM_FAMILIES:
        if k == re.sub(r"[^a-z0-9]", "", fam.lower()):
            return fam
    return None


def rom_slug(family: str, rom_version: Optional[str], android_version: str) -> str:
    """Generate exact ROM slug matching src/lib/rom-import.ts romSlug()."""
    parts = [family, rom_version or "", android_version]
    clean_parts = [p for p in parts if p]
    joined = " ".join(clean_parts).lower()
    joined = joined.replace("+", "-plus")
    slug = re.sub(r"[^a-z0-9]+", "-", joined).strip("-")
    return slug


def rom_identity(brand: str, device_slug: str, rom_name: str, rom_version: Optional[str], android_version: str) -> str:
    return "|".join([
        brand.lower().strip(),
        device_slug.lower().strip(),
        rom_name.lower().strip(),
        (rom_version or "").lower().strip(),
        android_version.lower().strip(),
    ])


def build_supabase_records(
    roms_data: dict[str, Any],
    catalog_path: str = DEFAULT_CATALOG_PATH,
) -> dict[str, Any]:
    """Transform raw roms.json / rom_database.json into public.roms schema rows."""
    catalog = load_catalog(catalog_path)
    
    # Map devices by name and codename from catalog
    devices_by_name = {d["name"].lower(): d for d in catalog.get("devices", []) if d.get("name")}
    devices_by_code = {d["codename"].lower(): d for d in catalog.get("devices", []) if d.get("codename")}

    # Also build map from roms_data["devices"]
    for d in roms_data.get("devices", []):
        if d.get("name") and d["name"].lower() not in devices_by_name:
            code = d.get("codename", "")
            if code and code.lower() in devices_by_code:
                devices_by_name[d["name"].lower()] = devices_by_code[code.lower()]
            else:
                mfg = d.get("manufacturer", "")
                d_name = d.get("name", "")
                slug = re.sub(r"[^a-z0-9]+", "-", d_name.lower()).strip("-")
                devices_by_name[d_name.lower()] = {
                    "brand_slug": mfg.lower(),
                    "slug": slug,
                    "name": d_name,
                    "codename": code,
                    "manufacturer": mfg,
                }

    raw_roms = roms_data.get("roms", [])
    accepted: list[dict[str, Any]] = []
    rejected: list[dict[str, Any]] = []

    seen_identities: dict[str, dict[str, Any]] = {}
    duplicates_removed = 0

    missing_android_count = 0
    missing_download_count = 0
    missing_version_count = 0

    for r in raw_roms:
        raw_device_name = r.get("device") or ""
        raw_codename = r.get("codename") or ""
        raw_rom_name = r.get("name") or ""
        raw_android_version = r.get("android_version")
        raw_rom_version = r.get("rom_version")
        raw_source_url = r.get("source_url") or ""
        raw_download_url = r.get("download_url")

        # 1. Device resolution: prefer exact device name, then device from roms_data, then codename
        dev_entry = None
        if raw_device_name and raw_device_name.lower() in devices_by_name:
            dev_entry = devices_by_name[raw_device_name.lower()]
        elif raw_codename:
            for d in roms_data.get("devices", []):
                if d.get("codename", "").lower() == raw_codename.lower():
                    dev_entry = devices_by_name.get((d.get("name") or "").lower())
                    if dev_entry:
                        break
            if not dev_entry and raw_codename.lower() in devices_by_code:
                dev_entry = devices_by_code[raw_codename.lower()]

        if not dev_entry:
            rejected.append({
                "source_url": raw_source_url,
                "rom": r,
                "reason": f"Device '{raw_device_name}' / codename '{raw_codename}' not recognized in device catalog",
            })
            continue

        # 2. ROM Family validation
        family = normalize_family(raw_rom_name)
        if not family:
            rejected.append({
                "source_url": raw_source_url,
                "rom": r,
                "reason": f"ROM family '{raw_rom_name}' is not in ALLOWED_ROM_FAMILIES",
            })
            continue

        # 3. Android Version requirement (strict: never invented)
        if not raw_android_version or not raw_android_version.strip():
            missing_android_count += 1
            rejected.append({
                "source_url": raw_source_url,
                "rom": r,
                "reason": "Missing explicit Android version (required for UI ROM card indexing)",
            })
            continue

        android_version = raw_android_version.strip()
        rom_version = raw_rom_version.strip() if (raw_rom_version and raw_rom_version.strip()) else None
        if not rom_version:
            missing_version_count += 1

        download_url = raw_download_url.strip() if (raw_download_url and raw_download_url.strip()) else None
        if not download_url:
            missing_download_count += 1

        brand_slug = dev_entry.get("brand_slug") or dev_entry.get("manufacturer", "").lower()
        device_slug = dev_entry.get("slug") or re.sub(r"[^a-z0-9]+", "-", dev_entry["name"].lower()).strip("-")
        device_name = dev_entry.get("name")
        codename = dev_entry.get("codename") or raw_codename or None

        slug = rom_slug(family, rom_version, android_version)
        rom_type = "skin-port" if family in SKIN_FAMILIES else "aosp"

        # Extract found_on host
        found_on = "official_source"
        if raw_source_url:
            try:
                found_on = urllib.parse.urlsplit(raw_source_url).hostname or "official_source"
                if found_on.startswith("www."):
                    found_on = found_on[4:]
            except Exception:
                found_on = "official_source"

        record = {
            "brand": brand_slug,
            "device_slug": device_slug,
            "device_name": device_name,
            "codename": codename,
            "slug": slug,
            "rom_name": family,
            "rom_version": rom_version,
            "android_version": android_version,
            "rom_type": rom_type,
            "source_url": raw_source_url or None,
            "download_url": download_url,
            "found_on": found_on,
            "made_by": family,
            "official_status": "official" if r.get("status") == "verified" else None,
            "installation_guide": None,
            "additional_info": None,
        }

        identity = rom_identity(brand_slug, device_slug, family, rom_version, android_version)
        if identity in seen_identities:
            duplicates_removed += 1
            # Keep entry with download_url if available
            existing = seen_identities[identity]
            if download_url and not existing.get("download_url"):
                existing["download_url"] = download_url
                if raw_source_url:
                    existing["source_url"] = raw_source_url
                if found_on:
                    existing["found_on"] = found_on
            continue

        seen_identities[identity] = record
        accepted.append(record)

    # Group accepted records by device
    by_device: dict[str, list[dict[str, Any]]] = {}
    for rec in accepted:
        key = f"{rec['brand']}:{rec['device_slug']}"
        by_device.setdefault(key, []).append(rec)

    # Group rejection reasons
    reasons_count: dict[str, int] = {}
    for rej in rejected:
        rsn = rej["reason"]
        reasons_count[rsn] = reasons_count.get(rsn, 0) + 1

    return {
        "total_records": len(raw_roms),
        "accepted_count": len(accepted),
        "rejected_count": len(rejected),
        "duplicates_removed": duplicates_removed,
        "missing_android_count": missing_android_count,
        "missing_download_count": missing_download_count,
        "missing_version_count": missing_version_count,
        "rejection_reasons": reasons_count,
        "devices_count": len(by_device),
        "by_device": by_device,
        "accepted_records": accepted,
        "rejected_records": rejected,
    }


def execute_supabase_upsert(
    records: list[dict[str, Any]],
    *,
    env_path: str = ".env",
) -> tuple[int, list[dict[str, Any]], Optional[str]]:
    """Upsert validated records into Supabase public.roms non-destructively."""
    env_vars = {}
    if os.path.exists(env_path):
        with open(env_path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    env_vars[k.strip()] = v.strip().strip("\"").strip("'")

    sb_url = os.environ.get("SUPABASE_URL") or env_vars.get("SUPABASE_URL")
    sb_key = os.environ.get("SUPABASE_PUBLISHABLE_KEY") or env_vars.get("SUPABASE_PUBLISHABLE_KEY")

    if not sb_url or not sb_key:
        return 0, [], "Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY in environment or .env"

    # Authenticate as owner to satisfy RLS
    auth_url = f"{sb_url}/auth/v1/token?grant_type=password"
    auth_headers = {
        "apikey": sb_key,
        "Content-Type": "application/json",
    }
    auth_body = json.dumps({
        "email": "techbymarcon@handles.evolution-x.local",
        "password": "99999::evox"
    }).encode("utf-8")

    import urllib.error
    import urllib.request

    try:
        req = urllib.request.Request(auth_url, data=auth_body, headers=auth_headers, method="POST")
        with urllib.request.urlopen(req) as resp:
            token = json.loads(resp.read().decode("utf-8"))["access_token"]
    except Exception as e:
        return 0, [], f"Authentication failed: {e}"

    # Upsert with on_conflict=brand,device_slug,slug and ignore-duplicates
    upsert_url = f"{sb_url}/rest/v1/roms?on_conflict=brand,device_slug,slug"
    headers = {
        "apikey": sb_key,
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Prefer": "resolution=ignore-duplicates,return=representation"
    }

    try:
        req = urllib.request.Request(upsert_url, data=json.dumps(records).encode("utf-8"), headers=headers, method="POST")
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return len(data), data, None
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8")
        return 0, [], f"HTTP Error {e.code}: {err_msg}"
    except Exception as e:
        return 0, [], f"Upsert failed: {e}"

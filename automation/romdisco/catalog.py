"""Device catalog loader, queries, and consistency validator."""

from __future__ import annotations

import json
import os
import re
from typing import Any, Optional

from .models import Device

DEFAULT_CATALOG_PATH = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "data",
    "device_catalog.json",
)


def load_catalog(path: str = DEFAULT_CATALOG_PATH) -> dict[str, Any]:
    if not os.path.exists(path):
        raise FileNotFoundError(f"Device catalog not found at {path}")
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def get_catalog_entries(
    path: str = DEFAULT_CATALOG_PATH,
    *,
    brand: Optional[str] = None,
    device_id: Optional[str] = None,
) -> list[dict[str, Any]]:
    catalog = load_catalog(path)
    entries = catalog.get("devices", [])
    if brand:
        b_lower = brand.lower().strip()
        entries = [
            e for e in entries
            if e.get("brand_slug", "").lower() == b_lower
            or e.get("manufacturer", "").lower() == b_lower
        ]
    if device_id:
        target_ids = {d.strip().lower() for d in device_id.split(",") if d.strip()}
        entries = [e for e in entries if e.get("id") and e["id"].lower() in target_ids]
    return entries


def get_catalog_devices(
    path: str = DEFAULT_CATALOG_PATH,
    *,
    brand: Optional[str] = None,
    device_id: Optional[str] = None,
    resolved_only: bool = True,
) -> list[Device]:
    """Return Device domain objects from catalog.
    
    Unresolved devices (resolved == False or codename is None) are excluded when
    resolved_only is True (default), guaranteeing no guessed/empty codenames enter discovery.
    """
    entries = get_catalog_entries(path, brand=brand, device_id=device_id)
    devices: list[Device] = []
    for e in entries:
        if resolved_only and (not e.get("resolved") or not e.get("codename")):
            continue
        if not e.get("codename"):
            continue
        devices.append(
            Device(
                name=e["name"],
                codename=e["codename"],
                manufacturer=e["manufacturer"],
                aliases=tuple(e.get("aliases") or ()),
            )
        )
    return devices


def validate_catalog_consistency(
    catalog_path: str = DEFAULT_CATALOG_PATH,
    ts_path: Optional[str] = None,
) -> dict[str, Any]:
    """Validate that device_catalog.json is complete, consistent, and adheres to strict rules."""
    catalog = load_catalog(catalog_path)
    entries = catalog.get("devices", [])

    seen_ids: dict[str, str] = {}
    seen_manufacturer_codenames: dict[tuple[str, str], str] = {}
    resolved_count = 0
    unresolved_count = 0

    for e in entries:
        name = e.get("name")
        brand_slug = e.get("brand_slug")
        manufacturer = e.get("manufacturer")
        codename = e.get("codename")
        is_resolved = bool(e.get("resolved"))

        if not name or not brand_slug or not manufacturer:
            raise ValueError(f"Incomplete catalog entry: {e}")

        if is_resolved:
            if not codename or not codename.strip():
                raise ValueError(f"Device '{name}' marked resolved but has empty codename")
            device_id = e.get("id")
            expected_id = f"{manufacturer.lower()}:{codename.lower()}"
            if device_id != expected_id:
                raise ValueError(f"Device '{name}' ID mismatch: {device_id} != {expected_id}")
            if device_id in seen_ids:
                raise ValueError(f"Duplicate device ID '{device_id}' for '{name}' and '{seen_ids[device_id]}'")
            seen_ids[device_id] = name

            m_key = (manufacturer.lower(), codename.lower())
            if m_key in seen_manufacturer_codenames:
                raise ValueError(
                    f"Duplicate manufacturer codename {m_key} for '{name}' and '{seen_manufacturer_codenames[m_key]}'"
                )
            seen_manufacturer_codenames[m_key] = name
            resolved_count += 1
        else:
            if codename is not None:
                raise ValueError(f"Device '{name}' marked unresolved but has codename '{codename}'")
            if e.get("id") is not None:
                raise ValueError(f"Device '{name}' marked unresolved but has ID '{e.get('id')}'")
            unresolved_count += 1

    # If ts_path provided, verify 1:1 completeness with src/lib/devices.ts
    if ts_path and os.path.exists(ts_path):
        with open(ts_path, "r", encoding="utf-8") as f:
            text = f.read()
        eq_pos = text.find("export const BRANDS")
        eq_pos = text.find("=", eq_pos)
        start = text.find("[", eq_pos)
        end = text.find("export function getBrand")
        end = text.rfind("]", start, end) + 1
        raw_array = text[start:end]
        clean = re.sub(
            r"(\b(?:slug|name|series|title|models)\b)\s*:",
            lambda m: "\"" + m.group(1) + "\":",
            raw_array,
        )
        clean = re.sub(r",\s*([\]\}])", r"\1", clean)
        brands = json.loads(clean)

        ts_device_keys: set[tuple[str, str]] = set()
        for b in brands:
            for s in b["series"]:
                for m in s["models"]:
                    ts_device_keys.add((b["slug"], m))

        catalog_keys = {(e["brand_slug"], e["name"]) for e in entries}

        missing_in_catalog = ts_device_keys - catalog_keys
        extra_in_catalog = catalog_keys - ts_device_keys

        if missing_in_catalog:
            raise ValueError(f"Devices in src/lib/devices.ts missing from catalog: {missing_in_catalog}")
        if extra_in_catalog:
            raise ValueError(f"Extra devices in catalog not in src/lib/devices.ts: {extra_in_catalog}")

    return {
        "valid": True,
        "total_devices": len(entries),
        "resolved_devices": resolved_count,
        "unresolved_devices": unresolved_count,
    }

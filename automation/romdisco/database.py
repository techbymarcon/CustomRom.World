"""JSON database: metadata + devices + sources + roms (+ pending candidates)."""

from __future__ import annotations

import json
import os
import tempfile
from dataclasses import asdict
from typing import Any, Optional

from .models import SCHEMA_VERSION, Candidate, Device, Rejection, Rom, now_iso
from .source_registry import SourceRegistry, registry as default_registry

DEFAULT_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                            "data", "rom_database.json")


class Database:
    def __init__(self, path: str = DEFAULT_PATH, reg: SourceRegistry | None = None) -> None:
        self.path = path
        self.reg = reg or default_registry
        self.data: dict[str, Any] = self._empty()
        if os.path.exists(path):
            self.load()

    def _empty(self) -> dict[str, Any]:
        return {
            "metadata": {
                "schema_version": SCHEMA_VERSION,
                "generator": "romdisco",
                "created_at": now_iso(),
                "updated_at": now_iso(),
                "counts": {"devices": 0, "roms": 0, "sources": 0},
            },
            "devices": [],
            "sources": [],
            "roms": [],
            "candidates": [],
            "rejections": [],
        }

    # -- persistence ----------------------------------------------------
    def load(self) -> None:
        with open(self.path, "r", encoding="utf-8") as fh:
            self.data = json.load(fh)
        for key in ("devices", "sources", "roms", "candidates", "rejections"):
            self.data.setdefault(key, [])

    def save(self) -> None:
        os.makedirs(os.path.dirname(self.path), exist_ok=True)
        self._refresh_metadata()
        directory = os.path.dirname(self.path)
        fd, tmp = tempfile.mkstemp(dir=directory, suffix=".tmp")
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(self.data, fh, indent=2, ensure_ascii=False)
        os.replace(tmp, self.path)

    def _refresh_metadata(self) -> None:
        used = {r["source_id"] for r in self.data["roms"]}
        self.data["sources"] = [
            s.to_json() for s in self.reg.sources
            if s.id in used or not self.data["roms"]
        ] if used else [s.to_json() for s in self.reg.sources]
        self.data["metadata"]["updated_at"] = now_iso()
        self.data["metadata"]["schema_version"] = SCHEMA_VERSION
        self.data["metadata"]["counts"] = {
            "devices": len(self.data["devices"]),
            "roms": len(self.data["roms"]),
            "sources": len(self.data["sources"]),
            "verified": sum(1 for r in self.data["roms"] if r.get("status") == "verified"),
            "candidates": len(self.data["candidates"]),
        }

    # -- mutations ------------------------------------------------------
    def upsert_device(self, device: Device) -> None:
        payload = device.to_json()
        for i, existing in enumerate(self.data["devices"]):
            if existing.get("id") == payload["id"]:
                self.data["devices"][i] = payload
                return
        self.data["devices"].append(payload)

    def set_candidates(self, device: Device, candidates: list[Candidate]) -> None:
        others = [c for c in self.data["candidates"] if c.get("device_id") != device.id]
        self.data["candidates"] = others + [
            {**c.to_json(), "device_id": device.id} for c in candidates
        ]

    def candidates_for(self, device_id: Optional[str] = None) -> list[tuple[str, Candidate]]:
        out: list[tuple[str, Candidate]] = []
        for raw in self.data["candidates"]:
            if device_id and raw.get("device_id") != device_id:
                continue
            payload = {k: v for k, v in raw.items() if k != "device_id"}
            out.append((raw.get("device_id", ""), Candidate(**payload)))
        return out

    def device_by_id(self, device_id: str) -> Optional[Device]:
        for raw in self.data["devices"]:
            if raw.get("id") == device_id:
                return Device(name=raw["name"], codename=raw["codename"],
                              manufacturer=raw["manufacturer"],
                              aliases=tuple(raw.get("aliases") or ()))
        return None

    def upsert_roms(self, roms: list[Rom]) -> tuple[int, int]:
        by_id = {r["id"]: i for i, r in enumerate(self.data["roms"])}
        added = updated = 0
        for rom in roms:
            payload = rom.to_json()
            if payload["id"] in by_id:
                index = by_id[payload["id"]]
                payload["discovered_at"] = self.data["roms"][index].get(
                    "discovered_at", payload["discovered_at"])
                payload["updated_at"] = now_iso()
                self.data["roms"][index] = payload
                updated += 1
            else:
                self.data["roms"].append(payload)
                by_id[payload["id"]] = len(self.data["roms"]) - 1
                added += 1
        return added, updated

    def set_rejections(self, device: Device, rejections: list[Rejection]) -> None:
        others = [r for r in self.data["rejections"] if r.get("device_id") != device.id]
        self.data["rejections"] = others + [
            {**r.to_json(), "device_id": device.id} for r in rejections
        ]

    # -- export ---------------------------------------------------------
    def export(self, path: str, *, only_verified: bool = False) -> dict[str, Any]:
        roms = [r for r in self.data["roms"]
                if not only_verified or r.get("status") == "verified"]
        used = {r["source_id"] for r in roms}
        payload = {
            "metadata": {**self.data["metadata"], "exported_at": now_iso(),
                         "only_verified": only_verified,
                         "counts": {"devices": len(self.data["devices"]),
                                    "roms": len(roms), "sources": len(used)}},
            "devices": self.data["devices"],
            "sources": [s.to_json() for s in self.reg.sources if s.id in used],
            "roms": roms,
        }
        os.makedirs(os.path.dirname(os.path.abspath(path)) or ".", exist_ok=True)
        with open(path, "w", encoding="utf-8") as fh:
            json.dump(payload, fh, indent=2, ensure_ascii=False)
        return payload

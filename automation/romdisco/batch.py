"""Resumable, safe batch discovery across catalog devices with checkpointing and backups."""

from __future__ import annotations

import os
import signal
import sys
import time
from typing import Any, Callable, Optional

from .catalog import DEFAULT_CATALOG_PATH, get_catalog_devices, get_catalog_entries
from .database import DEFAULT_PATH, Database
from .discovery import build_plan, discover
from .models import Device
from .search import SearchBackend, default_backend
from .source_registry import SourceRegistry, registry as default_registry
from .validation import validate_all


class BatchInterruptedException(Exception):
    """Raised when batch run is gracefully interrupted by user."""
    pass


def run_batch_discovery(
    *,
    db: Database,
    catalog_path: str = DEFAULT_CATALOG_PATH,
    brand: Optional[str] = None,
    device_id: Optional[str] = None,
    backend: Optional[SearchBackend] = None,
    reg: Optional[SourceRegistry] = None,
    no_fallback: bool = False,
    no_probe: bool = False,
    probe_only: bool = False,
    resume: bool = False,
    dry_run: bool = False,
    per_query: int = 8,
    max_queries: int = 12,
    delay: float = 0.0,
    auto_validate: bool = False,
    verbose: bool = False,
    progress_callback: Optional[Callable[[dict[str, Any]], None]] = None,
) -> dict[str, Any]:
    """Execute safe batch discovery across registered devices in the catalog."""
    backend = backend or default_backend()
    reg = reg or default_registry
    if probe_only:
        max_queries = 0

    # 1. Load resolved catalog devices (unresolved devices are never returned)
    devices = get_catalog_devices(catalog_path, brand=brand, device_id=device_id, resolved_only=True)
    all_entries = get_catalog_entries(catalog_path, brand=brand, device_id=device_id)
    unresolved_entries = [e for e in all_entries if not e.get("resolved") or not e.get("codename")]

    if not devices:
        return {
            "status": "empty",
            "total_target_devices": 0,
            "processed": 0,
            "skipped": 0,
            "unresolved": len(unresolved_entries),
            "backup_path": None,
        }

    # 2. Automatic safety backup before any modifications
    backup_path = None
    if not dry_run and os.path.exists(db.path):
        backup_path = db.backup()

    if dry_run:
        plans = []
        for dev in devices:
            plan = build_plan(dev, reg, max_queries=max_queries, include_fallback=not no_fallback)
            plans.append({
                "device": dev.to_json(),
                "probe_count": 0 if no_probe else len(plan.probe_urls),
                "query_count": len(plan.queries),
                "probe_urls": [] if no_probe else plan.probe_urls[:5],
                "sample_queries": plan.queries[:5],
            })
        return {
            "status": "dry_run",
            "total_target_devices": len(devices),
            "unresolved_skipped": len(unresolved_entries),
            "plans": plans,
        }

    processed_count = 0
    skipped_count = 0
    interrupted = False

    # Setup graceful interrupt handling
    interrupted_flag = [False]

    def _sigint_handler(signum, frame):
        interrupted_flag[0] = True
        print("\n[!] Interrupt signal received. Finishing current device checkpoint...", file=sys.stderr)

    original_sigint = signal.getsignal(signal.SIGINT)
    signal.signal(signal.SIGINT, _sigint_handler)

    try:
        total = len(devices)
        for idx, device in enumerate(devices, start=1):
            if interrupted_flag[0]:
                interrupted = True
                break

            # 3. Resume check: check if candidates or ROMs already exist for this device
            has_candidates = bool(db.candidates_for(device.id))
            has_roms = any(r.get("codename") == device.codename for r in db.data["roms"])

            if resume and (has_candidates or has_roms):
                skipped_count += 1
                cand_count = len(db.candidates_for(device.id))
                info = {
                    "index": idx,
                    "total": total,
                    "device": device,
                    "action": "skipped_resume",
                    "candidates": cand_count,
                }
                if progress_callback:
                    progress_callback(info)
                print(f"[{idx}/{total}] SKIP (already in DB): {device.name} ({device.codename}) [{cand_count} candidates]", flush=True)
                continue

            t0 = time.monotonic()
            print(f"[{idx}/{total}] START: {device.name} ({device.codename}) [{device.id}]...", end="", flush=True)

            # 4. Discover device candidates
            candidates, discarded = discover(
                device,
                backend=backend,
                reg=reg,
                per_query=per_query,
                max_queries=max_queries,
                probe=not no_probe,
                include_fallback=not no_fallback,
            )

            # 5. Atomic checkpoint for this device
            db.upsert_device(device)
            db.set_candidates(device, candidates)

            roms_count = 0
            verified_count = 0
            if auto_validate:
                roms, rejections = validate_all(candidates, device, reg=reg)
                db.upsert_roms(roms)
                db.set_rejections(device, rejections)
                roms_count = len(roms)
                verified_count = sum(1 for r in roms if r.status == "verified")

            # Save state atomically after each device
            db.save()
            processed_count += 1
            elapsed = time.monotonic() - t0

            info = {
                "index": idx,
                "total": total,
                "device": device,
                "action": "discovered",
                "candidates_kept": len(candidates),
                "discarded_unregistered": len(discarded),
                "roms_count": roms_count,
                "verified_count": verified_count,
                "elapsed": elapsed,
            }
            if progress_callback:
                progress_callback(info)

            msg = f" done in {elapsed:.1f}s -> {len(candidates)} candidates kept"
            if auto_validate:
                msg += f" ({roms_count} roms, {verified_count} verified)"
            print(msg, flush=True)

            # Polite delay between devices
            if delay > 0 and idx < total and not interrupted_flag[0]:
                time.sleep(delay)

    except KeyboardInterrupt:
        interrupted = True
    finally:
        # Restore original signal handler
        signal.signal(signal.SIGINT, original_sigint)

    return {
        "status": "interrupted" if interrupted else "completed",
        "total_target_devices": len(devices),
        "processed": processed_count,
        "skipped": skipped_count,
        "unresolved_excluded": len(unresolved_entries),
        "backup_path": backup_path,
        "db_path": db.path,
    }

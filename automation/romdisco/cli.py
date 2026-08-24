"""CLI for the ROM discovery automation."""

from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Optional

from .batch import run_batch_discovery
from .catalog import DEFAULT_CATALOG_PATH, get_catalog_entries, validate_catalog_consistency
from .database import DEFAULT_PATH, Database
from .discovery import build_plan, discover
from .models import Device
from .search import FixtureBackend, NullBackend, default_backend
from .source_registry import registry
from .validation import validate_all


def _backend(args: argparse.Namespace):
    if getattr(args, "fixture", None):
        return FixtureBackend(args.fixture)
    if getattr(args, "offline", False):
        return NullBackend()
    return default_backend()


def cmd_discover(args: argparse.Namespace) -> int:
    device = Device(name=args.device, codename=args.codename,
                    manufacturer=args.manufacturer or args.device.split()[0],
                    aliases=tuple(a.strip() for a in (args.alias or []) if a.strip()))
    db = Database(args.db)
    db.upsert_device(device)

    plan = build_plan(device, registry, max_queries=args.max_queries,
                      include_fallback=not args.no_fallback)
    if args.dry_run:
        print("# direct source pages (probed first)")
        for url in plan.probe_urls:
            print(url)
        print("\n# source-scoped / fallback queries")
        for query in plan.queries:
            print(query)
        return 0

    candidates, discarded = discover(device, backend=_backend(args), reg=registry,
                                     per_query=args.per_query, max_queries=args.max_queries,
                                     probe=not args.no_probe,
                                     include_fallback=not args.no_fallback)
    db.set_candidates(device, candidates)
    db.save()
    print(f"device            : {device.name} ({device.codename})")
    print(f"source pages probed: {0 if args.no_probe else len(plan.probe_urls)}")
    print(f"candidates kept   : {len(candidates)}")
    print(f"discarded (unregistered domains): {len(discarded)}")
    if args.verbose:
        for candidate in candidates:
            source = registry.match_url(candidate.url)
            label = f"{source.id} / {source.source_class}" if source else "?"
            print(f"  [{label}] {candidate.url}")
    print(f"saved -> {db.path}\nnext: validate")
    return 0


def cmd_batch_discover(args: argparse.Namespace) -> int:
    db = Database(args.db)
    result = run_batch_discovery(
        db=db,
        catalog_path=getattr(args, "catalog", DEFAULT_CATALOG_PATH),
        brand=getattr(args, "brand", None),
        device_id=getattr(args, "device_id", None),
        backend=_backend(args),
        reg=registry,
        no_fallback=getattr(args, "no_fallback", False),
        no_probe=getattr(args, "no_probe", False),
        probe_only=getattr(args, "probe_only", False),
        resume=getattr(args, "resume", False),
        dry_run=getattr(args, "dry_run", False),
        per_query=getattr(args, "per_query", 8),
        max_queries=getattr(args, "max_queries", 12),
        delay=getattr(args, "delay", 0.0),
        auto_validate=getattr(args, "auto_validate", False),
        verbose=getattr(args, "verbose", False),
    )
    if result.get("status") == "dry_run":
        print(f"=== DRY RUN: {result['total_target_devices']} resolved devices (skipped {result['unresolved_skipped']} unresolved) ===")
        for p in result["plans"]:
            dev = p["device"]
            print(f"Device: {dev['name']} ({dev['codename']}) [{dev['id']}] - {p['probe_count']} probes, {p['query_count']} queries")
        return 0

    print("\n=== Batch Discovery Summary ===")
    print(f"Status             : {result.get('status')}")
    print(f"Target devices     : {result.get('total_target_devices')}")
    print(f"Processed devices  : {result.get('processed')}")
    print(f"Skipped (resume)   : {result.get('skipped')}")
    print(f"Unresolved excluded: {result.get('unresolved_excluded')}")
    if result.get("backup_path"):
        print(f"Safety backup      : {result.get('backup_path')}")
    print(f"Database saved to  : {result.get('db_path')}")
    return 0 if result.get("status") in ("completed", "empty") else 1


def cmd_catalog(args: argparse.Namespace) -> int:
    cat_path = getattr(args, "catalog", DEFAULT_CATALOG_PATH)
    if args.check:
        ts_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
                               "src", "lib", "devices.ts")
        res = validate_catalog_consistency(cat_path, ts_path=ts_path if os.path.exists(ts_path) else None)
        print(json.dumps(res, indent=2))
        return 0
    entries = get_catalog_entries(cat_path, brand=args.brand, device_id=args.device_id)
    if args.unresolved_only:
        entries = [e for e in entries if not e.get("resolved")]
    elif args.resolved_only:
        entries = [e for e in entries if e.get("resolved")]
    for e in entries:
        status = "RESOLVED" if e.get("resolved") else "UNRESOLVED"
        code = e.get("codename") or "-"
        print(f"[{status:<10}] {e['brand_slug']:<10} {e['name']:<32} codename={code:<16} id={e.get('id') or '-'}")
    print(f"\nTotal entries: {len(entries)}")
    return 0


def cmd_validate(args: argparse.Namespace) -> int:
    db = Database(args.db)
    device_ids = [args.device_id] if args.device_id else [d["id"] for d in db.data["devices"]]
    if not device_ids:
        print("no devices in the database — run discover first", file=sys.stderr)
        return 1
    total_added = total_updated = total_rejected = 0
    for device_id in device_ids:
        device = db.device_by_id(device_id)
        if device is None:
            print(f"unknown device id: {device_id}", file=sys.stderr)
            continue
        candidates = [c for did, c in db.candidates_for(device_id)]
        roms, rejections = validate_all(candidates, device, reg=registry)
        added, updated = db.upsert_roms(roms)
        db.set_rejections(device, rejections)
        total_added += added
        total_updated += updated
        total_rejected += len(rejections)
        verified = sum(1 for r in roms if r.status == "verified")
        print(f"{device.name} ({device.codename}): {len(candidates)} candidates -> "
              f"{len(roms)} roms ({verified} verified), {len(rejections)} rejected")
        if args.verbose:
            for rejection in rejections:
                print(f"    reject {rejection.url} :: {rejection.reason}")
    db.save()
    print(f"added {total_added}, updated {total_updated}, rejected {total_rejected}")
    return 0


def cmd_export(args: argparse.Namespace) -> int:
    db = Database(args.db)
    payload = db.export(args.output, only_verified=args.verified_only)
    print(f"exported {payload['metadata']['counts']['roms']} roms "
          f"and {payload['metadata']['counts']['sources']} sources -> {args.output}")
    return 0


def cmd_inspect_source(args: argparse.Namespace) -> int:
    hits = registry.inspect(args.target)
    if not hits:
        print(f"{args.target}: NOT REGISTERED — results from this domain are discarded")
        return 1
    for source in hits:
        print(json.dumps(source.to_json(), indent=2))
    return 0


def cmd_list_sources(args: argparse.Namespace) -> int:
    sources = registry.by_kind(args.kind) if args.kind else list(registry.sources)
    for source in sorted(sources, key=lambda s: (s.kind, -s.trust, s.host)):
        prefixes = ",".join(source.path_prefixes) or "*"
        print(f"{source.source_class:<18} {source.kind:<18} trust={source.trust:>3} verify={'Y' if source.can_verify else 'n'} "
              f"{source.host}{'' if prefixes == '*' else ' ' + prefixes}")
    print(f"\n{len(sources)} sources")
    return 0


def cmd_stats(args: argparse.Namespace) -> int:
    db = Database(args.db)
    db._refresh_metadata()
    print(json.dumps(db.data["metadata"], indent=2))
    return 0


def cmd_import_supabase(args: argparse.Namespace) -> int:
    from .importer import build_supabase_records
    input_file = args.input or "roms.json"
    if not os.path.exists(input_file):
        print(f"Input file not found: {input_file}", file=sys.stderr)
        return 1
    with open(input_file, "r", encoding="utf-8") as fh:
        data = json.load(fh)

    report = build_supabase_records(data, catalog_path=args.catalog)

    print("\n=======================================================")
    print("        Supabase ROM Import Pipeline — Dry Run         ")
    print("=======================================================\n")
    print(f"Input file            : {input_file}")
    print(f"Total raw records     : {report['total_records']}")
    print(f"Accepted for import   : {report['accepted_count']}")
    print(f"Duplicates removed    : {report['duplicates_removed']}")
    print(f"Rejected records      : {report['rejected_count']}")
    print(f"Target devices        : {report['devices_count']}\n")

    print("--- Rejection Breakdown ---")
    for rsn, count in report["rejection_reasons"].items():
        print(f"  [{count:>3} records] {rsn}")
    print()

    print("--- Quality & Completeness Checks ---")
    print(f"  Missing Android version : {report['missing_android_count']} (rejected - never guessed)")
    print(f"  Missing Download URL    : {report['missing_download_count']} (preserved as null)")
    print(f"  Missing ROM Version     : {report['missing_version_count']} (permitted by schema as null)")
    print()

    print("--- Accepted Records Grouped by Device ---")
    for dev_key, records in sorted(report["by_device"].items()):
        sample_rom = records[0]
        dev_name = sample_rom.get("device_name", dev_key)
        code = sample_rom.get("codename") or "-"
        print(f"  • {dev_name} ({code}) [{dev_key}]: {len(records)} ROMs")
        for r in records[:3]:
            dl_indicator = "✓ direct link" if r["download_url"] else "- source only"
            v_str = f"v{r['rom_version']}" if r['rom_version'] else "v(null)"
            print(f"      - {r['rom_name']:<18} {v_str:<10} {r['android_version']:<12} [{dl_indicator}]")
        if len(records) > 3:
            print(f"      ... and {len(records) - 3} more")
    print()

    if getattr(args, "output", None):
        with open(args.output, "w", encoding="utf-8") as out_fh:
            json.dump(report["accepted_records"], out_fh, indent=2, ensure_ascii=False)
        print(f"Exported {len(report['accepted_records'])} ready-to-insert public.roms rows -> {args.output}")

    if not getattr(args, "execute", False):
        print("\n[DRY RUN ONLY] No changes were made to Supabase.")
        return 0

    print("Executing non-destructive Supabase upsert...")
    from .importer import execute_supabase_upsert
    inserted_count, inserted_rows, err = execute_supabase_upsert(report["accepted_records"])
    if err:
        print(f"Error during import: {err}")
        return 1
    print(f"Successfully upserted {inserted_count} rows into Supabase public.roms!")
    return 0


def cmd_test(args: argparse.Namespace) -> int:
    from .tests import run
    return run()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="rom_discovery.py",
        description="Discover and validate Android custom ROMs / stock skins from a curated source registry.",
    )
    parser.add_argument("--db", default=DEFAULT_PATH, help="path to the JSON database")
    sub = parser.add_subparsers(dest="command", required=True)

    d = sub.add_parser("discover", help="search registered sources for a single device")
    d.add_argument("--device", required=True, help='e.g. "Xiaomi Pad 5"')
    d.add_argument("--codename", required=True, help="e.g. nabu")
    d.add_argument("--manufacturer", default=None)
    d.add_argument("--alias", action="append", default=[], help="repeatable alternative name")
    d.add_argument("--per-query", type=int, default=8)
    d.add_argument("--max-queries", type=int, default=60)
    d.add_argument("--fixture", help="JSON fixture file instead of live search")
    d.add_argument("--offline", action="store_true", help="no network, yields zero candidates")
    d.add_argument("--no-probe", action="store_true",
                   help="skip direct source-page probing (search only)")
    d.add_argument("--no-fallback", action="store_true",
                   help="registered-source queries only, no generic web search")
    d.add_argument("--dry-run", action="store_true", help="print the generated queries only")
    d.add_argument("-v", "--verbose", action="store_true")
    d.set_defaults(func=cmd_discover)

    b = sub.add_parser("batch-discover", help="resumable batch discovery across catalog devices")
    b.add_argument("--catalog", default=DEFAULT_CATALOG_PATH, help="path to device_catalog.json")
    b.add_argument("--brand", default=None, help="filter by brand (e.g. pixel, xiaomi, samsung)")
    b.add_argument("--device-id", default=None, help="filter by device ID(s) (comma-separated)")
    b.add_argument("--resume", action="store_true", help="skip devices that already have candidates/ROMs in DB")
    b.add_argument("--no-fallback", action="store_true", help="registered-source queries and probes only")
    b.add_argument("--no-probe", action="store_true", help="skip direct source-page probing")
    b.add_argument("--probe-only", action="store_true", help="Stage 1 direct source page probes only (zero search queries)")
    b.add_argument("--dry-run", action="store_true", help="print discovery plan without making requests")
    b.add_argument("--per-query", type=int, default=8)
    b.add_argument("--max-queries", type=int, default=12)
    b.add_argument("--delay", type=float, default=0.0, help="delay in seconds between devices")
    b.add_argument("--auto-validate", action="store_true", help="validate immediately after each device")
    b.add_argument("--fixture", help="JSON fixture file instead of live search")
    b.add_argument("--offline", action="store_true", help="no network")
    b.add_argument("-v", "--verbose", action="store_true")
    b.set_defaults(func=cmd_batch_discover)

    c = sub.add_parser("catalog", help="inspect or validate the device catalog")
    c.add_argument("--catalog", default=DEFAULT_CATALOG_PATH)
    c.add_argument("--check", action="store_true", help="run consistency validation against src/lib/devices.ts")
    c.add_argument("--brand", default=None)
    c.add_argument("--device-id", default=None)
    c.add_argument("--resolved-only", action="store_true")
    c.add_argument("--unresolved-only", action="store_true")
    c.set_defaults(func=cmd_catalog)

    imp = sub.add_parser("import-supabase", help="validate and transform roms.json into Supabase public.roms rows")
    imp.add_argument("input", nargs="?", default="roms.json", help="path to roms.json")
    imp.add_argument("--catalog", default=DEFAULT_CATALOG_PATH, help="path to device_catalog.json")
    imp.add_argument("--output", default=None, help="write transformed records to json file")
    imp.add_argument("--execute", action="store_true", help="execute live Supabase upsert (requires credentials)")
    imp.set_defaults(func=cmd_import_supabase)

    v = sub.add_parser("validate", help="validate stored candidates into ROM entries")
    v.add_argument("--device-id", default=None)
    v.add_argument("-v", "--verbose", action="store_true")
    v.set_defaults(func=cmd_validate)

    e = sub.add_parser("export", help="export a clean roms JSON file")
    e.add_argument("output", nargs="?", default="roms.json")
    e.add_argument("--verified-only", action="store_true")
    e.set_defaults(func=cmd_export)

    i = sub.add_parser("inspect-source", help="show registry info for a host/URL/source id")
    i.add_argument("target")
    i.set_defaults(func=cmd_inspect_source)

    l = sub.add_parser("list-sources", help="list the source registry")
    l.add_argument("--kind", default=None)
    l.set_defaults(func=cmd_list_sources)

    s = sub.add_parser("stats", help="database metadata")
    s.set_defaults(func=cmd_stats)

    t = sub.add_parser("test", help="run deterministic self-tests")
    t.set_defaults(func=cmd_test)
    return parser


def main(argv: Optional[list[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    return int(args.func(args) or 0)

"""CLI for the ROM discovery automation."""

from __future__ import annotations

import argparse
import json
import sys
from typing import Optional

from .database import DEFAULT_PATH, Database
from .discovery import build_queries, discover
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

    if args.dry_run:
        for query in build_queries(device, registry, max_queries=args.max_queries):
            print(query)
        return 0

    candidates, discarded = discover(device, backend=_backend(args), reg=registry,
                                     per_query=args.per_query, max_queries=args.max_queries)
    db.set_candidates(device, candidates)
    db.save()
    print(f"device            : {device.name} ({device.codename})")
    print(f"candidates kept   : {len(candidates)}")
    print(f"discarded (unregistered domains): {len(discarded)}")
    if args.verbose:
        for candidate in candidates:
            source = registry.match_url(candidate.url)
            print(f"  [{source.id if source else '?'}] {candidate.url}")
    print(f"saved -> {db.path}\nnext: validate")
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
        print(f"{source.kind:<18} trust={source.trust:>3} verify={'Y' if source.can_verify else 'n'} "
              f"{source.host}{'' if prefixes == '*' else ' ' + prefixes}")
    print(f"\n{len(sources)} sources")
    return 0


def cmd_stats(args: argparse.Namespace) -> int:
    db = Database(args.db)
    db._refresh_metadata()
    print(json.dumps(db.data["metadata"], indent=2))
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

    d = sub.add_parser("discover", help="search registered sources for a device")
    d.add_argument("--device", required=True, help='e.g. "Xiaomi Pad 5"')
    d.add_argument("--codename", required=True, help="e.g. nabu")
    d.add_argument("--manufacturer", default=None)
    d.add_argument("--alias", action="append", default=[], help="repeatable alternative name")
    d.add_argument("--per-query", type=int, default=8)
    d.add_argument("--max-queries", type=int, default=60)
    d.add_argument("--fixture", help="JSON fixture file instead of live search")
    d.add_argument("--offline", action="store_true", help="no network, yields zero candidates")
    d.add_argument("--dry-run", action="store_true", help="print the generated queries only")
    d.add_argument("-v", "--verbose", action="store_true")
    d.set_defaults(func=cmd_discover)

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

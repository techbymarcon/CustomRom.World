"""Query generation + discovery.

Queries are generated *from the registry*, so adding a source or family
automatically widens discovery. Bare codenames are never used alone (``nabu``
alone returns NABU the bird-conservation org), only combined with the device
name, manufacturer or a family/site scope.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

from .models import Candidate, Device
from .search import SearchBackend, SearchResult, default_backend
from .source_registry import Source, SourceRegistry, normalize_url, registry as default_registry

FAMILY_QUERY_TERMS = (
    "LineageOS", "crDroid", "Pixel Experience", "Evolution X", "ArrowOS", "PixelOS",
    "DerpFest", "Project Elixir", "RisingOS", "VoltageOS", "SuperiorOS",
    "Resurrection Remix", "Havoc-OS", "Paranoid Android", "CalyxOS", "GrapheneOS",
    "/e/OS", "iodeOS", "DivestOS",
)

SKIN_QUERY_TERMS = ("One UI", "HyperOS", "MIUI", "ColorOS", "OxygenOS", "Realme UI",
                    "Funtouch OS", "OriginOS", "Nothing OS", "MagicOS")


@dataclass
class DiscoveryPlan:
    device: Device
    queries: list[str]


def build_queries(device: Device, reg: SourceRegistry, *,
                  max_queries: int = 60) -> list[str]:
    name, code = device.name.strip(), device.codename.strip()
    quoted = f'"{name}"'
    base_targets = [f'{quoted} {code}']
    if device.manufacturer and device.manufacturer.lower() not in name.lower():
        base_targets.append(f'"{device.manufacturer} {name}" {code}')
    for alias in device.aliases:
        base_targets.append(f'"{alias}" {code}')

    queries: list[str] = []

    def add(q: str) -> None:
        if q not in queries:
            queries.append(q)

    # generic ROM intent
    for target in base_targets:
        add(f"{target} custom ROM download")
        add(f"{target} ROM build")

    # family-scoped (custom ROMs first, then skins/firmware)
    for family in FAMILY_QUERY_TERMS:
        add(f'{quoted} {code} {family}')
    for skin in SKIN_QUERY_TERMS:
        add(f'{quoted} {code} {skin} firmware')

    # domain-scoped queries against registered hosts only
    for source in reg.search_hosts():
        scope = f"site:{source.host}"
        if source.path_prefixes:
            scope += f" {source.path_prefixes[0].strip('/')}"
        if source.family:
            add(f'{scope} {code} {source.family}')
        else:
            add(f'{scope} {quoted} {code}')

    return queries[:max_queries]


def discover(device: Device, *, backend: SearchBackend | None = None,
             reg: SourceRegistry | None = None, per_query: int = 8,
             max_queries: int = 60) -> tuple[list[Candidate], list[str]]:
    """Run the plan and return (candidates, discarded_unregistered_urls)."""
    backend = backend or default_backend()
    reg = reg or default_registry
    queries = build_queries(device, reg, max_queries=max_queries)

    by_url: dict[str, Candidate] = {}
    discarded: list[str] = []

    for query in queries:
        results: Iterable[SearchResult] = backend.search(query, limit=per_query)
        for result in results:
            url = normalize_url(result.url)
            source: Source | None = reg.match_url(url)
            if source is None:
                discarded.append(url)          # unregistered domain -> dropped
                continue
            existing = by_url.get(url)
            if existing:
                existing.text = f"{existing.text} {result.snippet}".strip()
                continue
            by_url[url] = Candidate(
                url=url, title=result.title, text=result.snippet,
                source_id=source.id, query=query,
            )
    return list(by_url.values()), discarded

"""Source-first discovery.

Order of operations:

1. **Direct source pages** — every registered source may declare
   ``device_urls`` templates (LineageOS ``/devices/<codename>``, crDroid
   ``/<codename>``, XFU ``/miui/<codename>/`` …). These are fetched directly, so
   discovery does not depend on how Bing ranks anything.
2. **Source-specific search patterns** — ``query_templates`` per source
   (GitHub repos/releases, XDA threads, SourceForge file pages, firmware device
   pages), always domain-scoped and ordered by source authority.
3. **Generic web search fallback** — a handful of broad queries, last, and only
   as a fallback. Every result, whatever the stage, must resolve to a registered
   source or it is discarded before a candidate is ever created.

A bare codename (``nabu``) is never searched alone: it is always paired with the
device name, manufacturer, a ROM family or a ``site:`` scope.
"""

from __future__ import annotations

import concurrent.futures
import re
from dataclasses import dataclass
from typing import Iterable

from .models import Candidate, Device
from .search import SearchBackend, SearchResult, default_backend, fetch_page
from .source_registry import (Source, SourceRegistry, normalize_url,
                              registry as default_registry)

FAMILY_QUERY_TERMS = (
    "LineageOS", "crDroid", "Pixel Experience", "Evolution X", "ArrowOS", "PixelOS",
    "DerpFest", "Project Elixir", "RisingOS", "VoltageOS", "SuperiorOS",
    "Resurrection Remix", "Havoc-OS", "Paranoid Android", "CalyxOS", "GrapheneOS",
    "/e/OS", "iodeOS", "DivestOS",
)

SKIN_QUERY_TERMS = ("One UI", "HyperOS", "MIUI", "ColorOS", "OxygenOS", "Realme UI",
                    "Funtouch OS", "OriginOS", "Nothing OS", "MagicOS")


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


@dataclass
class DiscoveryPlan:
    device: Device
    probe_urls: list[str]
    queries: list[str]


def _fmt(template: str, device: Device, source: Source) -> str:
    prefix = source.path_prefixes[0].rstrip("/") if source.path_prefixes else ""
    return (template
            .replace("{code}", device.codename)
            .replace("{slug}", slugify(device.name))
            .replace("{q}", f'"{device.name}"')
            .replace("{host}", source.host)
            .replace("{prefix}", prefix))


def build_probe_urls(device: Device, reg: SourceRegistry) -> list[str]:
    """Direct source pages for this device, ordered by source authority."""
    urls: list[str] = []
    dev_mfg = device.manufacturer.lower().strip()
    for source in sorted(reg.sources, key=lambda s: -s.authority):
        if source.manufacturers:
            allowed = {m.lower().strip() for m in source.manufacturers}
            if dev_mfg not in allowed:
                continue
        for template in source.device_urls:
            url = _fmt(template, device, source)
            if url not in urls and reg.is_registered(url):
                urls.append(url)
    return urls


def build_source_queries(device: Device, reg: SourceRegistry) -> list[str]:
    """Source-specific, domain-scoped queries ordered by authority."""
    queries: list[str] = []
    dev_mfg = device.manufacturer.lower().strip()
    for source in sorted(reg.sources, key=lambda s: -s.authority):
        if source.manufacturers:
            allowed = {m.lower().strip() for m in source.manufacturers}
            if dev_mfg not in allowed:
                continue
        if source.source_class in {"DOWNLOAD_HOST", "ARCHIVE_MIRROR"} and not source.query_templates:
            continue
        templates = source.query_templates or (
            ("site:{host}{prefix} {code} {family}",) if source.family
            else ("site:{host}{prefix} {q} {code}",)
        )
        for template in templates:
            query = _fmt(template.replace("{family}", source.family or ""), device, source)
            query = re.sub(r"\s+", " ", query).strip()
            if query and query not in queries:
                queries.append(query)
    return queries


def build_fallback_queries(device: Device) -> list[str]:
    """Generic web search — fallback only, never a trust signal."""
    name, code = device.name.strip(), device.codename.strip()
    quoted = f'"{name}"'
    targets = [f"{quoted} {code}"]
    if device.manufacturer and device.manufacturer.lower() not in name.lower():
        targets.append(f'"{device.manufacturer} {name}" {code}')
    targets += [f'"{alias}" {code}' for alias in device.aliases]

    queries: list[str] = []

    def add(q: str) -> None:
        if q not in queries:
            queries.append(q)

    for target in targets:
        add(f"{target} custom ROM download")
        add(f"{target} ROM build")
    for family in FAMILY_QUERY_TERMS:
        add(f"{quoted} {code} {family}")
    for skin in SKIN_QUERY_TERMS:
        add(f"{quoted} {code} {skin} firmware")
    return queries


def build_queries(device: Device, reg: SourceRegistry, *,
                  max_queries: int = 60, include_fallback: bool = True) -> list[str]:
    """Source-scoped queries first, generic fallback last."""
    queries = build_source_queries(device, reg)
    if include_fallback:
        for query in build_fallback_queries(device):
            if query not in queries:
                queries.append(query)
    return queries[:max_queries]


def build_plan(device: Device, reg: SourceRegistry, *, max_queries: int = 60,
               include_fallback: bool = True) -> DiscoveryPlan:
    return DiscoveryPlan(
        device=device,
        probe_urls=build_probe_urls(device, reg),
        queries=build_queries(device, reg, max_queries=max_queries,
                              include_fallback=include_fallback),
    )


def _add(by_url: dict[str, Candidate], reg: SourceRegistry, discarded: list[str],
         url: str, title: str, text: str, query: str | None) -> None:
    url = normalize_url(url)
    source: Source | None = reg.match_url(url)
    if source is None:
        discarded.append(url)          # unregistered domain -> never a candidate
        return
    existing = by_url.get(url)
    if existing:
        if text and text not in existing.text:
            existing.text = f"{existing.text} {text}".strip()
        return
    by_url[url] = Candidate(url=url, title=title, text=text,
                            source_id=source.id, query=query)


def discover(device: Device, *, backend: SearchBackend | None = None,
             reg: SourceRegistry | None = None, per_query: int = 8,
             max_queries: int = 60, probe: bool = False,
             include_fallback: bool = True,
             max_probes: int = 60) -> tuple[list[Candidate], list[str]]:
    """Return (candidates, discarded_unregistered_urls)."""
    backend = backend or default_backend()
    reg = reg or default_registry
    plan = build_plan(device, reg, max_queries=max_queries,
                      include_fallback=include_fallback)

    by_url: dict[str, Candidate] = {}
    discarded: list[str] = []

    # 1. direct source pages (probed concurrently for speed)
    if probe and plan.probe_urls:
        urls_to_probe = plan.probe_urls[:max_probes]
        workers = min(10, len(urls_to_probe))
        with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as executor:
            future_to_url = {executor.submit(fetch_page, u): u for u in urls_to_probe}
            for future in concurrent.futures.as_completed(future_to_url):
                u = future_to_url[future]
                try:
                    page = future.result()
                except Exception:
                    page = None
                if page is not None:
                    title, text = page
                    _add(by_url, reg, discarded, u, title, text, query="direct:source")

    # 2./3. source-scoped queries, then generic fallback
    for query in plan.queries:
        results: Iterable[SearchResult] = backend.search(query, limit=per_query)
        for result in results:
            _add(by_url, reg, discarded, result.url, result.title, result.snippet, query)

    return list(by_url.values()), discarded

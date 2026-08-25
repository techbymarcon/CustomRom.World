"""Search backends.

Search engines are *discovery input only*. A backend that rate-limits, returns
202, or serves garbage yields zero results — it never influences trust, and the
pipeline degrades to "no candidates" instead of inventing ROMs.
"""

from __future__ import annotations

import html
import json
import os
import random
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Iterable, Protocol

UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
      "Chrome/124.0 Safari/537.36")


@dataclass
class SearchResult:
    url: str
    title: str = ""
    snippet: str = ""
    query: str = ""
    engine: str = ""


class SearchBackend(Protocol):
    name: str

    def search(self, query: str, limit: int = 10) -> list[SearchResult]: ...


def _fetch(url: str, timeout: float = 4.0, headers: dict[str, str] | None = None) -> tuple[int, str]:
    req = urllib.request.Request(url, headers={"User-Agent": UA, **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8", "replace")
            return resp.status, body
    except urllib.error.HTTPError as exc:  # 202 / 429 / 403 ...
        return exc.code, ""
    except Exception:
        return 0, ""


def fetch_page(url: str, timeout: float = 4.0) -> tuple[str, str] | None:
    """Fetch a direct source page. Returns (title, text) or None on any failure.

    Used for source-first probing: a 404/403/timeout simply means the device page
    does not exist on that source, never a fabricated candidate.
    """
    if os.environ.get("ROMDISCO_OFFLINE"):
        return None
    status, body = _fetch(url, timeout=timeout)
    if status != 200 or not body:
        return None

    # LineageOS official structured JSON API endpoint
    if "/api/v2/devices/" in url and url.endswith("/builds"):
        try:
            builds = json.loads(body)
            if not isinstance(builds, list) or not builds:
                return None
            lines = []
            links = []
            for b in builds:
                ver = b.get("version", "")
                date = b.get("date", "")
                b_type = b.get("type", "")
                files = b.get("files", [])
                zip_urls = [f["url"] for f in files if f.get("url") and f.get("filename", "").endswith(".zip")]
                links.extend(zip_urls)
                lines.append(f"LineageOS lineage-{ver} version {ver} build {date} {b_type} {' '.join(zip_urls)}")
            text = " ".join(lines)
            title = f"LineageOS {builds[0].get('version', '')} Builds"
            return title, f"{text} {' '.join(links)}".strip()
        except Exception:
            return None

    title_m = re.search(r"<title[^>]*>(.*?)</title>", body, re.S | re.I)
    title = _strip_tags(title_m.group(1)) if title_m else ""
    body = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", body, flags=re.S | re.I)

    raw_links = re.findall(r'href="([^"]+\.(?:zip|img|tar|tar\.md5|xz))"', body, re.I)
    abs_links = []
    for lk in raw_links:
        try:
            abs_l = urllib.parse.urljoin(url, lk)
            if abs_l not in abs_links:
                abs_links.append(abs_l)
        except Exception:
            pass

    links = " ".join(abs_links)
    text = re.sub(r"\s+", " ", _strip_tags(body))[:8000]
    return title, f"{text} {links}".strip()


def _strip_tags(text: str) -> str:
    return html.unescape(re.sub(r"<[^>]+>", " ", text)).strip()


class DuckDuckGoBackend:
    """DDG HTML endpoint without blocking delays on 202/429 anomaly pages."""

    name = "duckduckgo"

    def __init__(self, retries: int = 1, base_delay: float = 0.0) -> None:
        self.retries = retries
        self.base_delay = base_delay

    def search(self, query: str, limit: int = 10) -> list[SearchResult]:
        url = "https://html.duckduckgo.com/html/?q=" + urllib.parse.quote_plus(query)
        status, body = _fetch(url, timeout=3.0)
        if status == 200 and body and "result__a" in body:
            return self._parse(body, query)[:limit]
        return []


    def _parse(self, body: str, query: str) -> list[SearchResult]:
        out: list[SearchResult] = []
        for m in re.finditer(
            r'<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>(.*?)</a>', body, re.S
        ):
            href, title = m.group(1), _strip_tags(m.group(2))
            if "uddg=" in href:
                qs = urllib.parse.parse_qs(urllib.parse.urlsplit(href).query)
                href = (qs.get("uddg") or [href])[0]
            if href.startswith("http"):
                out.append(SearchResult(url=href, title=title, query=query, engine=self.name))
        return out


class BingBackend:
    """Bing result pages: tolerant parsing, zero results on any anomaly."""

    name = "bing"

    def search(self, query: str, limit: int = 10) -> list[SearchResult]:
        url = ("https://www.bing.com/search?q=" + urllib.parse.quote_plus(query)
               + f"&count={max(10, limit)}&setlang=en")
        status, body = _fetch(url, headers={"Accept-Language": "en-US,en;q=0.9"})
        if status != 200 or not body:
            return []
        out: list[SearchResult] = []
        for m in re.finditer(r'<li class="b_algo".*?</li>', body, re.S):
            block = m.group(0)
            a = re.search(r'<h2>\s*<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', block, re.S)
            if not a:
                continue
            href = html.unescape(a.group(1))
            if not href.startswith("http") or "bing.com" in href:
                continue
            snippet = ""
            p = re.search(r"<p[^>]*>(.*?)</p>", block, re.S)
            if p:
                snippet = _strip_tags(p.group(1))
            out.append(SearchResult(url=href, title=_strip_tags(a.group(2)),
                                    snippet=snippet, query=query, engine=self.name))
        return out[:limit]


class FixtureBackend:
    """Deterministic backend for tests / offline runs.

    Reads a JSON file: ``{"queries": {"<query substring>": [{url,title,snippet}]}}``
    or a flat list applied to every query.
    """

    name = "fixture"

    def __init__(self, path: str) -> None:
        with open(path, "r", encoding="utf-8") as fh:
            self.data = json.load(fh)

    def search(self, query: str, limit: int = 10) -> list[SearchResult]:
        items: list[dict] = []
        if isinstance(self.data, list):
            items = self.data
        else:
            for needle, results in (self.data.get("queries") or {}).items():
                if needle.lower() in query.lower():
                    items.extend(results)
            items.extend(self.data.get("always") or [])
        return [
            SearchResult(url=i["url"], title=i.get("title", ""), snippet=i.get("snippet", ""),
                         query=query, engine=self.name)
            for i in items
        ][:limit]


class NullBackend:
    name = "null"

    def search(self, query: str, limit: int = 10) -> list[SearchResult]:
        return []


class MultiBackend:
    """Tries each backend in order and merges de-duplicated results."""

    name = "multi"

    def __init__(self, backends: Iterable[SearchBackend]) -> None:
        self.backends = list(backends)

    def search(self, query: str, limit: int = 10) -> list[SearchResult]:
        seen: set[str] = set()
        out: list[SearchResult] = []
        for backend in self.backends:
            try:
                results = backend.search(query, limit=limit)
            except Exception:
                results = []
            for r in results:
                if r.url in seen:
                    continue
                seen.add(r.url)
                out.append(r)
            if len(out) >= limit:
                break
        return out[:limit]


def default_backend() -> SearchBackend:
    fixture = os.environ.get("ROMDISCO_FIXTURE")
    if fixture:
        return FixtureBackend(fixture)
    if os.environ.get("ROMDISCO_OFFLINE"):
        return NullBackend()
    return MultiBackend([DuckDuckGoBackend(), BingBackend()])

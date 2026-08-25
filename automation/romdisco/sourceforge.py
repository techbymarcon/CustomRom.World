"""SourceForge Direct Discovery Adapter.

Probes SourceForge project RSS/file endpoints directly for device codenames,
extracting concrete ROM release artifacts (.zip, .tgz) with deterministic metadata.
"""

from __future__ import annotations

import re
import urllib.request
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Optional

from .models import Candidate, Device

SOURCEFORGE_PROJECTS: tuple[tuple[str, str, tuple[str, ...]], ...] = (
    ("crdroid", "crDroid", ("crdroid", "crdroidandroid")),
    ("evolution-x", "Evolution X", ("evolution-x", "evolutionx")),
    ("derpfest", "DerpFest", ("derpfest",)),
    ("nameless-aosp", "Nameless-AOSP", ("nameless-aosp", "nameless")),
    ("projectmatrixx", "ProjectMatrixx", ("projectmatrixx", "matrixx")),
    ("ancientrom", "AncientOS", ("ancientrom", "ancientos")),
    ("infinity-x", "Infinity-X", ("infinity-x",)),
    ("pixelextended", "Pixel Extended", ("pixelextended",)),
    ("alphadroid-project", "AlphaDroid", ("alphadroid",)),
    ("projectblaze", "ProjectBlaze", ("projectblaze",)),
    ("mokee", "MoKee", ("mokee",)),
    ("aicp", "AICP", ("aicp",)),
    ("havoc-os", "Havoc-OS", ("havoc-os",)),
    ("superioros", "SuperiorOS", ("superioros",)),
    ("voltageos", "VoltageOS", ("voltageos",)),
    ("resurrectionremix", "Resurrection Remix", ("resurrectionremix", "rr")),
    ("pixelos-releases", "PixelOS", ("pixelos",)),
)

NON_ROM_MARKERS = (
    "recovery", "boot", "dtbo", "vbmeta", "vendor_boot", "vendor.img",
    "fastboot", "sha256", "md5", "changelog", "test", "gapps", "firmware",
)


def _probe_project(project: str, family: str, code: str, timeout: float = 3.0) -> list[Candidate]:
    candidates: list[Candidate] = []
    headers = {"User-Agent": "Mozilla/5.0 (CustomRom.World ROM Discovery Engine)"}
    
    # Try standard codename path
    urls = [f"https://sourceforge.net/projects/{project}/rss?path=/{code}"]
    if code != code.lower():
        urls.append(f"https://sourceforge.net/projects/{project}/rss?path=/{code.lower()}")
    elif code != code.capitalize():
        urls.append(f"https://sourceforge.net/projects/{project}/rss?path=/{code.capitalize()}")

    for url in urls:
        req = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                content = resp.read().decode("utf-8", errors="replace")
                if not content or "<rss" not in content:
                    continue
                root = ET.fromstring(content)
                for item in root.findall(".//item"):
                    title = item.findtext("title", "").strip()
                    link = item.findtext("link", "").strip()
                    pub_date = item.findtext("pubDate", "").strip()
                    desc = item.findtext("description", "").strip()
                    
                    if not title or not link:
                        continue
                    
                    # Must be a flashable ROM archive
                    lower_title = title.lower()
                    if not (lower_title.endswith(".zip") or lower_title.endswith(".tgz") or lower_title.endswith(".tar")):
                        continue
                    
                    # Skip recovery and partition images
                    if any(k in lower_title for k in NON_ROM_MARKERS):
                        continue
                    
                    # Ensure download link format
                    if not link.endswith("/download") and not link.endswith(".zip"):
                        dl_url = link.rstrip("/") + "/download"
                    else:
                        dl_url = link

                    text_block = f"{title} | {desc} | {pub_date} | SourceForge project: {project} for {code}"
                    cand = Candidate(
                        url=link,
                        title=f"[{family}] {title}",
                        text=text_block,
                        source_id="sourceforge",
                        query=f"sourceforge:{project}:{code}",
                        download_links=[dl_url],
                    )
                    candidates.append(cand)
                if candidates:
                    break
        except Exception:
            continue
            
    return candidates


def _probe_xiaomi_eu(code: str, timeout: float = 3.0) -> list[Candidate]:
    """Xiaomi.eu organizes releases by HyperOS / MIUI version folders containing codename tags."""
    candidates: list[Candidate] = []
    headers = {"User-Agent": "Mozilla/5.0 (CustomRom.World ROM Discovery Engine)"}
    folders = [
        "HyperOS-STABLE-RELEASES",
        "MIUIv14-STABLE-RELEASES",
        "MIUIv13-STABLE-RELEASES",
    ]
    code_pattern = re.compile(rf"[_\-]{re.escape(code)}[_\-]", re.I)

    for folder in folders:
        url = f"https://sourceforge.net/projects/xiaomi-eu-multilang-miui-roms/rss?path=/xiaomi.eu/{folder}"
        req = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                content = resp.read().decode("utf-8", errors="replace")
                if not content or "<rss" not in content:
                    continue
                root = ET.fromstring(content)
                for item in root.findall(".//item"):
                    title = item.findtext("title", "").strip()
                    link = item.findtext("link", "").strip()
                    pub_date = item.findtext("pubDate", "").strip()
                    if not title or not link or not title.lower().endswith(".zip"):
                        continue
                    if code_pattern.search(title):
                        dl_url = link if link.endswith("/download") else link.rstrip("/") + "/download"
                        text_block = f"{title} | Xiaomi.eu {folder} for {code} | {pub_date}"
                        candidates.append(Candidate(
                            url=link,
                            title=f"[Xiaomi.eu] {title}",
                            text=text_block,
                            source_id="sourceforge",
                            query=f"sourceforge:xiaomi-eu:{code}",
                            download_links=[dl_url],
                        ))
        except Exception:
            continue
    return candidates


def fetch_sourceforge_candidates(device: Device, max_workers: int = 16, timeout: float = 3.0) -> list[Candidate]:
    """Concurrently probe all registered SourceForge ROM projects for the device codename."""
    all_candidates: list[Candidate] = []
    code = device.codename
    
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {
            pool.submit(_probe_project, proj, fam, code, timeout): (proj, fam)
            for proj, fam, _ in SOURCEFORGE_PROJECTS
        }
        if device.manufacturer.lower() in {"xiaomi", "redmi", "poco"}:
            futures[pool.submit(_probe_xiaomi_eu, code, timeout)] = ("xiaomi-eu", "Xiaomi.eu")
            
        for fut in as_completed(futures):
            try:
                res = fut.result()
                if res:
                    all_candidates.extend(res)
            except Exception:
                continue
                
    return all_candidates

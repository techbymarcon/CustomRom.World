"""Strict candidate validation.

A candidate becomes a ROM entry only when it (a) comes from a registered source,
(b) demonstrably refers to the target device with *strong* evidence, (c) maps
onto an allowed ROM/skin family, and (d) shows **concrete** ROM/build evidence:
an artifact link, a device-specific official download page, a release/build page
tied to the device, or checksum/build metadata.

Being registered — even official — is never sufficient. Generic project
homepages, GitHub/GitLab organisation, search and profile URLs, tag/index pages,
guides, recovery and device-tree landing pages are rejected outright rather than
stored as ``unverified`` ROMs.

Status semantics:

``verified``
    concrete device-specific ROM/build evidence coming from a verifying source
    (official download/project/firmware database, or a concrete release page),
    or a concrete artifact tied to the device.
``unverified``
    plausible but not sufficient: community/mirror pages, code evidence,
    metadata-only pages.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional
from urllib.parse import urlsplit

from .extract import (find_artifacts, normalize_family, parse_android_version,
                      parse_build_date, parse_rom_version)
from .models import Candidate, Device, Evidence, Rejection, Rom, now_iso, rom_type_for_family
from .source_registry import Source, SourceRegistry, registry as default_registry

REJECT_PATTERNS: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"\b(device tree|kernel source|vendor tree|device sources)\b", re.I),
     "device tree / kernel source page"),
    (re.compile(r"\b(twrp|orangefox|recovery image|custom recovery)\b", re.I), "recovery page"),
    (re.compile(r"\b(how to (install|flash)|installation guide|step[- ]by[- ]step)\b", re.I),
     "installation guide"),
    (re.compile(r"\b(tag archives?|category archives?|index of tags|browse tags)\b", re.I),
     "tag / index page"),
    (re.compile(r"\b(build instructions|how to build|compile from source)\b", re.I),
     "build instructions"),
    (re.compile(r"\b(buy now|add to cart|price in|best price|offerta|prezzo)\b", re.I),
     "retail / store page"),
)

#: Weak page-level hints. They colour the evidence list but never validate alone.
WEAK_SIGNALS: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"\b(download|downloads|mirror)\b", re.I), "download_word"),
    (re.compile(r"\bnightly|weekly|stable|official build\b", re.I), "build_channel"),
    (re.compile(r"\b(changelog|release notes)\b", re.I), "changelog"),
)

#: Concrete build metadata: checksums, build numbers/sizes/dates.
METADATA_SIGNALS: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"\b(md5|sha256|sha1)\b", re.I), "checksum"),
    (re.compile(r"\bbuild (date|size|number)\b", re.I), "build_metadata"),
)

#: Content markers proving a page really lists builds for a device.
BUILD_CONTENT_RE = re.compile(
    r"(\.(?:zip|img|tar(?:\.md5)?|xz)\b|\bmd5\b|\bsha256\b|\bsha1\b|\bbuild (?:date|size|number)\b"
    r"|\bnightly\b|\bnightlies\b|\bofficial build\b|\bchangelog\b|\brelease[sd]?\b"
    r"|\bfirmware\b|\brecovery\.img\b|\bbuilds? for\b)", re.I)

#: Contexts in which an Android / ROM version number may be trusted.
VERSION_CONTEXT_RE = re.compile(
    r"(\brom\b|\bbuild\b|\bbuilds\b|\brelease[sd]?\b|\bnightly\b|\bfirmware\b|\bupdate\b"
    r"|\.zip\b|\.img\b|\bmd5\b|\bsha256\b|\bchangelog\b|\bbased on\b|\bflash\b)", re.I)

CODE_HOSTS = ("github.com", "gitlab.com", "codeberg.org", "review.lineageos.org")

#: Path fragments that indicate a concrete release / build / artifact page.
CODE_CONCRETE_RE = re.compile(
    r"(/releases(/|$)|/releases/download/|/tags?/|/-/releases|/-/tags|/downloads?(/|$)"
    r"|/raw/|/files/|\.(zip|img|xz|tar|apk)$)", re.I)

#: Generic code-host discovery URLs: org/profile pages and search pages.
CODE_GENERIC_PATH_RE = re.compile(
    r"^/?(search|orgs|explore|topics|trending|users)(/|$)|/-/search", re.I)

GENERIC_PAGE_PATHS = ("/", "/downloads", "/download", "/devices", "/index.html",
                      "/home", "/index.php", "/releases", "/news", "/blog")

#: Minimum evidence score required before a candidate becomes a ROM entry.
MIN_EVIDENCE_SCORE = 6

#: Concreteness ranking used for deduplication (higher wins).
TIER_RANK: dict[str, int] = {
    "artifact": 4,
    "device_download_page": 3,
    "release_page": 2,
    "metadata": 1,
}


def score_candidate(candidate: Candidate, device: Device, source: Source, *,
                    strong_device: bool, name_hit: bool, code_hit: bool,
                    family: Optional[str], build_signals: list[str],
                    generic_page: bool, tier: Optional[str] = None) -> int:
    """Additive evidence score. Source class contributes, but never alone."""
    score = 0
    if strong_device:
        score += 3 if source.is_authoritative else 2
    if code_hit:
        score += 1
    if name_hit:
        score += 2
    if family:
        score += 2
    score += TIER_RANK.get(tier or "", 0)
    if "artifact_link" in build_signals or "artifact_extension" in build_signals:
        score += 1
    if "checksum" in build_signals or "build_metadata" in build_signals:
        score += 1
    score += {"OFFICIAL": 3, "FIRMWARE_DATABASE": 2, "DEVELOPMENT": 2,
              "COMMUNITY": 1, "REFERENCE": 0, "DOWNLOAD_HOST": 0,
              "ARCHIVE_MIRROR": 0}.get(source.source_class, 0)
    if generic_page:
        score -= 4
    return score


@dataclass
class ValidationOutcome:
    rom: Optional[Rom] = None
    rejection: Optional[Rejection] = None


def _device_tokens(device: Device) -> list[str]:
    tokens = [device.name, device.codename, *device.aliases]
    return [t.lower() for t in tokens if t]


def _path_of(url: str) -> str:
    parts = urlsplit(url)
    path = parts.path or "/"
    return path if path.startswith("/") else "/" + path


def device_match(candidate: Candidate, device: Device) -> tuple[bool, list[Evidence], bool]:
    """Return (matches, evidence, strong_match).

    Strong evidence = codename inside the URL path of a registered source, or an
    explicit device-name + codename context in page content. A bare codename in
    generic site text is never strong (and never sufficient on its own).
    """
    haystack = " ".join([candidate.url, candidate.title, candidate.text]).lower()
    code = device.codename.lower()
    evidence: list[Evidence] = []
    sid = candidate.source_id or "unknown"

    name_variants = [device.name.lower(), *[a.lower() for a in device.aliases]]
    name_hit = any(v and v in haystack for v in name_variants)
    if not name_hit:
        compact = re.sub(r"[^a-z0-9]", "", device.name.lower())
        name_hit = bool(compact) and compact in re.sub(r"[^a-z0-9]", "", haystack)

    path = _path_of(candidate.url).lower()
    url_code = bool(re.search(rf"[/\-_=]{re.escape(code)}([/\-_.?&]|$)", path))
    text_code = bool(re.search(rf"\b{re.escape(code)}\b",
                               f"{candidate.title} {candidate.text}".lower()))

    if url_code:
        evidence.append(Evidence("codename_in_url", f"codename '{code}' in URL path", sid,
                                 candidate.url))
    elif text_code:
        evidence.append(Evidence("codename_match", f"codename '{code}' mentioned", sid,
                                 candidate.url))
    if name_hit:
        evidence.append(Evidence("device_name_match", f"device name '{device.name}' mentioned",
                                 sid, candidate.url))

    strong = url_code or (text_code and name_hit)
    return strong, evidence, strong


def _segments(text: str) -> list[str]:
    return [s for s in re.split(r"[\n\r|;•]+|(?<=[.!?])\s+", text) if s.strip()]


def _contextual(text: str, parser, device: Device, *args) -> Optional[str]:
    """Run ``parser`` only on segments that carry a ROM/build/device context."""
    code = device.codename.lower()
    for segment in _segments(text):
        low = segment.lower()
        if not (VERSION_CONTEXT_RE.search(low) or code in low):
            continue
        value = parser(segment, *args)
        if value:
            return value
    if VERSION_CONTEXT_RE.search(text.lower()):
        return parser(text, *args)
    return None


def _is_code_host(host: str) -> bool:
    return any(host == h or host.endswith("." + h) for h in CODE_HOSTS)


def classify_page(candidate: Candidate, source: Source) -> tuple[bool, Optional[str]]:
    """Return (generic_page, rejection_reason_if_structurally_generic)."""
    parts = urlsplit(candidate.url)
    host = parts.netloc.lower().removeprefix("www.")
    path = _path_of(candidate.url)
    query = parts.query

    if _is_code_host(host):
        segments = [s for s in path.split("/") if s]
        if CODE_GENERIC_PATH_RE.search(path):
            return True, "generic code-host search / listing page"
        if len(segments) <= 1:
            return True, "code-host organisation / profile page"
        if query and re.search(r"\b(q|type|search)=", query) and not CODE_CONCRETE_RE.search(path):
            return True, "code-host search query URL"
        return False, None

    if path.rstrip("/") in ("", *[p.rstrip("/") for p in GENERIC_PAGE_PATHS]):
        return True, "generic source landing page"
    return False, None


def _build_tier(candidate: Candidate, device: Device, source: Source, *,
                haystack: str, artifacts: list[str], strong_device: bool,
                url_code: bool) -> tuple[Optional[str], list[str]]:
    """Classify concrete build evidence. Returns (tier, signals)."""
    signals: list[str] = []
    path = _path_of(candidate.url)

    if artifacts or (candidate.download_url and re.search(
            r"\.(zip|img|tar(\.md5)?|apk|xz)(\?|$)", candidate.download_url, re.I)):
        signals.append("artifact_link")
    if re.search(r"\.(zip|img|tar(\.md5)?|apk|xz)\b", haystack, re.I):
        signals.append("artifact_extension")
    for pattern, label in METADATA_SIGNALS:
        if pattern.search(haystack):
            signals.append(label)
    for pattern, label in WEAK_SIGNALS:
        if pattern.search(haystack):
            signals.append(label)

    has_build_content = bool(BUILD_CONTENT_RE.search(haystack))

    if "artifact_link" in signals or "artifact_extension" in signals:
        return "artifact", signals

    # A registered official download/project/firmware page whose URL path carries the
    # target codename is a genuine device page. Many of them render builds via JS, so
    # in-page build markers are a bonus, not a requirement. Code hosts are excluded:
    # their org/search/profile URLs are handled by classify_page and never reach here
    # as device pages.
    device_download_page = (
        source.kind in {"official_download", "official_project", "firmware_database"}
        and url_code
        and not _is_code_host(urlsplit(candidate.url).netloc.lower().removeprefix("www."))
    )
    if device_download_page:
        signals.append("device_download_page")
        if has_build_content:
            signals.append("device_build_listing")
        return "device_download_page", signals

    release_page = (
        bool(re.search(r"/(releases?|builds?|downloads?|files)(/|$)", path, re.I))
        and strong_device and has_build_content
    )
    if release_page:
        signals.append("release_page")
        return "release_page", signals

    if any(s in signals for s in ("checksum", "build_metadata")) and strong_device:
        return "metadata", signals

    return None, signals


def validate_candidate(candidate: Candidate, device: Device, *,
                       reg: SourceRegistry | None = None) -> ValidationOutcome:
    reg = reg or default_registry
    source: Source | None = reg.match_url(candidate.url)
    if source is None:
        return ValidationOutcome(rejection=Rejection(candidate.url, "unregistered source domain"))

    sid = source.id
    haystack = " \n ".join(filter(None, [candidate.title, candidate.text]))
    artifacts = find_artifacts(f"{haystack} {' '.join(candidate.download_links)}")
    evidence: list[Evidence] = [
        Evidence("registered_source", f"{source.name} ({source.kind}, trust {source.trust})", sid,
                 source.canonical_url)
    ]

    strong_device, device_evidence, _ = device_match(candidate, device)
    if not strong_device:
        return ValidationOutcome(rejection=Rejection(
            candidate.url, "no strong device evidence (codename in device URL or name+codename)"))
    evidence.extend(device_evidence)

    generic_page, generic_reason = classify_page(candidate, source)
    url_code = any(e.kind == "codename_in_url" for e in evidence)

    tier, build_signals = _build_tier(candidate, device, source, haystack=haystack,
                                      artifacts=artifacts, strong_device=strong_device,
                                      url_code=url_code)

    if generic_page and tier not in {"artifact", "device_download_page", "release_page"}:
        return ValidationOutcome(rejection=Rejection(
            candidate.url, generic_reason or "generic landing page without device build evidence"))

    for pattern, label in REJECT_PATTERNS:
        if pattern.search(haystack) and tier != "artifact":
            return ValidationOutcome(rejection=Rejection(candidate.url, f"rejected: {label}"))

    if tier is None:
        return ValidationOutcome(rejection=Rejection(
            candidate.url, "no concrete ROM/build evidence"))

    for label in dict.fromkeys(build_signals):
        evidence.append(Evidence(label, "ROM/build evidence on the page", sid, candidate.url))
    evidence.append(Evidence("build_evidence_tier", tier, sid, candidate.url))

    family = (normalize_family(candidate.title)
              or normalize_family(candidate.text)
              or (source.family if source.family else None)
              or normalize_family(candidate.url))
    if not family:
        return ValidationOutcome(rejection=Rejection(candidate.url, "ROM family not in allowed list"))
    evidence.append(Evidence("family_resolved", family, sid, candidate.url))

    android_version = (_contextual(candidate.title, parse_android_version, device, family)
                       or _contextual(candidate.text, parse_android_version, device, family))
    rom_version = (_contextual(candidate.title, parse_rom_version, device, family)
                   or _contextual(candidate.text, parse_rom_version, device, family))
    build_date = parse_build_date(candidate.title) or parse_build_date(candidate.text)

    name_hit = any(e.kind == "device_name_match" for e in evidence)
    code_hit = url_code or any(e.kind == "codename_match" for e in evidence)
    score = score_candidate(candidate, device, source, strong_device=strong_device,
                            name_hit=name_hit, code_hit=code_hit, family=family,
                            build_signals=build_signals, generic_page=generic_page,
                            tier=tier)
    if score < MIN_EVIDENCE_SCORE:
        return ValidationOutcome(rejection=Rejection(
            candidate.url, f"insufficient evidence (score {score} < {MIN_EVIDENCE_SCORE})"))
    evidence.append(Evidence("evidence_score", str(score), sid, candidate.url))

    download_url = candidate.download_url or (artifacts[0] if artifacts else None)

    verified = False
    if source.kind != "mirror" and source.source_class not in {"ARCHIVE_MIRROR", "DOWNLOAD_HOST"}:
        if tier == "artifact" and source.can_verify:
            verified = True
        elif tier == "device_download_page":
            verified = source.can_verify
        elif tier == "release_page":
            verified = source.can_verify

    rom = Rom(
        id=Rom.make_id(device.codename, family, rom_version, android_version, build_date),
        name=family,
        type=rom_type_for_family(family),
        device=device.name,
        codename=device.codename,
        android_version=android_version,
        rom_version=rom_version,
        build_date=build_date,
        status="verified" if verified else "unverified",
        source_url=candidate.url,
        download_url=download_url,
        source_id=sid,
        evidence=evidence,
        discovered_at=now_iso(),
        updated_at=now_iso(),
    )
    return ValidationOutcome(rom=rom)


def validate_all(candidates: list[Candidate], device: Device, *,
                 reg: SourceRegistry | None = None) -> tuple[list[Rom], list[Rejection]]:
    roms: dict[str, Rom] = {}
    rejections: list[Rejection] = []
    for candidate in candidates:
        outcome = validate_candidate(candidate, device, reg=reg)
        if outcome.rejection:
            rejections.append(outcome.rejection)
            continue
        rom = outcome.rom
        assert rom is not None
        existing = roms.get(rom.identity)
        if existing is None:
            roms[rom.identity] = rom
            continue
        roms[rom.identity] = _prefer(existing, rom, reg or default_registry)
    return list(roms.values()), rejections


def _tier_of(rom: Rom) -> int:
    for e in rom.evidence:
        kind = e["kind"] if isinstance(e, dict) else e.kind
        detail = e["detail"] if isinstance(e, dict) else e.detail
        if kind == "build_evidence_tier":
            return TIER_RANK.get(detail, 0)
    return 0


def _prefer(a: Rom, b: Rom, reg: SourceRegistry) -> Rom:
    """Prefer the most concrete record: artifact > official device page > release > code."""

    def score(r: Rom) -> tuple[int, int, int, int, int]:
        src = reg.get(r.source_id)
        return (1 if r.download_url else 0,
                _tier_of(r),
                1 if r.status == "verified" else 0,
                src.authority if src else 0,
                len(r.evidence))

    winner, loser = (a, b) if score(a) >= score(b) else (b, a)
    if not winner.download_url and loser.download_url:
        winner.download_url = loser.download_url
    seen = {(e.kind, e.detail) if isinstance(e, Evidence) else None for e in winner.evidence}
    for e in loser.evidence:
        if (e.kind, e.detail) not in seen:
            winner.evidence.append(e)
    winner.updated_at = now_iso()
    return winner

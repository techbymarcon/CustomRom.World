"""Strict candidate validation.

A candidate becomes a ROM entry only when it (a) comes from a registered source,
(b) demonstrably refers to the target device, (c) maps onto an allowed ROM/skin
family, and (d) shows real ROM/build evidence rather than a guide, kernel,
recovery, device tree, tag/index or store page.

Verification (``status = verified``) needs a verifying source *or* corroborating
evidence: a concrete artifact/build page plus a strong device match.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Optional

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

BUILD_EVIDENCE: tuple[tuple[re.Pattern[str], str], ...] = (
    (re.compile(r"\.(zip|img|tar(\.md5)?|apk|xz)\b", re.I), "artifact_extension"),
    (re.compile(r"\b(md5|sha256|sha1)\b", re.I), "checksum"),
    (re.compile(r"\bbuild (date|size|number)\b", re.I), "build_metadata"),
    (re.compile(r"\b(download|downloads|mirror|release[sd]?|changelog)\b", re.I),
     "download_section"),
    (re.compile(r"\bnightly|weekly|stable|official build\b", re.I), "build_channel"),
)

GENERIC_PAGE_PATHS = ("/", "/downloads", "/download", "/devices", "/index.html")

#: Minimum evidence score required before a candidate becomes a ROM entry.
MIN_EVIDENCE_SCORE = 5


def score_candidate(candidate: Candidate, device: Device, source: Source, *,
                    strong_device: bool, name_hit: bool, code_hit: bool,
                    family: Optional[str], build_signals: list[str],
                    generic_page: bool) -> int:
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
    if "artifact_link" in build_signals or "artifact_extension" in build_signals:
        score += 2
    if "checksum" in build_signals or "build_metadata" in build_signals:
        score += 1
    if "download_link" in build_signals or "download_section" in build_signals:
        score += 1
    score += {"OFFICIAL": 3, "FIRMWARE_DATABASE": 2, "DEVELOPMENT": 2,
              "COMMUNITY": 1, "REFERENCE": 0, "DOWNLOAD_HOST": 0,
              "ARCHIVE_MIRROR": 0}.get(source.source_class, 0)
    if generic_page:
        score -= 3
    return score


@dataclass
class ValidationOutcome:
    rom: Optional[Rom] = None
    rejection: Optional[Rejection] = None


def _device_tokens(device: Device) -> list[str]:
    tokens = [device.name, device.codename, *device.aliases]
    return [t.lower() for t in tokens if t]


def device_match(candidate: Candidate, device: Device) -> tuple[bool, list[Evidence], bool]:
    """Return (matches, evidence, strong_match).

    A bare codename hit in unrelated prose is not enough on its own: it must be
    accompanied by the device/manufacturer name, or appear in the URL path of a
    registered ROM source.
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

    url_code = bool(re.search(rf"[/\-_=]{re.escape(code)}([/\-_.?&]|$)", candidate.url.lower()))
    text_code = bool(re.search(rf"\b{re.escape(code)}\b", haystack))

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
    matches = strong or (name_hit and text_code)
    return matches, evidence, strong


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

    matched, device_evidence, strong_device = device_match(candidate, device)
    if not matched:
        return ValidationOutcome(rejection=Rejection(candidate.url, "does not refer to the target device"))
    evidence.extend(device_evidence)

    # build/download evidence
    build_signals = [label for pattern, label in BUILD_EVIDENCE if pattern.search(haystack)]
    if artifacts:
        build_signals.append("artifact_link")
    if candidate.download_url or candidate.download_links:
        build_signals.append("download_link")
    for label in dict.fromkeys(build_signals):
        evidence.append(Evidence(label, "ROM/build evidence on the page", sid, candidate.url))

    for pattern, label in REJECT_PATTERNS:
        if pattern.search(haystack) and not build_signals:
            return ValidationOutcome(rejection=Rejection(candidate.url, f"rejected: {label}"))
    if not build_signals:
        return ValidationOutcome(rejection=Rejection(candidate.url, "no ROM/build evidence"))

    # generic landing pages of otherwise trusted sources
    path = "/" + candidate.url.split("://", 1)[-1].split("/", 1)[-1] if "://" in candidate.url else "/"
    if path in GENERIC_PAGE_PATHS and not strong_device:
        return ValidationOutcome(rejection=Rejection(candidate.url, "generic landing page"))

    family = (normalize_family(candidate.title)
              or normalize_family(candidate.text)
              or (source.family if source.family else None)
              or normalize_family(candidate.url))
    if not family:
        return ValidationOutcome(rejection=Rejection(candidate.url, "ROM family not in allowed list"))
    evidence.append(Evidence("family_resolved", family, sid, candidate.url))

    android_version = parse_android_version(candidate.title) or parse_android_version(candidate.text)
    rom_version = (parse_rom_version(candidate.title, family)
                   or parse_rom_version(candidate.text, family))
    build_date = parse_build_date(candidate.title) or parse_build_date(candidate.text)

    haystack_l = f"{candidate.url} {haystack}".lower()
    code_hit = bool(re.search(rf"\b{re.escape(device.codename.lower())}\b", haystack_l))
    name_hit = any(e.kind == "device_name_match" for e in evidence)
    generic_page = path in GENERIC_PAGE_PATHS
    score = score_candidate(candidate, device, source, strong_device=strong_device,
                            name_hit=name_hit, code_hit=code_hit, family=family,
                            build_signals=build_signals, generic_page=generic_page)
    if score < MIN_EVIDENCE_SCORE:
        return ValidationOutcome(rejection=Rejection(
            candidate.url, f"insufficient evidence (score {score} < {MIN_EVIDENCE_SCORE})"))
    evidence.append(Evidence("evidence_score", str(score), sid, candidate.url))

    has_artifact = bool(artifacts or candidate.download_url)
    verified = (source.can_verify and strong_device) or (has_artifact and strong_device)
    if source.kind == "mirror":
        verified = False  # mirrors may supply downloads, never establish existence

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
        download_url=candidate.download_url or (artifacts[0] if artifacts else None),
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


def _prefer(a: Rom, b: Rom, reg: SourceRegistry) -> Rom:
    def score(r: Rom) -> tuple[int, int, int]:
        src = reg.get(r.source_id)
        return (1 if r.status == "verified" else 0,
                src.trust if src else 0,
                (1 if r.download_url else 0) + len(r.evidence))
    winner, loser = (a, b) if score(a) >= score(b) else (b, a)
    if not winner.download_url and loser.download_url:
        winner.download_url = loser.download_url
    seen = {(e.kind, e.detail) if isinstance(e, Evidence) else None for e in winner.evidence}
    for e in loser.evidence:
        if (e.kind, e.detail) not in seen:
            winner.evidence.append(e)
    winner.updated_at = now_iso()
    return winner

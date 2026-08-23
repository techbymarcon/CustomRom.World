# romdisco — ROM discovery automation

A clean, standalone Python package (no dependencies, stdlib only) that discovers
and validates Android custom ROMs and stock skin/firmware builds for a device
and produces a database that maps 1:1 onto the CustomRom World ROM cards
(`src/lib/rom-import.ts`). It does not touch the web app.

```
automation/
  rom_discovery.py        CLI entry point
  romdisco/
    source_registry.py    curated sources: exact host/path match, kinds, trust
    models.py             dataclasses + JSON schema (metadata/devices/sources/roms)
    extract.py            family / Android version / ROM version / build date
    search.py             DDG + Bing + fixture backends (discovery input only)
    discovery.py          registry-driven query generation
    validation.py         strict validation, verification, dedupe
    database.py           JSON database load/save/export
    cli.py, tests.py
  data/rom_database.json  working database (created on first run)
```

## CLI (Termux)

Stdlib-only Python 3 — no Node, browser or extra pip packages. From
`~/customrom-importer` (the directory that *contains* `automation/`):

```bash
pkg install python           # once
cd ~/customrom-importer

python -m automation test
python -m automation inspect-source xdaforums.com
python -m automation inspect-source github.com/LineageOS
python -m automation inspect-source mi.com          # -> NOT REGISTERED (exit 1)
python -m automation discover --device "Xiaomi Pad 5" --codename nabu
```

Full command set:

```bash
python -m automation discover --device "Xiaomi Pad 5" --codename nabu --alias "Mi Pad 5"
python -m automation discover --device "Xiaomi Pad 5" --codename nabu --dry-run     # probe URLs + queries
python -m automation discover --device "Xiaomi Pad 5" --codename nabu --no-fallback # registered sources only
python -m automation discover --device "Xiaomi Pad 5" --codename nabu --no-probe    # search only
python -m automation validate
python -m automation export roms.json [--verified-only]
python -m automation list-sources --kind firmware_database
python -m automation stats
```

`python automation/rom_discovery.py <command>` remains an equivalent entry point.

Offline / deterministic runs: `--offline` (zero candidates) or
`--fixture results.json` (also via `ROMDISCO_OFFLINE` / `ROMDISCO_FIXTURE`).

## Source-first pipeline

1. **Direct source pages.** Each source may declare `device_urls` templates
   (`download.lineageos.org/devices/{code}`, `crdroid.net/{code}`,
   `xiaomifirmwareupdater.com/miui/{code}/`, `samfw.com/firmware/{slug}`, GitHub
   org search …). They are fetched directly, so discovery does not depend on a
   search engine ranking anything. A 404/403/timeout yields nothing.
2. **Source-specific search patterns.** `query_templates` per source, always
   domain-scoped and ordered by source authority: GitHub/GitLab repos and
   releases, XDA threads, SourceForge/AFH project & file pages, firmware-database
   device pages.
3. **Generic web search — fallback only** (`--no-fallback` disables it).

Every URL from every stage must resolve to a registered source, otherwise it is
discarded before a candidate exists.

## Source classes

`OFFICIAL` (official project/download) > `FIRMWARE_DATABASE` > `DEVELOPMENT`
(official code orgs) > `COMMUNITY` (XDA, 4PDA, SourceForge, generic GitHub) >
`REFERENCE` (AOSP docs/gerrit) > `DOWNLOAD_HOST` (AFH, Drive, MEGA, MediaFire) >
`ARCHIVE_MIRROR` (Telegram, Reddit, Wayback). `Source.authority` ranks class
first, trust second; file hosts and mirrors are never authoritative.

Subdomains of a registered base domain inherit its class
(`wiki.lineageos.org`, `mirrorbits.lineageos.org`), while lookalikes
(`lineageos.org.rom-download.xyz`, `not-lineageos.org`, `github.com.evil.io`)
never match.

## Evidence scoring

Each candidate accumulates points for a strong device match (codename in a
trusted URL path), codename mention, device name, resolved ROM family, artifact /
checksum / build metadata / download links, plus a source-class bonus; generic
landing pages are penalised. Candidates below `MIN_EVIDENCE_SCORE` are rejected
with the score in the rejection reason.

## Trust model

Trust lives **only** in `source_registry.py` and is decided by exact host plus
optional path prefix — never by substring matching on page text. Unregistered
domains (mi.com, mistoreitalia.com, amazon.com, aranzulla.it, wikipedia.org,
unieuro.it, …) are discarded during discovery.

Source kinds: `official_project`, `official_download`, `official_code`,
`firmware_database`, `community`, `mirror`, `reference`. Only the first four can
mark an entry `verified`; `mirror` sources (Reddit, Telegram, Drive, MEGA,
MediaFire) may contribute a download URL but never establish that a ROM exists.
Community sources (XDA, GitHub, SourceForge, AndroidFileHost) are discovery
evidence and need a concrete artifact/build page plus a strong device match to
reach `verified`.

Adding ROMs, skins or sources is a data edit in `SOURCES` / `FAMILY_ALIASES` —
the filtering logic stays untouched. Nothing is hardcoded to Xiaomi Pad 5.

## Discovery

Queries are generated from the registry and always combine the quoted device
name with the codename (`"Xiaomi Pad 5" nabu LineageOS`), plus domain-scoped
queries (`site:xdaforums.com nabu …`). A bare codename is never searched alone.
Search engines are input only: DDG 202/429 interstitials are retried with
exponential backoff and then yield nothing; Bing anomaly pages yield nothing.
Garbage HTML therefore produces zero candidates instead of fake ROMs.

## Validation

Each candidate must resolve to a registered source, demonstrably refer to the
target device (codename in URL path, or codename + device name in text), map to
an allowed ROM/skin family, and show real ROM/build evidence (artifact, checksum,
build metadata, download/release section). Guides, build instructions, kernels,
device trees, recoveries, tag/index pages, retail pages and generic landing
pages are rejected. Android version and ROM version are extracted separately and
stay `null` when not explicitly evidenced. Deduplication uses
family + codename + ROM version + Android version + build date, so different
versions of the same ROM coexist.

## Database schema

```json
{
  "metadata": { "schema_version": 2, "updated_at": "...", "counts": {} },
  "devices":  [{ "id": "xiaomi:nabu", "name": "...", "codename": "nabu", "manufacturer": "...", "aliases": [] }],
  "sources":  [{ "id": "lineageos_dl", "kind": "official_download", "host": "...", "trust": 100, "can_verify": true }],
  "roms": [{
    "id": "…", "name": "LineageOS", "type": "custom_rom", "device": "Xiaomi Pad 5",
    "codename": "nabu", "android_version": "Android 14", "rom_version": "21.0",
    "build_date": "2024-03-20", "status": "verified",
    "source_url": "…", "download_url": "…", "source_id": "lineageos_dl",
    "evidence": [{ "kind": "artifact_link", "detail": "…", "source_id": "…", "url": "…" }],
    "discovered_at": "…", "updated_at": "…"
  }]
}
```

Sources are stored once and referenced by `source_id`.

## Tests

`python -m automation test` (28 tests) asserts (among others) that mi.com,
mistoreitalia.com, amazon.com, aranzulla.it, wikipedia.org and unieuro.it are
rejected, while xdaforums.com (community), github.com/LineageOS (official_code),
sourceforge.net, androidfilehost.com (community), lineageos.org
(official_project), hyperosupdates.com and xiaomifirmwareupdater.com
(firmware_database) are accepted in the correct category; that approved
subdomains inherit trust while lookalike domains do not; that file hosts rank
below official sources and cannot verify — plus extraction, dedupe,
mirror-never-verified, unrelated-codename, source-first ordering and
zero-result behaviour.

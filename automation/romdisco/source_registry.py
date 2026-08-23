"""Curated source registry.

Trust is decided *only* here, by exact host (and optional path prefix) matching.
Search-engine HTML is discovery input; it can never grant trust. Any URL whose
host is not registered is discarded by the pipeline.

Adding a ROM/skin/source is a data change in ``SOURCES`` — no filtering logic
needs to be touched.
"""

from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Any, Iterable, Literal, Optional
from urllib.parse import urlsplit, urlunsplit

SourceKind = Literal[
    "official_project",
    "official_download",
    "official_code",
    "firmware_database",
    "community",
    "mirror",
    "reference",
]

#: Kinds that may, on their own, mark a ROM entry as ``verified``.
VERIFYING_KINDS: frozenset[str] = frozenset(
    {"official_project", "official_download", "official_code", "firmware_database"}
)

#: Coarse source classes used for ranking / authority decisions.
SourceClass = Literal[
    "OFFICIAL", "DEVELOPMENT", "FIRMWARE_DATABASE", "COMMUNITY",
    "DOWNLOAD_HOST", "ARCHIVE_MIRROR", "REFERENCE",
]

KIND_TO_CLASS: dict[str, str] = {
    "official_project": "OFFICIAL",
    "official_download": "OFFICIAL",
    "official_code": "DEVELOPMENT",
    "firmware_database": "FIRMWARE_DATABASE",
    "community": "COMMUNITY",
    "mirror": "ARCHIVE_MIRROR",
    "reference": "REFERENCE",
}

#: Pure file hosts / mirrors: they may carry a download URL, never authority.
DOWNLOAD_HOST_IDS: frozenset[str] = frozenset(
    {"afh", "gdrive", "mega", "mediafire"}
)
ARCHIVE_IDS: frozenset[str] = frozenset({"archive", "wayback", "reddit", "telegram",
                                         "telegram_me"})

#: Higher = more authoritative. Official projects outrank everything, file hosts
#: and mirrors sit at the bottom and can never establish that a ROM exists.
CLASS_AUTHORITY: dict[str, int] = {
    "OFFICIAL": 6,
    "FIRMWARE_DATABASE": 5,
    "DEVELOPMENT": 4,
    "COMMUNITY": 3,
    "REFERENCE": 2,
    "DOWNLOAD_HOST": 1,
    "ARCHIVE_MIRROR": 0,
}


@dataclass(frozen=True)
class Source:
    id: str
    name: str
    kind: SourceKind
    host: str
    canonical_url: str
    trust: int                      # 0-100
    path_prefixes: tuple[str, ...] = ()   # empty -> whole host allowed
    family: Optional[str] = None          # ROM family this source is authoritative for
    include_subdomains: bool = True        # subdomains inherit the trust class
    device_urls: tuple[str, ...] = ()      # direct probe templates ({codename}, {slug})
    query_templates: tuple[str, ...] = ()  # source-specific search patterns

    @property
    def can_verify(self) -> bool:
        return self.kind in VERIFYING_KINDS

    @property
    def source_class(self) -> str:
        if self.id in DOWNLOAD_HOST_IDS:
            return "DOWNLOAD_HOST"
        if self.id in ARCHIVE_IDS:
            return "ARCHIVE_MIRROR"
        return KIND_TO_CLASS.get(self.kind, "COMMUNITY")

    @property
    def authority(self) -> int:
        """Combined ranking: class first, trust as tie-breaker."""
        return CLASS_AUTHORITY.get(self.source_class, 0) * 1000 + self.trust

    @property
    def is_authoritative(self) -> bool:
        return self.source_class in {"OFFICIAL", "FIRMWARE_DATABASE", "DEVELOPMENT"}

    def matches(self, host: str, path: str) -> bool:
        """Exact host, or a real subdomain of it — never a lookalike suffix."""
        if host != self.host:
            if not (self.include_subdomains and host.endswith("." + self.host)):
                return False
        if not self.path_prefixes:
            return True
        p = path if path.startswith("/") else "/" + path
        return any(p.lower().startswith(prefix.lower()) for prefix in self.path_prefixes)

    def to_json(self) -> dict[str, Any]:
        d = asdict(self)
        d["path_prefixes"] = list(self.path_prefixes)
        d["device_urls"] = list(self.device_urls)
        d["query_templates"] = list(self.query_templates)
        d["can_verify"] = self.can_verify
        d["source_class"] = self.source_class
        d["authority"] = self.authority
        return d



#: Source-specific search patterns. ``{q}`` = quoted device name,
#: ``{code}`` = codename, ``{slug}`` = slugified device name.
GITHUB_QUERIES = (
    "site:{host}{prefix} {code}",
    "site:{host}{prefix} {code} releases",
    "site:{host}{prefix} device_{code}",
)


def _gh(org: str, family: str, sid: str, trust: int = 85) -> Source:
    return Source(
        id=sid, name=f"{family} on GitHub", kind="official_code", host="github.com",
        canonical_url=f"https://github.com/{org}", trust=trust,
        path_prefixes=(f"/{org}/",), family=family,
        device_urls=(
            f"https://github.com/{org}?q={{code}}&type=all",
            f"https://github.com/search?q=org%3A{org}+{{code}}&type=repositories",
        ),
        query_templates=GITHUB_QUERIES,
    )


def _gl(group: str, family: str, sid: str) -> Source:
    return Source(
        id=sid, name=f"{family} on GitLab", kind="official_code", host="gitlab.com",
        canonical_url=f"https://gitlab.com/{group}", trust=85,
        path_prefixes=(f"/{group}/",), family=family,
        device_urls=(f"https://gitlab.com/groups/{group}/-/search?search={{code}}",),
        query_templates=GITHUB_QUERIES,
    )



SOURCES: tuple[Source, ...] = (
    # ---------------- Official ROM projects / downloads / code ----------------
    Source("lineageos_site", "LineageOS", "official_project", "lineageos.org",
           "https://lineageos.org", 98, family="LineageOS"),
    Source("lineageos_dl", "LineageOS Downloads", "official_download", "download.lineageos.org",
           "https://download.lineageos.org", 100, family="LineageOS"),
    _gh("LineageOS", "LineageOS", "lineageos_gh", 90),
    Source("lineageos_gerrit", "LineageOS Gerrit", "official_code", "review.lineageos.org",
           "https://review.lineageos.org", 80, family="LineageOS"),

    Source("crdroid_site", "crDroid", "official_project", "crdroid.net",
           "https://crdroid.net", 98, family="crDroid"),
    _gh("crdroidandroid", "crDroid", "crdroid_gh"),

    Source("pe_dl", "Pixel Experience Downloads", "official_download", "get.pixelexperience.org",
           "https://get.pixelexperience.org", 100, family="Pixel Experience"),
    _gh("PixelExperience", "Pixel Experience", "pe_gh"),

    Source("evox_site", "Evolution X", "official_project", "evolution-x.org",
           "https://evolution-x.org", 98, family="Evolution X"),
    Source("evox_cdn", "Evolution X CDN", "official_download", "cdn.evolution-x.org",
           "https://cdn.evolution-x.org", 100, family="Evolution X"),
    _gh("Evolution-X", "Evolution X", "evox_gh"),

    Source("arrow_site", "ArrowOS", "official_project", "arrowos.net",
           "https://arrowos.net", 96, family="ArrowOS"),
    _gh("ArrowOS", "ArrowOS", "arrow_gh"),

    Source("pixelos_site", "PixelOS", "official_project", "pixelos.net",
           "https://pixelos.net", 96, family="PixelOS"),
    _gh("PixelOS-AOSP", "PixelOS", "pixelos_gh"),

    _gh("DerpFest-AOSP", "DerpFest", "derpfest_gh"),

    Source("elixir_site", "Project Elixir", "official_project", "projectelixiros.com",
           "https://projectelixiros.com", 95, family="Project Elixir"),
    _gh("ProjectElixir", "Project Elixir", "elixir_gh"),

    _gh("RisingOS-Revived", "RisingOS", "risingos_gh"),
    _gh("VoltageOS", "VoltageOS", "voltageos_gh"),
    _gh("SuperiorOS", "SuperiorOS", "superioros_gh"),

    Source("rr_site", "Resurrection Remix", "official_project", "resurrectionremix.com",
           "https://resurrectionremix.com", 92, family="Resurrection Remix"),
    _gh("ResurrectionRemix", "Resurrection Remix", "rr_gh"),

    _gh("Havoc-OS", "Havoc-OS", "havoc_gh"),

    Source("aospa_site", "Paranoid Android", "official_project", "paranoidandroid.co",
           "https://paranoidandroid.co", 95, family="Paranoid Android"),
    _gh("AOSPA", "Paranoid Android", "aospa_gh"),

    Source("calyx_site", "CalyxOS", "official_project", "calyxos.org",
           "https://calyxos.org", 97, family="CalyxOS"),
    _gh("CalyxOS", "CalyxOS", "calyx_gh"),

    Source("graphene_site", "GrapheneOS", "official_project", "grapheneos.org",
           "https://grapheneos.org", 97, family="GrapheneOS"),
    _gh("GrapheneOS", "GrapheneOS", "graphene_gh"),

    Source("eos_site", "/e/OS", "official_project", "e.foundation",
           "https://e.foundation/e-os", 95, path_prefixes=("/e-os",), family="/e/OS"),
    _gl("e", "/e/OS", "eos_gl"),
    _gh("eeos", "/e/OS", "eos_gh"),

    Source("iode_site", "iodeOS", "official_project", "iode.tech",
           "https://iode.tech", 94, family="iodeOS"),
    _gl("iode", "iodeOS", "iode_gl"),
    _gh("iodeOS", "iodeOS", "iode_gh"),

    _gh("Divested-Mobile", "DivestOS", "divest_gh"),
    _gl("divested-mobile", "DivestOS", "divest_gl"),

    # ---------------- Firmware / skin databases ----------------
    Source("samfw", "SamFW", "firmware_database", "samfw.com", "https://samfw.com", 80,
           family="One UI"),
    Source("sammobile", "SamMobile Firmwares", "firmware_database", "sammobile.com",
           "https://www.sammobile.com/firmwares", 78, path_prefixes=("/firmwares",),
           family="One UI", include_subdomains=True),
    Source("sfirmware", "SFirmware", "firmware_database", "sfirmware.com",
           "https://sfirmware.com", 72, family="One UI"),
    Source("samfrew", "Samfrew", "firmware_database", "samfrew.com",
           "https://samfrew.com", 70, family="One UI"),
    Source("xfu", "Xiaomi Firmware Updater", "firmware_database", "xiaomifirmwareupdater.com",
           "https://xiaomifirmwareupdater.com", 85),
    Source("hyperosupdates", "HyperOS Updates", "firmware_database", "hyperosupdates.com",
           "https://hyperosupdates.com", 78, family="HyperOS"),
    Source("mifirm", "MiFirm", "firmware_database", "mifirm.net", "https://mifirm.net", 72),
    Source("xmfirmware", "XM Firmware Updater", "firmware_database", "xmfirmwareupdater.com",
           "https://xmfirmwareupdater.com", 72),
    Source("oppofw", "Oppo Firmware", "firmware_database", "oppo-firmware.com",
           "https://oppo-firmware.com", 70, family="ColorOS"),
    Source("firmwarefile", "FirmwareFile", "firmware_database", "firmwarefile.com",
           "https://firmwarefile.com", 62),
    Source("oxygenupdater", "Oxygen Updater", "firmware_database", "oxygenupdater.com",
           "https://oxygenupdater.com", 82, family="OxygenOS"),
    Source("oneplusroms", "OnePlus ROMs", "firmware_database", "oneplusroms.com",
           "https://oneplusroms.com", 65, family="OxygenOS"),
    Source("realmefirmware", "Realme Firmware", "firmware_database", "realmefirmware.com",
           "https://realmefirmware.com", 68, family="Realme UI"),
    Source("nothing_community", "Nothing Community", "firmware_database", "nothing.community",
           "https://nothing.community", 75, family="Nothing OS"),

    # ---------------- Development / community ----------------
    Source("xda", "XDA Forums", "community", "xdaforums.com", "https://xdaforums.com", 70),
    Source("fourpda", "4PDA", "community", "4pda.to", "https://4pda.to", 55),
    Source("github", "GitHub", "community", "github.com", "https://github.com", 50),
    Source("gitlab", "GitLab", "community", "gitlab.com", "https://gitlab.com", 50),
    Source("sourceforge", "SourceForge", "community", "sourceforge.net",
           "https://sourceforge.net", 68, include_subdomains=True),
    Source("afh", "AndroidFileHost", "community", "androidfilehost.com",
           "https://androidfilehost.com", 60),
    Source("archive", "Internet Archive", "community", "archive.org",
           "https://archive.org", 55),
    Source("wayback", "Wayback Machine", "community", "web.archive.org",
           "https://web.archive.org", 55),

    # ---------------- Mirrors (download only, never authoritative) ----------------
    Source("reddit", "Reddit", "mirror", "reddit.com", "https://reddit.com", 20,
           include_subdomains=True),
    Source("telegram", "Telegram", "mirror", "t.me", "https://t.me", 20),
    Source("telegram_me", "Telegram", "mirror", "telegram.me", "https://telegram.me", 20),
    Source("gdrive", "Google Drive", "mirror", "drive.google.com",
           "https://drive.google.com", 15),
    Source("mega", "MEGA", "mirror", "mega.nz", "https://mega.nz", 15),
    Source("mediafire", "MediaFire", "mirror", "mediafire.com",
           "https://mediafire.com", 15),

    # ---------------- Android / AOSP reference ----------------
    Source("aosp_docs", "Android Open Source Project", "reference", "source.android.com",
           "https://source.android.com", 90),
    Source("aosp_git", "android.googlesource.com", "reference", "android.googlesource.com",
           "https://android.googlesource.com", 90),
    Source("aosp_mirror", "aosp-mirror", "reference", "github.com",
           "https://github.com/aosp-mirror", 85, path_prefixes=("/aosp-mirror/",)),
    Source("aosp_review", "AOSP Gerrit", "reference", "android-review.googlesource.com",
           "https://android-review.googlesource.com", 85),
    Source("pixel_images", "Google Pixel factory images", "official_download",
           "developers.google.com", "https://developers.google.com/android/images", 95,
           path_prefixes=("/android/images", "/android/ota")),
    Source("flash_android", "Android Flash Tool", "reference", "flash.android.com",
           "https://flash.android.com", 85),
)

# ---------------- extra firmware database ----------------
SOURCES = SOURCES + (
    Source("romprovider", "ROM Provider", "firmware_database", "romprovider.com",
           "https://romprovider.com", 60),
)

#: Direct, source-specific device pages probed *before* any web search.
_DEVICE_URLS: dict[str, tuple[str, ...]] = {
    "lineageos_dl": ("https://download.lineageos.org/devices/{code}",
                     "https://download.lineageos.org/devices/{code}/builds"),
    "lineageos_site": ("https://wiki.lineageos.org/devices/{code}",),
    "crdroid_site": ("https://crdroid.net/{code}",),
    "pe_dl": ("https://get.pixelexperience.org/{code}",),
    "evox_site": ("https://evolution-x.org/downloads/{code}",),
    "arrow_site": ("https://arrowos.net/download/{code}",),
    "pixelos_site": ("https://pixelos.net/download/{code}",),
    "elixir_site": ("https://projectelixiros.com/device/{code}",),
    "rr_site": ("https://resurrectionremix.com/downloads/{code}",),
    "calyx_site": ("https://calyxos.org/install/devices/{code}/",),
    "graphene_site": ("https://grapheneos.org/releases#{code}",),
    "xfu": ("https://xiaomifirmwareupdater.com/miui/{code}/",
            "https://xiaomifirmwareupdater.com/hyperos/{code}/"),
    "hyperosupdates": ("https://hyperosupdates.com/{code}/",),
    "mifirm": ("https://mifirm.net/model/{code}",),
    "samfw": ("https://samfw.com/firmware/{slug}",),
    "sfirmware": ("https://sfirmware.com/samsung-{slug}",),
    "oxygenupdater": ("https://oxygenupdater.com/devices/",),
}

#: Source-specific search patterns (device pages, threads, project/file pages).
_QUERY_TEMPLATES: dict[str, tuple[str, ...]] = {
    "xda": ("site:xdaforums.com {code} ROM",
            "site:xdaforums.com {q} {code}",
            "site:xdaforums.com {code} firmware download"),
    "fourpda": ("site:4pda.to {q} {code}",),
    "sourceforge": ("site:sourceforge.net {code} files",
                    "site:sourceforge.net {code} rom"),
    "afh": ("site:androidfilehost.com {code}",),
    "github": ("site:github.com {code} device tree releases",),
    "gitlab": ("site:gitlab.com {code} android",),
    "samfw": ("site:samfw.com {q} firmware",),
    "sammobile": ("site:sammobile.com/firmwares {q}",),
    "samfrew": ("site:samfrew.com {q}",),
    "xfu": ("site:xiaomifirmwareupdater.com {code}",),
    "hyperosupdates": ("site:hyperosupdates.com {code}",),
    "romprovider": ("site:romprovider.com {q} firmware",),
    "nothing_community": ("site:nothing.community {q} ota",),
    "oxygenupdater": ("site:oxygenupdater.com {q}",),
    "realmefirmware": ("site:realmefirmware.com {q}",),
    "oppofw": ("site:oppo-firmware.com {q}",),
    "firmwarefile": ("site:firmwarefile.com {q} firmware",),
    "archive": ("site:archive.org {code} rom",),
}

SOURCES = tuple(
    replace(
        s,
        device_urls=s.device_urls or _DEVICE_URLS.get(s.id, ()),
        query_templates=s.query_templates or _QUERY_TEMPLATES.get(s.id, ()),
    )
    for s in SOURCES
)

_BY_ID = {s.id: s for s in SOURCES}



class SourceRegistry:
    def __init__(self, sources: Iterable[Source] = SOURCES) -> None:
        self.sources: tuple[Source, ...] = tuple(sources)

    # -- lookup ---------------------------------------------------------
    def get(self, source_id: str) -> Optional[Source]:
        return {s.id: s for s in self.sources}.get(source_id)

    def match_url(self, url: str) -> Optional[Source]:
        """Return the most specific registered source for ``url``, else None."""
        try:
            parts = urlsplit(url if "://" in url else "https://" + url)
        except ValueError:
            return None
        host = (parts.hostname or "").lower()
        if host.startswith("www."):
            host = host[4:]
        if not host:
            return None
        path = parts.path or "/"
        matches = [s for s in self.sources if s.matches(host, path)]
        if not matches:
            return None
        # most specific: longest matching path prefix, then highest trust
        def specificity(s: Source) -> tuple[int, int]:
            longest = max((len(p) for p in s.path_prefixes), default=0)
            return (longest, s.trust)
        return max(matches, key=specificity)

    def is_registered(self, url: str) -> bool:
        return self.match_url(url) is not None

    def by_kind(self, kind: SourceKind) -> list[Source]:
        return [s for s in self.sources if s.kind == kind]

    def inspect(self, query: str) -> list[Source]:
        q = query.lower().strip()
        q = q[4:] if q.startswith("www.") else q
        hits = [s for s in self.sources
                if q == s.id or q == s.host or q in s.name.lower() or q in s.canonical_url.lower()]
        if not hits:
            src = self.match_url(query)
            if src:
                hits = [src]
        return hits

    def search_hosts(self) -> list[Source]:
        """Sources worth issuing domain-scoped searches against."""
        return [s for s in self.sources
                if s.kind in {"official_project", "official_download", "official_code",
                              "firmware_database", "community"}]

    def to_json(self) -> list[dict[str, Any]]:
        return [s.to_json() for s in self.sources]


def normalize_url(url: str) -> str:
    """Strip tracking noise / fragments so identical pages compare equal."""
    if "://" not in url:
        url = "https://" + url
    parts = urlsplit(url)
    host = (parts.hostname or "").lower()
    if host.startswith("www."):
        host = host[4:]
    netloc = host + (f":{parts.port}" if parts.port and parts.port not in (80, 443) else "")
    path = parts.path.rstrip("/") or "/"
    query = "&".join(
        q for q in parts.query.split("&")
        if q and not q.split("=")[0].lower().startswith(("utm_", "fbclid", "gclid", "ref"))
    )
    return urlunsplit((parts.scheme or "https", netloc, path, query, ""))


registry = SourceRegistry()

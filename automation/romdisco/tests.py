"""Deterministic self-tests: `python rom_discovery.py test`."""

from __future__ import annotations

import unittest

from .discovery import (build_fallback_queries, build_probe_urls, build_queries,
                        build_source_queries, discover)
from .extract import (normalize_family, parse_android_version, parse_build_date,
                      parse_rom_version)
from .models import Candidate, Device
from .search import FixtureBackend, NullBackend, SearchResult
from .source_registry import SourceRegistry, normalize_url, registry
from .validation import validate_all, validate_candidate

NABU = Device(name="Xiaomi Pad 5", codename="nabu", manufacturer="Xiaomi",
              aliases=("Mi Pad 5",))


class SourceRegistryTest(unittest.TestCase):
    def test_rejected_domains(self) -> None:
        for url in ("https://www.mi.com/global/xiaomi-pad-5/",
                    "https://www.mistoreitalia.com/prodotto/xiaomi-pad-5-rom",
                    "https://www.amazon.com/dp/B09FXY123?keywords=xiaomi+pad+5+rom",
                    "https://www.aranzulla.it/come-installare-una-rom-1234.html",
                    "https://en.wikipedia.org/wiki/Xiaomi_Pad_5",
                    "https://www.unieuro.it/online/Tablet/xiaomi-pad-5"):
            with self.subTest(url=url):
                self.assertIsNone(registry.match_url(url), url)

    def test_accepted_domains_and_kinds(self) -> None:
        expected = {
            "https://xdaforums.com/t/rom-13-nabu-lineageos-20.4500/": ("xda", "community"),
            "https://github.com/LineageOS/android_device_xiaomi_nabu": ("lineageos_gh", "official_code"),
            "https://sourceforge.net/projects/crdroid/files/nabu/": ("sourceforge", "community"),
            "https://androidfilehost.com/?fid=123456": ("afh", "community"),
            "https://lineageos.org/": ("lineageos_site", "official_project"),
            "https://hyperosupdates.com/nabu/": ("hyperosupdates", "firmware_database"),
            "https://xiaomifirmwareupdater.com/miui/nabu/": ("xfu", "firmware_database"),
        }
        for url, (sid, kind) in expected.items():
            with self.subTest(url=url):
                source = registry.match_url(url)
                self.assertIsNotNone(source, url)
                assert source is not None
                self.assertEqual(source.id, sid)
                self.assertEqual(source.kind, kind)

    def test_github_path_scoping(self) -> None:
        official = registry.match_url("https://github.com/LineageOS/android")
        generic = registry.match_url("https://github.com/someone/random-repo")
        assert official and generic
        self.assertEqual(official.kind, "official_code")
        self.assertEqual(generic.kind, "community")

    def test_mirrors_cannot_verify(self) -> None:
        for url in ("https://t.me/nabu_roms", "https://drive.google.com/file/d/abc",
                    "https://www.reddit.com/r/Xiaomi/comments/x/"):
            source = registry.match_url(url)
            assert source is not None
            self.assertEqual(source.kind, "mirror")
            self.assertFalse(source.can_verify)

    def test_normalize_url(self) -> None:
        self.assertEqual(normalize_url("HTTPS://WWW.XdaForums.com/t/abc/?utm_source=x#post-1"),
                         "https://xdaforums.com/t/abc")


class SourceClassTest(unittest.TestCase):
    def test_rejected_domains_explicit(self) -> None:
        for host in ("mi.com", "mistoreitalia.com", "amazon.com", "aranzulla.it",
                     "wikipedia.org", "unieuro.it", "www.mi.com"):
            with self.subTest(host=host):
                self.assertFalse(registry.is_registered(f"https://{host}/xiaomi-pad-5-nabu-rom"))

    def test_accepted_hosts_explicit(self) -> None:
        for url in ("https://xdaforums.com/t/nabu-rom.1/",
                    "https://github.com/LineageOS",
                    "https://github.com/LineageOS/android_device_xiaomi_nabu",
                    "https://sourceforge.net/projects/crdroid/files/nabu/",
                    "https://androidfilehost.com/?fid=1",
                    "https://romprovider.com/samsung-firmware/"):
            with self.subTest(url=url):
                self.assertTrue(registry.is_registered(url), url)

    def test_approved_subdomains_inherit(self) -> None:
        for url, sid in (("https://mirrorbits.lineageos.org/full/nabu/", "lineageos_site"),
                         ("https://wiki.lineageos.org/devices/nabu", "lineageos_site"),
                         ("https://files.xdaforums.com/attachments/x.zip", "xda"),
                         ("https://crdroid.net.cdn.crdroid.net/nabu", "crdroid_site")):
            with self.subTest(url=url):
                source = registry.match_url(url)
                self.assertIsNotNone(source, url)
                assert source is not None
                self.assertEqual(source.id, sid)

    def test_lookalike_domains_rejected(self) -> None:
        for url in ("https://lineageos.org.rom-download.xyz/nabu",
                    "https://not-lineageos.org/nabu",
                    "https://xdaforums.com.free-roms.net/t/nabu",
                    "https://github.com.evil.io/LineageOS",
                    "https://fake-grapheneos.org/releases"):
            with self.subTest(url=url):
                self.assertIsNone(registry.match_url(url), url)

    def test_source_classes(self) -> None:
        expected = {
            "lineageos_dl": "OFFICIAL",
            "lineageos_site": "OFFICIAL",
            "lineageos_gh": "DEVELOPMENT",
            "xfu": "FIRMWARE_DATABASE",
            "xda": "COMMUNITY",
            "afh": "DOWNLOAD_HOST",
            "mega": "DOWNLOAD_HOST",
            "gdrive": "DOWNLOAD_HOST",
            "telegram": "ARCHIVE_MIRROR",
            "wayback": "ARCHIVE_MIRROR",
        }
        for sid, cls in expected.items():
            source = registry.get(sid)
            assert source is not None, sid
            self.assertEqual(source.source_class, cls, sid)

    def test_file_hosts_rank_below_official(self) -> None:
        official = registry.get("lineageos_dl")
        firmware = registry.get("xfu")
        afh = registry.get("afh")
        mega = registry.get("mega")
        assert official and firmware and afh and mega
        self.assertGreater(official.authority, firmware.authority)
        self.assertGreater(firmware.authority, afh.authority)
        self.assertGreater(afh.authority, mega.authority)
        self.assertTrue(official.is_authoritative)
        self.assertFalse(afh.is_authoritative)
        self.assertFalse(mega.is_authoritative)
        self.assertFalse(mega.can_verify)


class SourceFirstDiscoveryTest(unittest.TestCase):
    def test_probe_urls_are_registered_and_device_specific(self) -> None:
        urls = build_probe_urls(NABU, registry)
        self.assertTrue(urls)
        for url in urls:
            self.assertTrue(registry.is_registered(url), url)
        self.assertIn("https://download.lineageos.org/devices/nabu", urls)
        self.assertIn("https://crdroid.net/nabu", urls)

    def test_source_queries_come_first(self) -> None:
        source_queries = build_source_queries(NABU, registry)
        queries = build_queries(NABU, registry, max_queries=500)
        self.assertTrue(all(q.startswith("site:") for q in source_queries[:5]))
        self.assertEqual(queries[:len(source_queries)], source_queries)
        fallback = build_fallback_queries(NABU)
        self.assertGreater(queries.index(fallback[0]), 0)

    def test_no_fallback_mode_is_source_only(self) -> None:
        queries = build_queries(NABU, registry, max_queries=500, include_fallback=False)
        self.assertTrue(queries)
        for q in queries:
            self.assertTrue(q.startswith("site:"), q)


class ExtractTest(unittest.TestCase):
    def test_family(self) -> None:
        self.assertEqual(normalize_family("crDroid 10.6 for nabu"), "crDroid")
        self.assertEqual(normalize_family("[ROM][13] LineageOS 20 nabu"), "LineageOS")
        self.assertIsNone(normalize_family("SuperCoolROM 9000"))

    def test_android_version(self) -> None:
        self.assertEqual(parse_android_version("Android 13 build"), "Android 13")
        self.assertEqual(parse_android_version("[ROM][14][UNOFFICIAL] x"), "Android 14")
        self.assertEqual(parse_android_version("Oreo build"), "Android 8.0 Oreo")
        self.assertIsNone(parse_android_version("crDroid 10.6 build 4500"))

    def test_rom_version(self) -> None:
        self.assertEqual(parse_rom_version("crDroid 10.6 nabu", "crDroid"), "10.6")
        self.assertEqual(parse_rom_version("LineageOS 20.0 nabu", "LineageOS"), "20.0")
        self.assertIsNone(parse_rom_version("Android 14 for nabu", "LineageOS"))

    def test_build_date(self) -> None:
        self.assertEqual(parse_build_date("lineage-20.0-20240115-nightly-nabu.zip"), "2024-01-15")
        self.assertIsNone(parse_build_date("build 4500"))


class ValidationTest(unittest.TestCase):
    def test_official_download_verified(self) -> None:
        candidate = Candidate(
            url="https://download.lineageos.org/devices/nabu/builds",
            title="LineageOS Downloads for Xiaomi Pad 5 (nabu)",
            text="lineage-21.0-20240320-nightly-nabu-signed.zip sha256 build date",
        )
        outcome = validate_candidate(candidate, NABU)
        self.assertIsNone(outcome.rejection)
        rom = outcome.rom
        assert rom is not None
        self.assertEqual(rom.name, "LineageOS")
        self.assertEqual(rom.status, "verified")
        self.assertEqual(rom.type, "custom_rom")
        self.assertEqual(rom.build_date, "2024-03-20")

    def test_store_page_rejected(self) -> None:
        candidate = Candidate(url="https://www.mi.com/global/xiaomi-pad-5/",
                              title="Xiaomi Pad 5 - buy now", text="best price ROM")
        self.assertIsNotNone(validate_candidate(candidate, NABU).rejection)

    def test_guide_only_rejected(self) -> None:
        candidate = Candidate(url="https://xdaforums.com/t/guide-how-to-install.123/",
                              title="[GUIDE] How to install LineageOS on nabu Xiaomi Pad 5",
                              text="step-by-step tutorial, no files here")
        outcome = validate_candidate(candidate, NABU)
        self.assertIsNotNone(outcome.rejection)

    def test_unrelated_codename_context_rejected(self) -> None:
        candidate = Candidate(url="https://xdaforums.com/t/nabu-bird-society.999/",
                              title="NABU nature conservation download report",
                              text="NABU is a German nature association; annual report zip")
        outcome = validate_candidate(candidate, NABU)
        self.assertIsNotNone(outcome.rejection)

    def test_unrelated_device_rejected(self) -> None:
        candidate = Candidate(url="https://xdaforums.com/t/rom-13-crdroid-alioth.111/",
                              title="[ROM][13] crDroid 9.6 for POCO F3 (alioth)",
                              text="crdroid-9.6-alioth.zip md5")
        self.assertIsNotNone(validate_candidate(candidate, NABU).rejection)

    def test_mirror_never_verified(self) -> None:
        candidate = Candidate(
            url="https://t.me/nabu_builds/42",
            title="crDroid 10.6 Xiaomi Pad 5 nabu",
            text="download crdroid-10.6-nabu.zip md5 Android 14",
        )
        outcome = validate_candidate(candidate, NABU)
        rom = outcome.rom
        assert rom is not None
        self.assertEqual(rom.status, "unverified")

    def test_dedupe_keeps_distinct_versions(self) -> None:
        base = dict(text="crdroid zip md5 Android 14 download")
        candidates = [
            Candidate(url="https://crdroid.net/nabu/10", title="crDroid 10.6 Xiaomi Pad 5 nabu", **base),
            Candidate(url="https://xdaforums.com/t/crdroid-nabu.1/",
                      title="crDroid 10.6 Xiaomi Pad 5 nabu", **base),
            Candidate(url="https://crdroid.net/nabu/11", title="crDroid 11.2 Xiaomi Pad 5 nabu", **base),
        ]
        roms, rejections = validate_all(candidates, NABU)
        self.assertEqual(rejections, [])
        versions = sorted(r.rom_version or "" for r in roms)
        self.assertEqual(versions, ["10.6", "11.2"])


class StrictValidationTest(unittest.TestCase):
    """Regressions from the over-permissive 33 -> 19 verified run."""

    def test_graphene_generic_page_not_a_nabu_rom(self) -> None:
        candidate = Candidate(
            url="https://grapheneos.org/",
            title="GrapheneOS: private and secure mobile OS",
            text="Downloads. Releases. Install. Android 6.0 support ended. nabu",
        )
        outcome = validate_candidate(candidate, NABU)
        self.assertIsNone(outcome.rom)
        self.assertIsNotNone(outcome.rejection)

    def test_github_org_search_page_rejected(self) -> None:
        candidate = Candidate(
            url="https://github.com/LineageOS?q=nabu&type=all",
            title="LineageOS · GitHub",
            text="Repositories nabu download releases",
        )
        self.assertIsNotNone(validate_candidate(candidate, NABU).rejection)

    def test_github_org_landing_rejected(self) -> None:
        candidate = Candidate(url="https://github.com/crdroidandroid",
                             title="crDroid Android · GitHub nabu Xiaomi Pad 5",
                             text="download releases")
        self.assertIsNotNone(validate_candidate(candidate, NABU).rejection)

    def test_generic_project_homepage_rejected(self) -> None:
        candidate = Candidate(url="https://crdroid.net/",
                             title="crDroid Android for Xiaomi Pad 5 nabu",
                             text="Download crDroid. Devices. Changelog.")
        self.assertIsNotNone(validate_candidate(candidate, NABU).rejection)

    def test_lineageos_device_download_page_verified(self) -> None:
        candidate = Candidate(
            url="https://download.lineageos.org/devices/nabu",
            title="LineageOS Downloads — Xiaomi Pad 5 (nabu)",
            text="Nightly builds for nabu. Build date and sha256 for every release.",
        )
        outcome = validate_candidate(candidate, NABU)
        self.assertIsNone(outcome.rejection)
        rom = outcome.rom
        assert rom is not None
        self.assertEqual(rom.status, "verified")
        self.assertEqual(rom.source_url, "https://download.lineageos.org/devices/nabu")

    def test_real_artifact_url_validates(self) -> None:
        candidate = Candidate(
            url="https://sourceforge.net/projects/crdroid/files/nabu/11.x/",
            title="crDroid 11.2 Xiaomi Pad 5 nabu",
            text="crDroid-11.2-nabu-20250104.zip md5 checksum",
            download_url="https://sourceforge.net/projects/crdroid/files/nabu/"
                         "crDroid-11.2-nabu-20250104.zip/download",
        )
        outcome = validate_candidate(candidate, NABU)
        self.assertIsNone(outcome.rejection)
        rom = outcome.rom
        assert rom is not None
        self.assertTrue(rom.download_url and rom.download_url.endswith("/download"))
        self.assertEqual(rom.rom_version, "11.2")
        self.assertEqual(rom.build_date, "2025-01-04")

    def test_android_version_from_unrelated_text_ignored(self) -> None:
        candidate = Candidate(
            url="https://xdaforums.com/t/crdroid-nabu.4500/",
            title="crDroid for Xiaomi Pad 5 nabu",
            text="crDroid-11.2-nabu.zip md5 abcdef\nOur team started in Android 6.0 times.",
        )
        outcome = validate_candidate(candidate, NABU)
        rom = outcome.rom
        assert rom is not None
        self.assertNotEqual(rom.android_version, "Android 6.0 Marshmallow")

    def test_official_code_page_alone_not_verified(self) -> None:
        candidate = Candidate(
            url="https://github.com/LineageOS/android_device_xiaomi_nabu",
            title="LineageOS device tree for Xiaomi Pad 5 (nabu)",
            text="Device sources. build date sha256 metadata for nabu.",
        )
        outcome = validate_candidate(candidate, NABU)
        if outcome.rom is not None:
            self.assertEqual(outcome.rom.status, "unverified")

    def test_registered_source_alone_insufficient(self) -> None:
        candidate = Candidate(url="https://lineageos.org/",
                             title="LineageOS — free and open OS",
                             text="Download LineageOS for your device (nabu Xiaomi Pad 5)")
        self.assertIsNotNone(validate_candidate(candidate, NABU).rejection)

    def test_codename_alone_in_generic_text_insufficient(self) -> None:
        candidate = Candidate(url="https://xdaforums.com/t/random-thread.777/",
                             title="Tablet talk",
                             text="Someone mentioned nabu once. crDroid md5")
        self.assertIsNotNone(validate_candidate(candidate, NABU).rejection)

    def test_dedupe_prefers_concrete_artifact_record(self) -> None:
        candidates = [
            Candidate(url="https://crdroid.net/nabu",
                      title="crDroid 11.2 Xiaomi Pad 5 nabu",
                      text="crDroid builds for nabu. md5 changelog"),
            Candidate(url="https://sourceforge.net/projects/crdroid/files/nabu/11.x/",
                      title="crDroid 11.2 Xiaomi Pad 5 nabu",
                      text="crDroid-11.2-nabu.zip md5",
                      download_url="https://sourceforge.net/projects/crdroid/files/nabu/"
                                   "crDroid-11.2-nabu.zip/download"),
        ]
        roms, rejections = validate_all(candidates, NABU)
        self.assertEqual(rejections, [])
        self.assertEqual(len(roms), 1)
        self.assertTrue(roms[0].download_url)


class DiscoveryTest(unittest.TestCase):

    def test_queries_never_bare_codename(self) -> None:
        queries = build_queries(NABU, registry, max_queries=200)
        self.assertTrue(queries)
        for query in queries:
            self.assertNotEqual(query.strip(), "nabu")
            self.assertGreater(len(query.split()), 1)
        self.assertTrue(any('"Xiaomi Pad 5" nabu LineageOS' == q for q in queries))
        self.assertTrue(any(q.startswith("site:xdaforums.com") for q in queries))

    def test_unregistered_results_discarded(self) -> None:
        class Backend:
            name = "stub"

            def search(self, query: str, limit: int = 10) -> list[SearchResult]:
                return [
                    SearchResult(url="https://www.mi.com/global/xiaomi-pad-5/", title="Xiaomi Pad 5"),
                    SearchResult(url="https://xdaforums.com/t/nabu-rom.1/", title="nabu rom"),
                ]

        candidates, discarded = discover(NABU, backend=Backend(), max_queries=1)
        self.assertEqual([c.url for c in candidates], ["https://xdaforums.com/t/nabu-rom.1"])
        self.assertTrue(discarded)

    def test_garbage_engine_yields_nothing(self) -> None:
        candidates, discarded = discover(NABU, backend=NullBackend(), max_queries=3)
        self.assertEqual(candidates, [])
        self.assertEqual(discarded, [])


def run() -> int:
    loader = unittest.TestLoader()
    suite = loader.loadTestsFromModule(__import__(__name__, fromlist=["*"]))
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    return 0 if result.wasSuccessful() else 1

"""Deterministic self-tests: `python rom_discovery.py test`."""

from __future__ import annotations

import unittest

from .discovery import build_queries, discover
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

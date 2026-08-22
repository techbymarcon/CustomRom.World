/**
 * ROM discovery / import data model for Custom Rom World.
 *
 * The pipeline may be broad, but validation here is strict:
 *  - a candidate must map onto one of the ALLOWED ROM families (never invent icons)
 *  - it must show genuine ROM/download evidence (not a guide, kernel, recovery,
 *    device tree, tag/index or generic device page)
 *  - Android version and ROM version are extracted separately; unknown stays null
 */

/** Canonical ROM/skin families that own an icon on the site. Nothing else is allowed. */
export const ALLOWED_ROM_FAMILIES = [
  "LineageOS",
  "crDroid",
  "Pixel Experience",
  "Evolution X",
  "ArrowOS",
  "PixelOS",
  "DerpFest",
  "Project Elixir",
  "RisingOS",
  "VoltageOS",
  "SuperiorOS",
  "Resurrection Remix",
  "Havoc-OS",
  "Paranoid Android",
  "CalyxOS",
  "GrapheneOS",
  "/ e / OS",
  "iodéOS",
  "DivestOS",
  "One UI",
  "HyperOS",
  "MIUI",
  "ColorOS",
  "OxygenOS",
  "Realme UI",
  "Funtouch OS",
  "OriginOS",
  "Nothing OS",
  "MagicOS",
] as const;

export type RomFamily = (typeof ALLOWED_ROM_FAMILIES)[number];

/** Manufacturer skins are "skin-port"; everything else is an AOSP-based custom ROM. */
const SKIN_FAMILIES = new Set<RomFamily>([
  "One UI",
  "HyperOS",
  "MIUI",
  "ColorOS",
  "OxygenOS",
  "Realme UI",
  "Funtouch OS",
  "OriginOS",
  "Nothing OS",
  "MagicOS",
]);

export type RomType = "aosp" | "skin-port";
export type OfficialStatus = "official" | "unofficial";

export function romTypeForFamily(family: RomFamily): RomType {
  return SKIN_FAMILIES.has(family) ? "skin-port" : "aosp";
}

/** Loose spellings seen in the wild → canonical family. */
const FAMILY_ALIASES: Record<string, RomFamily> = {
  lineageos: "LineageOS",
  lineage: "LineageOS",
  los: "LineageOS",
  crdroid: "crDroid",
  pixelexperience: "Pixel Experience",
  pe: "Pixel Experience",
  evolutionx: "Evolution X",
  evox: "Evolution X",
  arrowos: "ArrowOS",
  arrow: "ArrowOS",
  pixelos: "PixelOS",
  derpfest: "DerpFest",
  projectelixir: "Project Elixir",
  elixir: "Project Elixir",
  risingos: "RisingOS",
  rising: "RisingOS",
  voltageos: "VoltageOS",
  superioros: "SuperiorOS",
  resurrectionremix: "Resurrection Remix",
  rr: "Resurrection Remix",
  havocos: "Havoc-OS",
  havoc: "Havoc-OS",
  paranoidandroid: "Paranoid Android",
  aospa: "Paranoid Android",
  calyxos: "CalyxOS",
  grapheneos: "GrapheneOS",
  eos: "/ e / OS",
  "e-os": "/ e / OS",
  "eosrom": "/ e / OS",
  iodeos: "iodéOS",
  iode: "iodéOS",
  divestos: "DivestOS",
  oneui: "One UI",
  samsungexperience: "One UI",
  hyperos: "HyperOS",
  xiaomihyperos: "HyperOS",
  miui: "MIUI",
  coloros: "ColorOS",
  oxygenos: "OxygenOS",
  oos: "OxygenOS",
  realmeui: "Realme UI",
  funtouchos: "Funtouch OS",
  funtouch: "Funtouch OS",
  originos: "OriginOS",
  nothingos: "Nothing OS",
  magicos: "MagicOS",
};

function key(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Resolve free text to one of the allowed families, or null.
 * Never returns anything outside ALLOWED_ROM_FAMILIES.
 */
export function normalizeRomFamily(input: string | null | undefined): RomFamily | null {
  if (!input) return null;
  const k = key(input);
  if (!k) return null;
  const exact = FAMILY_ALIASES[k];
  if (exact) return exact;
  for (const family of ALLOWED_ROM_FAMILIES) {
    if (k === key(family)) return family;
  }
  // longest alias contained in the text wins (e.g. "crDroid 10.6 for beyond1lte")
  let best: RomFamily | null = null;
  let bestLen = 0;
  for (const [alias, family] of Object.entries(FAMILY_ALIASES)) {
    if (alias.length > bestLen && k.includes(alias) && alias.length >= 4) {
      best = family;
      bestLen = alias.length;
    }
  }
  return best;
}

/** Android platform versions we can label. */
const ANDROID_MAX = 17;

/**
 * Extract the Android platform version only from explicit Android mentions.
 * Returns e.g. "Android 11" or null. Never guesses from unrelated numbers.
 */
export function parseAndroidVersion(input: string | null | undefined): string | null {
  if (!input) return null;
  const text = input.replace(/\s+/g, " ");
  const named: Array<[RegExp, string]> = [
    [/gingerbread/i, "Android 2.3 Gingerbread"],
    [/honeycomb/i, "Android 3.0 Honeycomb"],
    [/ice ?cream ?sandwich/i, "Android 4.0 Ice Cream Sandwich"],
    [/jelly ?bean/i, "Android 4.1 Jelly Bean"],
    [/kitkat|kit ?kat/i, "Android 4.4 KitKat"],
    [/lollipop/i, "Android 5.0 Lollipop"],
    [/marshmallow/i, "Android 6.0 Marshmallow"],
    [/nougat/i, "Android 7.0 Nougat"],
    [/oreo/i, "Android 8.0 Oreo"],
    [/\bpie\b/i, "Android 9 Pie"],
  ];

  const explicit =
    /\bandroid[\s-]*(?:os[\s-]*)?v?(\d{1,2})(?:\.(\d))?/i.exec(text) ??
    /\ba(?:ndroid)?sp?[\s-]*(\d{2})\b/i.exec("");
  if (explicit) {
    const major = Number(explicit[1]);
    const minor = explicit[2] ? Number(explicit[2]) : 0;
    if (major >= 1 && major <= ANDROID_MAX) {
      if (major <= 9) {
        const legacy = `${major}.${minor}`;
        const legacyMap: Record<string, string> = {
          "2.3": "Android 2.3 Gingerbread",
          "3.0": "Android 3.0 Honeycomb",
          "4.0": "Android 4.0 Ice Cream Sandwich",
          "4.1": "Android 4.1 Jelly Bean",
          "4.4": "Android 4.4 KitKat",
          "5.0": "Android 5.0 Lollipop",
          "6.0": "Android 6.0 Marshmallow",
          "7.0": "Android 7.0 Nougat",
          "8.0": "Android 8.0 Oreo",
          "9.0": "Android 9 Pie",
        };
        if (legacyMap[legacy]) return legacyMap[legacy]!;
      } else {
        return `Android ${major}`;
      }
    }
  }

  for (const [re, label] of named) {
    if (re.test(text)) return label;
  }
  return null;
}

/**
 * Extract the ROM's own version (e.g. "crDroid 7.64" → "7.64", "LineageOS 18.1" → "18.1"),
 * only when it appears directly next to the family name. Unknown → null.
 */
export function parseRomVersion(
  input: string | null | undefined,
  family: RomFamily | null,
): string | null {
  if (!input || !family) return null;
  const text = input.replace(/\s+/g, " ");
  const namePattern = family
    .split("")
    .map((ch) => (/[a-z0-9]/i.test(ch) ? ch : ""))
    .join("")
    .split("")
    .map((ch) => `${ch}[^a-z0-9]*`)
    .join("");
  const re = new RegExp(`${namePattern}\\s*v?(\\d{1,2}(?:\\.\\d{1,3}){0,2})`, "i");
  const match = re.exec(text);
  if (!match) return null;
  // guard against picking up "Android 14" style numbers glued after the name
  const before = text.slice(Math.max(0, match.index - 12), match.index).toLowerCase();
  if (before.includes("android")) return null;
  return match[1] ?? null;
}

export function parseOfficialStatus(input: string | null | undefined): OfficialStatus | null {
  if (!input) return null;
  if (/\bunofficial\b/i.test(input)) return "unofficial";
  if (/\bofficial\b/i.test(input)) return "official";
  return null;
}

/** A raw candidate produced by the discovery pipeline. */
export type RomCandidate = {
  device_name: string;
  brand: string;
  device_slug: string;
  codename?: string | null;
  /** free text: page title, heading, thread name… */
  title?: string | null;
  rom_name?: string | null;
  rom_version?: string | null;
  android_version?: string | null;
  rom_type?: RomType | null;
  source_url: string;
  download_url?: string | null;
  /** site/forum name, e.g. "XDA", "SourceForge" */
  found_on?: string | null;
  made_by?: string | null;
  official_status?: OfficialStatus | null;
  /** extra page text used for evidence checks */
  page_text?: string | null;
  /** every download link discovered on the page (pages may legitimately list many) */
  download_links?: string[] | null;
};

/** A validated record, shaped exactly like a `roms` row insert. */
export type RomRecord = {
  brand: string;
  device_slug: string;
  device_name: string;
  codename: string | null;
  slug: string;
  rom_name: RomFamily;
  rom_version: string | null;
  android_version: string;
  rom_type: RomType;
  source_url: string;
  download_url: string | null;
  found_on: string;
  made_by: string;
  official_status: OfficialStatus | null;
  installation_guide: string | null;
  additional_info: string | null;
};

const REJECT_PAGE_PATTERNS: Array<[RegExp, string]> = [
  [/\b(device tree|kernel source|vendor tree|device sources)\b/i, "device tree / kernel source page"],
  [/\b(twrp|orangefox|recovery image|custom recovery)\b/i, "recovery page"],
  [/\b(how to (install|flash)|installation guide|tutorial|step[- ]by[- ]step guide)\b/i, "guide"],
  [/\b(tag archives?|category archives?|index of tags|browse tags)\b/i, "tag/index page"],
  [/\b(build instructions|how to build|compile)\b/i, "build instructions"],
];

const DOWNLOAD_EVIDENCE = [
  /\.zip(\?|$|["'\s])/i,
  /\.img(\?|$|["'\s])/i,
  /\.apk(\?|$|["'\s])/i,
  /\b(download|downloads|mirror|sourceforge|androidfilehost|releases?)\b/i,
  /\bmd5|sha256\b/i,
  /\bbuild (date|size)\b/i,
];

export type ValidationResult =
  | { ok: true; record: RomRecord }
  | { ok: false; reason: string };

export function romIdentity(r: {
  brand: string;
  device_slug: string;
  rom_name: string;
  rom_version: string | null;
  android_version: string;
}): string {
  return [r.brand, r.device_slug, r.rom_name, r.rom_version ?? "", r.android_version]
    .map((p) => p.toLowerCase().trim())
    .join("|");
}

export function romSlug(family: string, romVersion: string | null, androidVersion: string): string {
  return [family, romVersion ?? "", androidVersion]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .replace(/\+/g, "-plus")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Strict validation. Returns a ready-to-insert record or a rejection reason.
 * Android version is required (we cannot label a ROM card without it) but is only
 * ever taken from explicit "Android N" evidence — never guessed.
 */
export function validateCandidate(candidate: RomCandidate): ValidationResult {
  const haystack = [candidate.title, candidate.rom_name, candidate.page_text]
    .filter(Boolean)
    .join(" \n ");

  const family =
    normalizeRomFamily(candidate.rom_name) ??
    normalizeRomFamily(candidate.title) ??
    normalizeRomFamily(candidate.page_text?.slice(0, 400));
  if (!family) {
    return { ok: false, reason: "ROM family is not in the allowed list" };
  }

  const links = (candidate.download_links ?? []).filter(Boolean);
  const evidenceText = `${haystack} ${links.join(" ")} ${candidate.download_url ?? ""}`;
  const hasDownloadEvidence =
    Boolean(candidate.download_url) ||
    links.length > 0 ||
    DOWNLOAD_EVIDENCE.some((re) => re.test(evidenceText));

  for (const [re, label] of REJECT_PAGE_PATTERNS) {
    if (re.test(haystack) && !hasDownloadEvidence) {
      return { ok: false, reason: `rejected: ${label} without ROM download evidence` };
    }
  }
  if (!hasDownloadEvidence) {
    return { ok: false, reason: "no genuine ROM/download evidence on the page" };
  }

  const androidVersion =
    parseAndroidVersion(candidate.android_version) ??
    parseAndroidVersion(candidate.title) ??
    parseAndroidVersion(candidate.page_text);
  if (!androidVersion) {
    return { ok: false, reason: "Android version could not be determined (not guessed)" };
  }

  const romVersion =
    (candidate.rom_version && candidate.rom_version.trim()) ||
    parseRomVersion(candidate.title, family) ||
    parseRomVersion(candidate.rom_name, family) ||
    null;

  const romType = candidate.rom_type ?? romTypeForFamily(family);
  const officialStatus =
    candidate.official_status ??
    parseOfficialStatus(candidate.title) ??
    parseOfficialStatus(candidate.page_text) ??
    null;

  let foundOn = candidate.found_on?.trim() || null;
  if (!foundOn) {
    try {
      foundOn = new URL(candidate.source_url).hostname.replace(/^www\./, "");
    } catch {
      return { ok: false, reason: "source_url is not a valid URL" };
    }
  }

  return {
    ok: true,
    record: {
      brand: candidate.brand,
      device_slug: candidate.device_slug,
      device_name: candidate.device_name,
      codename: candidate.codename?.trim() || null,
      slug: romSlug(family, romVersion, androidVersion),
      rom_name: family,
      rom_version: romVersion,
      android_version: androidVersion,
      rom_type: romType,
      source_url: candidate.source_url,
      download_url: candidate.download_url?.trim() || links[0] || null,
      found_on: foundOn,
      made_by: candidate.made_by?.trim() || "unknown",
      official_status: officialStatus,
      installation_guide: null,
      additional_info:
        links.length > 1 ? `Downloads found on the source page:\n${links.join("\n")}` : null,
    },
  };
}

/**
 * Deduplicate by ROM identity (family + ROM version + Android version) per device.
 * Different versions of the same ROM are kept as separate entries.
 */
export function dedupeRecords(records: RomRecord[]): RomRecord[] {
  const seen = new Map<string, RomRecord>();
  for (const record of records) {
    const id = romIdentity(record);
    const existing = seen.get(id);
    if (!existing) {
      seen.set(id, record);
      continue;
    }
    // prefer the entry with more information
    const score = (r: RomRecord) =>
      (r.download_url ? 2 : 0) + (r.official_status ? 1 : 0) + (r.codename ? 1 : 0);
    if (score(record) > score(existing)) seen.set(id, record);
  }
  return [...seen.values()];
}

export type ImportReport = {
  accepted: RomRecord[];
  rejected: Array<{ source_url: string; reason: string }>;
  duplicatesRemoved: number;
};

/** Full pipeline: validate → dedupe → report. */
export function buildImport(candidates: RomCandidate[]): ImportReport {
  const accepted: RomRecord[] = [];
  const rejected: ImportReport["rejected"] = [];
  for (const candidate of candidates) {
    const result = validateCandidate(candidate);
    if (result.ok) accepted.push(result.record);
    else rejected.push({ source_url: candidate.source_url, reason: result.reason });
  }
  const deduped = dedupeRecords(accepted);
  return { accepted: deduped, rejected, duplicatesRemoved: accepted.length - deduped.length };
}

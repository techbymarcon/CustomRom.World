import a10 from "@/assets/android/android-10.svg.asset.json";
import a11 from "@/assets/android/android-11.svg.asset.json";
import a12 from "@/assets/android/android-12.svg.asset.json";
import a13 from "@/assets/android/android-13.svg.asset.json";
import a14 from "@/assets/android/android-14.svg.asset.json";
import a15 from "@/assets/android/android-15.svg.asset.json";
import a16 from "@/assets/android/android-16.svg.asset.json";

export const ANDROID_VERSIONS = [
  "Android 10",
  "Android 11",
  "Android 12",
  "Android 13",
  "Android 14",
  "Android 15",
  "Android 16",
  "Android 17",
] as const;

export const ROM_NAMES = [
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
  "AOSP",
] as const;

export const ANDROID_LOGOS: Record<string, string> = {
  "Android 10": a10.url,
  "Android 11": a11.url,
  "Android 12": a12.url,
  "Android 13": a13.url,
  "Android 14": a14.url,
  "Android 15": a15.url,
  "Android 16": a16.url,
};

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/\+/g, "-plus")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export type Rom = {
  id: string;
  brand: string;
  device_slug: string;
  device_name: string;
  slug: string;
  rom_name: string;
  android_version: string;
  download_url: string;
  made_by: string;
  found_on: string;
  installation_guide: string | null;
  additional_info: string | null;
};

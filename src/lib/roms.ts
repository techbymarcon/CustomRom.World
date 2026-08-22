import a23 from "@/assets/android/android-2.3.webp.asset.json";
import a30 from "@/assets/android/android-3.0.webp.asset.json";
import a40 from "@/assets/android/android-4.0.webp.asset.json";
import a41 from "@/assets/android/android-4.1.svg.asset.json";
import a44 from "@/assets/android/android-4.4.webp.asset.json";
import a50 from "@/assets/android/android-5.0.webp.asset.json";
import a60 from "@/assets/android/android-6.0.svg.asset.json";
import a70 from "@/assets/android/android-7.0.svg.asset.json";
import a80 from "@/assets/android/android-8.0.svg.asset.json";
import a9 from "@/assets/android/android-9.svg.asset.json";
import a10 from "@/assets/android/android-10.svg.asset.json";
import a11 from "@/assets/android/android-11.svg.asset.json";
import a12 from "@/assets/android/android-12.svg.asset.json";
import a13 from "@/assets/android/android-13.svg.asset.json";
import a14 from "@/assets/android/android-14.svg.asset.json";
import a15 from "@/assets/android/android-15.svg.asset.json";
import a16 from "@/assets/android/android-16.svg.asset.json";
import rInfinityX from "@/assets/roms/infinityx.jpg.asset.json";
import rDivestOS from "@/assets/roms/divestos.jpg.asset.json";
import rIodeOS from "@/assets/roms/iodeos.png.asset.json";
import rEOS from "@/assets/roms/e-os.png.asset.json";
import rGrapheneOS from "@/assets/roms/grapheneos.png.asset.json";
import rCalyxOS from "@/assets/roms/calyxos.png.asset.json";
import rParanoid from "@/assets/roms/paranoidandroid.svg.asset.json";
import rSuperiorOS from "@/assets/roms/superioros.png.asset.json";
import rResurrection from "@/assets/roms/resurrectionremix.png.asset.json";
import rHavocOS from "@/assets/roms/havocos.png.asset.json";

export const ANDROID_VERSIONS = [
  "Android 2.3 Gingerbread",
  "Android 3.0 Honeycomb",
  "Android 4.0 Ice Cream Sandwich",
  "Android 4.1 Jelly Bean",
  "Android 4.4 KitKat",
  "Android 5.0 Lollipop",
  "Android 6.0 Marshmallow",
  "Android 7.0 Nougat",
  "Android 8.0 Oreo",
  "Android 9 Pie",
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
  "Android 2.3 Gingerbread": a23.url,
  "Android 3.0 Honeycomb": a30.url,
  "Android 4.0 Ice Cream Sandwich": a40.url,
  "Android 4.1 Jelly Bean": a41.url,
  "Android 4.4 KitKat": a44.url,
  "Android 5.0 Lollipop": a50.url,
  "Android 6.0 Marshmallow": a60.url,
  "Android 7.0 Nougat": a70.url,
  "Android 8.0 Oreo": a80.url,
  "Android 9 Pie": a9.url,
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

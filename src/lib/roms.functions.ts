import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { RomCandidate } from "./rom-import";
import type { Rom } from "./roms";

const SELECT =
  "id, brand, device_slug, device_name, codename, slug, rom_name, rom_version, android_version, rom_type, source_url, download_url, made_by, found_on, official_status, installation_guide, additional_info";


export const listRoms = createServerFn({ method: "GET" })
  .inputValidator((input: { brand: string; device_slug: string }) => input)
  .handler(async ({ data }) => {
    const { getPublicClient } = await import("./public-client.server");
    const { data: rows } = await getPublicClient()
      .from("roms")
      .select(SELECT)
      .eq("brand", data.brand)
      .eq("device_slug", data.device_slug)
      .order("created_at", { ascending: false });
    return { roms: (rows ?? []) as Rom[] };
  });

export const getRom = createServerFn({ method: "GET" })
  .inputValidator((input: { brand: string; device_slug: string; slug: string }) => input)
  .handler(async ({ data }) => {
    const { getPublicClient } = await import("./public-client.server");
    const { data: row } = await getPublicClient()
      .from("roms")
      .select(SELECT)
      .eq("brand", data.brand)
      .eq("device_slug", data.device_slug)
      .eq("slug", data.slug)
      .maybeSingle();
    return { rom: (row as Rom | null) ?? null };
  });

export const createRom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      brand: string;
      device_slug: string;
      device_name: string;
      codename: string | null;
      slug: string;
      rom_name: string;
      rom_version: string | null;
      android_version: string;
      rom_type: string;
      source_url: string | null;
      download_url: string | null;
      made_by: string;
      found_on: string;
      official_status: string | null;
      installation_guide: string | null;
      additional_info: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("roms")
      .insert({ ...data, created_by: context.userId });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

export const deleteRom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("roms").delete().eq("id", data.id);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

/**
 * Import discovered ROM candidates: strict validation + dedupe, then upsert.
 * Rejected candidates are reported back with a reason, never inserted.
 */
export const importRomCandidates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { candidates: RomCandidate[] }) => input)
  .handler(async ({ data, context }) => {
    const { buildImport } = await import("./rom-import");
    const report = buildImport(data.candidates);
    if (report.accepted.length === 0) {
      return {
        ok: true as const,
        inserted: 0,
        duplicatesRemoved: report.duplicatesRemoved,
        rejected: report.rejected,
      };
    }
    const { error } = await context.supabase
      .from("roms")
      .upsert(
        report.accepted.map((record) => ({ ...record, created_by: context.userId })),
        { onConflict: "brand,device_slug,rom_name,rom_version,android_version", ignoreDuplicates: true },
      );
    if (error) return { ok: false as const, error: error.message };
    return {
      ok: true as const,
      inserted: report.accepted.length,
      duplicatesRemoved: report.duplicatesRemoved,
      rejected: report.rejected,
    };
  });


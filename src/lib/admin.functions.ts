import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MemberRow = {
  id: string;
  username: string;
  is_admin: boolean;
  is_contributor: boolean;
};

export type ContributorRomRow = {
  id: string;
  brand: string;
  device_slug: string;
  device_name: string;
  slug: string;
  rom_name: string;
  android_version: string;
  created_at: string;
  author: string;
};

export const listMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: adminRow } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!adminRow) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, username").order("username"),
      supabaseAdmin.from("user_roles").select("user_id, role"),
    ]);

    const members: MemberRow[] = (profiles ?? []).map((profile) => {
      const mine = (roles ?? []).filter((row) => row.user_id === profile.id);
      return {
        id: profile.id,
        username: profile.username,
        is_admin: mine.some((row) => row.role === "admin"),
        is_contributor: mine.some((row) => row.role === "contributor"),
      };
    });

    return { members };
  });

export const setContributorAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; grant: boolean }) => input)
  .handler(async ({ data, context }) => {
    const { data: adminRow } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!adminRow) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.grant) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.userId, role: "contributor" }, { onConflict: "user_id,role" });
      if (error) return { ok: false as const, error: error.message };
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", "contributor");
      if (error) return { ok: false as const, error: error.message };
    }
    return { ok: true as const };
  });

export const listContributorRoms = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: adminRow } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!adminRow) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: roms }, { data: profiles }, { data: roles }] = await Promise.all([
      supabaseAdmin
        .from("roms")
        .select(
          "id, brand, device_slug, device_name, slug, rom_name, android_version, created_at, created_by",
        )
        .order("created_at", { ascending: false })
        .limit(200),
      supabaseAdmin.from("profiles").select("id, username"),
      supabaseAdmin.from("user_roles").select("user_id, role"),
    ]);

    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.username]));
    const adminIds = new Set(
      (roles ?? []).filter((r) => r.role === "admin").map((r) => r.user_id),
    );

    const rows: ContributorRomRow[] = (roms ?? [])
      .filter((rom) => rom.created_by && !adminIds.has(rom.created_by))
      .map((rom) => ({
        id: rom.id,
        brand: rom.brand,
        device_slug: rom.device_slug,
        device_name: rom.device_name,
        slug: rom.slug,
        rom_name: rom.rom_name,
        android_version: rom.android_version,
        created_at: rom.created_at,
        author: nameById.get(rom.created_by as string) ?? "unknown",
      }));

    return { roms: rows };
  });

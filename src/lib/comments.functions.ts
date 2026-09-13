import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type RomComment = {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  parent_id: string | null;
  username: string;
  avatar_url: string | null;
  verified: boolean;
};

export type LatestComment = RomComment & {
  rom: {
    brand: string;
    device_slug: string;
    slug: string;
    rom_name: string;
    device_name: string;
  } | null;
};

type ProfileRow = { id: string; username: string; avatar_url: string | null };

async function decorate(
  rows: { user_id: string }[],
): Promise<Map<string, { username: string; avatar_url: string | null; verified: boolean }>> {
  const out = new Map<string, { username: string; avatar_url: string | null; verified: boolean }>();
  const ids = [...new Set(rows.map((r) => r.user_id))];
  if (ids.length === 0) return out;

  const { getPublicClient } = await import("./public-client.server");
  const { data: profiles } = await getPublicClient()
    .from("profiles")
    .select("id, username, avatar_url")
    .in("id", ids);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("user_id, role")
    .in("user_id", ids);
  const admins = new Set((roles ?? []).filter((r) => r.role === "admin").map((r) => r.user_id));

  for (const profile of (profiles ?? []) as ProfileRow[]) {
    let avatar: string | null = null;
    if (profile.avatar_url) {
      const signed = await supabaseAdmin.storage
        .from("avatars")
        .createSignedUrl(profile.avatar_url, 3600);
      avatar = signed.data?.signedUrl ?? null;
    }
    out.set(profile.id, {
      username: profile.username,
      avatar_url: avatar,
      verified: admins.has(profile.id),
    });
  }
  return out;
}

export const listRomComments = createServerFn({ method: "GET" })
  .inputValidator((input: { rom_id: string }) => input)
  .handler(async ({ data }) => {
    const { getPublicClient } = await import("./public-client.server");
    const { data: rows } = await getPublicClient()
      .from("rom_comments")
      .select("id, body, created_at, user_id, parent_id")
      .eq("rom_id", data.rom_id)
      .order("created_at", { ascending: false })
      .limit(100);

    const list = rows ?? [];
    const people = await decorate(list);
    const comments: RomComment[] = list.map((row) => ({
      ...row,
      username: people.get(row.user_id)?.username ?? "member",
      avatar_url: people.get(row.user_id)?.avatar_url ?? null,
      verified: people.get(row.user_id)?.verified ?? false,
    }));
    return { comments };
  });

export const listLatestComments = createServerFn({ method: "GET" }).handler(async () => {
  const { getPublicClient } = await import("./public-client.server");
  const { data: rows } = await getPublicClient()
    .from("rom_comments")
    .select(
      "id, body, created_at, user_id, parent_id, roms(brand, device_slug, slug, rom_name, device_name)",
    )
    .order("created_at", { ascending: false })
    .limit(8);

  const list = rows ?? [];
  const people = await decorate(list);
  const comments: LatestComment[] = list.map((row) => {
    const rom = (row as unknown as { roms: LatestComment["rom"] }).roms ?? null;
    return {
      id: row.id,
      body: row.body,
      created_at: row.created_at,
      user_id: row.user_id,
      parent_id: row.parent_id,
      username: people.get(row.user_id)?.username ?? "member",
      avatar_url: people.get(row.user_id)?.avatar_url ?? null,
      verified: people.get(row.user_id)?.verified ?? false,
      rom,
    };
  });
  return { comments };
});

export const addRomComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { rom_id: string; body: string; parent_id?: string | null }) => {
    const body = input.body.trim();
    if (!body) throw new Error("Write something first");
    if (body.length > 2000) throw new Error("Comment is too long");
    return { rom_id: input.rom_id, body, parent_id: input.parent_id ?? null };
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("rom_comments").insert({
      rom_id: data.rom_id,
      user_id: context.userId,
      body: data.body,
      parent_id: data.parent_id,
    });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

export const deleteRomComment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("rom_comments").delete().eq("id", data.id);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SiteContentRow = {
  key: string;
  text_value: string | null;
  color: string | null;
  image_url: string | null;
  width: number | null;
};

export const getSiteContent = createServerFn({ method: "GET" }).handler(async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  const url = process.env["SUPABASE_URL"]!;
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });

  const { data, error } = await client
    .from("site_content")
    .select("key, text_value, color, image_url, width");
  if (error || !data) return { rows: [] as SiteContentRow[] };

  const rows = data as SiteContentRow[];
  const paths = rows
    .map((row) => row.image_url)
    .filter((value): value is string => !!value && !value.startsWith("http"));

  if (paths.length > 0) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const signed = await supabaseAdmin.storage
      .from("site-images")
      .createSignedUrls(paths, 60 * 60 * 24 * 7);
    const map = new Map<string, string>();
    for (const item of signed.data ?? []) {
      if (item.path && item.signedUrl) map.set(item.path, item.signedUrl);
    }
    for (const row of rows) {
      if (row.image_url && map.has(row.image_url)) row.image_url = map.get(row.image_url)!;
    }
  }

  return { rows };
});

export const saveSiteContent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      key: string;
      text_value?: string | null;
      color?: string | null;
      image_url?: string | null;
      width?: number | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const patch = {
      key: data.key,
      updated_by: context.userId,
      ...(data.text_value !== undefined ? { text_value: data.text_value } : {}),
      ...(data.color !== undefined ? { color: data.color } : {}),
      ...(data.image_url !== undefined ? { image_url: data.image_url } : {}),
      ...(data.width !== undefined ? { width: data.width } : {}),
    };

    const { error } = await context.supabase.from("site_content").upsert(patch, {
      onConflict: "key",
    });
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

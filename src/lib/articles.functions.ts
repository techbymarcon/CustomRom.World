import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  resolveStorageUrls,
  sanitizeRichHtml,
  storagePathsInHtml,
  STORAGE_PREFIX,
} from "./rich-html";

export type Article = {
  id: string;
  scope: "device" | "page";
  brand: string | null;
  device_slug: string | null;
  page_key: string | null;
  title: string;
  cover_image_url: string | null;
  body_html: string;
};

const SELECT = "id, scope, brand, device_slug, page_key, title, cover_image_url, body_html";

async function signArticles(rows: Article[]): Promise<Article[]> {
  const paths = new Set<string>();
  for (const row of rows) {
    if (row.cover_image_url && !row.cover_image_url.startsWith("http")) {
      paths.add(row.cover_image_url.replace(STORAGE_PREFIX, ""));
    }
    for (const path of storagePathsInHtml(row.body_html ?? "")) paths.add(path);
  }
  if (paths.size === 0) return rows;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const signed = await supabaseAdmin.storage
    .from("article-images")
    .createSignedUrls([...paths], 60 * 60 * 24 * 7);
  const map = new Map<string, string>();
  for (const item of signed.data ?? []) {
    if (item.path && item.signedUrl) map.set(item.path, item.signedUrl);
  }

  return rows.map((row) => ({
    ...row,
    cover_image_url: row.cover_image_url
      ? (map.get(row.cover_image_url.replace(STORAGE_PREFIX, "")) ?? row.cover_image_url)
      : null,
    body_html: resolveStorageUrls(row.body_html ?? "", map),
  }));
}

export const listDeviceArticles = createServerFn({ method: "GET" })
  .inputValidator((input: { brand: string; device_slug: string }) => input)
  .handler(async ({ data }) => {
    const { getPublicClient } = await import("./public-client.server");
    const { data: rows } = await getPublicClient()
      .from("articles")
      .select(SELECT)
      .eq("scope", "device")
      .eq("brand", data.brand)
      .eq("device_slug", data.device_slug)
      .order("created_at", { ascending: false });
    return { articles: await signArticles((rows ?? []) as Article[]) };
  });

export const getArticleById = createServerFn({ method: "GET" })
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const { getPublicClient } = await import("./public-client.server");
    const { data: row } = await getPublicClient()
      .from("articles")
      .select(SELECT)
      .eq("id", data.id)
      .maybeSingle();
    if (!row) return { article: null };
    const [signed] = await signArticles([row as Article]);
    return { article: signed ?? null };
  });

export const getPageArticle = createServerFn({ method: "GET" })
  .inputValidator((input: { page_key: string }) => input)
  .handler(async ({ data }) => {
    const { getPublicClient } = await import("./public-client.server");
    const { data: row } = await getPublicClient()
      .from("articles")
      .select(SELECT)
      .eq("page_key", data.page_key)
      .maybeSingle();
    if (!row) return { article: null };
    const [signed] = await signArticles([row as Article]);
    return { article: signed ?? null };
  });

export const saveArticle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id?: string | null;
      scope: "device" | "page";
      brand?: string | null;
      device_slug?: string | null;
      page_key?: string | null;
      title: string;
      cover_image_url?: string | null;
      body_html: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const payload = {
      scope: data.scope,
      brand: data.brand ?? null,
      device_slug: data.device_slug ?? null,
      page_key: data.page_key ?? null,
      title: data.title.trim() || "Untitled",
      cover_image_url: data.cover_image_url ?? null,
      body_html: sanitizeRichHtml(data.body_html),
    };

    if (data.id) {
      const { error } = await context.supabase
        .from("articles")
        .update(payload)
        .eq("id", data.id);
      if (error) return { ok: false as const, error: error.message };
      return { ok: true as const, id: data.id };
    }

    if (data.scope === "page" && data.page_key) {
      const { data: row, error } = await context.supabase
        .from("articles")
        .upsert({ ...payload, created_by: context.userId }, { onConflict: "page_key" })
        .select("id")
        .maybeSingle();
      if (error) return { ok: false as const, error: error.message };
      return { ok: true as const, id: (row as { id: string } | null)?.id ?? null };
    }

    const { data: row, error } = await context.supabase
      .from("articles")
      .insert({ ...payload, created_by: context.userId })
      .select("id")
      .maybeSingle();
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, id: (row as { id: string } | null)?.id ?? null };
  });

export const deleteArticle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("articles").delete().eq("id", data.id);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

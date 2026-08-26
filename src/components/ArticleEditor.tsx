import { useState } from "react";
import { toast } from "sonner";

import { RichEditor } from "@/components/RichEditor";
import { supabase } from "@/integrations/supabase/client";
import { saveArticle, type Article } from "@/lib/articles.functions";
import { useServerFn } from "@tanstack/react-start";
import { STORAGE_PREFIX } from "@/lib/rich-html";

export function ArticleEditor({
  article,
  scope,
  brand,
  deviceSlug,
  pageKey,
  title: heading,
  withCover = true,
  onClose,
  onSaved,
}: {
  article: Article | null;
  scope: "device" | "page";
  brand?: string;
  deviceSlug?: string;
  pageKey?: string;
  title: string;
  withCover?: boolean;
  onClose: () => void;
  onSaved: (id: string | null) => void;
}) {
  const saveFn = useServerFn(saveArticle);
  const [title, setTitle] = useState(article?.title ?? "");
  const [body, setBody] = useState(article?.body_html ?? "");
  const [coverPath, setCoverPath] = useState<string | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(article?.cover_image_url ?? null);
  const [saving, setSaving] = useState(false);

  async function uploadCover(file: File) {
    const path = `covers/${Date.now()}-${file.name.replace(/[^\w.-]/g, "")}`;
    const up = await supabase.storage.from("article-images").upload(path, file, { upsert: true });
    if (up.error) {
      toast.error("Couldn't upload that image");
      return;
    }
    const signed = await supabase.storage.from("article-images").createSignedUrl(path, 3600);
    setCoverPath(path);
    setCoverPreview(signed.data?.signedUrl ?? null);
  }

  async function submit() {
    if (!title.trim()) {
      toast.error("Give the article a title.");
      return;
    }
    setSaving(true);
    const res = await saveFn({
      data: {
        id: article?.id ?? null,
        scope,
        brand: brand ?? null,
        device_slug: deviceSlug ?? null,
        page_key: pageKey ?? null,
        title: title.trim(),
        ...(coverPath ? { cover_image_url: `${STORAGE_PREFIX}${coverPath}` } : {}),
        body_html: body,
      },
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Article saved for everyone");
    onSaved(res.id ?? article?.id ?? null);
  }

  return (
    <div className="fixed inset-0 z-[100] flex animate-fade-in items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl animate-scale-in rounded-3xl border-2 border-primary bg-card p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">{heading}</h3>
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground">
            Close
          </button>
        </div>

        <div className="grid gap-4 text-left">
          <label className="text-sm font-bold">
            Title
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="mt-1 w-full rounded-xl border border-input bg-background p-2.5 text-sm"
            />
          </label>

          {withCover && (
            <label className="text-sm font-bold">
              Button image
              <input
                type="file"
                accept="image/*"
                className="mt-1 w-full text-sm"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadCover(file);
                }}
              />
              {coverPreview && (
                <img
                  src={coverPreview}
                  alt=""
                  className="mt-2 h-24 w-full rounded-xl object-cover"
                />
              )}
            </label>
          )}

          <div className="text-sm font-bold">
            Body
            <div className="mt-1">
              <RichEditor value={body} onChange={setBody} allowImages />
            </div>
          </div>

          <button
            disabled={saving}
            onClick={submit}
            className="rounded-full bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-60"
          >
            {saving ? "Saving…" : "Publish article"}
          </button>
        </div>
      </div>
    </div>
  );
}

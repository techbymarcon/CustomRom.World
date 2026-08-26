import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { ArticleEditor } from "@/components/ArticleEditor";
import { Fog } from "@/components/Fog";
import { Header } from "@/components/Header";
import { RichContent } from "@/components/RichContent";
import { deleteArticle, getArticleById } from "@/lib/articles.functions";
import { useSite } from "@/lib/site";

export const Route = createFileRoute("/articles/$id")({
  head: () => ({
    meta: [
      { title: "Article — Custom Rom World" },
      {
        name: "description",
        content: "Guides, notes and ROM articles written by the Custom Rom World team.",
      },
      { property: "og:title", content: "Article — Custom Rom World" },
      {
        property: "og:description",
        content: "Guides, notes and ROM articles written by the Custom Rom World team.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ArticlePage,
});

function ArticlePage() {
  const { id } = Route.useParams();
  const { isAdmin } = useSite();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const removeFn = useServerFn(deleteArticle);

  const query = useQuery({
    queryKey: ["article", id],
    queryFn: () => getArticleById({ data: { id } }),
  });
  const article = query.data?.article ?? null;

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <Fog />
      <Header />

      <main className="relative z-10 px-6 pb-20 pt-10">
        <article className="mx-auto max-w-2xl">
          {query.isLoading && <p className="text-muted-foreground">Loading article…</p>}
          {!query.isLoading && !article && (
            <p className="rounded-3xl border-2 border-primary/50 bg-background/40 p-6 text-muted-foreground backdrop-blur-sm">
              This article doesn't exist any more.
            </p>
          )}

          {article && (
            <>
              {article.cover_image_url && (
                <img
                  src={article.cover_image_url}
                  alt=""
                  className="mb-6 h-48 w-full rounded-3xl border-2 border-primary object-cover"
                />
              )}
              <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
                {article.title}
              </h1>

              {isAdmin && (
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    onClick={() => setEditing(true)}
                    className="rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
                  >
                    Edit article
                  </button>
                  <button
                    onClick={async () => {
                      const res = await removeFn({ data: { id: article.id } });
                      if (!res.ok) {
                        toast.error(res.error);
                        return;
                      }
                      toast.success("Article deleted");
                      await queryClient.invalidateQueries({ queryKey: ["article", id] });
                      await queryClient.invalidateQueries({ queryKey: ["device-articles"] });
                    }}
                    className="rounded-full border border-destructive px-4 py-2 text-sm font-bold text-destructive"
                  >
                    Delete
                  </button>
                </div>
              )}

              <RichContent
                html={article.body_html}
                className="mt-6 rounded-3xl border-2 border-primary/50 bg-background/40 p-5 text-left backdrop-blur-sm"
              />
            </>
          )}
        </article>
      </main>

      {editing && article && (
        <ArticleEditor
          article={article}
          scope={article.scope}
          {...(article.brand ? { brand: article.brand } : {})}
          {...(article.device_slug ? { deviceSlug: article.device_slug } : {})}
          {...(article.page_key ? { pageKey: article.page_key } : {})}
          title="Edit article"
          onClose={() => setEditing(false)}
          onSaved={async () => {
            await queryClient.invalidateQueries({ queryKey: ["article", id] });
            await queryClient.invalidateQueries({ queryKey: ["device-articles"] });
            setEditing(false);
          }}
        />
      )}
    </div>
  );
}

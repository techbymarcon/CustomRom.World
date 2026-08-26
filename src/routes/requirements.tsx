import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { ArticleEditor } from "@/components/ArticleEditor";
import { Fog } from "@/components/Fog";
import { Header } from "@/components/Header";
import { RichContent } from "@/components/RichContent";
import { getPageArticle } from "@/lib/articles.functions";
import { useSite } from "@/lib/site";

export const Route = createFileRoute("/requirements")({
  head: () => ({
    meta: [
      { title: "The requirements to Rom — Custom Rom World" },
      {
        name: "description",
        content:
          "What you need before flashing a custom ROM: bootloader unlocking, recovery, backups and the tools required.",
      },
      { property: "og:title", content: "The requirements to Rom — Custom Rom World" },
      {
        property: "og:description",
        content:
          "What you need before flashing a custom ROM: bootloader unlocking, recovery, backups and the tools required.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "The requirements to Rom — Custom Rom World" },
      {
        name: "twitter:description",
        content: "Everything you need before flashing a custom ROM.",
      },
    ],
  }),
  component: RequirementsPage,
});

const PAGE_KEY = "requirements";

function RequirementsPage() {
  const { isAdmin } = useSite();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);

  const query = useQuery({
    queryKey: ["page-article", PAGE_KEY],
    queryFn: () => getPageArticle({ data: { page_key: PAGE_KEY } }),
  });
  const article = query.data?.article ?? null;

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <Fog />
      <Header />

      <main className="relative z-10 px-6 pb-20 pt-10">
        <section className="mx-auto max-w-2xl">
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
            <span className="text-primary">the requirements</span> to Rom
          </h1>

          {isAdmin && (
            <button
              onClick={() => setEditing(true)}
              className="mt-4 rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
            >
              {article ? "Edit this page" : "Write this page"}
            </button>
          )}

          {query.isLoading && <p className="mt-6 text-muted-foreground">Loading…</p>}

          {!query.isLoading && !article && (
            <p className="mt-6 rounded-3xl border-2 border-primary/50 bg-background/40 p-6 text-muted-foreground backdrop-blur-sm">
              Nothing written here yet.
            </p>
          )}

          {article && (
            <>
              {article.cover_image_url && (
                <img
                  src={article.cover_image_url}
                  alt=""
                  className="mt-6 h-44 w-full rounded-3xl border-2 border-primary object-cover"
                />
              )}
              <RichContent
                html={article.body_html}
                className="mt-6 rounded-3xl border-2 border-primary/50 bg-background/40 p-5 text-left backdrop-blur-sm"
              />
            </>
          )}
        </section>
      </main>

      {editing && (
        <ArticleEditor
          article={article}
          scope="page"
          pageKey={PAGE_KEY}
          title="The requirements to Rom"
          withCover={false}
          onClose={() => setEditing(false)}
          onSaved={async () => {
            await queryClient.invalidateQueries({ queryKey: ["page-article", PAGE_KEY] });
            setEditing(false);
          }}
        />
      )}
    </div>
  );
}

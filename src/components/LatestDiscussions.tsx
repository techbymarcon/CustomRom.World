import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { CommentAvatar } from "@/components/CommentAvatar";
import { listLatestComments } from "@/lib/comments.functions";

export function LatestDiscussions() {
  const query = useQuery({
    queryKey: ["latest-comments"],
    queryFn: () => listLatestComments(),
  });
  const comments = query.data?.comments ?? [];

  return (
    <section id="discussions" className="px-5 pb-10">
      <div className="rounded-4xl border-2 border-primary bg-card/70 px-6 py-8 backdrop-blur-md">
        <h2 className="text-3xl font-extrabold leading-tight">
          <span className="text-primary">Last</span> discussions
        </h2>
        <p className="mt-2 text-sm text-foreground/80">
          The newest comments from the community across all ROMs.
        </p>

        <div className="mt-5 grid gap-3">
          {query.isLoading && <p className="text-sm text-muted-foreground">Loading discussions…</p>}
          {!query.isLoading && comments.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No discussions yet — open a ROM page and start one.
            </p>
          )}
          {comments.map((comment) => (
            <article
              key={comment.id}
              className="rounded-2xl border border-primary/40 bg-background/50 p-4 text-left"
            >
              <div className="flex items-center justify-between gap-2">
                <CommentAvatar
                  username={comment.username}
                  avatarUrl={comment.avatar_url}
                  verified={comment.verified}
                />
                <span className="text-xs text-muted-foreground">
                  {new Date(comment.created_at).toLocaleDateString()}
                </span>
              </div>
              <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                {comment.body}
              </p>
              {comment.rom && (
                <Link
                  to="/devices/$brand/$model/$rom"
                  params={{
                    brand: comment.rom.brand,
                    model: comment.rom.device_slug,
                    rom: comment.rom.slug,
                  }}
                  className="mt-2 inline-block text-xs font-bold text-primary underline"
                >
                  {comment.rom.rom_name} · {comment.rom.device_name}
                </Link>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

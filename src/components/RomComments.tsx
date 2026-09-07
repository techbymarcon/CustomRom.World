import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { CommentAvatar } from "@/components/CommentAvatar";
import { addRomComment, deleteRomComment, listRomComments } from "@/lib/comments.functions";
import { useSite } from "@/lib/site";

export function RomComments({ romId }: { romId: string }) {
  const { session, isAdmin } = useSite();
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");

  const comments = useQuery({
    queryKey: ["rom-comments", romId],
    queryFn: () => listRomComments({ data: { rom_id: romId } }),
  });

  const addFn = useServerFn(addRomComment);
  const removeFn = useServerFn(deleteRomComment);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["rom-comments", romId] }),
      queryClient.invalidateQueries({ queryKey: ["latest-comments"] }),
    ]);
  };

  const add = useMutation({
    mutationFn: () => addFn({ data: { rom_id: romId, body } }),
    onSuccess: async (res) => {
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setBody("");
      toast.success("Comment posted");
      await refresh();
    },
    onError: () => toast.error("Couldn't post your comment"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => removeFn({ data: { id } }),
    onSuccess: async () => {
      toast.success("Comment deleted");
      await refresh();
    },
    onError: () => toast.error("Couldn't delete that comment"),
  });

  const list = comments.data?.comments ?? [];

  return (
    <section className="mt-6 rounded-3xl border-2 border-primary bg-background/40 p-5 text-left backdrop-blur-sm">
      <h2 className="text-xl font-extrabold text-primary">Comments</h2>

      {session ? (
        <div className="mt-3">
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Share your experience with this ROM…"
            className="w-full rounded-2xl border-2 border-primary/60 bg-background/60 p-3 text-sm outline-none focus:border-primary"
          />
          <button
            onClick={() => add.mutate()}
            disabled={add.isPending || !body.trim()}
            className="mt-2 rounded-full bg-primary px-5 py-2 text-sm font-extrabold text-primary-foreground disabled:opacity-50"
          >
            {add.isPending ? "Posting…" : "Post comment"}
          </button>
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">Sign in to leave a comment.</p>
      )}

      <div className="mt-4 grid gap-3">
        {comments.isLoading && <p className="text-sm text-muted-foreground">Loading comments…</p>}
        {!comments.isLoading && list.length === 0 && (
          <p className="text-sm text-muted-foreground">No comments yet — be the first!</p>
        )}
        {list.map((comment) => (
          <article
            key={comment.id}
            className="rounded-2xl border border-primary/40 bg-background/50 p-3"
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
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {comment.body}
            </p>
            {(isAdmin || session?.user.id === comment.user_id) && (
              <button
                onClick={() => remove.mutate(comment.id)}
                disabled={remove.isPending}
                className="mt-2 text-xs font-bold text-muted-foreground underline disabled:opacity-50"
              >
                Delete
              </button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

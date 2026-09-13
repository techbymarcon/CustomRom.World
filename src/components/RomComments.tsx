import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { CommentAvatar } from "@/components/CommentAvatar";
import {
  addRomComment,
  deleteRomComment,
  listRomComments,
  type RomComment,
} from "@/lib/comments.functions";
import { useSite } from "@/lib/site";

export function RomComments({ romId }: { romId: string }) {
  const { session, isAdmin } = useSite();
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");

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
      queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    ]);
  };

  const add = useMutation({
    mutationFn: (vars: { body: string; parent_id: string | null }) =>
      addFn({ data: { rom_id: romId, body: vars.body, parent_id: vars.parent_id } }),
    onSuccess: async (res, vars) => {
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (vars.parent_id) {
        setReplyTo(null);
        setReplyBody("");
        toast.success("Reply posted");
      } else {
        setBody("");
        toast.success("Comment posted");
      }
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
  const roots = list.filter((comment) => !comment.parent_id);
  const repliesOf = (id: string) =>
    list
      .filter((comment) => comment.parent_id === id)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));

  const canDelete = (comment: RomComment) => isAdmin || session?.user.id === comment.user_id;

  const renderComment = (comment: RomComment, isReply: boolean) => (
    <article
      key={comment.id}
      className={`rounded-2xl border bg-background/50 p-3 ${
        isReply ? "ml-4 border-primary/25" : "border-primary/40"
      }`}
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

      <div className="mt-2 flex gap-4">
        {session && (
          <button
            onClick={() => {
              setReplyTo(replyTo === comment.id ? null : comment.id);
              setReplyBody("");
            }}
            className="text-xs font-bold text-primary underline"
          >
            {replyTo === comment.id ? "Cancel" : "Reply"}
          </button>
        )}
        {canDelete(comment) && (
          <button
            onClick={() => remove.mutate(comment.id)}
            disabled={remove.isPending}
            className="text-xs font-bold text-muted-foreground underline disabled:opacity-50"
          >
            Delete
          </button>
        )}
      </div>

      {replyTo === comment.id && session && (
        <div className="mt-2">
          <textarea
            value={replyBody}
            onChange={(event) => setReplyBody(event.target.value)}
            rows={2}
            maxLength={2000}
            placeholder={`Reply to ${comment.username}…`}
            className="w-full rounded-2xl border-2 border-primary/60 bg-background/60 p-2.5 text-sm outline-none focus:border-primary"
          />
          <button
            onClick={() =>
              add.mutate({ body: replyBody, parent_id: comment.parent_id ?? comment.id })
            }
            disabled={add.isPending || !replyBody.trim()}
            className="mt-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-extrabold text-primary-foreground disabled:opacity-50"
          >
            {add.isPending ? "Posting…" : "Post reply"}
          </button>
        </div>
      )}
    </article>
  );

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
            onClick={() => add.mutate({ body, parent_id: null })}
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
        {!comments.isLoading && roots.length === 0 && (
          <p className="text-sm text-muted-foreground">No comments yet — be the first!</p>
        )}
        {roots.map((comment) => (
          <div key={comment.id} className="grid gap-2">
            {renderComment(comment, false)}
            {repliesOf(comment.id).map((reply) => renderComment(reply, true))}
          </div>
        ))}
      </div>
    </section>
  );
}

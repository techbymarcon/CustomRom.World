import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { listNotifications, markNotificationsRead } from "@/lib/notifications.functions";
import { useSite } from "@/lib/site";

export function NotificationsBell() {
  const { session } = useSite();
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const listFn = useServerFn(listNotifications);
  const markFn = useServerFn(markNotificationsRead);

  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: () => listFn(),
    enabled: Boolean(session),
    refetchInterval: 60_000,
  });

  const mark = useMutation({
    mutationFn: () => markFn(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  if (!session) return null;

  const notifications = query.data?.notifications ?? [];
  const unread = query.data?.unread ?? 0;

  return (
    <div className="relative">
      <button
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next && unread > 0) mark.mutate();
        }}
        aria-label="Notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-full border-2 border-primary bg-background/40 backdrop-blur-sm"
      >
        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 text-primary" role="img" aria-hidden="true">
          <path
            fill="currentColor"
            d="M12 2a6 6 0 00-6 6v3.6L4.3 15a1 1 0 00.9 1.5h13.6a1 1 0 00.9-1.5L18 11.6V8a6 6 0 00-6-6zm0 19a2.8 2.8 0 002.8-2.5H9.2A2.8 2.8 0 0012 21z"
          />
        </svg>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-extrabold text-destructive-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-72 animate-fade-in rounded-2xl border-2 border-primary bg-card/95 p-3 text-left shadow-2xl backdrop-blur-md">
          <p className="text-sm font-extrabold text-primary">Notifications</p>
          <div className="mt-2 grid max-h-80 gap-2 overflow-y-auto">
            {notifications.length === 0 && (
              <p className="text-xs text-muted-foreground">Nothing here yet.</p>
            )}
            {notifications.map((item) => {
              const inner = (
                <>
                  <span className="block text-xs font-bold">{item.title}</span>
                  {item.body && (
                    <span className="mt-0.5 block line-clamp-2 text-xs text-muted-foreground">
                      {item.body}
                    </span>
                  )}
                </>
              );
              const className = `block rounded-xl border p-2 ${
                item.read ? "border-primary/25" : "border-primary bg-primary/10"
              }`;
              return item.link_path ? (
                <Link
                  key={item.id}
                  to={item.link_path}
                  onClick={() => setOpen(false)}
                  className={className}
                >
                  {inner}
                </Link>
              ) : (
                <div key={item.id} className={className}>
                  {inner}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

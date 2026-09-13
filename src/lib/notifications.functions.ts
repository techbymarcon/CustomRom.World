import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AppNotification = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link_path: string | null;
  read: boolean;
  created_at: string;
};

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("notifications")
      .select("id, kind, title, body, link_path, read, created_at")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) return { notifications: [] as AppNotification[], unread: 0 };
    const notifications = (data ?? []) as AppNotification[];
    return { notifications, unread: notifications.filter((n) => !n.read).length };
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", context.userId)
      .eq("read", false);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

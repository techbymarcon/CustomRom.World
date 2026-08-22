import { createServerFn } from "@tanstack/react-start";

import { handleToEmail, isValidHandle, normalizeHandle, padPassword } from "./handle";

const OWNER_HANDLE = "techbymarcon";
const OWNER_PASSWORD = "99999";

export const signUpWithHandle = createServerFn({ method: "POST" })
  .inputValidator((input: { handle: string; password: string }) => input)
  .handler(async ({ data }) => {
    const handle = normalizeHandle(data.handle);
    const password = data.password ?? "";

    if (!isValidHandle(handle)) {
      return {
        ok: false as const,
        error: "Handles use 3-24 characters: letters, numbers, dots or underscores.",
      };
    }
    if (password.length < 5) {
      return { ok: false as const, error: "Password must be at least 5 characters." };
    }
    if (handle === OWNER_HANDLE && password !== OWNER_PASSWORD) {
      return { ok: false as const, error: "That handle is reserved." };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const existing = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("username", handle)
      .maybeSingle();
    if (existing.data) {
      return { ok: false as const, error: "That handle is already taken." };
    }

    const created = await supabaseAdmin.auth.admin.createUser({
      email: handleToEmail(handle),
      password: padPassword(password),
      email_confirm: true,
      user_metadata: { username: handle },
    });
    if (created.error || !created.data.user) {
      return { ok: false as const, error: "Could not create the account. Try another handle." };
    }

    const profile = await supabaseAdmin
      .from("profiles")
      .insert({ id: created.data.user.id, username: handle });
    if (profile.error) {
      await supabaseAdmin.auth.admin.deleteUser(created.data.user.id);
      return { ok: false as const, error: "That handle is already taken." };
    }

    return { ok: true as const, handle };
  });

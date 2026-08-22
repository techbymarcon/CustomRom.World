import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { signUpWithHandle } from "@/lib/auth.functions";
import { handleToEmail, normalizeHandle, padPassword } from "@/lib/handle";
import { useSite } from "@/lib/site";
import { EditableText } from "@/components/Editable";

type Panel = "menu" | "auth" | "account";

function AuthPanel({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [handle, setHandle] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        const result = await signUpWithHandle({ data: { handle, password } });
        if (!result.ok) {
          setError(result.error);
          toast.error(result.error);
          return;
        }
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: handleToEmail(handle),
        password: padPassword(password),
      });
      if (signInError) {
        setError("Wrong handle or password.");
        toast.error("Wrong handle or password.");
        return;
      }
      toast.success(mode === "signup" ? "Account created. You're in!" : "Welcome back!");
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-sm text-left">
      <div className="mb-6 flex gap-2">
        {(["login", "signup"] as const).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={`flex-1 rounded-full border-2 py-2 text-sm font-bold uppercase ${
              mode === m ? "border-primary bg-primary/20" : "border-input"
            }`}
          >
            {m === "login" ? "Log in" : "Sign up"}
          </button>
        ))}
      </div>

      <label className="block text-xs uppercase tracking-wide text-muted-foreground">Handle</label>
      <div className="mt-1 flex items-center rounded-2xl border border-input bg-background/70 px-4">
        <span className="text-lg text-primary">@</span>
        <input
          value={handle}
          onChange={(e) => setHandle(normalizeHandle(e.target.value))}
          autoCapitalize="none"
          autoComplete="username"
          className="w-full bg-transparent py-3 text-base outline-none"
          placeholder="yourhandle"
        />
      </div>

      <label className="mt-4 block text-xs uppercase tracking-wide text-muted-foreground">
        Password
      </label>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete={mode === "login" ? "current-password" : "new-password"}
        className="mt-1 w-full rounded-2xl border border-input bg-background/70 px-4 py-3 text-base outline-none"
      />

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      <button
        disabled={busy}
        onClick={submit}
        className="mt-6 w-full rounded-full border-2 border-primary bg-primary/15 py-4 text-lg font-bold disabled:opacity-60"
      >
        {busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
      </button>
      <p className="mt-3 text-xs text-muted-foreground">
        Handles only — no email needed. Keep your password safe, it can't be reset by email.
      </p>
    </div>
  );
}

function AccountPanel() {
  const { profile, avatarUrl, session, refreshProfile, signOut } = useSite();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    if (!session) return;
    setBusy(true);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
    const path = `${session.user.id}/avatar-${Date.now()}.${ext}`;
    const up = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (!up.error) {
      await supabase.from("profiles").update({ avatar_url: path }).eq("id", session.user.id);
      refreshProfile();
      toast.success("Profile picture updated");
    } else {
      toast.error("Couldn't upload that file");
    }
    setBusy(false);
  }

  return (
    <div className="mx-auto w-full max-w-sm text-center">
      <div className="mx-auto h-28 w-28 overflow-hidden rounded-full border-2 border-primary bg-card">
        {avatarUrl ? (
          <img src={avatarUrl} alt="Your profile picture" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl font-bold text-primary">
            {profile?.username?.[0]?.toUpperCase() ?? "?"}
          </div>
        )}
      </div>
      <p className="mt-4 text-2xl font-bold">@{profile?.username}</p>
      <input
        ref={fileRef}
        type="file"
        accept="image/*,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      <button
        disabled={busy}
        onClick={() => fileRef.current?.click()}
        className="mt-6 w-full rounded-full border-2 border-primary bg-primary/15 py-3 font-bold disabled:opacity-60"
      >
        {busy ? "Uploading…" : "Upload picture or GIF"}
      </button>
      <button
        onClick={async () => {
          await signOut();
          toast("Logged out");
        }}
        className="mt-3 w-full rounded-full border border-input py-3 text-sm font-semibold"
      >
        Log out
      </button>
    </div>
  );
}

export function MainMenu() {
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>("menu");
  const { session, profile, avatarUrl, isAdmin, editMode, setEditMode } = useSite();

  const itemClass =
    "block w-full rounded-xl px-3 py-2 text-xl font-semibold uppercase tracking-wide transition-colors hover:bg-primary/10 sm:text-2xl";

  const barBase =
    "absolute left-0 block h-[3px] rounded-full bg-foreground transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]";

  const toggle = (
    <button
      aria-label={open ? "Close menu" : "Open menu"}
      aria-expanded={open}
      onClick={() => {
        if (!open) setPanel("menu");
        setOpen((v) => !v);
      }}
      className="relative h-4 w-5 shrink-0 sm:h-5 sm:w-6 md:h-[22px] md:w-7"
    >
      <span
        className={`${barBase} ${
          open ? "top-1/2 w-full -translate-y-1/2 rotate-45" : "top-0 w-3/4"
        }`}
      />
      <span
        className={`${barBase} top-1/2 w-full -translate-y-1/2 ${
          open ? "scale-x-0 opacity-0" : "opacity-100"
        }`}
      />
      <span
        className={`${barBase} ${
          open ? "top-1/2 w-full -translate-y-1/2 -rotate-45" : "bottom-0 w-1/2"
        }`}
      />
    </button>
  );

  return (
    <>
      {/* Spacer keeps header layout stable; the real toggle floats above the overlay. */}
      <div className="h-4 w-5 shrink-0 sm:h-5 sm:w-6 md:h-[22px] md:w-7" aria-hidden />

      {typeof document !== "undefined" &&
        createPortal(
          <div className="pointer-events-none fixed inset-x-0 top-0 z-[110] flex justify-end px-6 pt-8">
            <div className="pointer-events-auto">{toggle}</div>
          </div>,
          document.body,
        )}

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[90] animate-fade-in overflow-y-auto bg-background/40 backdrop-blur-2xl">

          <div className="flex min-h-full flex-col px-6 py-8">
            <div className="flex h-11 items-center justify-between">
              {session && (
                <div className="h-11 w-11 overflow-hidden rounded-full border border-primary/70">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-sm font-bold text-primary">
                      {profile?.username?.[0]?.toUpperCase() ?? "?"}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div
              key={panel}
              className="flex flex-1 animate-panel-in flex-col items-center justify-center py-8 text-center"
            >
              {panel === "menu" && (
                <nav className="flex w-full max-w-xs flex-col gap-1.5">
                  <button
                    onClick={() => setOpen(false)}
                    className={`${itemClass} text-primary`}
                  >
                    <EditableText contentKey="menu.home" defaultValue="HOME" />
                  </button>

                  {session ? (
                    <button onClick={() => setPanel("account")} className={itemClass}>
                      @{profile?.username ?? "account"}
                    </button>
                  ) : (
                    <button onClick={() => setPanel("auth")} className={itemClass}>
                      <EditableText contentKey="menu.login" defaultValue="LOGIN / SIGN UP" />
                    </button>
                  )}

                  {isAdmin && (
                    <>
                      <div className={`${itemClass} text-primary/90`}>ADMIN</div>
                      <button
                        onClick={() => {
                          setEditMode(!editMode);
                          toast(editMode ? "Edit mode off" : "Edit mode on");
                          setOpen(false);
                        }}
                        className="mx-auto mt-2 rounded-full border-2 border-primary bg-primary/15 px-6 py-3 text-sm font-bold uppercase"
                      >
                        {editMode ? "Exit edit mode" : "Enter edit mode"}
                      </button>
                    </>
                  )}
                </nav>
              )}

              {panel === "auth" && <AuthPanel onDone={() => setPanel("menu")} />}
              {panel === "account" && <AccountPanel />}

              {panel !== "menu" && (
                <button
                  onClick={() => setPanel("menu")}
                  className="mt-8 text-sm uppercase tracking-wide text-muted-foreground"
                >
                  Back to menu
                </button>
              )}
            </div>
          </div>
        </div>,
          document.body,
        )}
    </>
  );
}

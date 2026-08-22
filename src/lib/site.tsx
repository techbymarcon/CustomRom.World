import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { Session } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { supabase } from "@/integrations/supabase/client";
import { getSiteContent, saveSiteContent, type SiteContentRow } from "./content.functions";

type Profile = { id: string; username: string; avatar_url: string | null };

type SavePatch = {
  text_value?: string | null;
  color?: string | null;
  image_url?: string | null;
  width?: number | null;
};

type SiteContextValue = {
  session: Session | null;
  profile: Profile | null;
  avatarUrl: string | null;
  isAdmin: boolean;
  editMode: boolean;
  setEditMode: (value: boolean) => void;
  content: Record<string, SiteContentRow>;
  save: (key: string, patch: SavePatch) => Promise<void>;
  refreshProfile: () => void;
  signOut: () => Promise<void>;
};

const SiteContext = createContext<SiteContextValue | null>(null);

export function SiteProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [profileNonce, setProfileNonce] = useState(0);
  const queryClient = useQueryClient();
  const saveFn = useServerFn(saveSiteContent);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    return () => sub.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setAvatarUrl(null);
      setIsAdmin(false);
      setEditMode(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const [{ data: profileRow }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, username, avatar_url").eq("id", userId).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", userId),
      ]);
      if (cancelled) return;
      setProfile((profileRow as Profile | null) ?? null);
      setIsAdmin((roles ?? []).some((row) => row.role === "admin"));
      const path = (profileRow as Profile | null)?.avatar_url ?? null;
      if (path) {
        const signed = await supabase.storage.from("avatars").createSignedUrl(path, 3600);
        if (!cancelled) setAvatarUrl(signed.data?.signedUrl ?? null);
      } else {
        setAvatarUrl(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, profileNonce]);

  const contentQuery = useQuery({
    queryKey: ["site-content"],
    queryFn: () => getSiteContent(),
    staleTime: 30_000,
  });

  const content = useMemo(() => {
    const map: Record<string, SiteContentRow> = {};
    for (const row of contentQuery.data?.rows ?? []) map[row.key] = row;
    return map;
  }, [contentQuery.data]);

  const save = useCallback(
    async (key: string, patch: SavePatch) => {
      await saveFn({ data: { key, ...patch } });
      await queryClient.invalidateQueries({ queryKey: ["site-content"] });
    },
    [saveFn, queryClient],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setEditMode(false);
  }, []);

  const value: SiteContextValue = {
    session,
    profile,
    avatarUrl,
    isAdmin,
    editMode: isAdmin && editMode,
    setEditMode,
    content,
    save,
    refreshProfile: () => setProfileNonce((n) => n + 1),
    signOut,
  };

  return <SiteContext.Provider value={value}>{children}</SiteContext.Provider>;
}

export function useSite() {
  const ctx = useContext(SiteContext);
  if (!ctx) throw new Error("useSite must be used inside SiteProvider");
  return ctx;
}

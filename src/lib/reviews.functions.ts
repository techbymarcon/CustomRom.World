import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getRomRating = createServerFn({ method: "GET" })
  .inputValidator((input: { rom_id: string }) => input)
  .handler(async ({ data }) => {
    const { getPublicClient } = await import("./public-client.server");
    const { data: rows } = await getPublicClient()
      .from("rom_reviews")
      .select("rating")
      .eq("rom_id", data.rom_id);
    const ratings = (rows ?? []).map((row) => row.rating as number);
    const count = ratings.length;
    const average = count ? ratings.reduce((a, b) => a + b, 0) / count : 0;
    return { average, count };
  });

export const getMyRomRating = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { rom_id: string }) => input)
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("rom_reviews")
      .select("rating")
      .eq("rom_id", data.rom_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    return { rating: (row?.rating as number | undefined) ?? null };
  });

export const rateRom = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { rom_id: string; rating: number }) => {
    const rating = Math.round(input.rating);
    if (rating < 1 || rating > 5) throw new Error("Rating must be between 1 and 5");
    return { rom_id: input.rom_id, rating };
  })
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("rom_reviews")
      .upsert(
        { rom_id: data.rom_id, user_id: context.userId, rating: data.rating },
        { onConflict: "rom_id,user_id" },
      );
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

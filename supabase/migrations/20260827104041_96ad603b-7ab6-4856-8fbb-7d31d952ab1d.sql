CREATE TABLE public.rom_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rom_id uuid NOT NULL REFERENCES public.roms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rom_id, user_id)
);

GRANT SELECT ON public.rom_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rom_reviews TO authenticated;
GRANT ALL ON public.rom_reviews TO service_role;

ALTER TABLE public.rom_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ratings are viewable by everyone" ON public.rom_reviews FOR SELECT USING (true);
CREATE POLICY "Users can insert their own rating" ON public.rom_reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own rating" ON public.rom_reviews FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own rating" ON public.rom_reviews FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER rom_reviews_touch BEFORE UPDATE ON public.rom_reviews FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX rom_reviews_rom_id_idx ON public.rom_reviews (rom_id);
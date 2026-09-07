CREATE TABLE public.rom_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rom_id uuid NOT NULL REFERENCES public.roms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rom_comments TO authenticated;
GRANT SELECT ON public.rom_comments TO anon;
GRANT ALL ON public.rom_comments TO service_role;

ALTER TABLE public.rom_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comments are viewable by everyone" ON public.rom_comments
  FOR SELECT USING (true);

CREATE POLICY "Users can insert their own comment" ON public.rom_comments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comment" ON public.rom_comments
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comment" ON public.rom_comments
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any comment" ON public.rom_comments
  FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX rom_comments_rom_id_created_at_idx ON public.rom_comments (rom_id, created_at DESC);
CREATE INDEX rom_comments_created_at_idx ON public.rom_comments (created_at DESC);

CREATE TRIGGER rom_comments_touch BEFORE UPDATE ON public.rom_comments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
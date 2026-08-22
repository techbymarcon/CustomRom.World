CREATE TABLE public.roms (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand text NOT NULL,
  device_slug text NOT NULL,
  device_name text NOT NULL,
  slug text NOT NULL,
  rom_name text NOT NULL,
  android_version text NOT NULL,
  download_url text NOT NULL,
  made_by text NOT NULL,
  found_on text NOT NULL,
  installation_guide text,
  additional_info text,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (brand, device_slug, slug)
);

GRANT SELECT ON public.roms TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roms TO authenticated;
GRANT ALL ON public.roms TO service_role;

ALTER TABLE public.roms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Rom pages are viewable by everyone" ON public.roms FOR SELECT USING (true);
CREATE POLICY "Admins can insert rom pages" ON public.roms FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update rom pages" ON public.roms FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete rom pages" ON public.roms FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER roms_touch BEFORE UPDATE ON public.roms FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX roms_device_idx ON public.roms (brand, device_slug);
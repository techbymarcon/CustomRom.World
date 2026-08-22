ALTER TABLE public.roms
  ADD COLUMN IF NOT EXISTS codename text,
  ADD COLUMN IF NOT EXISTS rom_version text,
  ADD COLUMN IF NOT EXISTS rom_type text,
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS official_status text;

ALTER TABLE public.roms
  ALTER COLUMN download_url DROP NOT NULL;

ALTER TABLE public.roms
  ADD CONSTRAINT roms_rom_type_check CHECK (rom_type IS NULL OR rom_type IN ('aosp', 'skin-port'));

ALTER TABLE public.roms
  ADD CONSTRAINT roms_official_status_check CHECK (official_status IS NULL OR official_status IN ('official', 'unofficial'));

CREATE UNIQUE INDEX IF NOT EXISTS roms_identity_uidx
  ON public.roms (brand, device_slug, rom_name, coalesce(rom_version, ''), android_version);
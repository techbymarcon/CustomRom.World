ALTER TABLE public.rom_comments
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.rom_comments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS rom_comments_parent_idx ON public.rom_comments(parent_id);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  body text,
  link_path text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER notifications_touch BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS notifications_user_idx ON public.notifications(user_id, read, created_at DESC);

CREATE OR REPLACE FUNCTION public.notify_comment_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  parent_author uuid;
  r RECORD;
  author_name text;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT user_id INTO parent_author FROM public.rom_comments WHERE id = NEW.parent_id;
  IF parent_author IS NULL OR parent_author = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT brand, device_slug, slug, rom_name INTO r FROM public.roms WHERE id = NEW.rom_id;
  SELECT username INTO author_name FROM public.profiles WHERE id = NEW.user_id;

  INSERT INTO public.notifications (user_id, kind, title, body, link_path)
  VALUES (
    parent_author,
    'reply',
    COALESCE(author_name, 'someone') || ' replied to your comment',
    left(NEW.body, 180),
    CASE WHEN r.brand IS NULL THEN NULL
         ELSE '/devices/' || r.brand || '/' || r.device_slug || '/' || r.slug END
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rom_comments_notify_reply ON public.rom_comments;
CREATE TRIGGER rom_comments_notify_reply AFTER INSERT ON public.rom_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_comment_reply();

CREATE OR REPLACE FUNCTION public.notify_new_rom()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  author_name text;
BEGIN
  SELECT username INTO author_name FROM public.profiles WHERE id = NEW.created_by;

  INSERT INTO public.notifications (user_id, kind, title, body, link_path)
  SELECT p.id,
         'rom',
         'New ROM page: ' || NEW.rom_name || ' for ' || NEW.device_name,
         'Published by ' || COALESCE(author_name, 'the team'),
         '/devices/' || NEW.brand || '/' || NEW.device_slug || '/' || NEW.slug
  FROM public.profiles p
  WHERE NEW.created_by IS NULL OR p.id <> NEW.created_by;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS roms_notify_new ON public.roms;
CREATE TRIGGER roms_notify_new AFTER INSERT ON public.roms
  FOR EACH ROW EXECUTE FUNCTION public.notify_new_rom();
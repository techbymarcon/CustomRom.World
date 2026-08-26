CREATE TABLE public.articles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scope text NOT NULL CHECK (scope IN ('device','page')),
  brand text,
  device_slug text,
  page_key text,
  title text NOT NULL,
  cover_image_url text,
  body_html text NOT NULL DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX articles_page_key_unique ON public.articles (page_key) WHERE page_key IS NOT NULL;
CREATE INDEX articles_device_idx ON public.articles (brand, device_slug);

GRANT SELECT ON public.articles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.articles TO authenticated;
GRANT ALL ON public.articles TO service_role;

ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Articles are publicly readable" ON public.articles FOR SELECT USING (true);
CREATE POLICY "Admins can insert articles" ON public.articles FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can update articles" ON public.articles FOR UPDATE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role)) WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins can delete articles" ON public.articles FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins manage article images" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'article-images' AND private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (bucket_id = 'article-images' AND private.has_role(auth.uid(), 'admin'::public.app_role));
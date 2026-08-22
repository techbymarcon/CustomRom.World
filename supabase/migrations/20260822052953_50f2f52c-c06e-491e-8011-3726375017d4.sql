CREATE POLICY "Users manage own avatar files" ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Admins manage site images" ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'site-images' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'site-images' AND public.has_role(auth.uid(), 'admin'));
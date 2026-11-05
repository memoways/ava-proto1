CREATE POLICY "Admins read tavus training videos" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'tavus-training-videos' AND private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins upload tavus training videos" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'tavus-training-videos' AND private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update tavus training videos" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'tavus-training-videos' AND private.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'tavus-training-videos' AND private.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete tavus training videos" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'tavus-training-videos' AND private.has_role(auth.uid(), 'admin'));
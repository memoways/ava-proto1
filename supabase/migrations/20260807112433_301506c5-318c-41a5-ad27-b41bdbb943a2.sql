CREATE POLICY "Admins read character portraits"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'character-portraits' AND private.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins upload character portraits"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'character-portraits' AND private.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update character portraits"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'character-portraits' AND private.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'character-portraits' AND private.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete character portraits"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'character-portraits' AND private.has_role(auth.uid(), 'admin'));
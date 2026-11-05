-- Tavus lot 2: private bucket for Face training videos, admin-only (same model as
-- character-portraits). The Edge Function streaming-avatar-session signs a 48 h link with the
-- service role; the browser never reads these objects through a public URL.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tavus-training-videos',
  'tavus-training-videos',
  false,
  786432000, -- 750 MB, the Tavus limit
  ARRAY['video/mp4', 'video/webm']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "Admins read tavus training videos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'tavus-training-videos' AND private.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins upload tavus training videos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'tavus-training-videos' AND private.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update tavus training videos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'tavus-training-videos' AND private.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'tavus-training-videos' AND private.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete tavus training videos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'tavus-training-videos' AND private.has_role(auth.uid(), 'admin'));

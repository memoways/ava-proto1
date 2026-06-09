DELETE FROM public.embeddings WHERE character_id IN (SELECT id FROM public.characters WHERE name = 'Identité & Présentation');
DELETE FROM public.characters WHERE name = 'Identité & Présentation';
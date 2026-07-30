update public.admin_settings
set value = jsonb_set(value::jsonb, '{heygen,sandbox}', 'false'::jsonb, true),
    updated_at = now()
where key = 'ava_streaming_avatar_settings';
-- Admin console: show an invitation's password again (lost access).
-- Encrypted copy of the code (AES-GCM, key derived server-side in the
-- manage-test-invitations Edge Function); redeeming still checks code_hash only.
-- Invitations created before this column cannot be shown: the console offers a new code.
ALTER TABLE public.external_test_invitations
  ADD COLUMN IF NOT EXISTS code_ciphertext text;

COMMENT ON COLUMN public.external_test_invitations.code_ciphertext IS
  'v1:<iv>:<ciphertext> AES-GCM copy of the invitation code, readable only by the manage-test-invitations Edge Function (service role).';

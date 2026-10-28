import { expect, test } from '@playwright/test';

// Isolated authenticated admin and settings. No remote writes or provider audio.
test('AP1 : atelier admin, état explicite, brouillon A/B et écran étroit sans audio automatique', async ({ page }) => {
 const user = { id: '33333333-3333-4333-8333-333333333333', email: 'workshop@example.test', aud: 'authenticated', role: 'authenticated', is_anonymous: false, app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, identities: [], created_at: '2026-01-01T00:00:00Z' };
 const session = { access_token: 'ap1-simulated-token', refresh_token: 'ap1-simulated-refresh', expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user };
 await page.addInitScript(value => localStorage.setItem('sb-iralfqlslqndgvexixis-auth-token', JSON.stringify(value)), session);
 const states = [{ name: 'Retenu', description: 'Retient les mots, sans tic systématique.' }, { name: 'Éclair', description: 'Précis puis silencieux.' }];
 const values: Record<string, unknown> = {
  ava_speech_performance: { enabled: true, version: 'fixture-v1', gradiumTagsEnabled: false, byCharacter: { max: { Retenu: { emotion: 'fragile', delivery: 'measured', speed: 0.9, pauses: 'long', instruction: '' } } } },
  ava_tts_settings_gradium: { streamingEnabled: false, settingsVersion: 2, outputFormat: 'wav', byCharacter: { max: { paddingBonus: 0.2 } } },
  ava_llm_settings: { LLM_MODEL: 'fixture-model' }, ava_gameplay_settings: { MAX_PROMPT_VARIANT: 'optimized_v3' },
 };
 let audioCalls = 0;
 const writes: string[] = [];
 const errors: string[] = [];
 page.on('pageerror', error => errors.push(error.message));
 await page.route('https://**.supabase.co/**', async route => {
  const request = route.request(), url = new URL(request.url());
  let body: unknown = [];
  if (url.pathname.includes('/auth/')) body = url.pathname.endsWith('/user') ? user : session;
  else if (url.pathname.includes('/functions/')) { audioCalls++; return route.abort(); }
  else {
   if (request.method() !== 'GET') writes.push(url.pathname);
   const table = url.pathname.split('/').pop();
   if (table === 'admin_users') body = url.searchParams.has('user_id') ? { user_id: user.id, display_name: 'Workshop', default_environment_id: 'sandbox-ulrich' } : [];
   if (table === 'character_runtime_profiles') body = [{ character_key: 'max', display_name: 'Max', rugosite: 3, tts_provider: 'gradium', tts_voice_id: 'max-fixture', notion_character_id: 'max-id' }];
   if (table === 'characters') body = url.searchParams.has('name') ? { id: 'max-id', name: 'Max' } : [];
   if (table === 'character_prompts') body = [{ character_id: 'max-id', environment_id: 'sandbox-ulrich', updated_at: '2026-10-28T00:00:00Z', characters: { name: 'Max' }, speech_states: states }];
   if (table === 'experience_orchestration_versions') body = [{ version_number: 7, published_at: '2026-10-26T00:00:00Z' }];
   if (table === 'admin_settings') {
    const key = url.searchParams.get('key')?.replace('eq.', '');
    body = key === 'ava_speech_performance' ? { value: values[key] } : Object.entries(values).filter(([k]) => !key || key.startsWith('in.') || k === key).map(([k, value]) => ({ key: k, environment_id: 'sandbox-ulrich', value }));
   }
  }
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
 });
 await page.route('https://eu.i.posthog.com/**', route => route.fulfill({ body: '{}' }));
 await page.route('https://gamilab.ch/**', route => route.fulfill({ body: '' }));
 await page.goto('/admin/experience/atelier-de-parole');
 await expect(page.getByRole('heading', { name: 'Atelier de parole — Max' })).toBeVisible();
 await expect(page.getByText('Compilateur : optimized_v3', { exact: false })).toBeVisible();
 await expect(page.getByLabel('Transport audition')).toHaveValue('rest');
 await expect(page.getByLabel('Diff A/B')).toContainText('A = 0.2 → B = 0');
 const listen = page.getByRole('button', { name: 'Écouter / rejouer' });
 await expect(listen).toBeDisabled();
 await page.getByLabel('État de la réplique').selectOption('Retenu');
 await expect(listen).toBeEnabled();
 await page.getByLabel('Variante à écouter').selectOption('B');
 await page.getByLabel('Valeur B').fill('-0.2');
 await page.getByLabel('Valeur B').press('Tab');
 await expect(page.getByLabel('Diff A/B')).toContainText('B = -0.2');
 await page.getByLabel('Réplique du banc').selectOption('1');
 await expect(listen).toBeDisabled();
 await expect(page.getByRole('button', { name: /Sauvegarder/ })).toHaveCount(0);
 await page.setViewportSize({ width: 390, height: 844 });
 await expect(page.getByLabel('Variante à écouter')).toBeVisible();
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
 expect(audioCalls).toBe(0); expect(writes).toEqual([]); expect(errors).toEqual([]);
});

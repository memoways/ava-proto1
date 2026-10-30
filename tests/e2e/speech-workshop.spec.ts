import { expect, test } from '@playwright/test';

// Isolated authenticated admin and settings. No remote writes or provider audio.
test('AP4 : atelier par intention, puis banc AP2 replié et comparaisons retrouvables sans audio automatique', async ({ page }) => {
 // This contract tests the workshop, not the CI machine's sound device/autoplay policy.
 // Keep real provider requests intercepted below and model both playout and denial.
 await page.addInitScript(() => {
  const fixture = { plays: 0, denyNext: false, failNext: false };
  Object.assign(window, { __workshopAudio: fixture });
  class WorkshopAudio {
   onended: (() => void) | null = null;
   onplaying: (() => void) | null = null;
   ontimeupdate: (() => void) | null = null;
   onerror: (() => void) | null = null;
   private timer?: ReturnType<typeof setTimeout>;
   pause() { clearTimeout(this.timer); }
   async play() {
    fixture.plays++;
    if (fixture.failNext) { fixture.failNext = false; this.onerror?.(); return; }
    if (fixture.denyNext) { fixture.denyNext = false; throw new DOMException('Lecture refusée par le navigateur simulé', 'NotAllowedError'); }
    this.onplaying?.();
    this.timer = setTimeout(() => this.onended?.(), 10);
   }
  }
  Object.defineProperty(window, 'Audio', { configurable: true, value: WorkshopAudio });
 });
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
 let workshopValue: unknown = null;
 const requests: Array<Record<string, unknown>> = [];
 const wav = Buffer.alloc(4844); wav.write('RIFF'); wav.writeUInt32LE(4836, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(24000, 24); wav.writeUInt32LE(48000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(4800, 40);
 const writes: string[] = [];
 const errors: string[] = [];
 page.on('pageerror', error => errors.push(error.message));
 await page.route('https://**.supabase.co/**', async route => {
  const request = route.request(), url = new URL(request.url());
  let body: unknown = [];
  if (url.pathname.includes('/auth/')) body = url.pathname.endsWith('/user') ? user : session;
  else if (url.pathname.includes('/functions/')) { audioCalls++; requests.push(request.postDataJSON()); return route.fulfill({ status: 200, contentType: 'audio/wav', body: wav }); }
  else {
   if (request.method() !== 'GET') writes.push(url.pathname);
   const table = url.pathname.split('/').pop();
   if (table === 'admin_users') body = url.searchParams.has('user_id') ? { user_id: user.id, display_name: 'Workshop', default_environment_id: 'sandbox-ulrich' } : [];
   if (table === 'character_runtime_profiles') body = [{ character_key: 'max', display_name: 'Max', rugosite: 3, tts_provider: 'gradium', tts_voice_id: 'max-fixture', notion_character_id: 'max-id' }];
   if (table === 'characters') body = url.searchParams.has('name') ? { id: 'max-id', name: 'Max' } : [];
   if (table === 'character_prompts') body = [{ character_id: 'max-id', environment_id: 'sandbox-ulrich', updated_at: '2026-10-28T00:00:00Z', characters: { name: 'Max' }, speech_states: states }];
   if (table === 'experience_orchestration_versions') body = [{ version_number: 7, published_at: '2026-10-26T00:00:00Z' }];
   if (table === 'admin_settings') {
    const key = url.searchParams.get('key')?.replace('eq.', '') ?? (request.method() === 'POST' ? request.postDataJSON().key : undefined);
    if (key === 'speech_workshop_documents') {
     if (request.method() === 'GET') body = workshopValue ? { value: workshopValue } : null;
     else { workshopValue = request.postDataJSON().value; body = [{ key }]; }
    } else body = key === 'ava_speech_performance' ? { value: values[key] } : Object.entries(values).filter(([k]) => !key || key.startsWith('in.') || k === key).map(([k, value]) => ({ key: k, environment_id: 'sandbox-ulrich', value }));
   }
  }
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
 });
 await page.route('https://eu.i.posthog.com/**', route => route.fulfill({ body: '{}' }));
 await page.route('https://gamilab.ch/**', route => route.fulfill({ body: '' }));
 const advanced = async () => {
  await page.getByText('Options avancées — réglages bruts et A/B (AP2), Emma, transports, mapping du jeu et preuves', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Comparaison A/B des réglages — Max' })).toBeVisible();
 };
 await page.goto('/admin/experience/atelier-de-parole');
 await expect(page.getByRole('heading', { name: 'Atelier de parole — Max' })).toBeVisible();
 await expect(page.getByLabel('Étape courante')).toContainText('Étape 1 sur 4 — Texte à jouer');
 await expect(page.locator('details[open]')).toHaveCount(0);
 await expect(page.getByRole('heading', { name: 'Comparaison A/B des réglages — Max' })).toHaveCount(0);
 await advanced();
 const first = page.getByRole('button', { name: 'Continuer vers la version actuelle' });
 await expect(first).toBeDisabled();
 await expect(page.getByLabel('Étape A/B')).toContainText('Étape 1');
 await page.getByLabel('État de la réplique').selectOption('Retenu');
 await expect(first).toBeEnabled();
 await first.focus(); await page.keyboard.press('Enter');
 await expect(page.getByRole('button', { name: 'Écouter la version actuelle' })).toBeVisible();
 await page.getByRole('button', { name: 'Revenir au choix de la réplique' }).click();
 await page.getByText('Options avancées — Emma, fournisseurs et autres répliques', { exact: true }).click();
 await page.getByText('Enregistrer un brouillon sans écoute', { exact: true }).click();
 await page.getByLabel('Nom du brouillon', { exact: true }).fill('AP2 comparaison simulée');
 await page.getByRole('button', { name: 'Enregistrer ce brouillon sans écoute' }).click();
 await expect(page.getByRole('status')).toContainText('enregistrée et relue');
 expect(writes).toEqual(['/rest/v1/admin_settings']);
 expect(JSON.stringify(workshopValue)).not.toContain('ap1-simulated-token');
 await page.reload(); await advanced();
 await expect(page.getByText(/AP2 comparaison simulée · max/)).toBeVisible();
 await page.getByText(/AP2 comparaison simulée · max/).click();
 await expect(page.getByText('Brouillon sans preuve d’écoute')).toBeVisible();
 await page.getByRole('button', { name: 'Charger comme brouillon' }).click();
 await expect(page.getByRole('status')).toContainText('Brouillon chargé sans audio');
 await expect(page.getByLabel('État de la réplique')).toHaveValue('Retenu');
 await page.setViewportSize({ width: 390, height: 844 });
 await expect(first).toBeVisible();
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
 await page.getByText('Options avancées — Emma, fournisseurs et autres répliques', { exact: true }).click();
 await expect(page.getByLabel('Personnage du banc')).toBeVisible();
 await expect(page.getByLabel('Transport audition')).toHaveValue('rest');
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
 expect(audioCalls).toBe(0); expect(writes).toHaveLength(1); expect(errors).toEqual([]);
 expect(await page.evaluate(() => (window as unknown as { __workshopAudio: { plays: number } }).__workshopAudio.plays)).toBe(0);
 await first.click();
 await page.getByRole('button', { name: 'Écouter la version actuelle' }).click();
 await expect(page.getByRole('button', { name: 'Écouter l’essai' })).toBeEnabled();
 await page.getByRole('button', { name: 'Écouter l’essai' }).click();
 await expect(page.getByLabel('Nom de la comparaison')).toBeVisible();
 await page.getByLabel('Pauses / rythme', { exact: true }).fill('Avis simulé de test');
 await page.getByRole('button', { name: 'Enregistrer la comparaison et mon avis' }).click();
 await expect(page.getByRole('status')).toContainText('enregistrée et relue');
 expect(audioCalls).toBe(2);
 expect(await page.evaluate(() => (window as unknown as { __workshopAudio: { plays: number } }).__workshopAudio.plays)).toBe(2);
 expect(requests[0].text).toBe(requests[1].text); expect(requests[0].voiceId).toBe(requests[1].voiceId);
 expect({ ...requests[0], jsonConfig: { ...(requests[0].jsonConfig as object), padding_bonus: (requests[1].jsonConfig as Record<string, unknown>).padding_bonus } }).toEqual(requests[1]);
 await page.reload(); await advanced();
 await page.getByText(/AP2 comparaison simulée · max/).click();
 await expect(page.getByText('Pauses / rythme : Avis simulé de test', { exact: true })).toBeVisible();
 await page.getByRole('button', { name: 'Charger comme brouillon' }).click();
 await first.click();
 for (const failure of ['device', 'permission']) {
  await page.evaluate(mode => {
   const fixture = (window as unknown as { __workshopAudio: { denyNext: boolean; failNext: boolean } }).__workshopAudio;
   fixture.denyNext = mode === 'permission'; fixture.failNext = mode === 'device';
  }, failure);
  await page.getByRole('button', { name: 'Écouter la version actuelle' }).click();
  await expect(page.getByRole('alert')).toContainText(failure === 'device' ? 'Audio playback failed' : 'Lecture refusée');
  await expect(page.getByLabel('Étape A/B')).toContainText('Étape 2');
  await expect(page.getByRole('button', { name: 'Écouter l’essai' })).toHaveCount(0);
 }
 expect(audioCalls).toBe(4);

 // AP4: one text, one intent, cards side by side, human ratings saved and reread.
 await page.setViewportSize({ width: 1280, height: 900 });
 await page.reload();
 const toEmotion = page.getByRole('button', { name: 'Continuer vers l’émotion' });
 await expect(toEmotion).toBeEnabled();
 await expect(page.getByLabel('Texte à jouer')).toHaveValue(/^Emma est dans la cuisine depuis ce matin/);
 await toEmotion.focus(); await page.keyboard.press('Enter');
 await expect(page.getByLabel('Étape courante')).toContainText('Étape 2 sur 4');
 await page.getByRole('radio', { name: /Peur — La peur accélère/ }).check();
 await page.getByRole('button', { name: 'Continuer vers les fournisseurs' }).click();
 await expect(page.getByRole('checkbox', { name: 'Comparer Fish Audio' })).toBeDisabled();
 for (const name of ['ElevenLabs', 'Cartesia']) await page.getByRole('checkbox', { name: `Comparer ${name}` }).uncheck();
 await expect(page.getByRole('checkbox', { name: 'Comparer Inworld' })).toBeChecked();
 await page.getByRole('button', { name: 'Afficher les cartes côte à côte' }).click();
 await expect(page.getByRole('article')).toHaveCount(2);
 const gradiumCard = page.getByRole('article', { name: 'Carte Gradium' }), inworldCard = page.getByRole('article', { name: 'Carte Inworld' });
 const [gBox, iBox] = [await gradiumCard.boundingBox(), await inworldCard.boundingBox()];
 expect(Math.abs((gBox?.y ?? 0) - (iBox?.y ?? 1))).toBeLessThan(2);
 const before = audioCalls;
 await page.getByRole('button', { name: 'Générer et écouter Gradium' }).click();
 await expect(page.getByRole('button', { name: 'Réécouter Gradium (sans nouvel appel)' })).toBeVisible();
 await page.getByRole('button', { name: 'Réécouter Gradium (sans nouvel appel)' }).click();
 await page.getByRole('button', { name: 'Générer et écouter Inworld' }).click();
 await expect(page.getByRole('button', { name: 'Réécouter Inworld (sans nouvel appel)' })).toBeVisible();
 expect(audioCalls - before).toBe(2);
 expect(requests.at(-2)?.text).toBe(requests.at(-1)?.text);
 await page.getByRole('radio', { name: 'Note 2 Gradium' }).check();
 const saveTrial = page.getByRole('button', { name: 'Enregistrer l’essai et mes notes' });
 await expect(saveTrial).toBeDisabled();
 await page.getByLabel('Ce qui est off Gradium').fill('Avis simulé : la peur ne s’entend pas');
 await page.getByRole('radio', { name: 'Note 5 Inworld' }).check();
 await expect(page.getByLabel('Ce qui est off Inworld')).toHaveCount(0);
 await saveTrial.click();
 await expect(page.getByRole('status')).toContainText('Essai enregistré et relu');
 expect(writes).toHaveLength(3);
 await page.setViewportSize({ width: 390, height: 844 });
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
 const [gNarrow, iNarrow] = [await gradiumCard.boundingBox(), await inworldCard.boundingBox()];
 expect((iNarrow?.y ?? 0)).toBeGreaterThan((gNarrow?.y ?? 0) + (gNarrow?.height ?? 0) - 1);
 await page.reload();
 const results = page.getByRole('region', { name: 'Résultats par intention' });
 await expect(results.getByRole('row', { name: /Peur/ })).toContainText('2 (1)');
 await expect(results.getByRole('row', { name: /Peur/ })).toContainText('5 (1)');
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
 expect(audioCalls).toBe(6); expect(errors).toEqual([]);
 await page.goto('/admin/technique/configuration-tts');
 await expect(page.getByRole('link', { name: /Ouvrir l’atelier de parole/ })).toBeVisible();
 await expect(page.getByRole('button', { name: /Écouter|Tester/ })).toHaveCount(0);
 await expect(page.getByText('A3 — Réglages fidèles et auditions')).toHaveCount(0);
 expect(audioCalls).toBe(6);
});

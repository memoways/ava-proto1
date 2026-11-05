# Prompt de reprise — Anam, lot AN1 (fondations : modèle, métriques, réseau, voix)

Tu travailles sur Ava (`~/CodeProjects/memoways/ava-proto1`, checkout canonique, remote
`https://github.com/memoways/ava-proto1`). Réponds en français.

## 1. Démarrage

1. Lis `CLAUDE.md`, `AGENTS.md`, `docs/etat_courant.md`, `git status`, les six derniers commits
   de main et le début du CHANGELOG. Applique le contrat de livraison d'AGENTS : **aller au bout
   sans rien demander** (commit, push, PR, CI, mise à jour sur main, fusion squash par la garde,
   nettoyage, Lovable synchronisé).
2. Vérifie qu'aucun autre agent n'est actif, note les branches et PR ouvertes (PR historique #24
   à préserver ; aucune PR ouverte ne doit toucher `src/services/streamingAvatar/`,
   `StreamingAvatar*.tsx` ni `supabase/functions/_shared/streamingAvatarRequest.ts`, sinon
   demander à Ulrich). Actualise main propre (`git pull --ff-only`), puis crée
   `feat/anam-an1-foundations`.
3. Lis dans `docs/plan_avatar_streaming_multi_fournisseurs.md` la section « Anam » (3) et
   « Suite Anam — expressivité, émotion évolutive et synchro » en entier.
4. Aucune décision d'Ulrich n'est requise avant de coder.

## 2. État vérifié au 5 novembre 2026

- `providers/anam.ts` (SDK `@anam-ai/js-sdk` 4.29.1) : mode texte (`CUSTOMER_CLIENT_V1`), micro
  jamais ouvert, une talk stream par réplique, balise fixe par le canal de données
  (`sendDirectorNoteCue(cue, { atSeconds: 0 })`), tampon de lecture 400 ms
  (`jitterBufferTarget`), accueil retenu jusqu'à un flux WebRTC stable (`waitForSteadyStream`,
  diagnostic `warm_up`). `createClient` est appelé avec `metrics: { disableClientMetrics: true }`.
- Module partagé `supabase/functions/_shared/streamingAvatarRequest.ts` :
  `normalizeAnamSettings` (défaut `avatarModel: "cara-4-latest"`, `videoQuality: "high"`,
  région `auto`), `buildAnamSessionTokenRequest`.
- Ouvert depuis #149 : l'image a 1 à 2 s d'avance sur le son pendant la première réplique.
- Documentation Anam lue le 5 novembre : `cara-4.1-express` est le modèle recommandé ;
  `cara-4-latest` « peut changer d'une session à l'autre », déconseillé en production. Réseau :
  UDP 3478 direct vers les relais Anam, repli TURN Cloudflare (TLS/TCP 443, UDP/TCP 3478).
  Page Sessions de Lab (`lab.anam.ai/sessions`) : performance par session.

## 3. Périmètre AN1

- **Modèle.** Défaut `cara-4.1-express` dans `normalizeAnamSettings` (client et Edge). Une valeur
  déjà enregistrée n'est pas réécrite. Dans la carte Anam de l'admin, l'option `cara-4-latest`
  dit « instable, déconseillé en production » ; Cara 4.1 Express est marqué recommandé.
- **Métriques client.** Retirer `disableClientMetrics: true` pour qu'Anam et Lab reçoivent nos
  mesures réseau. Vérifie d'abord dans les types du SDK 4.29.1 (`npm ci` puis
  `node_modules/@anam-ai/js-sdk`) ce que l'option envoie ; la rétention (enregistrement,
  transcriptions) reste désactivée.
- **Diagnostic réseau.** Au `warm_up`, lire la paire de candidats ICE retenue (`getStats`,
  `candidate-pair` nommée par `transport.selectedCandidatePairId`) : type local et distant
  (`host` / `srflx` / `relay`), protocole (`udp` / `tcp`, `relayProtocol` si relais), RTT
  courant, débit entrant estimé si disponible, région demandée. **Jamais d'adresse IP ni de
  port.** Lecture défensive comme `waitForSteadyStream` : rien si la connexion est privée.
  Ces champs rejoignent le diagnostic `warm_up` déjà affiché dans l'admin.
- **Voix.** Aides de l'admin : voix expressives recommandées par Anam (Cartesia Sonic 3.6 :
  choisir une voix Sonic 3.6 par son `voiceId` ; ElevenLabs `eleven_v3_conversational`, stabilité
  seule, ou `eleven_v4` / `eleven_v4_turbo`, stabilité et similarité) ; changement du 3 novembre
  (voix ElevenLabs standard en v3 conversational passées en `eleven_v4_turbo`). Vérifie que les
  champs envoyés par moteur correspondent à `https://anam.ai/docs/personas/voices/configuration.md`.
  Aucun changement de voix par défaut.
- **Tests.** Corps de jeton (défaut 4.1 Express, ancienne valeur conservée), `createClient` sans
  `disableClientMetrics`, diagnostic réseau (relais, direct, connexion absente, aucun champ IP),
  aides admin si testées ailleurs. Anam, HeyGen, Tavus et LemonSlice intacts.
- **Docs.** Plan (section « Exécution AN1 »), CHANGELOG, état courant ; **actualiser
  `docs/prompt_reprise_anam_lot_an2.md`** avec ce que AN1 a appris, avant le push.

## 4. Invariants

- Ava garde micro, STT, LLM ; Anam n'ouvre jamais le micro. Repli TTS local inchangé.
- Aucune adresse IP, URL de relais, jeton ou texte prononcé dans les diagnostics ni les journaux.
- Edge Function : si le module partagé change, son redéploiement passe uniquement par Lovable
  (projet Ava `1265958d-b74e-40f2-917d-182fe05163fc`) ; aucun Supabase direct, aucune publication
  production sans autorisation. Base Caractères Notion en lecture seule.

## 5. Validation et livraison — jusqu'au bout

- `npm run test:quality` et `npm run test:delivery` verts ; tout commité avant le premier push
  (code, tests, plan, CHANGELOG, état courant, prompt AN2 actualisé).
- PR, CI sur le HEAD exact contenant main, job `regression-gates` vert, puis fusion squash
  uniquement par
  `~/CodeProjects/_shared/scripts/github-delivery-exec node .github/scripts/ship-pr.mjs --pr N --head SHA --merge`
  (lancée en arrière-plan). Vérifier arbre et parent sur main, supprimer notre branche, main
  local à jour.
- **Lovable** : vérifier que le projet Ava a repris le commit de main ; Edge Function
  `streaming-avatar-session` redéployée par Lovable si le module partagé a changé. Publication
  du site : une seule action d'Ulrich, distincte, s'il veut tester en ligne.
- Recette humaine d'Ulrich, une action à la fois : choisir Cara 4.1 Express pour Max dans
  l'admin si sa valeur enregistrée est autre ; une session Anam ; lire `warm_up` (chemin réseau)
  et la page Sessions de Lab ; comparer région `auto` puis `eu`, puis un partage de connexion
  mobile ; vérifier dans Lab que le portrait de Max a une expression neutre.
- Clôture : compte rendu avec SHA de main, CI PR/HEAD, arbre vérifié, lien direct vers
  [le prompt AN2](prompt_reprise_anam_lot_an2.md). Cette obligation (aller au bout et préparer le
  prompt suivant) est reprise dans le prompt AN2.

## 6. Première action exécutable

`git status && git fetch --prune origin && git log --oneline -6 origin/main`, puis
`~/CodeProjects/_shared/scripts/github-delivery-exec gh pr list --repo memoways/ava-proto1`.

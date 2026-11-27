# Prompt de reprise — Réglages, lot 2 : vérifier dans l'aperçu, finir le tri des réglages de test

À copier dans un nouveau chat Ava. Origine : clôture du lot 1 (27 novembre 2026), après la demande d'Ulrich de séparer les réglages de test, de couper la vidéo par personnage et de compacter Réglages personnages.

## Objectif

Confirmer dans l'aperçu Lovable que le lot 1 se lit et se comporte comme voulu, puis finir le tri des réglages de test sur les pages qui n'ont pas encore été passées en revue. Ce lot seulement.

## État vérifié à la fin du lot 1

- Routage (`src/services/callOutputMode.ts`, `src/services/callVideoRouting.ts`, tests associés) : appareil en voix → voix ; global « Voix » → voix pour tous, lien ou pas (raison `settings`) ; un appareil réglé explicitement sur « avatar » garde son choix ; « Pas de vidéo » (`characterLinks.<clé> = { provider: "none" }`) → voix (`character_no_video`) ; un fournisseur → ce fournisseur (`character_link`) ; « Suivre le réglage global » → Max suit, les autres restent en voix. `describeNextCall` rend la ligne « Prochain appel sur ordinateur ».
- Réglages personnages : blocs « Audio » et « Vidéo » repliés (`src/components/admin/SettingsFold.tsx`, `<details>`), résumé d'une ligne.
- Réglages de test repliés (`TestSettingsFold`) : Orchestration › Conversation vocale mains libres (3 réglages), Streaming Avatar Config › Tavus (avancé) et › Anam. Note fixe à la place de « Transcription du joueur ». Routage OpenRouter rapide au premier niveau, libellé simple.
- Télémétrie : une observation LLM par appel en flux (`src/services/openRouterLLM.ts`).
- SHA de fusion et PR : voir le CHANGELOG et le compte rendu du lot 1 ; vérifier `git log origin/main` au départ.
- Non vérifié par l'agent : rendu dans l'aperçu Lovable et un appel réel (Ulrich fait ses tours de test en voix seule après le lot 1).

## Point à confirmer avec Ulrich

Un appareil réglé explicitement sur « avatar » (Technique › Services par appareil) garde la vidéo même quand le global est sur « Voix ». C'est le comportement d'avant pour Max, conservé parce que ce réglage d'appareil sert justement à passer outre le global. Si Ulrich veut que le global coupe aussi cet appareil, changer la ligne `choice !== "avatar" && configuredMode === "tts"` de `resolveCallOutputMode` et les tests « keeps a device explicitly set to the live avatar ».

## Sources à lire

- `docs/plan_avatar_video_par_personnage.md` §9.3 bis.
- `src/components/admin/SettingsFold.tsx`, `src/components/GameMasterConfigTab.tsx`, `src/components/StreamingAvatarConfigTab.tsx`, `src/components/LLMConfigTab.tsx`, `src/services/adminNavigation.ts` (liste des pages).
- Pages pas encore passées en revue : TTS Config, Services par appareil, Gameplay, RAG, Cinématiques. Chercher les libellés de chantier : `rg -n "\(mesure\)|\(prototype\)|Lot [A-Z]?[0-9]|Canary|canary" src/components`.

## Périmètre

1. Vérification dans le navigateur (aperçu Lovable, `sandbox-ulrich`) : Orchestration, Avatar vidéo, Réglages personnages se lisent ; blocs de test fermés ; avec le global sur « Voix » et Max lié à Tavus, un appel reste en voix (`voice_turn_events.output_stream.output` ≠ `tavus`). Lire `services` d'un tour en flux : une entrée `llm`, et `tts` présent.
2. Trier les autres pages : chaque réglage de mesure ou de prototype passe dans `TestSettingsFold`, avec une phrase et un état ; libellés sans numéro de lot.
3. `VOICE_ONLY_UI` : encore lu par `IndexPRD4` et `prd4Session` sans écran. Proposer à Ulrich de le figer ou de le retirer ; ne rien changer sans son accord.

Hors périmètre : logique des sorties et du flux, fiches Notion, nouveaux fournisseurs, production.

## Invariants et limites d'autorisation

- Sandbox uniquement ; production non publiée, réglages de production intacts.
- Aucune valeur enregistrée réécrite automatiquement ; ne pas toucher `sandbox-romed`, `sandbox-benoit`, `sandbox-julien`.
- Aucune migration attendue. Base Caractères Notion en lecture seule. Gami DigiDouble exclu.
- Passage de personnage, cinématiques, interruption inchangés ; un passage vers un autre personnage repasse en voix.

## Validations

- Tests d'écran des pages touchées (bloc de test fermé, libellés sans « Lot »).
- `npm run typecheck`, lint, `npm run test:quality`, `npm run test:delivery` verts. CI de la PR verte avec `regression-gates`. `PeriodCostLines.test.tsx` peut échouer localement sur « 1'500 » (locale ICU) ; la CI fait foi.

## Livraison

Branche de lot depuis main à jour, commit, push, PR, CI complète sur la PR, puis `~/CodeProjects/_shared/scripts/github-delivery-exec node .github/scripts/ship-pr.mjs --pr N --head SHA --merge`. Vérifier sur origin/main (arbre et parent), supprimer notre branche, synchroniser en local et sur Lovable. Mettre à jour `docs/etat_courant.md` et le CHANGELOG.

## Première action exécutable

Ouvrir l'aperçu Lovable sur `sandbox-ulrich`, page Réglages › Orchestration, et vérifier que « Réglages de test (temporaires) » est fermé ; puis lancer `rg` ci-dessus pour lister les réglages restants.

## Clôture obligatoire

Avant le push, s'il reste un travail identifié, écrire `docs/prompt_reprise_reglages_tests_et_video_personnage_lot_3.md` avec l'état vérifié, les sources, le périmètre, les invariants, les validations, la livraison, la première action exécutable et cette même obligation de clôture ; sinon le dire. Donner le lien direct dans le compte rendu. Ne pas lancer de lot suivant.

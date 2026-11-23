# Prompt de reprise — Tavus, tenue de l'audio quand Max s'emballe, lot 1

À copier dans un nouvel agent sur Ava. Contexte : [plan voix Ava](plan_tavus_voix_ava_audio.md),
[état courant](etat_courant.md). Point fait le 23 novembre 2026, aucun code de ce lot.

---

**Objectif.** Rendre l'audio de Max tenable quand il s'emballe, sur la voie déjà retenue :
Ava synthétise, Tavus anime le visage. Confirmer d'abord le réglage réel de la sandbox.
Ne pas introduire un modèle audio « Tavus ». Ne pas changer la source de voix par défaut.

**État vérifié (23 novembre, code, pas la base live).**

- Deux sources, Admin → Avatar streaming → Tavus, global et par personnage (`max`, `emma`).
  Défaut `voiceSource: "ava"`. « Ava (audio) » : TTS du personnage, PCM 24 kHz, morceaux de
  250 ms, `conversation.echo` en audio. Tavus n'anime que le visage et les lèvres. Les lèvres
  suivent cet audio ; il n'y a pas d'étape de synchro à ajouter.
  « Tavus (PAL) » : Ava envoie le texte, la voix est celle du PAL. Elle se règle dans la
  console Tavus. Ava l'affiche en lecture seule (bouton Vérifier). Diction française jugée
  mauvaise le 6 novembre. Un PAL figé sur ElevenLabs chez Tavus a été écarté par Ulrich :
  la voix se pilote depuis Ava, personnage par personnage.
- Moteurs déjà branchés sur la voie Ava : ElevenLabs, Gradium, Fish, Cartesia, Inworld.
  Les changer se fait dans les réglages de voix du personnage, pas dans le bloc Tavus.
- Émotions de visage (`set_emotion`, émotion en parlant / en écoutant) et balise Echo
  (`<emotion value="…"/>`) ne fabriquent pas le timbre en source Ava. La balise Echo est
  retirée avant le TTS.
- Pourquoi la voix casse quand Max s'excite, si le moteur est ElevenLabs :
  `applyElevenLabsPerformance` dans `src/services/tts/performanceIntent.ts`.
  Colère, urgence, tension, accusation montent `style`, baissent `stability`, accélèrent.
  Sur v3 / v4 (`eleven_v4_turbo` inclus), une balise est collée au texte :
  `[angry]`, `[urgent]`, `[tense]`, `[stern]`, `[worried]`.
  Le preset « Expressif » part de style 0,38 et stabilité 0,38 sur `eleven_v4_turbo`.
  Le preset « Max diction FR » reste sur `eleven_multilingual_v2`, sans ces balises.
  Max sans indice émotionnel part sur « tendu », débit coupé.
  L'émotion jouée est déjà journalisée : `performance_emotion`, `performance_intensity`,
  `performance_speech_state`, `model` (télémétrie TTS, `src/services/tts/index.ts`).
- `streamedLlm` (première phrase pendant que le LLM écrit) est faux par défaut. Ne pas l'activer.
- Latence Tavus : lot arrêté le 21 novembre. Ne pas le rouvrir.

**Périmètre de ce lot.**

1. Lire, en lecture seule, le réglage live sandbox (Lovable Ava
   `1265958d-b74e-40f2-917d-182fe05163fc`, pas de Supabase direct) :
   `admin_settings` Tavus (`voiceSource` global et Max) et la voix effective de Max
   (moteur, modèle, style, stabilité). Citer ces valeurs dans le compte rendu.
   Si la source live de Max est « Tavus (PAL) », s'arrêter et le dire : le timbre n'est
   pas celui d'Ava, aucun plafond de TTS ne s'applique.
2. Si la source est Ava et le moteur ElevenLabs v3/v4 : ajouter un plafond de tenue,
   **désactivé par défaut**, limité à la lecture Tavus en voix Ava.
   Activé, sur une intention chaude (`angry`, `urgent`, `tense`, `accusatory`, `scared`) :
   ne pas préfixer de balise audio, et borner la hausse de style et la baisse de stabilité
   à un cran plus petit que le delta actuel (le coder et le tester ; ne pas inventer un
   nouveau moteur). Le texte dit, le visage, les autres fournisseurs et le TTS hors Tavus
   restent identiques.
   Nom admin explicite, du genre « Tenue audio quand la voix s'emballe », avec une phrase
   qui dit ce que ça change à l'oreille.
3. Si le moteur live n'est pas ElevenLabs : ne pas coder le plafond ElevenLabs.
   Décrire le levier réel de ce moteur (une phrase) et t'arrêter. Ulrich choisit.

**Hors lot.** Pas de nouveau PAL. Pas de changement de `voiceSource`. Pas de changement
de voix de Max. Pas de production. Pas de migration. Base Caractères en lecture seule.
Anam, LemonSlice, HeyGen, Gradium hors Tavus : aucun écart. Ne pas rouvrir la latence.

**Recette humaine, après livraison, sandbox seulement.** Ulrich parle avec Max en Tavus,
source Ava, jusqu'à une réplique qui s'emballe, une fois le plafond coupé, une fois activé.
Il dit si la voix reste intelligible et si les lèvres suivent. Rien n'est activé par défaut
avant ce retour.

**Validations.** Tests du plafond (balise absente, style et stabilité bornés, texte inchangé,
voie non-Tavus identique, défaut = comportement actuel). `npm run test:quality` et
`npm run test:delivery` verts avant push. CI `regression-gates` verte sur le HEAD exact.
Garde : `node .github/scripts/ship-pr.mjs --pr N --head SHA --merge` via
`~/CodeProjects/_shared/scripts/github-delivery-exec`.

**Livraison.** Branche depuis `main` à jour. CHANGELOG, `docs/etat_courant.md`,
[plan](plan_tavus_voix_ava_audio.md). Si un lot suit (écoute d'Ulrich, ou le plafond d'un
autre moteur), écrire son prompt dans le même tour, avec cette même obligation.
Sinon l'écrire : aucun lot suivant.

**Première action.** `git fetch --prune`, branches et PR ouvertes, puis lecture seule du
réglage Tavus et de la voix de Max en sandbox. Ne rien écrire tant que ces deux valeurs
ne sont pas citées.

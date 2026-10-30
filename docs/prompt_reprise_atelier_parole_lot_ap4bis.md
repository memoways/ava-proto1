# Ava — AP4-bis : voix des personnages par fournisseur et atelier compact

Exécute uniquement AP4-bis, dans un chat neuf. Ce prompt a été préparé le
30 octobre 2026 après le retour d’Ulrich sur l’atelier AP4. Il ne lance rien
d’autre.

## État vérifié

- Main `ad719848b788ff65e2721d79ef2ab82ba979a4b8` : AP4 fusionné par #113 via la
  garde. CI 41047619803 et `regression-gates` sont verts ; l’arbre et le parent
  `fad96ca` sont vérifiés. Preview Lovable synchronisée. Production non publiée.
  Seule autre PR ouverte : #24, à préserver.
- Écran AP4 : Expérience → Atelier de parole (`SpeechIntentWorkshop.tsx`,
  `speechIntentWorkshop.ts`, essais `intentTrials` dans
  `speech_workshop_documents`). Le banc AP2 est replié dans les options
  avancées.
- **Travail partiel non vérifié** : une branche locale non poussée,
  `claude/ap4-bis-voix-personnages`, contient un commit WIP. Il a été commencé
  avant ce prompt et n’a passé ni la qualité complète ni l’E2E. Contenu :
  - catalogue `src/services/tts/characterVoices.ts` ;
  - panneau `CharacterVoicesPanel.tsx` dans TTS Config ;
  - `updateCharacterRuntimeVoice` ;
  - réglages des personnages lisant le catalogue ;
  - atelier compact avec boutons « Faire un autre test » ;
  - premiers tests unitaires.

  À relire et reprendre ou réécrire au choix, jamais pousser tel quel.

## Retour d’Ulrich après essai AP4 (30 octobre)

1. Après l’écoute et la note, aucun bouton ne permet de refaire un test : on
   reste bloqué et il faut changer d’onglet.
2. Gradium : entre moyennement et très dramatique, rien ne change. La voix
   reste monocorde et appliquée, sans émotion.
3. Les autres fournisseurs utilisent leur voix par défaut, pas celle de Max.
   Les Voice ID des **quatre personnages** pour **chaque fournisseur** doivent
   se saisir une seule fois dans Technique avancée → Configuration TTS. Dans
   Expérience → réglages des personnages, choisir le fournisseur doit reprendre
   l’ID automatiquement, sans copier-coller à deux endroits.
4. L’écran est trop long sur desktop. Les fournisseurs à comparer doivent
   tenir à 2–3 par ligne, et les cartes aussi. Plus compact, moins de
   défilement.
5. La séance accompagnée de l’ancien AP5 est faite. La suite consiste à
   comparer les fournisseurs avec les bonnes voix custom.

## Diagnostic (fait, à ne pas refaire)

- **Gradium** (docs.gradium.ai, voice-settings et text-to-speech) : aucun
  réglage d’émotion, de style ni d’instruction. Il n’accepte que `temp`
  (0–1,4, variabilité), `padding_bonus` (−4 à 4, vitesse), `rewrite_rules` et
  les balises `<break time="…"/>` et `<flush>`. `cfg_coef` est **déprécié et
  ignoré**. Notre adaptateur borne `temp` à +0,1 (plafond 0,85), donc les
  intentions sont quasi inaudibles. C’est une limite du fournisseur et non un
  bug : l’expressivité vient de la voix clonée et du texte.
  Options à présenter à Ulrich, sans les coder sans accord :
  - cloner sur Gradium des voix de Max enregistrées dans des registres
    différents ;
  - concentrer les comparaisons d’émotion sur Fish, ElevenLabs v3 et Inworld,
    qui ont de vrais leviers ;
  - tester une variabilité plus haute dans l’atelier seulement, au risque
    d’artefacts.
- **Voix** : `character_runtime_profiles` n’a qu’un fournisseur et une voix
  par personnage et par environnement. Le jeu lit `tts_voice_id`. Dans
  `sandbox-ulrich`, Max et Emma sont sur Gradium, Ava et Léo sans voix.
  Réglages de fournisseurs stockés : Gradium et Fish seulement (`referenceId`
  global). Dans l’état actuel, seul Gradium a la voix de Max dans l’atelier.
- **Conception retenue pour la correction** :
  - catalogue `ava_tts_character_voices` (`admin_settings` par environnement,
    sans migration) au format `{personnage: {fournisseur: id}}` ;
  - au premier affichage, préremplir le catalogue avec les voix déjà
    utilisées par le jeu ;
  - à l’enregistrement : relecture, puis mise à jour de `tts_voice_id`
    uniquement pour les personnages dont le fournisseur choisi a un ID
    différent. Le jeu continue de lire le profil ;
  - réglages des personnages : affichage en lecture seule de l’ID du
    catalogue, avec un lien vers TTS Config si l’ID manque ;
  - atelier : voix de Max prise dans le catalogue ;
  - carte Gradium : afficher explicitement « pas de réglage d’émotion », et
    déclarer `cfg_coef` comme ignoré au lieu de l’afficher comme paramètre.

## Périmètre

1. Bouton « Faire un autre test » après l’enregistrement (même texte et autre
   émotion, ou autre texte), plus « Recommencer » visible à chaque étape.
2. Catalogue des Voice ID : 4 personnages × 5 fournisseurs dans TTS Config.
   Les réglages des personnages et l’atelier le reprennent, sans saisie
   double.
3. Atelier compact sur desktop : intentions et fournisseurs sur 2–3 colonnes,
   cartes sur 3 colonnes en `lg`, détails des cartes resserrés, 390 px
   conservé.
4. Carte Gradium honnête (diagnostic ci-dessus). Présenter les options
   Gradium à Ulrich ; aucune n’est codée sans accord.
5. Documents : plan (section AP4-bis avec retour, diagnostic et exécution),
   CHANGELOG, `docs/etat_courant.md`. Remplacer l’ancien prompt AP5 (séance
   déjà faite) par la suite convenue.

## Invariants

- Inchangés : fiches Notion, prompt GM, modèle/température du jeu, mapping des
  états, budget, capture/STT, interruptions/mains libres, transferts.
- La voix du jeu ne change que par l’enregistrement explicite du catalogue,
  dans l’environnement actif, et seulement pour le fournisseur déjà choisi.
- Aucune migration. Pas de `.env`. Secrets côté serveur uniquement. Aucun
  audio durable. Aucun juge LLM. Gami DigiDouble exclu, aucun animal affiché.
- Aucune publication en production, aucun lancement automatique du lot
  suivant.
- Plateforme : Lovable est la seule chaîne Cloud, et le SQL passe uniquement
  par le MCP Lovable. GitHub : natif, sinon une session unique
  `github-1password.sh session` (FIFO). Aucun Trousseau, aucune rafale
  1Password.

## Validations

- Unitaires :
  - catalogue (nettoyage, ID invalides, relecture différente, préremplissage,
    synchronisation limitée) ;
  - panneau TTS Config ;
  - réglages des personnages (ID repris, avertissement si l’ID manque ou
    diffère) ;
  - atelier (voix du catalogue envoyée, nouveau test, carte Gradium).
- E2E `tests/e2e/speech-workshop.spec.ts` étendu : nouveau test sans changer
  d’onglet, colonnes en desktop, 390 px sans défilement horizontal.
- `npm run test:quality` et `npm run test:delivery` verts avant le push.

## Livraison

- Une CI sur la PR, sur le HEAD exact contenant main à jour. Fusion
  uniquement par
  `node .github/scripts/ship-pr.mjs --pr NUMERO --head SHA_COMPLET --merge`,
  puis vérification de l’arbre et du parent.
- Supprimer notre seule branche, y compris la branche WIP locale si elle a été
  reprise ou abandonnée. Vérifier Lovable synchronisé. Aucune seconde campagne
  complète sur main.
- Notion : relire la tâche Gamilab
  https://app.notion.com/p/f3944bc8e9ce48138f2b309db223035d, ajouter la section
  AP4-bis avec « Last updated by », puis relire l’écriture.

## Première action exécutable

Dans `/Users/ulrich/CodeProjects/memoways/ava-proto1` :

1. Lire `git status`, AGENTS.md, `docs/etat_courant.md`, le début du
   CHANGELOG, puis les sections AP4 du plan.
2. Vérifier les chats actifs, le remote unique, les branches et PR,
   `git fetch --prune` sans helper personnel, puis main par pull ff-only.
3. Relire le diff `git diff origin/main...claude/ap4-bis-voix-personnages` et
   décider : reprendre le WIP ou repartir de main.
4. Lire
   `/Users/ulrich/CodeProjects/_shared/agent-context/12-task-closeout-handoff.md`.

## Règle de travail (demande d’Ulrich)

À chaque nouveau lot, après le diagnostic et **avant tout code**, rédiger le
prompt de reprise du lot pour un chat neuf, le donner à Ulrich et s’arrêter.

## Clôture obligatoire

Dans le même tour, enregistrer le prompt autonome du lot suivant, AP5 :
comparaison des fournisseurs avec les voix custom de Max saisies dans TTS
Config. Il contient l’état vérifié, les sources, le périmètre, les
invariants, les validations, la livraison, la première action exécutable et
cette même obligation. Donner son lien direct, sans lancer AP5.

Si AP4-bis reste incomplet, enregistrer la reprise exacte et l’unique action
humaine indispensable. Le bilan indique PR/SHA/CI/arbre/parent, les branches
restantes et rappelle que la production n’est pas publiée.

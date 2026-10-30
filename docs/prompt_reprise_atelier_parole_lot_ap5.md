# Ava — AP5 : comparer les fournisseurs avec les voix custom de Max

Exécute uniquement AP5, dans un chat neuf. Ce prompt a été préparé à la
clôture d’AP4-bis, le 30 octobre 2026, et ne lance rien. Il remplace l’ancien
AP5 (séance accompagnée), déjà fait par Ulrich. AP5 est une **recette
humaine** : une CI verte ou une capture ne prouve pas la crédibilité vocale.
Seules les notes qu’Ulrich donne à l’oreille comptent.

## État vérifié à la préparation

- AP4-bis implémenté sur la branche `claude/ap4-bis-voix-personnages-854fad`,
  depuis main `ad719848b788ff65e2721d79ef2ab82ba979a4b8`. PR, HEAD testé, CI,
  SHA de fusion et arbre/parent : lire le reçu dans la PR AP4-bis et la tâche
  Gamilab. Ce fichier est commité avant la fusion et ne contient donc pas ces
  valeurs. Seule autre PR ouverte à la préparation : #24, à préserver.
- Voix des personnages : **un seul endroit de saisie**, Technique avancée →
  Configuration TTS → « Voix des personnages par fournisseur » (clé
  `ava_tts_character_voices` dans `admin_settings`, par environnement). Les
  réglages des personnages et l’atelier reprennent ces ID. À l’enregistrement,
  la voix du jeu ne change que pour les personnages dont le fournisseur choisi
  a un ID différent.
- Dans `sandbox-ulrich`, d’après la lecture d’AP4 : Max et Emma jouent sur
  Gradium avec une voix ; Ava et Léo n’ont pas de voix. Aucune voix custom de
  Max n’est encore saisie pour Fish, ElevenLabs, Inworld ou Cartesia. Les clés
  serveur ne sont pas lisibles en SQL : elles se révèlent au premier essai.
- Atelier : Expérience → Atelier de parole
  (`/admin/experience/atelier-de-parole`). Texte → émotion → fournisseurs →
  cartes côte à côte (3 par ligne sur desktop), note de 1 à 5, « ce qui est
  off » sous 5, tableau intention × fournisseur exportable, « Faire un autre
  test » après l’enregistrement.
- Gradium n’a aucun réglage d’émotion (seuls `temp` et `padding_bonus`
  varient ; `cfg_coef` déprécié). La carte le dit. Trois options ont été
  présentées à Ulrich à la clôture d’AP4-bis, aucune codée : voix Gradium
  clonées dans plusieurs registres, comparaisons d’émotion centrées sur Fish,
  ElevenLabs v3 et Inworld, ou `temp` plus haut dans l’atelier seulement.
- Aucun son réel n’a été généré en développement. Publication production : non.

## Sources

AGENTS.md, `docs/etat_courant.md`, début du CHANGELOG,
`docs/plan_lot_b_rendu_vocal.md` (contrat AP1–AP8, exécutions AP4 et AP4-bis),
tâche Gamilab https://app.notion.com/p/f3944bc8e9ce48138f2b309db223035d (relire
avant toute édition). Notion Ava : Gamilab natif, get-self attendu
`7e1a9a09-09cb-4deb-a306-83a29b831bc2`. Lovable Ava
`1265958d-b74e-40f2-917d-182fe05163fc`, workspace Memoways `5glbtPltldwz9tgNwIi4`.

## Première action exécutable

Dans `/Users/ulrich/CodeProjects/memoways/ava-proto1` :

1. Lire `git status`, AGENTS.md, `docs/etat_courant.md`, le début du
   CHANGELOG et le reçu de livraison AP4-bis (PR et Notion).
2. Vérifier les chats actifs, le remote unique
   `https://github.com/memoways/ava-proto1`, les branches et PR,
   `git fetch --prune` (sans helper d’identifiants personnel), les six derniers
   commits, puis mettre main à jour par pull ff-only.
3. Vérifier par le connecteur Lovable, en lecture seule, que le projet est
   synchronisé sur le SHA de main contenant AP4-bis. Relire
   `ava_tts_character_voices` et les profils de `sandbox-ulrich`, sans rien
   modifier.
4. Règles : un seul agent ; aucun clone ni worktree adjacent ; #24 et `.vexp/`
   préservés.
5. Lire `/Users/ulrich/CodeProjects/_shared/agent-context/12-task-closeout-handoff.md`.

## Périmètre

1. **Une seule action humaine de préparation.** Ulrich saisit les Voice ID de
   Max chez chaque fournisseur à comparer dans Configuration TTS et répond
   « fait ». Ne jamais inventer un identifiant. Un fournisseur sans voix de Max
   reste « indisponible » ou « pas la voix de Max », et le bilan le note.
   Proposer en même temps la séance : deux passages et trois intentions
   (départ : P1 et P3 × Très dramatique, Perdu, Colère contenue), et la
   décision attendue sur les options Gradium.
2. **Comparaison** dans la preview Lovable `sandbox-ulrich` :
   - Ulrich génère lui-même chaque carte (un clic, un appel) et note de 1 à 5,
     avec « ce qui est off » sous 5 ;
   - l’agent ne déclenche aucun appel fournisseur en série, ne note rien à la
     place d’Ulrich et ne fabrique aucun avis.
3. **Bilan :**
   - exporter le tableau (CSV/JSON) et le recopier dans le plan avec les
     remarques « off » ;
   - pour chaque fournisseur, dire quelles intentions sonnent distinctes et
     lesquelles se confondent ;
   - noter les fournisseurs indisponibles et l’erreur réelle affichée.
4. **Suite :** préparer AP6, qui choisit le fournisseur et relie les cinq
   états de Max à des intentions validées. Ce choix est une décision humaine
   distincte. Aucune note ne change le fournisseur du jeu.

Si l’écran bloque la comparaison (fournisseur en erreur, voix refusée,
ergonomie), consigner le défaut observé. Une correction de code devient un
sous-lot AP5-bis, cadré et validé avant d’être codé, jamais pendant la séance.

## Invariants

- Inchangés : fiches Notion, prompt GM, modèle/température du jeu, mapping
  live, budget, capture/STT, interruptions/mains libres, transferts.
- La voix du jeu ne change que par l’enregistrement explicite du catalogue
  dans Configuration TTS, dans l’environnement actif, et seulement pour le
  fournisseur déjà choisi par personnage.
- Interdits : injecter les passages dans le jeu ; utiliser un juge LLM ;
  conserver de l’audio durable ; toucher à Gami DigiDouble ; afficher un
  animal. Aucune migration, aucun `.env`, secrets côté serveur uniquement.
- Notes humaines : ce sont des avis. Une note de 5 n’active rien.
- Aucune publication en production. Aucun passage automatique à AP6.
- Plateforme : Lovable est la seule chaîne Cloud, et le SQL passe uniquement
  par le MCP Lovable. GitHub : natif, sinon la session unique
  `bash .github/scripts/github-1password.sh session` décrite dans AGENTS.
  Aucun Trousseau macOS, aucune rafale de demandes au coffre.

## Validations

- Le tableau exporté correspond aux essais enregistrés, relus après
  rechargement.
- Chaque note sous 5 a sa remarque ; chaque carte indique bien « Voix de Max
  (configuration TTS) » pour les fournisseurs comparés.
- Les fournisseurs indisponibles sont nommés avec leur erreur réelle.
- AP5 est documentaire tant qu’aucun code ne change : relire contenu, liens et
  diff, vérifier que le code est inchangé et citer la dernière CI verte.

## Livraison

- Lot documentaire : branche, PR, fusion par
  `node .github/scripts/ship-pr.mjs --pr NUMERO --head SHA_COMPLET --merge`
  après vérification documentaire ; arbre et parent vérifiés.
- Un sous-lot de code éventuel suit le contrat complet : qualité locale,
  `test:delivery`, une CI sur le HEAD exact de la PR, la garde, puis arbre et
  parent ; aucune seconde campagne complète sur main.
- Supprimer notre seule branche. Vérifier Lovable synchronisé. La production
  n’est pas publiée.
- Documents : plan (résultats AP5), CHANGELOG, `docs/etat_courant.md`.
- Notion : relire la tâche Gamilab, écrire le bilan avec « Last updated by »,
  puis relire l’écriture.

## Règle de travail (demande d’Ulrich)

À chaque nouveau lot, après le diagnostic et **avant tout code**, rédiger le
prompt de reprise du lot pour un chat neuf, le donner à Ulrich et s’arrêter.

## Clôture obligatoire

Dans le même tour, enregistrer le prompt autonome AP6 dans
`docs/prompt_reprise_atelier_parole_lot_ap6.md` : choix du fournisseur sur
décision humaine, reliure des cinq états de Max à des intentions validées,
puis conversations courtes guidées. Il contient l’état vérifié, les sources,
le périmètre, les invariants, les validations, la livraison, la première
action exécutable et cette même obligation de prompt suivant. Donner son lien
direct. Sa préparation ne lance pas AP6.

Si AP5 reste incomplet, enregistrer la reprise exacte et l’unique action
humaine indispensable. Le bilan indique PR/SHA/CI/arbre/parent, les branches
restantes et rappelle que la production n’est pas publiée.

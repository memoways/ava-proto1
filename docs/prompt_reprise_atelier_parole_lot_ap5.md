# Ava — AP5 : séance accompagnée, intentions × fournisseurs

Exécute uniquement AP5. Ce prompt a été préparé à la clôture d’AP4, le
30 octobre 2026, et ne lance rien. AP5 est une **recette humaine** : une CI
verte ou une capture ne prouve pas la crédibilité vocale. Seules les notes
qu’Ulrich donne à l’oreille comptent.

## État vérifié à la préparation

- AP4 implémenté sur la branche `claude/ap4-atelier-parole-cfc140`, depuis
  main `fad96ca`. PR, HEAD testé, CI, SHA de fusion et arbre/parent : lire le
  reçu dans la PR AP4 et la tâche Gamilab. Ce fichier est commité avant la
  fusion et ne contient donc pas ces valeurs. Seule autre PR ouverte : #24, à
  préserver.
- Écran : Expérience → Atelier de parole (`/admin/experience/atelier-de-parole`).
  Parcours : texte à jouer → émotion → fournisseurs → cartes côte à côte, note
  de 1 à 5 par carte (« ce qui est off » sous 5), tableau intention ×
  fournisseur exportable. Banc AP2 replié dans les options avancées.
- Catalogue validé par Ulrich le 30 octobre : passages P1 (présent,
  appartement), P2 (souvenir J−2, hôtel), P3 (Emma) et dix intentions.
  Le catalogue est dans `src/services/tts/speechIntentWorkshop.ts`. Source et
  tableau des paramètres :
  [plan, AP4 étape 0 et exécution](plan_lot_b_rendu_vocal.md#ap4-étape-0--textes-et-intentions-à-valider-30-octobre-2026).
- Sandbox `sandbox-ulrich`, lue le 30 octobre par le connecteur Lovable :
  - Max joue sur Gradium, avec une voix configurée.
  - Fish a une voix de référence stockée, mais rien n’atteste que c’est celle
    de Max.
  - Inworld, Cartesia et ElevenLabs n’ont aucun réglage stocké.
  - Les clés serveur ne sont pas lisibles en SQL : elles se révèlent au
    premier essai.
- Limites connues d’après le code, à mesurer à l’oreille plutôt qu’à supposer :
  - Gradium : posé, moyennement dramatique, perdu et confidence reçoivent les
    mêmes réglages.
  - Fish : pas d’intensité, donc moyennement et très dramatique ne diffèrent
    que par la vitesse.
  - Cartesia : aucune émotion appliquée en français, et la colère contenue
    monte le volume.
- Aucun son réel n’a été généré en développement. Publication production : non.

## Sources

AGENTS.md, `docs/etat_courant.md`, début du CHANGELOG,
`docs/plan_lot_b_rendu_vocal.md` (contrat AP1–AP8, AP4 étape 0 et exécution),
tâche Gamilab https://app.notion.com/p/f3944bc8e9ce48138f2b309db223035d (relire
avant toute édition). Notion Ava : Gamilab natif, get-self attendu
`7e1a9a09-09cb-4deb-a306-83a29b831bc2`. Lovable Ava
`1265958d-b74e-40f2-917d-182fe05163fc`, workspace Memoways `5glbtPltldwz9tgNwIi4`.

## Première action exécutable

Dans `/Users/ulrich/CodeProjects/memoways/ava-proto1` :

1. Lire `git status`, AGENTS.md, `docs/etat_courant.md`, le début du
   CHANGELOG et le reçu de livraison AP4 (PR et Notion).
2. Vérifier les chats actifs, le remote unique
   `https://github.com/memoways/ava-proto1`, les branches et PR,
   `git fetch --prune` (sans helper d’identifiants personnel), les six derniers
   commits, puis mettre main à jour par pull ff-only.
3. Vérifier par le connecteur Lovable, en lecture seule, que le projet est
   synchronisé sur le SHA de main contenant AP4. Relire les fournisseurs et les
   voix de Max dans `sandbox-ulrich`, sans rien modifier.
4. Règles : un seul agent ; aucun clone ni worktree adjacent ; #24 et `.vexp/`
   préservés.
5. Lire `/Users/ulrich/CodeProjects/_shared/agent-context/12-task-closeout-handoff.md`.

## Périmètre

1. **Préparation, avec une seule action humaine.**
   - Proposer deux passages et trois intentions pour la séance. Proposition de
     départ : P1 et P3 × Très dramatique, Perdu, Colère contenue, car ces
     intentions séparent le mieux les fournisseurs dans le code.
   - Lister les fournisseurs à comparer et, pour chacun sauf Gradium, la voix
     d’atelier proposée pour Max (identifiant chez le fournisseur).
   - Ulrich valide ou corrige en une seule réponse. Ne pas inventer
     d’identifiant de voix : s’il n’en fournit pas, la carte reste « voix par
     défaut — pas la voix de Max » et la séance le note.
2. **Séance accompagnée** de 10 à 15 minutes, dans la preview Lovable
   `sandbox-ulrich` :
   - Ulrich génère lui-même chaque carte (un clic, un appel) et note de 1 à 5.
   - Il écrit « ce qui est off » sous 5.
   - L’agent ne déclenche pas d’appel fournisseur en série, ne note rien à la
     place d’Ulrich et ne fabrique aucun avis.
3. **Bilan :**
   - exporter le tableau (CSV/JSON) et le recopier dans le plan avec les
     remarques « off » ;
   - pour chaque fournisseur, dire quelles intentions sonnent distinctes et
     lesquelles se confondent ;
   - noter les fournisseurs indisponibles et la raison réelle affichée.
4. **Suite :** préparer AP6, qui choisit le fournisseur et relie les cinq
   états de Max à des intentions validées. Ce choix est une décision humaine
   distincte. Aucune note ne change le fournisseur du jeu.

Si l’écran bloque la séance (fournisseur en erreur, voix manquante,
ergonomie), consigner le défaut observé. Une correction de code éventuelle
devient un sous-lot AP5-bis, cadré et validé avant d’être codé. Elle ne se
fait pas pendant la séance.

## Invariants

- Inchangés : fiches Notion, prompt GM, modèle/température du jeu, voix et
  fournisseur du jeu, mapping live, budget, capture/STT, interruptions/mains
  libres, transferts.
- Interdits : injecter les passages dans le jeu ; utiliser un juge LLM ;
  conserver de l’audio durable ; toucher à Gami DigiDouble ; afficher un
  animal.
- Notes humaines : ce sont des avis. Une note de 5 n’active rien.
- Aucune publication en production. Aucun passage automatique à AP6.
- Plateforme : Lovable est la seule chaîne Cloud, et le SQL passe uniquement
  par le MCP Lovable. GitHub : natif, sinon la session unique 1Password décrite
  dans AGENTS. Aucun Trousseau macOS, aucune rafale de demandes au coffre.

## Validations

- Le tableau exporté correspond aux essais enregistrés, relus après
  rechargement.
- Chaque note sous 5 a sa remarque.
- Les fournisseurs indisponibles sont nommés avec leur erreur réelle.
- AP5 est documentaire tant qu’aucun code ne change : relire contenu, liens et
  diff, vérifier que le code est inchangé et citer la dernière CI verte.

## Livraison

- Lot documentaire : branche, PR, fusion par
  `node .github/scripts/ship-pr.mjs --pr NUMERO --head SHA_COMPLET --merge`
  après vérification documentaire ; arbre et parent vérifiés.
- Un sous-lot de code éventuel suit le contrat complet : qualité locale,
  `test:delivery`, une CI sur le HEAD exact de la PR, la garde, puis arbre et
  parent.
- Supprimer notre seule branche. Vérifier Lovable synchronisé. La production
  n’est pas publiée.
- Documents : plan (résultats AP5), CHANGELOG, `docs/etat_courant.md`.
- Notion : relire la tâche Gamilab, écrire le bilan avec « Last updated by »,
  puis relire l’écriture.

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

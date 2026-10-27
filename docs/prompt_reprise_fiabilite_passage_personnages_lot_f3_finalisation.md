# Reprise F3 — démo fiable Max/Emma, objectif validé

## 1. Première action : vérifier l’état, conserver l’objectif convenu

Projet : /Users/ulrich/CodeProjects/memoways/ava-proto1.
Remote unique : https://github.com/memoways/ava-proto1.
Lire AGENTS.md ; exécuter `git fetch --prune`, `git status`,
`git log origin/main -6 --oneline`, `gh pr list --repo memoways/ava-proto1`.
Lire ensuite **seulement le résumé courant en tête** de
`docs/plan_changement_interlocuteur_manuel.md`, jusqu’à « Historique conservé ».
Les anciennes sections sont des preuves, pas des tâches à réimplémenter.

**Décision d’Ulrich du 27 octobre 2026 : « Démo fiable Max/Emma d’abord ».**
La priorité A est validée ; ne pas redemander de choisir entre démo, CI et F3
complet. L’optimisation CI reste un chantier distinct ultérieur ; la qualification
exhaustive ne doit pas être imposée à la démonstration.
Le choix a été demandé « pour la reprise, sans la lancer maintenant » : ce tour
l’enregistre seulement. Lorsqu’Ulrich lancera explicitement la reprise, préparer
le parcours court ci-dessous ; aucun code par défaut, aucune publication implicite.
Lire les dernières réponses pour éviter de refaire des validations déjà acquises.

## 2. État à préserver

- Base vérifiée : main `ccd34143df4cec59b8f4be0418c2ad5c897a434a` (#99),
  Lovable au même SHA ready ; la présente mise au point Markdown peut l’avancer.
  Code #98 : `0170ac5`, CI PR 40488269434 et main 40491618695 vertes,
  109 E2E sans retry. Branches F3 précédentes supprimées, PR #24 historique préservée.
- Max et Emma sont actifs. Passages : accord du personnage, GM, reçu complet,
  minimum de quatre échanges complets par appel, bouton texte puis clic.
  Pas de bascule automatique, seuil technique distinct de la confiance narrative.
- Raccrochage → grille, même expérience, budget suspendu et souvenirs privés.
  Une offre validée survit à merci/continuation ; Rester ou un changement explicite
  la révoque. Aucun retour aux messages techniques ni à la pastille animée.
- **Entrée vocale déjà acceptée** : session 373833d0-4ed0-4613-9a6c-b33c3c9460b6,
  27 octobre 12:03:29 Paris. Ulrich : « plus de coupures, donc implémenter ça ».
  Réglage enregistré : mains libres=true, acoustic_confirmed, bargeIn=false,
  endOfSpeechMs=2 000, hesitationExtraMs=700, incremental=false.
  Ne pas refaire ce test après une modification documentaire.
- Identités vocales : Max Gradium b5ioHAR7JuHVLskk, Emma Gradium JReEQbhiZbfpeMYy.
  Ne changer ni voix, prosodie, prompt éditorial ou fournisseur pour réparer un passage.
- La stratégie text retirait aussi la garde acoustique de fin de parole : ne pas
  y revenir comme simple repli pour désactiver les interruptions. Le réglage
  actuel garde l’écoute et désactive seulement l’interruption de Max.
- Ava/Léo, sortie incrémentale et interruption volontaire ne sont pas à activer
  pour finir la démo. Une fonction volontairement désactivée n’est pas un test « à faire ».

## 3. Objectif A validé : une version de démonstration fiable

Lors du lancement explicite de la reprise, demander un seul parcours réel court dans Sandbox Ulrich
(cible 10–15 minutes, pas un délai à attendre) : Max, mention d’Ava/Emma, passage
accepté vers Emma, puis retour par grille. Observer les voix, les paroles entières,
l’absence de mécanique technique et la continuité. Un refus naturel est légitime ;
il ne doit pas bloquer la grille. Ne forcer ni confiance, ni seuil, ni accord.

Conserver les preuves déjà valides. Si le parcours fonctionne et qu’Ulrich
l’accepte comme démo : **geler cette version et s’arrêter**. Ne pas transformer
cette acceptation en validation exhaustive PTT/mains libres ou en publication.
Si Ulrich choisit C, utiliser le protocole complet et distinguer ses résultats
observés/non observés, sans réactiver barge-in ni effacer les validations antérieures.

Si un défaut précis apparaît : noter attendu/observé, session, mode et réglages ;
reproduire le cas avant de choisir une correction. Une hypothèse, un changement
minimal réversible ; identifier les réglages couplés avant de les modifier.
Rejouer le défaut et les formulations/cas voisins avant le premier push.
Aucun nouveau contrôleur, refactor ou support de fournisseur par défaut.

## 4. Tests et livraison : rendre le temps visible

Les 109 scénarios navigateur prennent environ 21 minutes, contre ~2 min 20 s
pour toute la qualité hors E2E. Le correctif #98 a consommé 75 min 49 s de CI
(échec, correction, répétition sur main). Sources et erreurs évitables sont dans le bilan.

Ne lancer une campagne complète que sur un code figé, après les replays ciblés.
Adapter aussi les anciennes assertions de présentation avant de pousser.
Préparer code, preuves et prompt ensemble. Ne pas relancer pour une modification
Markdown ou rejouer des cas déjà acceptés sans modification pertinente.
Le contrat actuel exige toujours CI PR puis CI main pour le code ; il reste
applicable. Le bilan propose d’en discuter le doublon et de réduire les temps
sans perdre les contrôles : **objectif B séparé, pas une modification autorisée ici**.
Une CI verte prouve les contrats simulés ; elle ne prouve pas la qualité acoustique.

## 5. Cibles et clôture

Un seul agent, checkout canonique seul, aucune branche étrangère modifiée.
Lovable seul : projet 1265958d-b74e-40f2-917d-182fe05163fc, workspace Memoways
5glbtPltldwz9tgNwIi4. SQL/Cloud par MCP Lovable natif, pas de Supabase générique.
Preview : https://id-preview--1265958d-b74e-40f2-917d-182fe05163fc.lovable.app/?env=sandbox-ulrich
Notion natif Gamilab : vérifier get-self = 7e1a9a09-09cb-4deb-a306-83a29b831bc2 ;
relire la tâche https://app.notion.com/p/1c498377edb94cfea4d4bae8728e8c7f avant
édition. Conserver Source, Last updated by=Codex, vérifier les écritures.
Gami DigiDouble exclu ; aucun navigateur de repli ou transcript complet sauvegardé.

Production différente : bargeIn=true, endOfSpeechMs=900, incremental=true lors du
bilan. Publier le code ne copierait pas les réglages sandbox. Aucune publication
F3 ni portage Cloud implicite : acceptation humaine du périmètre, puis autorisation
explicite distincte de publier ; identifier version servie et retour arrière.

À la clôture : actualiser le résumé du plan, les preuves pertinentes, CHANGELOG,
STORY et la tâche Notion ; vérifier main/CI, Lovable et suppression des seules
branches propres. Documentation seule : exception CI Markdown, dernier code vert
cité. Distinguer livré, entendu, accepté et publié. Livrer avec lien le prompt
autonome de finalisation ou du prochain lot dans le même tour, sans le lancer,
et y conserver cette obligation. Ne pas déclarer F3 entièrement accepté tant
que le périmètre de recette convenu ne l’est pas.

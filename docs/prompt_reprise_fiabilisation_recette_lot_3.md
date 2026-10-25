# Prompt autonome — Ava, lot 3 de recette : réponse sûre et passage fiable

Exécute uniquement ce lot dans `/Users/ulrich/CodeProjects/memoways/ava-proto1`,
remote `https://github.com/memoways/ava-proto1`. Implémente, teste et livre
complètement. Un seul agent actif ; aucun clone, sous-agent ou nouveau worktree.
Réutilise l'identité GitHub existante, sans login/refresh/logout. Préserve la
PR étrangère #24 et toutes les branches qui ne sont pas les tiennes.

Lis AGENTS.md, le contexte personnel Notion canonique via MCP natif et
`/Users/ulrich/CodeProjects/_shared/agent-context/12-task-closeout-handoff.md`.
Vérifie activité récente, remote, branches/PR et main à jour avant d'écrire.
Au moment de préparer ce prompt, main est
`5b56c0e987b04caf98f09726dae8ed62bd2d61cc`, #75 fusionnée. Les quatre documents
de cette proposition peuvent être présents comme seules modifications locales
non commises : reconnais-les et intègre-les au lot sans reset/stash destructif.
N'absorbe pas d'autres modifications inconnues. Une seule branche depuis main.

## Périmètre

Max et Emma, texte et Gradium, `sandbox-ulrich` uniquement pour les réglages et
la recette. Objectif : corriger le bug de réponse et les faux blocages du passage.
L'accueil et le jeu émotionnel sont le lot suivant ; ne pas les commencer ici.
Ne pas refaire le lot 2 : unités éditoriales et cinq états propres à chaque
fiche sont désormais protégés dans les quatre compilateurs ; mapping Cloud
sandbox sauvegardé/relu, version `2026-10-25T11:39:32.000Z`. Aucun gain de naturel
ou de latence ni recette humaine acceptée n'est acquis par ce prompt.

Consulte et actualise les plans existants, sans créer un plan concurrent :
- `docs/plan_parole_incarnee_personnages.md`, section « Suite après recette » ;
- `docs/plan_changement_interlocuteur_manuel.md`, section « Suite de recette » ;
- `docs/plan_fiabilisation_tours_transcrits_et_transferts.md` pour la récupération ;
- `docs/plan_lot_b_rendu_vocal.md` et le plan latence pour leurs invariants.

## Preuves de départ — vérifier, puis réutiliser

La session réelle `abb58e39-763d-465e-baeb-203c3f99bae0`, du 25 octobre 2026,
utilise bien la protection du lot 2. GM `gm-2026-10-25-compatible-contract`,
version publiée sandbox v7 `98145fe3-96f1-4525-84c2-0e0a1cc5c6da`.
Lecture SQL seulement par MCP Lovable du projet
`1265958d-b74e-40f2-917d-182fe05163fc`. Ne pas exporter transcript ou prompts
complets ; garder seulement les extraits minimaux et métadonnées nécessaires.

1. T2 : réponse ponctuée complète suivie de `\n</speech` tronqué ; le parseur
   échoue `Incomplete response sentence or quote`. Le reçu passe en failed,
   une partie audio incertaine est enregistrée. Cause amont de la troncature
   non établie : ne pas l'attribuer automatiquement à Internet.
2. T8 : demande de parler à Emma, réponse hésitante proposant de lui annoncer ;
   audit `gm_late` et persistance GM échouée. Une nouvelle soumission/interruption
   ne doit pas permettre à l'ancien résultat de créer une offre.
3. T9 : réponse « D’accord… je vais lui dire. Un instant. ». Recommandation GM
   de passage mais `consentRef: "currentUserMessage"` hors schéma. Le rejet est
   correct. Ne pas réparer cette référence ni transformer le différé en accord.
4. T12 : demande « comment, enfin, tu as pu me passer Emma ou pas » ; réponse
   livrée « Non… pas encore. J’ai dit que j’allais lui annoncer. Je te la passe
   maintenant. ». GM : accord courant, preuve « Je te la passe maintenant. ».
   Le veto local répond `character_refused`. Le rejeu du validateur accepte la
   même preuve sans le préfixe « Non… pas encore ».

Les 92 tests existants de `characterHandoff.test.ts` et 34 tests de
`responseIntentStream.test.ts` passent malgré ces replays rouges. Ajouter la
couverture manquante, pas seulement relancer ces tests. `characterHandoff.ts`
n'a pas changé dans #75 ; ne pas prétendre avoir établi une régression de ce lot.

## Travail attendu

### A. Protocole et parole sûre

Reproduis le résidu de fermeture à toutes les frontières SSE utiles, puis
empêche sa génération dans le contrat et définis son traitement terminal strict.
Si une fermeture connue est tolérée, cela exige fin normale du flux et parole
complète déjà validée. Ne jamais accepter `finish_reason=length`, abandon, mot
tronqué, citation ouverte, JSON privé, tag arbitraire ou identité étrangère.
Ne pas simplement retirer tous les caractères après `<`.

Teste aussi le cas où de l'audio a déjà commencé : aucune répétition ni nouvelle
génération rejouée après son. Réutilise les mécanismes de récupération existants
avant audio dans leur échéance ; pas de nouvel appel systématique ni de tour
utilisateur/RAG/GM supplémentaire. Reçus exacts delivered/uncertain/private
conservés. N'annonce pas un succès silencieux si la complétude reste indémontrable.

### B. Passage et négation rétrospective

Corrige le veto trop large sans retirer la priorité du refus. Un « Non… pas
encore » décrivant le passé puis un accord présent prouvé doit pouvoir aboutir.
Un « je te la passe… enfin non », « ne lui passe pas », refus conditionnel,
différé ou accord non entendu doit rester bloqué. Aucune autorisation par mot
clé ou regex seule : GM, reçu, cible/source, tour/version, gardes et clic requis.
Tests symétriques Max → Emma et Emma → Max.

### C. Référence et cycle du GM

Clarifie le contrat compact `consentRef=speech_N` dans tous les prompts effectifs,
y compris v7, sans changer snapshot publié, modèle, budget 950 ou timeout GM.
Teste la vraie évaluation avec la référence fautive T9 : toujours rejetée, raison
utile visible ; jamais de remapping inventé. Une preuve référencée valide sur un
accord réellement livré passe les validations existantes.

Reproduis la course fin de lecture/évaluation/nouvelle soumission et la
persistance T8 ; corrige une cause uniquement après preuve. Un résultat tardif
reste tardif ; une confirmation valide du tour courant peut aboutir sans
réutiliser un ancien accord. Aucun blocage de voix, délai d'attente du micro ou
modification des décisions mains libres pour contourner la course.

## Invariants et limites

Lovable/Lovable Cloud sont la seule chaîne. Aucun Supabase direct ni hébergeur
externe. Aucun changement de fiche, voix, fournisseur actif, mapping sandbox,
tags émotionnels, production ou configuration d'accueil dans ce lot.
Conserver experienceFrame, mémoires privées, capture, interruptions, budget GM,
preuve + gardes + persistance atomique + clic. Aucun stockage brut systématique.

## Vérification et livraison

Replays minimaux rouges avant correction, verts après sur les défauts corrigés ;
cas dangereux toujours rejetés. Tests au vrai point d'appel, vraie évaluation GM
avec réponses simulées historiques et E2E jusqu'au clic/connexion dans les deux
sens, plus concurrence et absence d'offre tardive. Aucun fournisseur audio ou
appel de jeu réel lancé automatiquement pour remplacer la recette humaine.

Exécute `npm run test:quality` et les E2E requis sur le code final. Ne répète pas
les suites vertes sans nouveau changement ou doute. Actualise plans, CHANGELOG
et STORY avec causes, limites et preuves. Commit/push/PR unique ; CI verte sur
HEAD exact avant squash, puis CI main/E2E vérifiée selon le contrat courant.
Supprime seulement ta branche locale/distante. Rapporte SHA main, liens CI,
checkout propre et branches étrangères conservées. Aucune CI/doc synchronisation
ou publication n'est présumée à partir d'un ancien bilan.

Vérifie source et preview Lovable sur le SHA livré ; prépare une seule URL :
https://id-preview--1265958d-b74e-40f2-917d-182fe05163fc.lovable.app/?env=sandbox-ulrich&diagnostic=full
Demande ensuite une recette courte à Ulrich : accord → offre → clic → Emma,
puis retour vers Max. Le texte entendu et les événements doivent concorder.
L'écoute reste humaine ; ne pas déduire son acceptation d'un lien ou des E2E.
Ne pas retarder cette recette par une nouvelle enquête générale si les preuves
techniques attendues sont acquises.

La livraison complète de ce seul lot est autorisée sans redemander ; aucune
publication de production. Si un blocage subsiste, continue l'indépendant puis
donne une seule action humaine précise. N'annonce pas « terminé » avec un reste
obligatoire. Le lot 4 accueil/jeu vocal attend une reprise distincte.

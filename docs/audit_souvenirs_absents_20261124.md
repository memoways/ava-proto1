# Audit — souvenirs absents du prompt de Max et Emma (sessions Romed du 23 novembre)

24 novembre 2026 · pour Ulrich et Romed · **diagnostic, aucun code de jeu modifié, rien en production.**
Lectures faites : code `main` à `8cf58ee6`, base Lovable en lecture seule (`sessions`, `experience_orchestration_versions`).
Suite : [prompt de reprise lot 1](prompt_reprise_souvenirs_absents_lot_1.md).

## Contexte

Romed a joué deux longues sessions le 23 novembre (14:31 Max→Emma, 65 tours ; 16:33 Emma→Max, 70 tours ;
`5215c870…` et `783f4a09…`, version d'orchestration `a9448fee`, trace diagnostique non activée). Dans le PDF,
le jaune montre ce que Max ou Emma nient ou ignorent, le rouge les souvenirs Notion qui disent le contraire (J-5.01,
S-3.01, S-3.02, J-7.01, J-3.11). Le motif est constant : le personnage ne ment pas, **il dit ne pas savoir**
(« je n'ai pas ce fait avec certitude », « je ne sais pas comment ce fusil est arrivé »). C'est ce qui se passe quand
le souvenir n'est pas dans le prompt et que le contrat dit « en cas d'incertitude, dis-le ».

## Constats (vérifiés dans le code et en base, lecture seule)

### 1. L'écran « Ce que reçoit Max » est trompeur, sans être la cause
`CharacterReceivedPreview.tsx` compile la fiche **sans tour** : `userMessage: "(message du joueur)"`, pas de
souvenirs, pas de cadre, pas de GM, pas de mémoire. Les lignes « absent (section_vide) » veulent dire « non simulé
ici », pas « bloqué en jeu ». Mais il cache le vrai problème : il ne montre jamais ce qui reste de place une fois tout
ajouté. Le seul chiffre révélateur : **Canon pertinent = 208 car.**, même sans historique.

### 2. Cause principale : les souvenirs passent en dernier, quand il ne reste plus de place
`buildOptimizedPromptAssembly` (`src/agents/maxOptimizedPromptCompiler.ts`, l. ~650-782) ajoute les sections dans
cet ordre, chacune dans la place restante d'un plafond `13 900 − historique` :
contrat (3 044) → noyau (≈ 7 675) → cadre → directive relationnelle → parole → état radar (≈ 790) → état du tour →
mémoire (≤ 1 200) → canon pertinent → post-vidéo → vidéos vues → **souvenirs**.

Calcul sur ces sessions (historique ≈ 800-1 200 car. via `selectOptimizedConversation`) :
- plafond ≈ 12 700-13 100 ; contrat + noyau ≈ 10 750 → il reste ≈ 2 000-2 300 ;
- cadre ≈ 700 (présent de l'appel + transfert), état ≈ 790, mémoire jusqu'à 1 200 (résumé présent : `memory_last_turn` 64/69)
  → **il ne reste rien** pour le canon et les souvenirs ;
- un souvenir fait 1 000 à 1 750 car. et `trimRagContextToWholeSouvenirs` ne l'injecte qu'entier : la section tombe
  en `budget_contexte_epuise`.

Le RAG est bien appelé à chaque tour (`rag_ms` ≈ 700 ms dans `conversation_log.pipeline`) : on paie la recherche,
le résultat est jeté à l'assemblage. Plus la conversation avance (mémoire pleine, transfert d'appel), plus c'est vrai.
**À confirmer par mesure** (lot 1) : aucune trace de ces sessions ne garde les sections incluses.

Historique : le budget global a été fixé avant que le noyau grossisse (vécu +1 500, hiérarchie +500, faits +900 le
23 novembre). Chaque ajout a été « payé » en relevant le plafond d'autant, en supposant que le reste gardait sa place ;
mais le reste n'a pas de place réservée, il prend ce qui reste.

### 3. Le cadre « bénévole » n'est jamais envoyé
En base, `experience_orchestration_versions.a9448fee` (et la dernière, `3613d91e`) : `frame.enabled = false`.
`buildExperienceFrame` n'envoie alors que le présent de l'appel, le film et le transfert. La phrase « L'interlocuteur
est une personne bénévole… » n'arrive pas : d'où « je peux demander aux bénévoles » adressé… à un bénévole.

### 4. La directive GM est vide dans ces sessions
`gm_post_turn_log[].injected.text` est vide sur tous les tours (moyenne 0 car.). Ce n'est pas elle qui prend la place ;
à noter seulement pour la lecture.

### 5. Contrat qui transforme le manque en déni
Contrat l. 63 : « En cas d'incertitude, dis-le. » + hiérarchie « les faits de ta fiche » d'abord. Sans souvenir dans
le prompt, le modèle conclut « je ne peux pas confirmer ». Correct si la donnée manque vraiment ; nuisible ici.

### 6. Points éditoriaux (Romed, pas de code)
- Paragraphe des faits de Max : « Tu l'as su il y a cinq jours, en prenant les clés chez lui » → le modèle en déduit
  « il ne me l'a pas dit, je l'ai découvert en prenant ses clés », contraire à J-5.01 (« ton père t'a lâché une
  nouvelle »). Reformuler.
- Le fusil donné par le père à Léo (J-3.11) et la raison du père (J-5.01) ne sont que dans les souvenirs : ils
  dépendent entièrement du point 2.
- Max « n'a jamais essayé de sortir Mona » : rien dans le noyau ne l'interdit ; à ajouter aux faits si c'est un fait.

## Plan de correction (un lot à la fois)

### Lot 1 — rendre visible et mesurer (prochain lot)
Objectif : prouver le constat 2 sur les fiches réelles et ne plus jamais le laisser silencieux.
1. **Trace légère toujours enregistrée** : dans `conversation_log[].pipeline` (déjà écrit à chaque tour), ajouter
   `prompt_sections` = liste courte `{key, chars, omission}` et `rag` = `{retrieved, injected, evicted_budget}`
   depuis `trace.budget` (`sections`, `ragSelection`). Pas de texte, quelques centaines d'octets. Fichiers :
   `src/services/prd4Orchestrator.ts` (là où `pipeline` est construit), type dans `src/types/conversationTrace.ts`.
2. **Aperçu réaliste** dans `CharacterReceivedPreview.tsx` : option « simuler un tour long » (historique 1 200 car.,
   mémoire 1 200, transfert, 3 souvenirs réels via `queryRAGDetailed` sur une question saisie) ; afficher la place
   restante et marquer en rouge « souvenirs : budget épuisé ».
3. **Avertissement** dans `buildOptimizedPromptAssembly` : si des souvenirs ont été récupérés et aucun injecté,
   ajouter `budget.warnings` (`souvenirs_evinces`) — repris par l'aperçu et par `eval:judge:sheets`.
4. **Mesure hors ligne** : test du compilateur avec un noyau de 7 675, contrat 3 044, historique 1 000, mémoire
   1 200, transfert, 3 souvenirs de 1 500 → aujourd'hui 0 souvenir injecté (test qui documente le défaut, marqué
   `it.fails` ou attendu explicite). Puis rejouer les 8 questions de Romed via `eval:judge:sequences` (sandbox) en
   relevant `rag.injected`.
Livraison : contrat du dépôt (branche, CI, garde `ship-pr.mjs`). Aucun changement de comportement en jeu.

### Lot 2 — réserver la place des souvenirs (décision d'Ulrich sur le coût)
- Réserver une place aux souvenirs **avant** mémoire et état : au moins 2 souvenirs entiers (≈ 3 500 car.), et les
  insérer juste après le canon (ou avant la mémoire, qui résume ce qui a déjà été dit).
- Financer la réserve : relever `generatedContextChars` de ≈ 3 500 (≈ +1 000 tokens d'entrée par tour, ≈ +20-25 %),
  **ou** alléger le contrat/noyau (contrat 3 044 car. à réduire). Recommandation : relever le plafond, mesurer.
- Le canon pertinent reçoit son plancher `minCanonChars` (650) réellement, pas seulement dans la sélection.
- Mesure avant/après : factualité (corpus lot F + questions de Romed), tokens, latence `character_llm`.

### Lot 3 — cadre et consigne d'incertitude
- Décider d'activer le cadre (`frame.enabled`) dans l'orchestration publiée : texte bénévole + posture (≈ +900 car.,
  à compter dans le budget du lot 2).
- Nuancer « en cas d'incertitude, dis-le » : un souvenir présent fait foi ; « je ne sais pas » seulement si rien dans
  la fiche ni les souvenirs n'en parle.
- Transmettre à Romed les points éditoriaux du constat 6 (tâche Notion, fiches en lecture seule pour nous).

## Vérification
- Lot 1 : `npm run test` (nouveau test de budget), aperçu admin en local sur la fiche Max (ligne souvenirs en rouge),
  une partie sandbox puis lecture SQL de `conversation_log[].pipeline.rag` sur la session.
- Lots 2-3 : même lecture → `injected ≥ 2` sur les tours longs ; `eval:judge:sequences --focus factuality` avant/après ;
  écoute Romed sur les 8 questions du PDF.

## Hors périmètre
Aucune écriture dans la base Caractères Notion ; aucune modification de production hors Lovable ; aucune nouvelle
mesure de retrieval tant que l'assemblage n'est pas corrigé (le retrieval lui-même n'est pas mis en cause, non vérifié).

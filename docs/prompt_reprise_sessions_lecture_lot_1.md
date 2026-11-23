# Prompt de reprise — Données › Sessions, la conversation au centre, lot 1

**Lot livré le 23 novembre 2026.** Ne pas le refaire. La recette du 23 novembre a élargi la liste et rangé le détail dans un toggle ([état courant](etat_courant.md)). Le trou des répliques absentes est le lot suivant : [reprise](prompt_reprise_sessions_reponses_manquantes.md).

À copier dans un nouvel agent sur Ava. Contexte : [état courant](etat_courant.md).
Décrit le 23 novembre 2026 par Ulrich.

---

**Objectif.** Rendre une session lisible pour comprendre ce qui s'est dit, tour par tour.
La conversation prend le centre et toute la hauteur. La liste des sessions se resserre à
gauche. Les métadonnées passent à droite, sur toute la hauteur. Chaque tour a son numéro.
Sous chaque réplique, le minimum utile pour voir pourquoi elle est sortie ainsi, et quels
chunks RAG ont été injectés quand ils ont été enregistrés.

**État vérifié (23 novembre, code).**

- Écran : Admin → Données → Sessions, `src/components/admin/SessionsTab.tsx`.
  Grille `lg:grid-cols-2`. Gauche : filtres, cases, liste `h-[70vh]`.
  Droite, empilé : titre, statistiques, réglages effectifs, triggers, rôle, passages,
  émotion du visage, journal GM (`h-48`), puis la conversation dans un `ScrollArea`
  de classe `h-60` (environ 240 px). C'est ce bandeau qui est trop petit.
- Le numéro de tour existe déjà pour le GM (`turn_index`, affiché `T{n}`) et pour
  le lien « Analyser ce tour » (`causalTurn` = nombre de messages joueur avant la réplique).
  Il n'est pas affiché comme titre de chaque échange.
- « Envoyer question dans le laboratoire RAG » épingle la phrase du joueur dans
  `rag_lab_pinned_questions` (étoile dans le Laboratoire RAG, questions fréquentes).
  Ça prépare un essai de recherche. Ça ne rejoue pas la réponse et ne montre pas les chunks
  de ce tour. Garder la case, en second plan, pour ne pas manger la lecture.
- Chunks, scores, modèle, température, prompt : table `conversation_turn_traces`,
  seulement si `sessions.diagnostic_trace_enabled`. Contrat :
  `src/types/conversationTrace.ts`, bloc `rag.matches`
  (`id`, `source_id`, `content`, `similarity`, `rerank_score`) et
  `maxCall.requestedSettings` (`model`, `temperature`, `maxTokens`).
  Lecture admin déjà faite par `src/components/PipelineTraceTab.tsx`
  (Mécanique → Traces Max). Une session normale n'a pas ces lignes.
  Ne pas les inventer. Ne pas commencer à tracer toutes les sessions : ce serait un autre lot.
- Déjà dans le journal, pour toute session : texte, « GM → personnage »
  (`describeGmToCharacter`), état joué si `character_state_used` est là,
  émotion de visage Tavus (`AvatarCueTrajectory`, télémétrie `avatar_cue`).
  Le TTS journalise `performance_emotion`, `performance_speech_state` et `model`
  (`src/services/tts/index.ts`) : les afficher sur la réplique s'ils sont lisibles
  pour ce `session_id` + `turn_index`, sans nouvel appel payant.

**Mise en page.**

- Trois colonnes, toute la hauteur utile de l'admin, desktop.
  Gauche, étroite (liste et filtres seulement ; la ligne de session montre le titre,
  la date, les personnages ; le reste des métadonnées quitte cette colonne).
  Centre, la plus large : conversation, défilement sur toute la hauteur, texte plus grand
  que le `text-sm` actuel, contrastes User / Max / Emma conservés.
  Droite, toute la hauteur : statistiques, réglages effectifs, triggers, rôle, passages,
  trajectoire d'émotion, journal GM, questionnaire. Rien de cette colonne n'est supprimé.
- Écran étroit : les trois blocs se suivent, conversation d'abord après la liste.
  Pas de régression du test d'épinglage `SessionsTab.ragLab.test.tsx`.

**Chaque échange, colonne du centre.**

- Numéro de tour visible, le même que `turn_index` / « Analyser ce tour ».
  Une réplique de personnage se range sous le tour du message joueur qui l'a provoquée.
- Texte de la réplique lisible en premier.
- Sous la réplique, une ligne courte : état de parole joué s'il est dans le journal GM,
  « GM → personnage », émotion de jeu TTS si la télémétrie l'a, émotion de visage si la
  trajectoire l'a.
- Si la session est tracée : pour ce tour, les chunks injectés (identifiant source,
  score, début du texte, assez pour reconnaître le souvenir) et le modèle + température
  demandés. Lien « Analyser ce tour » conservé pour le prompt complet.
  Si la session n'est pas tracée : une phrase fixe, « Chunks et paramètres du modèle
  non enregistrés pour cette session », et rien d'autre. Pas de reconstruction.

**Hors lot.** Pas de changement du pipeline de jeu, du RAG, du GM, ni de l'enregistrement
des traces. Pas de nouvelle table. Pas de migration. Pas de production.
Base Caractères en lecture seule. L'export Markdown reste disponible ; s'il omet le numéro
de tour, l'ajouter seulement si l'export relit déjà le journal, sans nouveau format secret.

**Recette humaine.** Ulrich ouvre Données → Sessions, choisit une session tracée et une
session normale. Il lit la conversation sans ouvrir un autre onglet pour le texte.
Sur la session tracée, il voit le numéro, le chunk et le modèle du tour. Sur l'autre,
il voit la phrase « non enregistrés ». La liste ne prend plus la moitié de l'écran.

**Validations.** Test de rendu : trois régions (liste, conversation, détails), numéro de
tour affiché, chunks affichés seulement pour une session tracée, phrase fixe sinon,
case RAG toujours présente sur une question. `npm run test:quality` et
`npm run test:delivery` verts avant push. CI `regression-gates` verte sur le HEAD exact.
Garde : `node .github/scripts/ship-pr.mjs --pr N --head SHA --merge` via
`~/CodeProjects/_shared/scripts/github-delivery-exec`.

**Livraison.** Branche depuis `main` à jour. CHANGELOG, `docs/etat_courant.md`.
Le lot suivant, s'il est encore utile après recette, serait d'enregistrer pour chaque
session normale le chunk retenu et le modèle du tour, sans passer par une session tracée.
Ne pas le commencer ici. Écrire son prompt dans le même tour seulement s'il reste ce trou
après la recette ; sinon écrire : aucun lot suivant. Ce prompt de suite reprend la même
obligation.

**Première action.** Lire `SessionsTab.tsx` (grille, `h-60`, `causalTurn`) et le bloc
`rag` de `src/types/conversationTrace.ts`. Ensuite poser la grille à trois colonnes
sans déplacer la logique d'épinglage.

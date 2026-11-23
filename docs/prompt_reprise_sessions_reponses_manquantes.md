# Prompt de reprise — réponses de personnage absentes du journal

À copier dans un nouvel agent sur Ava. Contexte : [état courant](etat_courant.md).
Décrit le 23 novembre 2026 après la lecture de la session Romed 16:33.
Ne pas refaire la mise en page de `SessionsTab` : elle est livrée dans le lot « liste plus large ».

---

**Objectif.** Une réplique qui a été produite doit rester dans `conversation_log`, même si le joueur enchaîne avant la fin du tour. Aujourd'hui la question reste et la réponse disparaît.

**État vérifié (23 novembre, écran + code, base non relue).**

- Session : « Romed · 23.11.26 16:33 · Emma · longue conversation (47 tours), non terminée ».
  Identifiant affiché, tronqué : `783f4a09-12de-4`. Sandbox Romed. Trace : « Non enregistrée ».
  L'en-tête de la conversation indique 61 messages. Le titre compte 47 messages `role: "user"`.
  Les tours 1 à 4 de la capture n'ont pas de ligne Emma sous la question.
- La phrase « Chunks et paramètres du modèle non enregistrés pour cette session » est le comportement voulu d'une session sans `diagnostic_trace_enabled`. Ne pas commencer à tracer toutes les sessions dans ce lot.
- Le connecteur SQL Lovable (`1265958d-b74e-40f2-917d-182fe05163fc`) n'était pas branché dans le chat Cursor qui a fait le diagnostic. Première action : relire cette ligne, en lecture seule, et compter les rôles. Ne pas passer par le connecteur Supabase générique.
- Écriture actuelle, `src/pages/IndexPRD4.tsx` :
  1. le message joueur est ajouté à `conversationRef` puis envoyé par `writeHandoffSnapshot` avant l'appel au modèle ;
  2. `streamPRD4Turn` / `processPRD4Turn` peut déjà faire parler le personnage ;
  3. `if (!isCurrentTurn()) return;` sort avant `conversationRef.current = [..., maxMsg]`.
  Le tour suivant réécrit alors le journal avec la nouvelle question et sans la réplique.
- Les thèmes et mots-clés sont posés plus tard encore, dans le `.then` du Game Master, par le même `persistTurnConversation`. Ils peuvent manquer pour la même raison. Ne pas les inventer à l'affichage.

**Périmètre.**

- Quand une réplique a été produite (`result.maxResponse` non vide) et que le tour n'est plus courant, l'insérer dans le journal entre le message joueur de ce tour et un message joueur plus récent, puis la persister.
- Un tour vraiment sans texte généré reste sans réplique. L'admin dit déjà « Réponse du personnage non enregistrée pour ce tour. »
- Ne pas élargir la trace diagnostic. Ne pas modifier le RAG, le Game Master, les prompts, ni la base Caractères.
- Test : un tour supplanté après génération laisse la réplique dans le journal, devant la question suivante, une seule fois.

**Hors lot.** Pas de reconstruction des répliques déjà perdues de la session `783f4a09-12de-4`. Pas de production.

**Validations.** Test ciblé du journal, puis `npm run test:quality` et `npm run test:delivery`. CI `regression-gates` verte sur le HEAD exact. Garde : `node .github/scripts/ship-pr.mjs --pr N --head SHA --merge` via `~/CodeProjects/_shared/scripts/github-delivery-exec`.

**Livraison.** Branche depuis `main` à jour. CHANGELOG, `docs/etat_courant.md`. Après fusion, le prompt du lot suivant dans le même tour, ou « aucun lot suivant » s'il n'y en a pas. Cette obligation est dans le prompt transmis.

**Première action.** Lire le retour `if (!isCurrentTurn()) return` qui suit `processPRD4Turn` / `streamPRD4Turn` dans `IndexPRD4.tsx`, et le `writeHandoffSnapshot` qui précède l'appel au modèle. Ensuite poser un test qui échoue tant que la réplique supplantée n'est pas dans le journal.

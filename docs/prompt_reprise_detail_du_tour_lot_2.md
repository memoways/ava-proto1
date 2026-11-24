# Prompt de reprise — Admin › Sessions › « Détail du tour », lot 2 (contexte et lisibilité)

À coller dans une nouvelle conversation, dépôt `memoways/ava-proto1`, checkout canonique, branche de lot depuis `main` à jour.

---

**Objectif.** Dans Admin › Sessions, le bloc « Détail du tour » doit permettre de comprendre pourquoi le personnage a répondu ce qu'il a répondu : ce qui a été passé au modèle, ce qui a fonctionné, ce qui a manqué ou été écarté, avec les problèmes remontés visiblement. Sans devenir kilométrique. Aujourd'hui tout est en petit, en blanc, au même niveau : améliorer la hiérarchie visuelle (groupes, libellés, alertes en couleur, replié par défaut pour le détail fin).

**État vérifié (24 novembre).** Le détail est rendu dans `src/components/admin/SessionsTab.tsx` (lecture des tours par `src/services/sessionTurnReading.ts`, `replyContextLine`). Il affiche déjà : état joué, GM → personnage, émotion, parole TTS, voix, visage, Game Master (statut, durée, modèle), conseil pour la suite, sujets, RAG/modèle/bloquant, épinglage laboratoire RAG. Le lot « Souvenirs lot 1 » enregistre en plus par tour `conversation_log[].pipeline.prompt` : sections envoyées ou retirées (clé, taille, raison), souvenirs envoyés, alertes (`souvenirs_evinces`, `memoire_evincee`, `canon_evince`) ; lire `src/services/promptSectionsDigest.ts` pour ce qui est déjà exposé. Capture de référence : session Benoît 24.11.26 00:21 (Max, 28 tours).

**Périmètre.** Lecture seule côté admin : aucun changement du pipeline de jeu ni de l'enregistrement, sauf ajout de champs de trace si un manque l'impose (le justifier). Proposer d'abord, dans le rapport, la liste des informations à ajouter (ex. fournisseur STT et `trigger` du tour, texte reçu par le GM, souvenirs et canon réellement envoyés, sections du prompt retirées, états de repli ou d'erreur, durée par étape), puis les implémenter.

**Limites.** Pas de Base Caractères Notion. Pas de production. Un seul lot, puis s'arrêter avec le prompt du suivant.

**Validations.** `npm run typecheck`, `npm run lint`, tests des composants Sessions (`SessionsTab.*.test.tsx`, `sessionTurnReading.test.ts`), capture avant/après.

**Livraison.** Contrat du dépôt : commit, push, PR, CI verte sur le HEAD exact, `node .github/scripts/ship-pr.mjs --pr NUMERO --head SHA_COMPLET --merge`, `gh` via `~/CodeProjects/_shared/scripts/github-delivery-exec`. Fin de lot : si du travail reste, donner le prompt de reprise suivant.

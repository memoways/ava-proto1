# Démarrer et livrer uniquement F2 — cycle des appels Ava

Travaille dans `/Users/ulrich/CodeProjects/memoways/ava-proto1`, remote unique
`https://github.com/memoways/ava-proto1`. F2 n'est pas lancé par cette passation.

**Première action :** `git fetch --prune`, puis lire `git log origin/main -6 --oneline`,
`git status`, branches et PR ouvertes ; actualiser main propre avec `git pull --ff-only`.
Un seul agent et une seule branche de lot. Préserver la PR étrangère #24 et les
branches historiques ; aucun clone/worktree adjacent.

Lis AGENTS.md, CHANGELOG.md, STORY.md, le plan
`docs/plan_changement_interlocuteur_manuel.md` et
`/Users/ulrich/CodeProjects/_shared/agent-context/12-task-closeout-handoff.md`.
Vérifie Notion natif Gamilab par get-self : `7e1a9a09-09cb-4deb-a306-83a29b831bc2`,
puis lis la [tâche](https://app.notion.com/p/1c498377edb94cfea4d4bae8728e8c7f) et
[l'application](https://app.notion.com/p/97462322e595822ca21601814e915159).
Aucun autre workspace ni navigateur en repli ; Gami DigiDouble exclu.
Vérifie Lovable Ava `1265958d-b74e-40f2-917d-182fe05163fc`, Memoways
`5glbtPltldwz9tgNwIi4`. Tout SQL/Cloud/migration/Edge passe par ce connecteur.

**État F1 vérifié : livré techniquement.** PR #88 fusionnée, code main `5bf1bd51617adc5ae06c656767ea02b29aca3371`,
[CI PR verte](https://github.com/memoways/ava-proto1/actions/runs/40370058542) et
[CI main verte](https://github.com/memoways/ava-proto1/actions/runs/40374094704),
E2E compris : 91/91 sur main sans retry, 91/91 local sans retry (la CI PR a eu un retry de journal asynchrone, bouton déjà présent). Preview synchronisée et prête. Aucune migration,
Edge ou publication production par F1. Le SHA ci-dessus désigne le code validé ; la clôture documentaire avance main sans changer ce code. Lire son SHA réel avant reprise, sans restaurer une ancienne révision.

**Seulement F2 :** séparer `closeCall` et fin d'expérience. Raccrocher revient
immédiatement à la grille libre Max/Emma, Ava/Léo indisponibles, sans questionnaire
imposé. Le prochain appel conserve expérience, film, version, contexte commun et
souvenirs privés propres. Fournir un identifiant/marqueur explicite de nouvel appel
et remettre à zéro uniquement son compteur d'échanges complets. Ne pas copier les
réinitialisations du premier `handleAnswered`.

Timer suspendu sur la grille, repris avec le même temps restant, sans reset ni
décompte sur la grille ; expiration technique distincte du budget d'expérience.
Arrêter micro, sorties et callbacks de l'appel quitté. Préserver F1 : coordinateur,
requestId/sourceCallId/version/CAS, préparation avant confirmation, reçu complet,
accord + GM + clic, bouton après « merci »/continuation jusqu'au clic, « Rester »
ou changement explicite, gardes admin, double clic et isolation des mémoires.

**Validation :** actualiser le plan avant code ; tester Max → grille → Emma →
grille → Max avec même expérience, souvenirs retrouvés sans confidences croisées,
timer, reprise/reload/expiration, callbacks tardifs, réseau, PTT/mains libres.
Repasser les replays F1, tests ciblés, `test:quality` et E2E complets. Toute migration
préserve anciens clients, autorisation par session et RLS ; application Cloud vérifiée.

**Livraison :** commit/push/PR, CI verte sur HEAD exact avant squash-merge,
CI main verte E2E compris, suppression de sa branche locale/distante, synchronisation
et état prêt Lovable. Production distincte, uniquement sur autorisation explicite ;
recette humaine distincte des tests simulés. Actualiser plan, CHANGELOG/STORY et tâche
Notion existante : Source conservée, Last updated by=Codex, chaque écriture relue.

Si Ulrich doit intervenir dans Lovable, sauver un prompt exact projet/SHA/environnement,
actions/contrôles/retour arrière et le donner prêt à copier. Ne pas annoncer F2 complet
si cette intégration reste à faire. Dans le même tour, enregistrer et fournir **prêt à
copier dans la réponse avec son lien** le prompt F3 si F2 est complet, sinon sa reprise
de finalisation : état vérifié, sources, contrôle Notion, décisions, périmètre, tests,
GitHub/Lovable et première action. Reporter cette obligation dans chaque prompt suivant.
Ne lancer aucun prochain lot et ne créer aucun nouveau chat automatiquement.

# AVA — Reprise Tavus Face & émotion, lot 4 : recette réelle (Ulrich + agent)

Dépôt Ava (`/Users/ulrich/CodeProjects/memoways/ava-proto1`, remote `https://github.com/memoways/ava-proto1`), en français.
Lovable / Lovable Cloud est l'unique chaîne de livraison. Ce lot est une **recette humaine** : l'agent prépare, observe,
documente et corrige un défaut éventuel ; il ne lance **aucun entraînement de Face** (coût et quota Tavus) sans le « fait »
explicite d'Ulrich après la boîte de confirmation de l'interface. Une action humaine à la fois.

## État vérifié (5 novembre 2026)
- Lots 1, 2, 3 livrés (CHANGELOG « Tavus lot 1/2/3 », plan sections « Exécution lot 1/2/3 »). Admin : onglet Avatar streaming →
  Tavus → bloc « Entraîner un Face (vidéo) » : upload TUS vers `tavus-training-videos`, entraînement après confirmation, liste des
  Faces (suivi 30 s tant que `started`), « Attribuer à Max » (écrit `tavus.characters.max.faceId`, puis « Sauvegarder »).
- Bucket et 4 politiques vérifiés présents (MCP Lovable Ava `1265958d-b74e-40f2-917d-182fe05163fc`). Edge Function
  `streaming-avatar-session` : déploiement des actions `train-face` / `face-status` non éprouvé par appel ; se confirme au
  premier « Rafraîchir » (liste) puis au suivi du Face.
- Incident à la première recette (5 novembre) : l'upload TUS a été refusé (`AccessDenied`, RLS) alors que bucket, politiques
  et rôles admin existent. Lot 3 bis : message détaillé (réponse du stockage, compte, hôte) + repli sur l'envoi standard.
  Lire ce message en premier ; il dira si le blocage vient du TUS, du compte ou de l'environnement Lovable (Test/Live :
  vérifier que le site testé est celui où la migration est appliquée, publier si besoin avec l'accord d'Ulrich).
- Point ouvert : la taille d'objet maximale de Lovable Cloud peut être inférieure à 750 Mo → message dédié et champ « ou URL publique ».

## Séquence de recette (Ulrich, une action à la fois ; l'agent guide, vérifie et note)
1. Tourner la vidéo de Max : 30 s en parlant, puis 30 s immobile lèvres fermées, 1080p, ≥ 25 ips, mp4/webm ≤ 750 Mo, visage sérieux,
   **sans sourire en écoute** (levier le plus fort noté au CHANGELOG).
2. Admin → Tavus → ouvrir le bloc : « Rafraîchir » (confirme le déploiement Edge), téléverser, vérifier le message si la taille
   est refusée (alors héberger la vidéo en lien public https ≥ 24 h), puis « Lancer l'entraînement » → confirmer.
3. Attendre `completed` (aperçu filigrané en minutes, affinage en quelques heures), « Attribuer à Max », « Sauvegarder ».
4. Panneau test (`StreamingAvatarTestPanel.tsx`) puis session réelle : pas de sourire en parlant ni en écoute ; comparer balise
   Echo `dejected` et `neutral`, émotion d'écoute `neutral` vs `sadness`.
5. Voix : bouton « Vérifier » (voix du PAL en lecture seule) + écoute — la voix doit rester celle du PAL (ElevenLabs de Max) et non
   le `default_voice_id` créé depuis l'audio de la vidéo.
6. Consigner le résultat (Face ID, réglages retenus, défauts) dans le plan « Exécution lot 4 », CHANGELOG et `docs/etat_courant.md`.

## Invariants
Secrets côté serveur ; base Caractères Notion en lecture seule ; aucun prompt modifié ; aucune suppression de Face depuis l'app ;
tout correctif de code reste minimal et passe par la livraison Ava habituelle.

## Validations et livraison (si du code ou des docs changent)
`npm run test:quality` et `npm run test:delivery` verts ; commit, push, PR, CI `regression-gates` verte sur le HEAD exact, fusion
uniquement par `node .github/scripts/ship-pr.mjs --pr N --head SHA_COMPLET --merge` (via
`~/CodeProjects/_shared/scripts/github-delivery-exec`, jamais `gh` nu ; aucun Trousseau). Supprimer la branche, actualiser main,
vérifier Lovable. Fusion ≠ publication.

## Obligation de reprise
Avant le push de ce lot, préparer le prompt de reprise suivant (`docs/prompt_reprise_<sujet>_<lot>.md`) : soit la suite décidée
après recette (réglage définitif, Face d'Emma, nettoyage des Faces d'essai chez Tavus), soit une note de clôture si rien ne reste ;
y reprendre cette même obligation.

## Première action exécutable
`git status && git fetch --prune && git log --oneline -6 origin/main`, puis lire le plan (sections Lot 4 et « Exécution lot 3 »).

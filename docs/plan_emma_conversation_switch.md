# Plan — Emma au départ et passage Max ↔ Emma

> Enregistré depuis le plan d’implémentation approuvé le 2026-08-25.
> Publication exclusive : Lovable / Lovable Cloud.

## Décision déjà tranchée

Le Game Master **suggère** un changement de personnage. Le personnage actuel le formule. Le joueur accepte, refuse, ou insiste. Aucun switch forcé.

## État des lieux (ce qui existe déjà)

Le prototype a déjà une **V1 Max → Emma**, livrée le 7 août 2026 ([`docs/plan_assainissement_mecanique_orchestration_gm.md`](plan_assainissement_mecanique_orchestration_gm.md), [`STORY.md`](../STORY.md) §2026-08-07).

Ce qui marche :

- Pipeline unique : STT → RAG cloisonné par `character_id` → LLM du personnage actif → TTS / avatar. Emma réutilise `simulateMaxResponse` avec `characterName: "Emma"`.
- Directeur d’expérience **hors chemin voix** : un JSON `{ labels, nextTurnGuidance, memoryDelta, action }` puis un garde déterministe ([`src/services/experienceDirector.ts`](../src/services/experienceDirector.ts)).
- Handoff V1 : après ≥ 4 tours, **une seule fois**, Max → Emma uniquement. Max propose au tour suivant ; boutons **Appeler Emma** / **Rester avec Max**.
- Mémoire V2 avec visibilité par personnage. Emma ne reçoit ni le transcript de Max, ni `sessionSummary`.
- Profils runtime Max / Emma (`character_runtime_profiles`) : phrase d’ouverture, voix TTS, checklist de readiness.
- Admin Orchestration : switch « Emma actif » = destination de handoff, **pas** le sélecteur public.

Ce qui bloquait le besoin actuel :

1. Sélecteur figé : Emma `active: false`. `handleAnswered` force toujours Max.
2. Écran d’appel Max-only.
3. Handoff unidirectionnel et unique (`targetCharacter: "emma"`, quota `0 | 1`).
4. Pas de demande joueur explicite.
5. Isolation trop fragile pour un aller-retour (un curseur d’index, résumé global, champs V1 non cloisonnés).
6. Admin : Max restait « entrée obligatoire ».

Ava et Léo restent hors périmètre (grisés).

## Cible produit

Deux personnages d’entrée : Max et Emma, si le profil est **enabled + ready**.

Deux façons de changer de locuteur, **sans jamais donner à l’autre le transcript ni la mémoire de conversation** :

- **Le joueur demande** : le personnage en ligne répond in character (accepte, objecte, hésite). S’il accepte → appel de l’autre. S’il objecte → on reste ; le joueur peut insister.
- **Le GM juge utile** : guidance au tour suivant pour que le personnage **propose**. Puis confirmation joueur. Jamais de bascule automatique.

Mémoire :

- Premier contact = rien de l’échange avec l’autre. Rôle / posture d’onboarding restent partagés.
- Retour = le personnage retrouve **sa** conversation et **sa** mémoire.
- Phrase d’ouverture uniquement au premier contact.

Session, timer, rôle joueur inchangés.

## Architecture

- Tag `spokenWith: "max" | "emma"` sur chaque message du `conversation_log`.
- Contexte LLM = slice du personnage actif.
- Mémoire de conversation privée par personnage ; interlocuteur onboarding seul élément partagé.
- Résumé de session : cache et injection par personnage ; jamais un résumé du log mixte.
- Demande joueur détectée avant le LLM, stance classée après la voix (GM + repli heuristique).
- Handoff GM bidirectionnel, cooldown, règles thèmes/topics, confirmation joueur.

## Hors périmètre

Ava, Léo, switch forcé, fuite volontaire de secrets entre personnages, nouvel hébergeur / Supabase hors Lovable, migration destructive.

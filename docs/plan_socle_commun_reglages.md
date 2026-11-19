# Socle commun des réglages (19 novembre 2026)

Besoin d'Ulrich : Romed, Benoît et Julien reprennent les réglages de la sandbox Ulrich ; les Voice ID et réglages de
services ne se ressaisissent plus à la main dans chaque sandbox.

## Ce que fait le code (livré avec la PR)

- `resolveSettingRows` : défauts codés ← **production (socle commun)** ← sandbox, champ par champ. Une ligne sandbox
  partielle n'efface plus les champs de la production.
- Catalogue de voix : fusion par personnage et fournisseur (`mergeVoiceCatalogues`) ; un ID sandbox ne remplace que son
  emplacement. Les clés API restent des secrets serveur partagés par tout le projet (aucune saisie par sandbox).

## Migrations à faire appliquer par Lovable (collées dans le chat)

1. `20261119120000_sync_sandbox_settings_from_ulrich.sql` — copie les réglages `ava_%` et les voix du jeu de
   `sandbox-ulrich` vers Romed, Benoît, Julien. Ne remplace jamais une valeur déjà modifiée dans la sandbox cible
   (remplace seulement ce qui égale encore la production, ou ce qui manque).
2. `20261119120100_shared_voice_catalogue_in_prod.sql` — **production, go d'Ulrich requis** : complète le catalogue de
   voix de la production avec les ID d'Ulrich (n'écrase aucun ID existant).

## Prompt de reprise

> Dans ava-proto1 (main à jour), vérifier l'application des deux migrations du socle commun via Lovable : lire
> `admin_settings` (`ava_tts_character_voices`, `ava_llm_settings`, `ava_tts_settings*`) et
> `character_runtime_profiles` pour prod et les quatre sandbox ; confirmer que Romed, Benoît, Julien affichent les
> mêmes voix qu'Ulrich dans Technique → Configuration TTS. Auditer ensuite les secrets des fonctions Edge
> (`proxy-tts-*`, `proxy-stt-*`, `proxy-llm`, `streaming-avatar-session`) : lister les clés attendues et celles
> présentes côté Lovable. Aucune écriture production sans go ; livraison par la garde `ship-pr.mjs`.

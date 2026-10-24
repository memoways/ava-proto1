# Plan — Lot B : rendre les états de parole audibles

Le plan détaillé est enregistré dans [docs/plan_lot_b_rendu_vocal.md](docs/plan_lot_b_rendu_vocal.md).

## Ce que l'audit confirme

- Gradium transforme les suspensions en virgules ou points : une partie des ruptures disparaît.
- « euh » et les reprises restent présents, mais l'intention vocale ne reçoit pas l'état du lot A.
- Les points de suspension peuvent imposer une voix fragile/mesurée, même lorsqu'un état demande d'accélérer.
- Le streaming Gradium prépare ses paramètres avant l'arrivée de l'état privé ; l'audition actuelle ne compare qu'une phrase et des émotions manuelles.

## Ce qui sera construit après validation

1. **Rendu par état**, éditable dans TTS Config, propre à chaque personnage : débit relatif, pauses et delivery. L'état déclaré et validé pilote la voix ; lexique et ponctuation servent de repli. La rugosité 0 garde le comportement actuel.
2. **Transmission aux sorties batch et streaming**, avant le premier texte synthétisé, sans appel LLM supplémentaire ni attente de la réponse complète. L'état reste confirmé comme « joué » uniquement après livraison audio.
3. **Préparation de texte prudente** : préserver mots, reprises, « euh » et phrases coupées ; ne pas réintroduire aveuglément les signes qui provoquaient des hoquets Gradium. Aucun changement des sous-titres.
4. **Banc d'écoute manuel sandbox** : 10 répliques par personnage × rugosité 1/2/3 × Gradium, Hume, Inworld, ElevenLabs v3, Cartesia. Soit 150 combinaisons par personnage ; aucune synthèse massive automatique. Voix distinctes par fournisseur, arrêt/rejeu, mesures et export. Le banc ne change pas le fournisseur actif.
5. **Adaptateur Gradium fermé par défaut** : flag false, aucun tag spéculatif. La disponibilité et le format annoncés pour novembre restent à confirmer ; seuls les adaptateurs pourront injecter des tags, jamais le LLM.
6. **Fish Audio dans le document seulement** : qualité FR et latence Ava non mesurées ; annonces commerciales clairement séparées des faits vérifiés. Aucune intégration.

## Garanties de périmètre

- Sandbox uniquement, Lovable Cloud ; aucune publication ou configuration production.
- Conserver voix sauvegardées, température/padding Gradium par personnage, buffers et décisions d'interruption existants.
- Mapping déterministe, chargé avec les réglages d'environnement ; aucun appel distant par segment.
- Fournisseur ou état non configuré : repli actuel, aucune voix inventée ni identifiant envoyé au mauvais service.
- Interrupteur sandbox réversible en cas de problème de diction ou de latence.

## Vérifications et rapport

Tests de priorité état/ponctuation, isolation personnage/environnement, rugosité 0, bornes des fournisseurs, mots conservés, tags désactivés, banc 10 × 3 × 5 et modèle v3 sans changement live ; suites streaming et interruptions existantes.

Vérifier le banc connecté, puis faire les auditions réelles à la demande. Comparer diction, artefacts et premier son avant/après ; ne pas annoncer l'absence de régression sans mesures. Objectif voix-à-voix existant : médiane ≤2 s, p95 ≤4 s, distinct des mesures TTS seules.

Rapport final technique et expérience : ce qui a changé, où écouter, résultats réellement mesurés et limites restantes. GitHub main/CI/nettoyage non vérifiés ici : aucune livraison complète revendiquée tant que ce statut manque.

## Détails techniques

Étendre le contexte TTS et `PerformanceIntent` avec état validé et provenance ; utiliser la configuration d'environnement existante pour le mapping versionné. Adapter `IndexPRD4`, `streamedVoiceTurn`, la préparation Gradium et les adaptateurs fournisseurs sans toucher au canon Notion, à l'expérience commune ou aux sous-titres. Préserver l'ouverture anticipée du transport Gradium tout en fixant son setup avant l'envoi du premier segment. Pas de migration envisagée tant que les réglages existants suffisent.
# Conversation vocale mains libres et interruption

## Besoin
Parler au personnage sans bouton : on ouvre le micro une fois, on parle ; après un court silence le personnage répond ; on peut lui couper la parole. Réglages de tempo dans Expérience → Orchestration.

## Réalisé
- Réglages (par environnement, `VOICE_HANDS_FREE` dans les réglages globaux) : activation, silence avant réponse (300–3000 ms, défaut 900), attente en plus si hésitation (0–3000 ms, défaut 700), interruption on/off, nombre de mots pour interrompre (1–6, défaut 2). Désactivé par défaut : l'appel reste en « appuyer pour parler ».
- `src/services/handsFreeVoice.ts` : logique pure (fin de parole, détection d'hésitation « euh / et / parce que / virgule », interruption avec filtre anti-écho : si ≥ 80 % des mots entendus appartiennent à la réplique en cours, on ignore).
- Appel : bouton unique « Activer le micro » ; la reconnaissance reste ouverte pendant la réponse ; silence → envoi ; parole pendant que le personnage réfléchit ou parle → voix coupée, tour abandonné, le joueur reprend. Écoute suspendue pendant cinématiques et changement de personnage.
- Fonctionne avec tous les fournisseurs de reconnaissance (décision de fin de parole prise par l'app, pas par le fournisseur).

## Limites connues
- 20–50 ms de silence n'est pas réaliste : la reconnaissance livre les mots avec ~200–300 ms de retard et une respiration dure plus. Minimum 300 ms, conseillé 700–1000 ms.
- Sur haut-parleurs sans casque, l'écho peut déclencher une interruption ; monter le nombre de mots à 3.
- Une réplique interrompue reste en entier dans l'historique (le personnage « croit » avoir tout dit).
- Le texte affiché reste un outil de débogage.

## Tests
`src/services/handsFreeVoice.test.ts` : bornes du silence, hésitation, interruption et anti-écho.


## Complément de latence et de continuité — 12 octobre 2026

La base réalisée ci-dessus reste le point de départ. Le [plan d'optimisation voice-to-voice](plan_optimisation_latence_voice_to_voice.md) complète la mesure, la sortie LLM/TTS incrémentale et la mémoire des répliques interrompues ; il ne recrée pas la saisie mains libres. L'[audit chiffré](audit_voice_conversation_max.md) distingue les mesures PTT de septembre du fonctionnement mains libres récent.

Ulrich a choisi le 12 octobre une réaction dès début de voix, avec confirmation ensuite. Cette évolution **reste à implémenter** selon la section 3 du plan d'optimisation : décision dans `handsFreeVoice.ts`, candidat réversible, puis interruption confirmée. Les réglages et le comportement réalisés ci-dessus demeurent la base de compatibilité.

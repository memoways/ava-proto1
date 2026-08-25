# Plan — Réglages Gradium TTS par personnage

Date : 2026-08-25
Statut : implémenté

## Objectif

Permettre des réglages fins Gradium distincts pour chaque personnage actif
(aujourd’hui Max et Emma), depuis Admin → Technique avancée → TTS Config,
avec un test REST / streaming qui utilise la voix et les réglages du
personnage sélectionné.

## Contexte

- Les **Voice ID** restent dans Expérience → Orchestration / Réglages personnages.
- Les réglages Gradium (temp, cfg_coef, padding_bonus, rewrite, pronunciation)
  sont aujourd’hui **globaux** (`ava_tts_settings_gradium`).
- Max et Emma peuvent déjà parler dans la même session : un seul jeu de
  paramètres Gradium ne suffit plus.

## Découpage

| Portée | Réglages |
|---|---|
| Par personnage | `temp`, `cfgCoef`, `paddingBonus`, `rewriteRules`, `pronunciationId` |
| Global (transport) | `outputFormat`, `streamingEnabled`, `streamingFormat` |
| Déjà par personnage | Voice ID + provider TTS (profil runtime) |

## Stockage

Pas de migration BDD. Extension additive de la clé existante
`ava_tts_settings_gradium` :

```json
{
  "temp": 0.7,
  "cfgCoef": 2.0,
  "byCharacter": {
    "max": { "temp": 0.6, "cfgCoef": 2.2, "...": "..." },
    "emma": { "temp": 0.9, "cfgCoef": 1.8, "...": "..." }
  }
}
```

Un personnage sans entrée `byCharacter` hérite des valeurs globales
(rétrocompatible). Premier edit dans l’admin fige une copie complète
pour ce personnage.

## Runtime

- Ajouter `characterKey` à `TTSGenerateContext` / `ResponseOutputTurnContext`.
- `resolveGradiumSettings(characterKey)` fusionne global + override.
- `IndexPRD4` transmet le personnage actif (ouverture, tour, handoff).
- Appels sans `characterKey` : comportement actuel (défauts globaux).

## Admin UI

Dans le panneau Gradium de TTS Config :

1. Sélecteur des personnages **actifs** (profils runtime `enabled`),
   repli Max + Emma si le chargement échoue.
2. Sliders / champs de réglages fins liés au personnage sélectionné.
3. Affichage en lecture seule de la Voice ID Orchestration.
4. Tester REST / Tester streaming : `providerId: "gradium"` +
   `characterKey` + `voiceId` du profil.

Reset = réinitialise les réglages fins du personnage sélectionné.
Sauver = persiste tout l’objet Gradium (global + `byCharacter`).

## Tests

- Résolution Max vs Emma vs fallback global.
- TTS Config : le sélecteur liste Max et Emma.
- Aucune migration Lovable Cloud.

## Hors périmètre

- Réglages par personnage pour ElevenLabs / Inworld / Hume.
- Voice ID Gradium dans TTS Config (reste dans Orchestration).
- Ava / Léo tant qu’ils ne sont pas activés.

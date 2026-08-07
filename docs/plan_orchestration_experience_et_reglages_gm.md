# Plan — Orchestration de l’expérience et réglages GM

> **Statut :** implémenté et validé localement le 7 août 2026
>
> **Activation :** synchronisation, build et recette à finaliser exclusivement
> dans Lovable / Lovable Cloud avec le
> [prompt opérationnel](interfaces/lovable-experience-orchestration-finalization.md#prompt-prêt-à-coller-dans-lovable).

## Objectifs

- Distinguer visuellement « Expérience » de « Personnages » dans la navigation.
- Regrouper dans l’orchestration les variables qui activent ou désactivent des étapes globales de l’expérience.
- Déplacer l’activation des personnages hors de leurs réglages techniques.
- Remplacer l’édition GM uniquement textuelle par un éditeur structuré qui génère le prompt final.
- Vérifier et corriger le câblage des réglages personnages vers le runtime public.

## Diagnostic initial

- La phrase d’ouverture de Max est actuellement codée en dur dans `openingTTSCache.ts` et n’utilise pas `character_runtime_profiles.opening_line`.
- La phrase d’ouverture et la voix d’Emma sont lues lors du handoff, mais le provider TTS reste global.
- La voix et le portrait configurés pour Max ne sont pas lus par le parcours public.
- Le champ `enabled` des personnages est stocké dans les profils runtime, mais son contrôle se trouve dans le mauvais panel.
- La configuration versionnée du GM contient déjà des seuils, mais ils ne sont pas tous appliqués par les garde-fous déterministes.

## Implémentation

1. Remplacer l’icône du groupe « Expérience » par une icône distincte.
2. Étendre les réglages globaux avec :
   - affichage du questionnaire final ;
   - personnages actifs (Max obligatoire dans ce prototype, Emma activable pour le handoff).
3. Faire respecter le choix du questionnaire dans le parcours de fin de session.
4. Retirer le contrôle d’activation du panel « Réglages personnages » et y conserver les réglages propres à chaque personnage.
5. Charger pour Max sa phrase d’ouverture et son Voice ID au démarrage de l’appel, avec repli explicite sur la valeur intégrée.
6. Ajouter un éditeur GM structuré : selects, cases à cocher, champs texte et numériques, explications d’incidence et aperçu du prompt généré.
7. Appliquer les paramètres déterministes du GM dans le runtime : handoff/cinématiques autorisés, tour minimum, nombre maximal de handoffs et timeout.
8. Ajouter ou adapter les tests unitaires et exécuter lint, tests ciblés et build local de vérification. Le build et la publication de référence restent exclusivement dans Lovable.

## Variables globales recommandées pour une itération ultérieure

- écran ou personnage d’entrée ;
- cinématiques activées et limite par session ;
- reprise de session autorisée et fenêtre de reprise ;
- mode de fin (automatique, naturelle, manuelle) ;
- consentement analytics optionnel ;
- variantes d’onboarding et de teaser.

Ces variables ne doivent être exposées que lorsqu’elles sont effectivement consommées par le runtime.

## Résultat d’implémentation

- Le groupe Expérience utilise l’icône 🧭.
- `SHOW_QUESTIONNAIRE` est persisté avec les réglages de gameplay et consommé
  par la transition de fin PRD4.
- L’activation des profils est sauvegardée uniquement depuis Orchestration ; la
  sauvegarde d’un profil ne transporte plus le champ `enabled`.
- L’ouverture de Max, son provider et son Voice ID sont chargés depuis son profil
  runtime. Le provider et la voix suivent également les réponses suivantes et
  les fallbacks avatar → TTS.
- L’éditeur GM génère un prompt complet depuis une configuration versionnée. La
  configuration accompagne l’évaluation post-tour et pilote les garde-fous
  déterministes.
- Tests qualitatifs et isolation des connaissances sont visibles, explicables et
  inclus dans la checklist de readiness.

## Validation locale

- `npx tsc --noEmit -p tsconfig.app.json` : réussi.
- `npm run test:unit` : 60 fichiers, 237 tests réussis.
- `npm run build` : réussi.
- `git diff --check` : réussi.
- Lint ciblé : aucune nouvelle erreur dans les composants et services ajoutés.
  Le lint global reste bloqué par les `any` historiques déjà présents dans le
  dépôt.

## Documentation liée

- [Changelog 0.55.2](../CHANGELOG.md#0552--2026-08-07--orchestration-globale-et-éditeur-gm-réellement-câblés)
- [Development Story](../STORY.md#2026-08-07--les-réglages-dexpérience-cessent-dêtre-décoratifs-)
- [Finalisation et prompt Lovable](interfaces/lovable-experience-orchestration-finalization.md)

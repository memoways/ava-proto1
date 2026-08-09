# Design QA — dashboard PostHog interactif

## Artifacts

- Source visuelle : `/var/folders/fd/t8wh_hy505x_cb5jp9fg2jdh0000gn/T/codex-clipboard-5f2d3d45-b518-45c2-84ad-445d93a90b47.png`
- Implémentation complète finale : `/Users/ulrich/CodeProjects/memoways/ava-proto1/design-qa-implementation-final.png`
- Focus final — tableau et détail d’un tour : `/Users/ulrich/CodeProjects/memoways/ava-proto1/design-qa-implementation-detail-final.png`
- URL vérifiée : `http://127.0.0.1:4173/__preview/latency-telemetry`

## Normalisation

- Source : 2802 × 1876 px, ratio 1,494.
- Viewport navigateur : 1912 × 1272 CSS px, ratio 1,503, `devicePixelRatio = 2`.
- Capture finale complète : 1897 × 2489 px (largeur utile après scrollbar, capture normalisée en pixels CSS par le navigateur).
- Capture focalisée : 1897 × 1272 px.
- État : thème sombre desktop, données PostHog factices réalistes, filtre et détail interactif testés. La navigation admin entourant le composant n’est volontairement pas reproduite dans la route de QA.

## Comparaison complète

La structure, la typographie Inter, les fonds sombres, les bordures, les rayons et l’accent rouge restent cohérents avec la source. Les annotations ont été traduites en changements intentionnels : les cinq champs deviennent des sélecteurs, le lien cible le projet 137897, et la grille de valeurs est remplacée par une hiérarchie de KPI, graphiques et tableau de diagnostic.

## Comparaison focalisée

Une capture dédiée était nécessaire car le tableau des tours lents et son détail sont sous la ligne de flottaison. Elle confirme la lisibilité des colonnes, les états Erreur/Fallback/OK, l’ouverture au clavier/clic d’un tour et la décomposition STT → RAG → Max LLM → TTS → expérience complète.

## Surfaces de fidélité

- Typographie : famille, graisses et hiérarchie conformes aux tokens existants ; labels secondaires volontairement atténués.
- Espacement et rythme : sections espacées régulièrement, grille responsive sans débordement horizontal à 1912 px, cartes et graphiques alignés.
- Couleurs et tokens : palette sombre AVA conservée ; rouge pour le p95/alerte, ambre pour le p50/actions et couleurs sémantiques pour les états.
- Images et assets : aucune image métier n’est requise dans cette vue ; les icônes proviennent de la bibliothèque déjà utilisée par le produit.
- Contenu : libellés français, sources PostHog/Supabase séparées, période/fraîcheur et unités conservées.

## Interactions et console

- Sélection du personnage `max`, application et apparition de `1 filtre actif` : réussies.
- Changement de la chronologie de `End-to-end` vers `Premier son` : réussi.
- Ouverture du tour #12 et affichage de son détail : réussie.
- Cible du lien externe : `https://eu.posthog.com/project/137897/dashboard`.
- Erreurs console : aucune. Deux avertissements React Router v7 préexistants et non bloquants seulement.

## Historique des corrections

1. Première comparaison : [P1] les barres Providers et Actions étaient noires car les variables `--chart-*` ne sont pas définies dans le thème AVA.
2. Correction : remplacement par les tokens existants `--primary`, `--accent`, `--trust-color`, `--cinema-blue` et `--muted-foreground`.
3. Nouvelle capture : les séries p50/p95, providers et actions sont distinctes, contrastées et lisibles ; aucun P0/P1/P2 restant.

## Findings

Aucun écart P0, P1 ou P2 restant. La densité de la table peut être réduite sur une future itération mobile, mais la vue admin cible est desktop et reste navigable horizontalement aux largeurs inférieures.

## Implementation Checklist

- [x] Menus déroulants fonctionnels et accessibles.
- [x] Lien PostHog exact.
- [x] Visualisations p50/p95 et chronologie interactives.
- [x] Répartitions, blockers et actions visualisés.
- [x] Tours lents et détail sélectionnable.
- [x] Aucun débordement horizontal au viewport cible.
- [x] Aucune erreur console.

## Follow-up Polish

- [P3] Ajouter un mode de comparaison entre deux périodes lorsque le volume de données le justifiera.

final result: passed

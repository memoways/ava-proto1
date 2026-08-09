# Design QA — Configuration RAG

## Artifacts

- Source visuelle annotée : `/var/folders/fd/t8wh_hy505x_cb5jp9fg2jdh0000gn/T/codex-clipboard-894ef063-39e3-41ef-8246-07a7fde36ee4.png`
- Capture navigateur de l’implémentation : `/Users/ulrich/CodeProjects/memoways/ava-proto1/design-qa-rag-config-implementation.png`
- Comparaison focalisée côte à côte : `/Users/ulrich/CodeProjects/memoways/ava-proto1/design-qa-rag-config-comparison.png`
- Route de QA locale : `http://localhost:8080/__preview/rag-config`

## Normalisation

- Source : 1820 × 1884 px.
- Viewport navigateur : 1280 × 720 CSS px, `devicePixelRatio = 2`.
- Capture complète : 1265 × 2971 px, normalisée en pixels CSS par le navigateur.
- État comparé : thème sombre desktop, variante `legacy` active, reranking et
  troncature actifs, période `30 jours`, données live représentatives.
- La comparaison focalisée conserve toute la source et recadre l’implémentation
  sur les trois sections annotées, puis aligne les hauteurs. Les différences de
  largeur proviennent du viewport et non d’une rupture de grille.

## Comparaison complète

L’implémentation conserve le langage visuel existant : fond sombre, bordures
fines, accent primaire rouge, cartes métriques et hiérarchie compacte. Les
annotations jaunes ne sont pas reproduites comme contenu ; elles ont été
traduites en contrôles et explications intégrés à l’interface.

## Comparaison focalisée

La comparaison côte à côte confirme les quatre corrections attendues :

- les résultats live montrent une période sélectionnable et des valeurs issues
  de `voice_turn_events`, avec une explication de p50, p95 et de l’état vide ;
- le reranking et la troncature décrivent leur effet lorsqu’ils sont actifs ou
  désactivés ;
- le select opaque des variantes Max devient une grille de quatre choix avec
  maturité, cas d’usage, statut actif et budget RAG ;
- l’activation des réglages passe par un bouton explicite, accessible en haut et
  au bas de la section de récupération.

## Surfaces de fidélité

- Typographie : famille, graisses, tailles, hauteur de ligne et contraste suivent
  les tokens de l’admin existant ; les explications secondaires restent lisibles
  sans concurrencer les valeurs.
- Espacement et rythme : les quatre métriques restent sur une ligne au viewport
  desktop ; les contrôles et cartes de choix suivent une grille cohérente sans
  débordement horizontal.
- Couleurs et tokens : palette AVA existante conservée ; états actif, canary et
  modifications non enregistrées utilisent des couleurs sémantiques distinctes.
- Images et assets : aucune image métier n’est requise ; les icônes utilisent la
  bibliothèque déjà présente dans le projet.
- Contenu : les libellés français répondent directement aux annotations et la
  deadline affichée vient de la constante runtime réelle (3 500 ms).

## Interactions et console

- Filtre de période `7 jours` : sélection réussie.
- Sélection `Optimized v3` : brouillon visible et boutons de sauvegarde activés.
- Désactivation du reranking : troncature correctement désactivée.
- Annulation : retour à `legacy` et disparition de l’alerte de brouillon.
- Enregistrement en mode de prévisualisation : `Optimized v3` devient `ACTIF` et
  le bouton redevient désactivé faute de modification restante.
- Console navigateur : aucune erreur.

## Historique des corrections

Une seule passe visuelle a été nécessaire. Aucun problème P0, P1 ou P2 n’a été
identifié dans la comparaison focalisée ; aucune correction de rattrapage n’a
donc été appliquée après la capture.

## Findings

Aucun écart P0, P1 ou P2 restant. La page est plus longue que la source car les
explications et cartes de choix demandées sont visibles sans interaction cachée ;
cette augmentation est intentionnelle et améliore la décision administrative.

## Implementation Checklist

- [x] Périodes historiques 24 h, 7 jours, 30 jours et tout l’historique.
- [x] Source et sens des métriques explicités.
- [x] Brouillon sans effet runtime avant enregistrement.
- [x] Annulation et enregistrement testés.
- [x] Effet des interrupteurs expliqué et dépendance fonctionnelle vérifiée.
- [x] Variantes Max comparables et accessibles comme groupe radio.
- [x] Aucune erreur console ni débordement horizontal.

## Follow-up Polish

- [P3] Ajouter ultérieurement une comparaison avec la période précédente si le
  volume de tours devient suffisant pour rendre la tendance statistiquement utile.

final result: passed

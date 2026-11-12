# Reprise — étude de faisabilité du rappel sortant de Max

**Statut : préparé le 12 novembre 2026 ; étude non lancée.**

**Modèle conseillé :** un modèle généraliste récent capable de raisonner sur une architecture,
de lire un dépôt et de comparer des documentations techniques, avec un niveau de raisonnement
élevé s'il est proposé. Ce prompt convient à Cursor, Codex ou Claude ; aucun modèle précis
n'est imposé.

## Prompt à copier

Reprendre l'étude du rappel sortant de Max pour Soleure. Lire d'abord
`docs/plan_rappel_sortant_max.md`, `docs/etat_courant.md`, `docs/plan_multilingue_ava.md`, la
tâche Notion liée dans le plan et les instructions `AGENTS.md`. Vérifier l'état courant du
dépôt et la cible Gamilab pour Notion.

Objectif : vérifier la faisabilité d'une file commune web et rappels, puis d'une conversation
complète avec Max par WhatsApp ou téléphone classique, en français, allemand standard ou
anglais. Respecter les décisions d'expérience, les contraintes de forfait, d'itinérance, de
consentement, de confidentialité et la chaîne Lovable / Lovable Cloud documentées dans le plan.
Le plan multilingue prévoit l'anglais pilote en sandbox avant ouverture publique : vérifier
cette dépendance sans supposer qu'il est déjà disponible.

Première action : vérifier les sources et l'état du projet, puis établir les inconnues
techniques et commerciales encore ouvertes. Comparer Twilio et Telnyx avec leurs documentations
et tarifs actuels ; vérifier la compatibilité du flux audio avec WhatsApp et Lovable Cloud,
les numéros et destinations possibles et le coût complet. Distinguer faits vérifiés, hypothèses
et éléments nécessitant une confirmation fournisseur.

Résultat attendu : actualiser le plan avec une architecture argumentée, des scénarios de coût,
les limites et une recommandation explicite sur l'intérêt d'un prototype et ses critères de
réussite. Poser à Ulrich les questions qui changent réellement cette décision. Aucun achat,
souscription, prototype, changement de la base Caractères ou déploiement n'est autorisé par
ce prompt. Si un prochain lot est identifié à la clôture, préparer son prompt autonome et
actualiser le plan conformément aux instructions du dépôt. Distinguer livraison technique
et recette humaine.

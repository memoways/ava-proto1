# Ava — état courant

Mise à jour : 28 octobre 2026. Entrée courte de reprise, historique dans CHANGELOG.

## Priorité produit

Continuer l'amélioration de Max/Emma ; pas de gel de démo accepté. Présent canonique
livré par #104, code vert `9adabdce5b5a4f9be6f6fdc6545868659cb4120a` ; 109 E2E,
[CI 40661278202](https://github.com/memoways/ava-proto1/actions/runs/40661278202).
Le souvenir J−2 de l'hôtel doit rester distinct du présent de l'appartement.
Voix et mains libres acceptées préservées ; la recette F4 demeure humaine et
distincte : [prompt F4](prompt_reprise_present_canonique_lot_f4_recette.md).
Aucune publication production par CT1 ; main fusionné ne vaut pas publication.

## CT1 — contexte et livraison

Les trois décisions ont été approuvées. [Plan et validations](plan_audit_contexte_travail.md),
[ADR CI](adr_ci_complete_sur_pr.md). Campagne complète sur PR/HEAD exact contenant
main ; garde obligatoire, puis arbre/parent fusionnés vérifiés. Aucun second
passage complet sur main. Le SHA réel et le run se lisent sur GitHub et dans le
compte rendu de livraison, sans créer une PR documentaire supplémentaire.
Contexte personnel/skills et branchement git-ship sont des changements locaux
du poste, décrits dans [la livraison CT1](livraison_contexte_travail_ct1.md).

## Démarrer

`git status`, remote, activité des chats, branches/PR, `git fetch --prune`, six
commits de main et début du CHANGELOG ; main propre par pull ff-only. PR étrangère
#24 et branches locales historiques à préserver. Aucun autre agent simultané.
Lire ensuite le plan du seul domaine concerné ; pas tous les historiques.

Lovable Ava `1265958d-b74e-40f2-917d-182fe05163fc`, Memoways `5glbtPltldwz9tgNwIi4` :
seul accès SQL/Cloud et seule chaîne de livraison. Notion Ava : Gamilab natif,
ID `7e1a9a09-09cb-4deb-a306-83a29b831bc2`, vérifier par get-self. Tâche :
https://app.notion.com/p/1c498377edb94cfea4d4bae8728e8c7f.
Personnel : Ulrich `377e8583-7838-4c05-9f76-8833a450f304`, sources Ava exclues.
GitHub natif Unknown tool au dernier test ; repli git/gh autorisé avec Ulrfis.

## Suite préparée

**AP1 livré techniquement ; utilisabilité rejetée par Ulrich.**
Accès admin sandbox : Expérience → Atelier de parole,
`/admin/experience/atelier-de-parole`. A/B temporaire, état explicite par cas,
transport actuel respecté et preuves effectives lisibles ; aucun réglage live.
[Résultat et validations AP1](plan_lot_b_rendu_vocal.md#exécution-ap1--28-octobre-2026).
Lire la PR AP1 et son reçu GitHub/Notion pour les SHA/run finaux ; ce document
est committé avant le squash. Lovable/production restent des étapes distinctes.

**AP2 implémenté : atelier unique et comparaisons persistantes.**
TTS Config ne lance plus d’audio. Dans l’atelier : réplique/état explicite → version
actuelle → un réglage différent → avis nommé et sauvegarde confirmée par relecture.
Emma, fournisseurs et contrôles experts dans les options avancées du même banc.
Documents admin/sandbox `speech_workshop_documents` (hors `ava_` pour conserver
l’isolation RLS), CAS du document et relecture exacte. Charger reste un brouillon,
aucun audio automatique ni activation du jeu. Audio exact uniquement en mémoire.
[Résultat et limites AP2](plan_lot_b_rendu_vocal.md#exécution-ap2--28-octobre-2026).
Livraison GitHub/CI et preview sont vérifiées à la clôture, avec reçu réel dans la
PR et Notion ; ne pas confondre implémentation et publication.

**Suite AP3 préparée, non lancée : première écoute accompagnée Max.**
[Prompt autonome AP3](prompt_reprise_atelier_parole_lot_ap3.md) : 10–15 minutes,
M1/M2, une hypothèse et deux versions. Compréhension et préférence vocales sont
validées par Ulrich ; aucune acceptation humaine revendiquée par les tests AP2.
F4 reste distincte. Aucune publication production implicite.

## AP2 — livraison interrompue, état local conservé

Push refusé avant toute création de PR ; aucune CI AP2, fusion ni nouvelle preview.
Qualité finale locale : 71 régressions, 1 131 unitaires, 42 intégrations et build
verts ; garde 23/23, E2E ciblé simulé vert. Branche AP2, main non modifié.
[Reprise exacte de livraison](prompt_reprise_atelier_parole_lot_ap2_livraison.md).
Décision explicite d’Ulrich : **plus aucun recours au Trousseau macOS**.
[Voie d’accès dédiée préparée, non configurée](plan_authentification_github_sans_trousseau.md).
L’interdiction est dans AGENTS ; ne pas redemander un déverrouillage ou une
reconnexion personnelle. AP3 reste préparé sans lancement.


Accès alternatif préparé dans le même lot : CLI officielle 1Password installée,
seule option CLI activée avec accord, lanceur Ava et broker App sans stockage
personnel, 30 tests de livraison. GitHub App privée approuvée par Ulrich, mais
**création non effectuée** : demande Mobile non reçue/expirée, confirmation
administrateur GitHub avec remplissage 1Password encore attendue. Aucun token
réel installé. Ne pas annoncer une intégration opérationnelle. Scripts partagés
inchangés (leur modification globale a été refusée par la revue automatique).

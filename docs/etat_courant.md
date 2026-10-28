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

## Livraison AP2 et accès dédié

Qualité locale : 71 régressions, 1 131 unitaires, 42 intégrations, lint/typage/build ;
35 tests de livraison, dont session à un seul accès au coffre et jeton App stateless ; E2E ciblé simulé clavier/390 px.
Le reçu PR/HEAD, CI et arbre/parent fusionnés est consigné après livraison dans
la PR et la tâche Gamilab ; ce fichier est committé avant la fusion.
[Procédure de reprise AP2](prompt_reprise_atelier_parole_lot_ap2_livraison.md).

App privée `ava-delivery` créée (5515307) et installée (176291841) sur le seul dépôt
Ava : Contents/PR write, Actions/Metadata read. Clé dans le coffre Privé Fischers,
configuration locale de références non secrètes, jetons en mémoire, aucun repli
personnel. Accès API authentifié vérifié avec un seul dépôt retourné ; copie
PEM temporaire supprimée. Utiliser le lanceur versionné d’AGENTS à chaque reprise.
[Plan d’accès et limites](plan_authentification_github_sans_trousseau.md).
Scripts partagés inchangés ; une clé initiale non récupérée reste côté GitHub,
suppression distincte non effectuée. Aucun accès au Trousseau ni reconnexion
GitHub personnelle. AP3 préparé sans lancement ; aucune publication production.

PR AP2 #111 ouverte ; première CI 40751731709 rouge : seul le parcours AP2 Firefox
échoue après refus de lecture, 111 autres E2E verts. Garde : fusion refusée.
Correction locale : fixture audio déterministe + refus explicite ; trois navigateurs
et Firefox strict verts. Mode session pour éviter les demandes 1Password répétées,
suivi CI à une minute, aucun nouveau paramétrage 1Password. La première demande a expiré, sans relance ; après réponse « prêt » d’Ulrich,
une session réelle a été ouverte, puis traces CI et fetch effectués avec cette
même clé en mémoire. Les traces confirment OnMediaSinkAudioError sur le runner.
Nouveau HEAD/CI/fusion/preview encore à vérifier dans le reçu final.

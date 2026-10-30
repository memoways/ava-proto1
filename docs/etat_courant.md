# Ava — état courant

Mise à jour : 30 octobre 2026. Entrée courte de reprise, historique dans CHANGELOG.

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

**AP3 mené le 29 octobre : parcours compris, réglages bruts refusés.**
Ulrich juge la mécanique claire. En revanche, les réglages bruts Gradium sont
incompréhensibles et les répliques M1/M2 trop courtes, sans contexte. Il demande
des passages de 2 à 3 phrases longues, une émotion choisie dans une liste, la
recette traduite pour chaque fournisseur avec ses paramètres visibles, et une
comparaison côte à côte entre fournisseurs notée de 1 à 5. Aucune écoute ni
comparaison enregistrée.
Analyse : le socle neutre `PerformanceIntent` et ses cinq adaptateurs existent
déjà ; l’atelier exposait la mauvaise couche.
[Retour, analyse et contrat AP4](plan_lot_b_rendu_vocal.md#retour-dulrich-pendant-ap3--29-octobre-2026).

**AP4 implémenté le 30 octobre : atelier par intention de jeu.**
Textes et dix intentions validés par Ulrich. Un texte, une émotion, une carte
par fournisseur côte à côte : recette, paramètres appliqués, leviers ignorés,
une génération par clic, note de 1 à 5 (« off » sous 5), tableau intention ×
fournisseur exportable. Essais dans `speech_workshop_documents` (`intentTrials`),
sans migration ; banc AP2 replié en options avancées. Seul Gradium a la voix
de Max dans `sandbox-ulrich` ; les autres demandent une voix d’atelier.
Aucun son réel généré en développement.
[Exécution AP4](plan_lot_b_rendu_vocal.md#exécution-ap4--30-octobre-2026).

**AP4-bis implémenté le 30 octobre : voix par fournisseur et atelier compact.**
Après l’essai d’Ulrich : Voice ID des 4 personnages × 5 fournisseurs saisis
une seule fois dans Technique → Configuration TTS (`ava_tts_character_voices`),
repris par les réglages des personnages et l’atelier ; la voix du jeu ne suit
que l’ID du fournisseur déjà choisi, à l’enregistrement. « Faire un autre
test » sans changer d’onglet, écran sur 2–3 colonnes. Gradium n’a aucun
réglage d’émotion : la carte le dit, trois options attendent la décision
d’Ulrich. La séance accompagnée de l’ancien AP5 est faite.
[Exécution AP4-bis](plan_lot_b_rendu_vocal.md#exécution-ap4-bis--30-octobre-2026) ·
[Prompt autonome AP5](prompt_reprise_atelier_parole_lot_ap5.md) : comparer les
fournisseurs avec les voix custom de Max, non lancé. Reçu PR/CI/fusion dans la
PR et Notion. F4 reste distincte. Aucune publication production implicite.

**AP4-ter implémenté le 30 octobre : ElevenLabs corrigé, v4 par défaut dans l’atelier.**
Le 400 `unsupported_model` venait très probablement de `optimize_streaming_latency`
(déprécié) et du contexte de phrases, envoyés à v3/v4 ; `proxy-tts` ne les envoie
plus que là où ils sont acceptés, les Turbo dépréciés sont lus comme Flash v2.5,
TTS Config liste les modèles actuels. Défaut expressif de l’atelier : `eleven_v4`
(choix d’Ulrich). Cause non confirmée par logs ni appel réel ; la recette humaine
après déploiement Lovable reste à faire.
[Exécution AP4-ter](plan_lot_b_rendu_vocal.md#exécution-ap4-ter--30-octobre-2026).

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

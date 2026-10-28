# Ava — AP3 : première écoute accompagnée de Max

Exécute uniquement AP3, une recette humaine de 10–15 minutes. Ce prompt préparé
par AP2 ne lance ni écoute, ni conversation, ni publication. Ne pas déduire la
compréhension d’Ulrich ou la crédibilité vocale d’une CI verte.

**AP2 n’est pas encore livré : reprendre d’abord**
[prompt AP2 livraison](prompt_reprise_atelier_parole_lot_ap2_livraison.md). Aucun
accès au Trousseau macOS, aucune demande de déverrouillage/reconnexion personnelle.
Ne démarrer AP3 qu’après livraison et recette technique AP2 vérifiées.

## Première action exécutable

Dans `/Users/ulrich/CodeProjects/memoways/ava-proto1`, lire `git status`, AGENTS.md,
`docs/etat_courant.md`, le début du CHANGELOG, la section AP1–AP6 et le bilan AP2 de
`docs/plan_lot_b_rendu_vocal.md`. Lire le SHA réel, la PR AP2 et son reçu de garde
sur GitHub et dans la tâche Gamilab : ce prompt est committé avant le squash AP2.
Vérifier les chats actifs, remote unique `https://github.com/memoways/ava-proto1`,
branches/PR, `git fetch --prune`, six derniers commits et main propre par pull
ff-only. Un agent, aucun sous-agent, aucun clone/worktree adjacent. Préserver #24,
les branches historiques et `.vexp/` local ; aucun recouvrement avec PR étrangère.
Lire `/Users/ulrich/CodeProjects/_shared/agent-context/12-task-closeout-handoff.md`.

## État et sources

AP2 réunit toutes les auditions dans Expérience → Atelier de parole :
`/admin/experience/atelier-de-parole`. TTS Config garde uniquement les réglages
techniques et un lien vers cet atelier. Réplique/état explicite → version actuelle
→ essai avec un réglage différent → avis et sauvegarde. Emma, autres fournisseurs,
transports A2/WS, corpus, buffer, preuves et mapping live sont repliés dans les
options avancées du même banc/propriétaire audio.

Comparaisons nommées et avis : clé `speech_workshop_documents` dans
`admin_settings`, schéma 1, sandbox stricte, accès admin existant, CAS du document
complet et relecture exacte. Cette clé est volontairement hors `ava_` : les droits
runtime/invitation peuvent lire les clés préfixées. Ne pas la renommer en `ava_*`.
Absence, indisponibilité, conflit, format inconnu et défaut de relecture restent
distincts. Aucun enregistrement dans la clé du mapping live. Charger prépare un
brouillon, jamais un audio ou une activation. Preuves filtrées, avis humains séparés,
coût inconnu ; aucune conservation du son exact après fermeture. Cache mémoire
16 écoutes/16 Mio, capture WS 30 s. Export texte et JSON dans chaque comparaison.

Sources : [plan courant](plan_lot_b_rendu_vocal.md), [contrat CI](adr_ci_complete_sur_pr.md),
[tâche existante](https://app.notion.com/p/f3944bc8e9ce48138f2b309db223035d).
Notion Ava **Gamilab natif**, get-self attendu
`7e1a9a09-09cb-4deb-a306-83a29b831bc2`. Aucun workspace personnel ni navigateur
Notion. Rapport éditorial `40462322e59580ca98a4d6148d8ce406` seulement si nécessaire ;
Max actif `ef4cfaa6-70e3-4e87-9b9e-079815fd0cd9`, Emma active
`dfcc15f8-9d37-45f7-8c84-d0c24a4288cf`. Gami DigiDouble exclu ; aucun animal affiché.
Lovable Ava `1265958d-b74e-40f2-917d-182fe05163fc`, Memoways
`5glbtPltldwz9tgNwIi4` : seule chaîne Cloud/build/preview/publication. SQL uniquement
par MCP Lovable ; aucun connecteur Supabase générique. GitHub natif prioritaire,
repli git/gh autorisé si Unknown tool, identité existante/remote vérifiés sans login.

## Périmètre de la séance

1. Vérifier la preview authentifiée synchronisée et la sandbox choisie. Demander
   à Ulrich d’identifier sa première action et la différence proposée ; noter
   ses incompréhensions sans annoncer une acceptation à sa place. Pas de JSON
   nécessaire pour effectuer la comparaison.
2. Max seulement, M1 puis M2, état de sa propre fiche choisi par Ulrich pour chaque
   cas. Une hypothèse et deux versions maximum : même texte, état, voix, rugosité
   et transport. Vérifier les références enregistrées et leurs différences
   éventuelles. Commencer au transport actuel ; ne pas activer WS dans le jeu.
3. Les écoutes réelles sont des actions humaines explicites, une par clic.
   Aucun lancement en série ni génération/conversation autonome. Observer mots /
   pensée, pauses / rythme, affect / timbre et clics / hoquets, sans juge LLM ni
   conclusion artistique inventée. Un repli REST ne valide pas les pauses WS.
4. Nommer, enregistrer l’hypothèse, les avis et la décision humaine, puis recharger
   la comparaison après fermeture. Vérifier l’export lisible et la provenance.
   « Essai préféré » reste un avis, jamais une application au jeu.
5. Finir par une référence à conserver pour AP4 et le prochain défaut observable.
   En l’absence d’avis humain, marquer la recette ouverte et conserver une reprise
   exacte ; ne pas inventer une préférence pour avancer.

Invariants : aucun changement de fiche Notion, prompt GM, modèle/température de
jeu, voix, mapping live, budget, capture/STT, interruptions/mains libres ou transfert.
Mots/faits, présent de l’appartement et souvenir J−2 préservés. Aucun tic ou cycle
imposé à Max ; tags Gradium fermés. Aucun passage automatique à AP4/AP5/Emma.
Aucune publication production implicite.

## Validation et livraison

AP3 est d’abord une recette humaine ; ne pas refaire une campagne complète pour
des notes documentaires. Si une correction de code est indispensable, la cadrer
dans le plan existant : qualité/delivery locales, lot complet committé avant push,
une campagne PR/HEAD exact contenant main à jour, run et regression-gates success,
fusion exclusivement par `node .github/scripts/ship-pr.mjs --pr NUMERO --head SHA_COMPLET --merge`,
arbre/parent du squash vérifiés, notre seule branche nettoyée, Lovable synchronisé.
Aucune seconde campagne complète sur main. Aucune publication sans autorisation
distincte. Mesurer CT2 si un lot de code est exécuté.

Actualiser le plan existant avec bilan humain, preuves, limites et états
local/GitHub/preview/production. Relire la tâche Gamilab avant édition, préserver
Source et historique, indiquer Last updated by : Codex puis relire chaque écriture.
Si l’accès est indisponible, annoncer les éléments non sauvegardés sans navigateur.

**À cette clôture, enregistrer dans le même tour le prompt autonome AP4** dans
`docs/prompt_reprise_atelier_parole_lot_ap4.md`, avec état vérifié, sources,
périmètre, invariants, validations, livraison, première action exécutable et cette
même obligation de prompt suivant. Fournir son lien direct dans le bilan, sans
attendre une nouvelle demande ; sa préparation ne lance pas AP4. Si AP3 reste
incomplet, enregistrer plutôt la reprise exacte, les contrôles faits et l’unique
action humaine indispensable. La clôture indique PR/SHA/CI/arbre/parent lorsqu’ils
sont concernés, branches restantes et production non publiée.

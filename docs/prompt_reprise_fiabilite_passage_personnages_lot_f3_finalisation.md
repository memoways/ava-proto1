# Finaliser uniquement F3 — continuité vocale, recette et publication distincte

## Première action et périmètre

Travaille dans /Users/ulrich/CodeProjects/memoways/ava-proto1, remote unique
https://github.com/memoways/ava-proto1. Première action exécutable :
`git fetch --prune`, `git status`, `git log origin/main -8 --oneline`, puis
`gh pr list --repo memoways/ava-proto1`. Lire AGENTS.md, CHANGELOG.md, STORY.md,
le plan `docs/plan_changement_interlocuteur_manuel.md`, le protocole
`docs/recette_humaine_ava_f3.md` et le contrat partagé
`/Users/ulrich/CodeProjects/_shared/agent-context/12-task-closeout-handoff.md`.

Un agent actif, checkout canonique seul ; aucun clone/worktree adjacent, aucun
prochain lot/chat automatique. Préserver la PR #24 et les branches historiques.
Mettre main à jour par fast-forward s’il est propre avant toute écriture.
Le présent prompt poursuit F3 ; il ne demande pas de recommencer les corrections
ou une campagne de tests. La priorité d’Ulrich est une présentation rapidement
utilisable avec voix continues, timbre cohérent, personnages dans leur rôle.

## Livraison technique vérifiée

[PR #98](https://github.com/memoways/ava-proto1/pull/98) fusionnée le 27 octobre
2026 à 11:50:42 Paris dans main **0170ac5e5d324b08c8a154a2aa393c2e4ead7c42**.
[CI PR 40488269434](https://github.com/memoways/ava-proto1/actions/runs/40488269434)
verte sur HEAD exact **941bd50d36754c24fbec4284319c7a54c94c440b** : 1 072
unitaires, 42 intégrations, 71 régressions, lint/typage/build, **109 E2E sans retry**.
[CI main 40491618695](https://github.com/memoways/ava-proto1/actions/runs/40491618695)
en cours sur 0170ac5 ; lire le plan pour son résultat final.
La clôture documentaire peut avancer main sans changer le code : lire le SHA réel.

Lovable Ava au même SHA 0170ac5, ready, agentFinished=true. Les cinq fichiers de
code modifiés ont été relus au ref natif et comparés octet par octet identiques :
ConversationScreen, IndexPRD4, characterConversation, handoffCoordinator,
prd4Orchestrator. Branche de code codex/ava-f3-voice-restore supprimée localement
et à distance après comparaison des arbres. Clôture documentaire seule sur
codex/ava-f3-input-continuity, à fusionner/nettoyer si encore présente.
Invitations Claude #95 et correctifs Lovable présents dans le main de départ
97f3a79 sont conservés. Ne restaurer aucune ancienne révision complète du dépôt.

Premier passage CI 40484077097 rouge sur 83ca585 : qualité verte, 104/109 E2E.
Deux annonces pronominales avaient été trop resserrées (« je vais l’appeler »,
« je vais aller le chercher »), trois assertions attendaient encore la pastille.
Ces cinq cas ont été corrigés, rejoués verts sans retry (56,4 s), puis les 109 E2E
complets ont passé sur le nouveau HEAD ci-dessus. Les preuves rouges sont
conservées dans le plan ; ne pas les confondre avec l’état final vert de la PR.
137 tests locaux ciblés verts ; aucune nouvelle campagne complète locale ajoutée.

## Restauration Cloud effective — sandbox seulement

Cible confirmée par Ulrich : PREVIEW Lovable, Sandbox Ulrich. Projet
1265958d-b74e-40f2-917d-182fe05163fc, workspace Memoways
5glbtPltldwz9tgNwIi4. Seul MCP natif Lovable pour SQL/Cloud ; aucun Supabase
générique, autre hébergeur ou chaîne de livraison. Relectures exactes confirmées :

- Max : Gradium / b5ioHAR7JuHVLskk, référence prod ; auparavant Fish /
  4f9c9d8df44847049a8a281f1fdf52dd depuis le 26 octobre 16:34 UTC.
- Emma inchangée : Gradium / JReEQbhiZbfpeMYy.
- ava_gameplay_settings : VOICE_INCREMENTAL_OUTPUT=false,
  VOICE_HANDS_FREE.bargeInEnabled=false, interruptionStrategy=acoustic_confirmed,
  endOfSpeechMs=2 000, hesitationExtraMs=700, mains libres enabled=true.
  Autres champs conservés. Ces valeurs finales ont été acceptées humainement.
- ava_tts_settings_gradium.streamingEnabled=false ; autres champs conservés.

Production, autres profils, mapping expressif, fiches Notion et orchestration
publiée v7 restent inchangés. Comparaison canonique avant/après et nouvelle
relecture après fusion : seuls les champs annoncés ont changé. La première restauration utilisait encore
text/900 ms ; Ulrich a alors révélé des entrées coupées en parlant sans pause.
Ce repli text retirait aussi le détecteur qui garde flush pendant une voix active.
Le retour acoustic_confirmed avec bargeIn=false rétablit cette garde sans
interrompre Max ; 2 000 ms rétablit le tempo historique de Deepgram automatique.
Retour arrière éventuel limité aux anciennes valeurs ci-dessus : incremental /
bargeIn / streaming=true, strategy=acoustic_confirmed, Max Fish ; ne pas le faire
sans nouveau diagnostic. Ne pas modifier les anciennes sessions pour forcer un test.

**Conserver les passages entre personnages** : correction explicite d’Ulrich
après la proposition de les désactiver, non appliquée. Les messages techniques et
pastilles animées sont retirés ; les actions texte Appeler/Rester, le GM,
consentement, reçu complet, CAS et clic restent actifs, ainsi que la grille.
Une demande du joueur ne remplace plus une réponse narrative normale. Seule une
annonce réelle de transfert ou un accord bref à une demande ouverte prépare
l’opération. Les verbes ordinaires et mentions de tiers ne doivent pas changer
la parole ni son état. Aucun nouvel algorithme audio ou seuil de confiance.

## Preuves humaines et prochaine action

Recette Cineforom refusée : session 4e018bd3-71d8-4967-b4fb-2d5d72c1da48,
27 octobre 10:33:53 Paris, phrases hachées et voix variables chez Max puis Emma.
Deux tours Max completed, puis Max interrupted/cancelled et Emma
interrupted/interrupted/cancelled. Passage par grille, handoff_count=0 : le
libellé admin « 1 changement » ne prouve pas un transfert GM. Cause acoustique
exacte non démontrée. Session suivante 4b0112b8-5904-4d8f-89fe-7f821818b4c0 à
10:41 conserve les anciens flags épinglés. Ulrich décrit ensuite des voix plutôt
stables, mais rejette le changement de ton après mention d’Ava/Emma : aucune
acceptation F3 déduite. Les essais PTT précédents et leurs limites sont dans le
protocole ; ne pas les compter comme deux recettes complètes.

Nouvelle validation effective après réglage : session
373833d0-4ed0-4613-9a6c-b33c3c9460b6 à 12:03:29 Paris, flags finaux relus
exactement. Ulrich confirme : « oui maintenant il n’y a plus de coupures, donc
implémenter ça ! ». Le réglage est déjà sauvegardé en base et conservé. Aucun
nouveau contrôleur ni code à implémenter, aucun test long à rejouer. Cette
acceptation de la continuité d’entrée ne vaut ni matrice F3 complète ni publication.

La preview corrigée a été remise à Ulrich après fusion. Demande humaine historique déjà
émise : recharger puis « Commencer » une NOUVELLE expérience, parler à Max en
mentionnant Ava/Emma, puis rejoindre Emma ; vérifier timbre, phrases entières,
absence de messages techniques, et un passage accepté. Lire la validation ci-dessus avant de redemander cet essai. Ne pas reprendre une ancienne expérience : les
flags vocaux sont épinglés. La CI ne prouve ni le son physique ni son acceptation.

Preview :
https://id-preview--1265958d-b74e-40f2-917d-182fe05163fc.lovable.app/?env=sandbox-ulrich
Priorité immédiate acceptée sur les coupures d’entrée ; conserver ce réglage pour la présentation. Compléter
PTT et mains libres dans deux nouvelles expériences selon le protocole, en
conservant bargeIn=false, incremental=false et la garde acoustic_confirmed /
2 000 ms validée. Ne pas modifier seuils/fiches pour forcer un passage.
Préserver contexte commun, souvenirs privés, budget/timer sur grille, nouvel ID
et accueil par appel. Aucun transcript complet à sauvegarder.

## Clôture attendue

Lire d’abord les réponses arrivées depuis ce prompt. Vérifier CI main, état
GitHub et Lovable réels, finir uniquement la documentation/nettoyage propres à
F3 si nécessaire. Aucune correction spéculative, réécriture de fin de parole ou nouveau lot automatique.
Une correction réellement requise suit le contrat et des contrôles ciblés ; les
lots purement Markdown utilisent l’exception CI documentaire, code inchangé et
sa dernière CI verte citée. Ne pas laisser de branche ou PR propre ouverte.

Notion natif Gamilab obligatoire : vérifier get-self workspace
7e1a9a09-09cb-4deb-a306-83a29b831bc2. Relire puis actualiser la tâche existante
https://app.notion.com/p/1c498377edb94cfea4d4bae8728e8c7f et si pertinent
l’application https://app.notion.com/p/97462322e595822ca21601814e915159.
Conserver Source, Last updated by=Codex, vérifier chaque écriture. Pas de
workspace personnel, de navigateur de repli ou de Gami DigiDouble.

**Aucune publication production effectuée ou autorisée.** Attendre acceptation
humaine ET autorisation explicite distincte de publier. Avant publication via
Lovable seulement, vérifier la version servie et le retour arrière possible.
Ne pas propager les réglages sandbox vers prod implicitement.

À chaque clôture complète ou partielle : actualiser plan, preuves, CHANGELOG,
STORY, Notion ; distinguer local/GitHub/preview/production, donner SHA/CI et
branches restantes vérifiées. Fournir dans le même tour avec lien un prompt
autonome de finalisation ou du prochain lot, contenant cette même obligation.
Ne jamais le lancer automatiquement. Si aucun lot ne suit, le dire explicitement.

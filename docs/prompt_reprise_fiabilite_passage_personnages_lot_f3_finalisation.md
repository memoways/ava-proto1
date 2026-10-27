# Finaliser uniquement F3 — restauration vocale et recette humaine

Projet : /Users/ulrich/CodeProjects/memoways/ava-proto1 ; remote unique
https://github.com/memoways/ava-proto1. Lire AGENTS.md, CHANGELOG.md,
STORY.md, docs/plan_changement_interlocuteur_manuel.md,
docs/recette_humaine_ava_f3.md et le contrat partagé
/Users/ulrich/CodeProjects/_shared/agent-context/12-task-closeout-handoff.md.

Première action exécutable : git fetch --prune, git status, git log origin/main -8
--oneline, gh pr list --repo memoways/ava-proto1. Vérifier qu’aucun autre agent
n’est actif, préserver PR #24 et toutes les branches étrangères. Ne créer aucun
clone/worktree adjacent, aucun autre lot ni chat automatique. Mettre main à jour
par fast-forward uniquement s’il est propre.

Demande prioritaire d’Ulrich du 27 octobre : restaurer rapidement la continuité et
le timbre des voix pour la présentation, sans nouvelles expériences techniques
ni longue campagne de tests locaux. Cible explicitement confirmée : PREVIEW
Lovable / Sandbox Ulrich. Conserver les passages Max ↔ Emma, leur consentement,
le GM, le reçu complet et le clic ; conserver le changement par la grille.
Retirer les messages techniques et les pastilles animées. Le personnage ne doit
jamais expliquer les mécanismes du GM. Ne pas désactiver les passages : Ulrich
l’a explicitement corrigé après la proposition de désactivation, non appliquée.

Point de départ : main 97f3a79b3ec1ec14e21e9d844515a9da67518bc0 ; correctifs
F3 #93/e38b189 puis #94/ea650f8 déjà fusionnés. Invitations Claude #95, #96,
#97 et correctifs Lovable intégrés, à préserver. Dernière CI main complète
verte de ce point de départ : 40477874691 sur aafafa7ca479c4b048974f359682a16867519886.
Ne pas restaurer tout le dépôt à une ancienne version. Lire le plan et GitHub
pour le SHA réellement livré depuis : ce prompt est commité AVANT la CI du
correctif urgent, branche codex/ava-f3-voice-restore.

Retour Cineforom : session 4e018bd3-71d8-4967-b4fb-2d5d72c1da48,
27 octobre 10:33:53 Paris. 12 entrées ; deux tours Max completed, puis
Max interrupted/cancelled et Emma interrupted/interrupted/cancelled.
Navigation Max → grille → Emma, compteur handoff_count=0 : le libellé admin
« 1 changement » n’est pas une preuve de transfert GM. Ulrich entend des phrases
hachées et variations de voix. Une session suivante 4b0112b8-5904-4d8f-89fe-7f821818b4c0
à 10:41:53 conserve encore les anciens flags épinglés. Ses captures montrent un
message après mention d’Ava/Emma. Ulrich trouve ensuite les voix plutôt stables,
mais rejette le changement de ton lié au mécanisme ; ce n’est pas une acceptation F3.

Restauration Cloud déjà EFFECTUÉE et RELUE via MCP Lovable natif, sandbox seule :
- Max : gradium / b5ioHAR7JuHVLskk, la référence actuelle prod ; auparavant
  fish / 4f9c9d8df44847049a8a281f1fdf52dd depuis le 26 octobre 16:34 UTC.
- Emma inchangée : gradium / JReEQbhiZbfpeMYy.
- ava_gameplay_settings : VOICE_INCREMENTAL_OUTPUT=false,
  VOICE_HANDS_FREE.bargeInEnabled=false, interruptionStrategy=text ;
  mains libres enabled=true, délais et tous les autres champs conservés.
- ava_tts_settings_gradium.streamingEnabled=false ; autres champs inchangés.
Comparaison exacte avant/après : seulement ces quatre réglages et le fournisseur /
la voix Max ; production et tous les autres profils identiques. Aucun changement
éditorial, mapping, orchestration publiée, secret, migration ou production.
Retour arrière éventuel : rétablir les seules valeurs précédentes true / true /
acoustic_confirmed / streamingEnabled=true et Max Fish cité ci-dessus ; ne pas
l’appliquer sans nouveau diagnostic. Ne pas restaurer une session historique.

Cause corrigée dans le lot urgent : handoffRequested imposait une préparation
et remplaçait même une réponse normale à la demande du joueur. Le détecteur de
sortie associait pass*/appel* et n’importe quel pronom/nom, y compris une phrase
sans transfert. La garde porte maintenant sur une annonce réelle du locuteur,
ou un accord bref à une demande ouverte ; la demande seule ne remplace plus
la réponse. La mention qu’Ava veut parler à quelqu’un n’est pas une demande du
joueur. Préserver la parole et son état d’origine ; aucune nouvelle modulation
vocale ni filtre éditorial. Interface sans bloc technique ni pastille animée,
actions texte Appeler/Rester conservées et accessibles.

Livraison à achever/vérifier : tous changements et preuves avant premier push,
puis PR, CI verte sur son HEAD exact, squash main, CI main verte, branche propre
supprimée. Ne modifier aucun fichier de code pendant cette CI. Les contrôles
ciblés, résultats définitifs et identifiants sont dans le plan ; ne pas transformer
une preuve locale en preuve preview. Une correction documentaire seule utilise
l’exception CI Markdown, avec dernière CI code citée.

Lovable : projet 1265958d-b74e-40f2-917d-182fe05163fc, workspace Memoways
5glbtPltldwz9tgNwIi4. Seul connecteur natif pour SQL/Cloud ; pas de Supabase
générique. Vérifier ready, SHA main et fichier corrigé réellement synchronisé.
Preview : https://id-preview--1265958d-b74e-40f2-917d-182fe05163fc.lovable.app/?env=sandbox-ulrich&diagnostic=full
Après synchronisation, une seule action humaine : recharger, Commencer une
NOUVELLE expérience, écouter Max puis Emma. Une reprise conserve les anciens
flags épinglés. Vérifier les métadonnées de la nouvelle session, ne pas attribuer
à cette restauration une écoute ayant eu lieu avant elle.

Recette prioritaire : Max garde le même timbre et sa parole entière avant/après
mention d’Ava/Emma ; aucune alerte technique ; la demande directe précoce peut
rester réservée, sans réplique GM ni confiance inventée. Préserver ensuite un
passage accepté Max ↔ Emma et le retour par grille, souvenirs isolés et accueils.
Recette complète PTT puis mains libres selon protocole seulement lorsque la
continuité urgente est jugée acceptable. Les essais antérieurs partiels ne
valident ni les deux modalités ni une acceptation générale. Garder les résultats
humains négatifs et inconnus visibles. Aucun transcript complet à sauvegarder.

Notion : connexion native Gamilab, vérifier get-self workspace
7e1a9a09-09cb-4deb-a306-83a29b831bc2. Relire puis actualiser la tâche existante
https://app.notion.com/p/1c498377edb94cfea4d4bae8728e8c7f ; application
https://app.notion.com/p/97462322e595822ca21601814e915159. Conserver Source,
Last updated by=Codex, vérifier chaque écriture ; pas de workspace personnel ni
navigateur de repli, Gami DigiDouble exclu.

Publication production : seulement APRÈS acceptation humaine ET autorisation
explicite distincte. Aucune publication effectuée dans cette restauration.
À la clôture complète ou partielle : actualiser preuves, plan, CHANGELOG, STORY,
Notion ; fournir SHA main/CI, état GitHub/preview/production et branches restantes.
Livrer dans le même tour un prompt autonome de finalisation ou du prochain lot,
avec lien direct et cette même obligation, sans le lancer automatiquement.

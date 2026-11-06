# Fluidité du passage Max → Emma

Date : 6 novembre 2026. Demande d'Ulrich : « à quasiment tous les passages entre Max et Emma il y a eu
des blocages ; Max se répète, redemande ce qu'on veut lui dire, se brusque. Dès que Max accepte, il faut
basculer tout de suite. Une friction est normale si le joueur ne dit pas pourquoi ; une fois qu'il l'a dit,
plus de blocage. »

## Diagnostic sur les sessions réelles (lecture seule, Lovable Cloud)

Sessions du 31 octobre au 4 novembre avec passage Max → Emma (`sessions.conversation_log`,
`gm_post_turn_log`, `experience_events` de type `handoff_*`). 18 passages exécutés, **31 blocages**
(`handoff_blocked`) dans 13 sessions, dont 20 `assessment_missing` et 5 `character_deferred`.
Dernières sessions relues en détail : `6b438965`, `bb1e433e`, `5e8c0d40`, `ac9fd074`, `26d5a06a`,
`0519c59f`, `68b5141f`, `a82a3588`, `70b1b56f`, `bc1e8845`.

Ce que le joueur entendait : il demande Emma en expliquant pourquoi (« juste savoir comment elle va »),
Max répond « De quoi veux-tu lui parler, au juste ? » ou « Attends. Qu'est-ce que tu voudrais lui dire ? »,
le joueur réexplique, la même question revient, parfois « Je vais lui demander si elle accepte de te
parler », puis le joueur insiste plusieurs fois. Dans `6b438965` le joueur abandonne et appelle Emma
directement par la grille.

Causes établies :

1. **Phrases figées dans le code.** Ces deux questions ne viennent pas du LLM : ce sont les lignes de
   « pause de transfert » de `characterConversationContinuity.ts`. Quand Max (le LLM) annonce le passage
   (« Je te la passe »), sa réplique est retenue le temps que le GM prouve le consentement ; si la preuve
   échoue, **toute la réplique de Max est remplacée** par cette question, même si le joueur a déjà donné
   sa raison. D'où la répétition identique d'une session à l'autre et l'impression que Max « se brusque ».
2. **Demande coupée en fragments STT.** La reconnaissance vocale découpe « Est-ce que tu peux me la » /
   « passer, … ». Chaque fragment est un message ; la preuve n'utilisait que le **dernier** fragment, sans le
   nom d'Emma, et Max dit « je te la passe » sans la nommer → `request_unresolved` → preuve abandonnée
   (`assessment_missing`), alors que le GM notait « Max accepte » (12 rejets `request_unresolved`).
3. **Référence de consentement mal formée** (`consent_reference_invalid`, ex. `"currentUserMessage"`) :
   même abandon (7 rejets).
4. **Demandes non détectées** : « si tu peux me passer Emma », « échanger avec Emma », « je pourrais lui
   parler à Emma » n'ouvraient pas de demande, donc une confirmation ultérieure (« volontiers, passe-la
   moi ») ne pouvait plus s'y rattacher.
5. **Max diffère** : « Je vais lui demander si elle accepte de te parler » est (à juste titre) classé
   « différé » ; rien ne bascule et le joueur doit redemander.

## Correction

- `playerUtteranceSinceLastReply` (characterConversation) : la demande du joueur = ses messages consécutifs
  depuis la dernière réplique du personnage, bornée à 2000 caractères. Utilisée partout où la preuve lit
  la demande : ouverture de la demande, contexte du GM (`currentUserMessage`), matérialisation, validation,
  validation à la livraison, finalisation et restauration après rechargement.
- Détection élargie des demandes (me passer Emma, échanger avec, je serais curieux de…), sans ouvrir de
  demande pour « tu as pu parler avec Emma ? » ni pour un refus.
- `recoverHandoffAssessment` (handoffCoordinator) : si la preuve du GM est absente ou rejetée, une preuve
  déterministe est construite **seulement si** le joueur a demandé la cible (tour courant ou demande ouverte)
  **et** une phrase délivrée du personnage est une annonce explicite de transfert. Le GM garde son veto
  (object, defer, refusal), la validation complète repasse avec ses vetos sur toute la réplique (« je vais
  lui demander si elle accepte » reste différé), puis gardes du directeur (seuil, quota, disponibilité) et
  clic du joueur inchangés. Trace : `validation_issues` `handoff_proof_recovered` avec la raison d'origine.
- `withheldHandoffReply` (characterConversationContinuity) : la question « De quoi veux-tu lui parler ? »
  n'est posée **qu'une fois par appel, et seulement si le joueur n'a donné aucune raison**. Sinon le
  personnage garde ses propres mots sans la promesse de transfert, ou une courte attente (« Attends. Une
  seconde. ») — jamais la même question.
- Consigne de passage (`CHARACTER_CALL_TRANSFER_INSTRUCTIONS`) : accepter, c'est passer l'appel tout de
  suite, sans aller d'abord demander son accord à l'autre ; si le joueur a dit pourquoi, ne pas le lui
  redemander. Réécrite à longueur inférieure (budget du noyau compact).
- `GM_CODE_VERSION` → `gm-2026-11-06-handoff-recovery`.

Inchangé : fiches Notion (lecture seule), réglages Cloud, modèle, seuil `minimumHandoffTurn` (4), clic du
joueur, mémoires privées séparées, sonneries et mains libres, aucune migration ni Edge Function.

## Vérification

Tests construits sur les répliques réelles : `src/services/handoffFluidity.test.ts` (fragments,
détection, preuve déterministe et vetos, restauration, pas de question répétée) et
`src/agents/gameMasterPRD4.handoffRecovery.test.ts` (référence invalide ou preuve omise → passage ;
report du GM respecté ; aucune demande inventée). Qualité locale et CI complète sur la PR.

Recette humaine (Ulrich) : appeler Max, demander Emma en disant pourquoi, en plusieurs phrases ; attendu :
Max accepte en une réplique, le bouton de passage devient disponible, aucune question répétée. Variante sans
raison : une seule question de Max, puis passage à la réponse. Une simulation ne prouve pas le ressenti.

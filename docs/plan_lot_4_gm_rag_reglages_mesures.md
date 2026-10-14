# Reprise — lot 4 / P3 : GM, RAG, prompts et buffers comparés

Date : 14 octobre 2026. Statut : **implémentation P3 locale vérifiée ; livraison GitHub/Lovable à clôturer**.
Ce document conserve le prompt complet, le diagnostic, les décisions P3 et les
preuves de clôture. La livraison reste exclusivement Lovable/Lovable Cloud.

## Point de reprise vérifié

- Dépôt : `memoways/ava-proto1` ; workspace
  `/Users/ulrich/CodeProjects/memoways/ava-proto1` ; branche `main` propre.
- Référence au moment de la préparation :
  `77db4638864279f6928017f07dc998456bdea606`, descendant de la clôture P2
  `5938d12eac954501e44182ec92c0aa06974c7c00`. Le commit de ce document ou
  un descendant devient la référence documentaire à réactualiser.
- Dernier code P2 : `0daa7e315f5f1ef81d5c9a7735b914e121065312`,
  PR #38/#39/#40 fusionnées par squash, deux revues finales par PR.
  CI de clôture P2 [38541267390](https://github.com/memoways/ava-proto1/actions/runs/38541267390)
  success : 569 unitaires, 34 intégrations, 46 régressions, 45 E2E.
- Commit Lovable ultérieur `77db463`, intitulé « Corrigé l'erreur 404 Tavus »,
  conservé : diff depuis `5938d12` limité à `.lovable/mcp/manifest.json`.
  Son intitulé n'est pas une preuve d'un test Tavus. CI
  [38550730765](https://github.com/memoways/ava-proto1/actions/runs/38550730765)
  success ; MCP Lovable constate le même SHA, projet ready, agentFinished=true.
- Publication P2 native depuis `0daa7e3`, déploiement
  `cefe6424-cc0e-4215-bf0e-e6eaa36e4c5f`. Site publié vérifié par la voix
  réelle d'Ulrich, session Max `bd6dc87e-328a-4d61-b3a7-e6ea6d184e79` :
  réponse complète, voix habituelle, micro actif ; reçu V4 completed,
  211 caractères générés/livrés, 0 incertain, mémoire isolée. Appel clôturé.
  Aucun SHA du bundle servi ni numéro Edge exact indépendamment attesté.
- Preview Max/Emma : réponses complètes avec voix habituelles ; interruption
  Max puis nouvelle réponse sans replay ; micro-off laisse finir la sortie
  et le bouton reste réactivable. Les sessions sont clôturées.
- Canary uniquement `sandbox-ulrich` : mains libres, sortie progressive,
  `acoustic_confirmed`, voix seule ; silence 900 ms, hésitation 700 ms,
  seuil texte 3 mots. Preset épinglé dans V4. Production conserve le batch
  et les flags P2 désactivés par défaut. Aucun pilote statistique acquis.

## Réserves et limites héritées

- Deux GM P1 ont atteint le délai existant de 12000 ms : preview Max,
  session `3f2ded7a-fc05-4ae6-a66a-575f99402f8c`, tour 4, requête GM
  `b412ebbb-8093-4ea9-b038-3bd53bbdc75b` ; publié Max, session
  `1e5a72b5-5aa2-4263-bba0-db55ddf7f616`, tour 1, requête GM
  `66884b15-d4c3-4819-aedc-70ebdc7f9ba2`. Spans gm_generation failed
  de 12005/12002 ms, persistance réussie ; cause upstream non démontrée.
  Le statut completed d'un événement parent ne transforme pas ce span
  failed en réussite. Tests timeout/annulation vérifient absence de delta
  mémoire et d'action autorisée. Ne pas effacer la réserve par un tuning.
- P2 : bruit bref déclaré fluide par Ulrich, mais rejet acoustique réel non
  observé dans cet essai. Pause/reprise et rejet couverts automatiquement ;
  aucune preuve humaine spécifique de rejet ni mesure matérielle d'arrêt.
  Un cas d'interruption mesuré logiciellement ne donne pas de percentile.
- Pilote 300 tours / 10 sessions et activation générale non réalisés.
  Conserver le protocole P2 ; ne pas fabriquer de corpus ni de résultat.
- P0 : transfert accepté non observé dans la dernière recette GM, écart
  éditorial Emma retrouvé sans cause technique démontrée, prompt exact
  post-vidéo non attesté. Ne pas relancer P0 par défaut.

La demande de préparer ce prochain lot autorise sa reprise en canary après
préflight borné, sans déclarer ces réserves levées. Une violation démontrée
d'un invariant bloque la variante concernée ; une cause inconnue n'est ni
un succès ni une raison de refaire toute la recette historique.

## Prompt complet à coller dans le prochain chat

Mets en œuvre uniquement le lot 4/P3 d'Ava Proto 1 : GM en arrière-plan sûr,
lectures de contexte dédupliquées, RAG et prompts comparés, prébuffer vocal
mesuré. Le but est de réduire les attentes réellement critiques sans réduire
le rappel, le canon, la confidentialité, la continuité vocale ou la mémoire.
Ne refais pas P0/P1/P2 et ne lance pas un chantier avatar ou éditorial.
Commence par un préflight ciblé des réserves GM et de la couverture des
mesures, puis complète ce plan avant toute implémentation.

Dépôt : memoways/ava-proto1.
Workspace : /Users/ulrich/CodeProjects/memoways/ava-proto1.
Référence : main, 77db4638864279f6928017f07dc998456bdea606 ou descendant
contenant ce prompt. Dernier code P2 : 0daa7e3, PR #38/#39/#40 ; clôture
documentaire 5938d12. Vérifie l'état actuel, les nouveaux commits et les
modifications locales ; conserve les travaux non liés et le manifest MCP.

### Sources obligatoires et cibles

Lis AGENTS.md, CHANGELOG.md, STORY.md, puis :
- docs/plan_lot_4_gm_rag_reglages_mesures.md : ce prompt complet ;
- docs/plan_optimisation_latence_voice_to_voice.md : section 4, gates et rollout ;
- docs/plan_lot_3_ecoute_libre_interruptions.md : bilan final, réserves et pilote ;
- docs/plan_lot_2_memoire_streaming_coherent.md : contrat P1 et reçus ;
- docs/plan_lot_1_observabilite_latence.md : couverture et limites des mesures ;
- docs/plan_changement_interlocuteur_manuel.md : clarification prioritaire ;
- docs/plan_mcp_statistiques.md : accès Cloud et régression de schéma corrigée.
Le dernier bilan prévaut sur les états intermédiaires historiques.

Lovable/Lovable Cloud est l'unique compilation et livraison : projet
1265958d-b74e-40f2-917d-182fe05163fc, workspace Memoways
5glbtPltldwz9tgNwIi4, Cloud iralfqlslqndgvexixis,
site https://proto1.parle-a-ava.com. Vérifie ces cibles depuis le connecteur
natif avant toute action Cloud/build/publication. Aucun hébergeur, Supabase
ou déploiement externe. Réutilise l'identité GitHub existante ; un refus
sandbox/trousseau ne justifie pas de remplacer des identifiants.

Accès aux statistiques : connecteur **MCP app Ava**, serveur ava-prototype-1,
endpoint https://iralfqlslqndgvexixis.supabase.co/functions/v1/mcp, OAuth admin.
Teste list_sessions, get_usage_overview, get_voice_latencies, get_llm_costs.
Filtre sandbox-ulrich quand le contrat le permet ; coûts globaux sans filtre
d'environnement. Utilise les arguments réellement exposés par les outils.
Pour une projection technique absente de ces outils, MCP Lovable
query_database sur ce même projet/Cloud, avec SELECT ciblé et métadonnées
minimales. Ne lis pas automatiquement dialogue ou intentions privées pour
diagnostiquer une latence. Le connecteur Supabase générique n'est pas le
point d'accès à ce Cloud ; son refus ne justifie pas une reconnexion Ava.
Si le connecteur adapté est indisponible, signale précisément le blocage et
attends sa résolution sans contournement navigateur.

Ne touche jamais Gami DigiDouble. N'affiche aucun animal, y compris dans
les captures présentées. Les tests humains sont uniquement dans Brave,
sandbox-ulrich, admin → Tester moi-même. Prépare les onglets ; aucune parole
synthétique injectée en réel, aucun changement de Shields sans accord
spécifique. Les simulations audio restent dans des navigateurs de test isolés.

### Préflight borné, puis plan avant code

1. Actualise dépôt/Lovable, flags, presets, CI et version effective des
   modèles/prompts/orchestration. Conserve les preuves P2 et les réserves
   détaillées ci-dessus. Pas de recette générale P0 par défaut.
2. Reprends les deux GM timeout avec sessions/tours/requêtes. Inspecte les
   protections parent/deadline, génération upstream, validation/persistance,
   disponibilité GM et attente au tour suivant. Distingue annulation voulue,
   timeout et échec du nouveau tour. Si les spans manquent, ajoute d'abord
   une instrumentation technique bornée ; ne déduis pas la cause du seul
   total de 12 secondes. Compare des cohortes compatibles, pas des agrégats
   historiques mélangés. Toute cause inconnue demeure explicitement ouverte.
3. Vérifie que le GM échoué ou tardif ne remplace pas reçu, mémoire récente,
   personnage, relation ou autorisation de transfert. Si un défaut est
   démontré, documente sa reproduction et un sous-lot correctif ciblé avant
   de l'implémenter. Ne baisse pas deadline/budget pour masquer l'échec.
4. Complète ce document avec architecture, modules effectivement retenus,
   sous-lots, contrats de version/cache/annulation, stockage, expériences,
   budgets, métriques, gates, tests et rollback. Réutilise les seams existants ;
   ne crée pas une seconde orchestration. Documente avant réalisation les
   livraisons intermédiaires nécessaires.

### Contrat GM et mémoire

- Un seul appel GM par échange livré ou interrompu finalisé ; aucun GM
  pré-tour et aucun nouveau validateur LLM. Sépare génération, validation,
  persistance, disponibilité et attente effective du tour suivant.
- Le reçu local du dialogue entendu est appliqué immédiatement. Le GM
  enrichit en arrière-plan avec session/personnage/tour/version/provenance.
  Des faits tardifs peuvent être fusionnés seulement avec provenance et
  déduplication ; une transition relationnelle ancienne ne remplace jamais
  une version plus récente. Une action obsolète ne déclenche rien.
- Préserve mémoire V4, CAS, isolation Max/Emma, reçu conservateur et contexte
  livré pour GM/résumés. Une portion incertaine ou continuation privée ne
  devient jamais une confidence, promesse, consentement ou fait entendu.
  Candidat acoustique seul : aucun nouveau GM, reçu ou appel personnage.
- Allège répétitions, descriptions vidéo et champs GM réellement inutiles
  après comparaison sémantique. Conserve règles de canon, identité, mémoire,
  relation, consentement, vidéo, handoff et fin. Réglage admin et plafond
  effectif doivent correspondre : plancher actuel 950 pour JSON complet,
  ancien réglage souvent 180. Aucun passage arbitraire à 180 ; un budget
  retenu exige JSON complet, absence de troncature et corpus de décisions.
- Compare un modèle GM plus rapide à la baseline, à prompt et corpus fixés.
  Retenir coût/latence uniquement avec identité, confidentialité, mémoire,
  qualité des décisions et JSON complets équivalents. Mesure les erreurs
  et annulations ; un appel avorté n'est pas un gain de disponibilité.

### Contexte, RAG, prompts et buffers

- Précharge fiche, orchestration épinglée et mémoire pendant la préparation
  de session ; déduplique les lectures concurrentes. Clés minimales :
  environnement/session/personnage, version prompt/orchestration, profil/index
  RAG et version mémoire. Invalide à modification, handoff, reprise ou fin
  selon le contrat documenté. Pas de cache global mélangeant des personnages.
- Cache l'absence confirmée de résumé avec invalidation à sa création ou
  modification. Distingue absence, panne et expiration ; une panne ne devient
  pas une absence durable. Préserve la lecture fraîche si la version est
  inconnue et borne durée/taille des caches et requêtes en vol.
- Mesure embedding, recherche DB et rerank séparément. Compare rerank
  courant, plus léger et sans rerank dans le laboratoire RAG existant, mêmes
  questions françaises canoniques/elliptiques, noms propres et contexte.
  Ne retiens sans rerank que si rappel/canon/confidentialité ne régressent pas.
- Pré-retrieval sur transcript stable : expérience isolée, annulée au
  changement. Résultat réutilisable seulement si transcript final et toutes
  les clés de contexte correspondent ; sinon discard puis chemin normal.
  Aucun LLM ni TTS spéculatif avant transcript final. Borne le travail annulé
  et mesure son coût marginal, pas seulement le temps apparent économisé.
- Stabilise les préfixes de prompts et compare le routage OpenRouter sur
  TTFT, génération complète, p95 et cache hits réellement retournés. Aucun
  hit inféré d'un préfixe identique. Conserve rôle bénévole, film vu/non vu,
  posture, canon, relation et cadre commun généré uniquement par
  src/services/experienceFrame.ts, injecté identiquement personnage/GM.
- Garde un appel personnage avec intention privée compacte puis phrases sûres,
  un contexte Gradium par tour et les voix habituelles Max/Emma. N'économise
  pas le budget en supprimant un invariant métier ou en créant un appel
  indépendant par phrase. La réponse entière doit rester complète.
- Compare prébuffer Gradium courant, 160 et 240 ms d'audio, puis rebuffer
  adaptatif si justifié. Mesure underruns, clics, trous interphrases, continuité
  et livraison ; pause/réprise du suffixe, samples audibles atténués, EOS et
  annulation P2 restent corrects. Ne retouche pas les seuils acoustiques pour
  embellir une comparaison de buffer.
- ElevenLabs/Inworld incrémentaux et autres providers intégrés : comparaison
  secondaire, transport expérimental isolé, identité vocale contrôlée, aucune
  substitution silencieuse des voix ni suppression du batch/provider existant.
  Si l'identité équivalente n'est pas disponible, constate la limite et garde
  Gradium. Clés permanentes uniquement dans Lovable Cloud.
- Documente l'incohérence fenêtre globale 11 s / promesse de 8 s après
  3,5 s de RAG. Une modification des délais nécessite un sous-lot dédié
  avant code, tests de budget restant, annulation et récupération ; aucune
  diminution des deadlines actuelles pour améliorer les chiffres.

### Modules à inspecter, pas une liste de refontes

src/agents/gameMasterPRD4.ts ; src/services/gameMasterPromptBuilder.ts ;
src/services/prd4Orchestrator.ts ; src/services/sessionConversationMemory.ts ;
src/services/conversationMemoryV1.ts ; src/services/responseDelivery.ts ;
src/services/characterPromptService.ts ; src/services/experienceFrame.ts ;
src/services/ragService.ts et ragIndexService.ts ; RAGLabTab/RAGConfigTab ;
src/services/tts/gradiumStreamPlayer.ts et tts/providers/gradium.ts ;
src/services/voiceTurnTelemetryV2.ts ; src/lib/mcp/ et projections admin ;
supabase/functions/query-rag, proxy-llm et _shared/ragProfiles.
Confirme les chemins et propriétaires réels avant toute édition. Les décisions
de tour restent dans handsFreeVoice.ts ; PTT, captures et avatars restent
compatibles. Aucune migration/RLS/RPC existante modifiée sans nécessité
démontrée et sous-lot documenté ; aucune migration destructive.

### Mesures, tests et gates

- Une variable à la fois : GM prompt/budget, modèle, cache/préchargement,
  rerank, pré-retrieval, routage, prébuffer. Même corpus, pauses, voix,
  contexte et révisions épinglées ; ne combine pas les gains supposés.
- Chronologie par session/attempt/tour/interruption_id, horloges monotones
  distinctes, fournisseur/modèle demandés/résolus/effectifs, couverture,
  effectifs, coûts, p50/p95 et incertitude. Déduplique les snapshots ; exclue
  observations GM des effectifs de tours. Valeurs manquantes à null.
  Une page MCP bornée n'est pas une cohorte complète.
- Fin réelle de parole → première sortie estimée : cibles proposées
  p50 ≤ 1500 ms, p95 ≤ 2500 ms. Détection → atténuation p95 ≤ 100 ms,
  confirmation → arrêt p95 ≤ 200 ms. Aucun gain annoncé sans mesure ;
  AudioContext donne une estimation, pas une référence physique.
- Conserve le pilote d'au moins 300 tours / 10 sessions avant activation
  générale. Prépare les cohortes et collecte uniquement des essais réels
  autorisés dans Brave / sandbox-ulrich. Les autres navigateurs restent
  couverts automatiquement et leurs percentiles humains non attestés.
  L'enregistrement acoustique de référence nécessite un cadre explicite ;
  ne fais pas d'enregistrement ambiant autonome. Garde les gates non mesurées
  ouvertes si le corpus ou la référence manquent.
- Gates : aucun mélange Max/Emma, fuite privée, identité étrangère prononcée,
  film réinterprété, confidence non livrée promue, consentement forcé ou
  action GM tardive ; aucun JSON GM tronqué ni croissance de contexte,
  erreur ou underrun supérieur à la baseline comparable. Faux endpoints et
  fausses interruptions ≤ 1 % sur corpus contrôlé ; pas de taux fictif.
- Tests aux seams réels : GM lent/timeout/annulé/ancien, faits fusionnables
  vs transition obsolète, CAS et déduplication ; cache négatif/panne/invalidation,
  annulation et clés du pré-retrieval ; rappel RAG ; buffers/reçus/replay ;
  JSON GM complet et prompt canonique. Pour toute projection MCP modifiée,
  teste le schéma réel avec le sérialiseur SDK avant génération/publication,
  puis reteste les quatre outils. Préserve les tests de transfert réel des
  buffers AudioWorklet, pas un mock qui ignore la sémantique de transfert.
- Exécute npm run test:quality (lint, typecheck, régressions, unitaires,
  intégrations, build), E2E isolés multi-navigateurs et CI. Réalise deux
  revues indépendantes Spec/Standards sur le HEAD final et corrige les
  constats actionnables ; toute modification ensuite exige revalidation
  appropriée du nouveau HEAD. Ces builds de contrôle ne sont pas un hébergeur.

### Livraison et rollback

Conduis le lot jusqu'aux commits sur branche codex/, push, PR vers main,
revues et CI finales, squash merge, vérification SHA main, synchronisation
native Lovable, contrôle preview, publication native et vérification publiée.
Ne t'arrête pas à un code local ou une PR ouverte. Attache chaque PR créée.
Prépare les onglets Brave ; les confirmations vocales requièrent Ulrich,
une seule action précise à la fois. Termine les appels et libère les micros.
Ne relance pas les recettes historiques sans violation ciblée démontrée.

Ne demande pas une réécriture globale à l'agent Lovable pour synchroniser un
commit. Contrôle les fichiers modifiés et conserve les travaux non liés.
Si Lovable exige une validation humaine d'un plan, rends ce plan concret,
explique le choix puis attends la décision ; ne l'auto-approuve pas.

Canary sandbox-ulrich seulement ; modèle, rerank, prébuffer et optimisations
retenus explicitement par preset/version après leurs gates. Les anciennes
sessions gardent leurs paramètres épinglés. Rollback pour nouvelles sessions
vers preset courant et chemin sans expérience/caches spéculatifs, stratégie
texte et batch de compatibilité ; aucune conversion de mémoire ni suppression
des fournisseurs. Publication de code compatible sous défauts conservés
possible ; aucune activation générale tant que corpus/gates restent ouverts.

À la clôture, actualise ce plan, CHANGELOG et STORY. Donne PR, SHA, fonctions
ou migrations réellement livrées, CI, preuves et limites ; distingue local,
GitHub, preview et publié. Fournis un prompt Lovable prêt à coller avec ces
faits et rollback si une reprise manuelle est nécessaire. Applique
/Users/ulrich/CodeProjects/_shared/agent-context/12-task-closeout-handoff.md.
Ne revendique pas un modèle, un gain, un cache hit, un pilote ou une réserve
levée sans preuve. Pas d'extension au-delà de ce lot.

## Prochaine action à la reprise

Relancer les suites qualité et E2E après les correctifs finaux, puis créer la
branche `codex/`, ouvrir la PR vers `main`, attendre les revues/CI, effectuer le
squash merge, synchroniser Lovable, contrôler la preview et publier uniquement
depuis Lovable Cloud. La recette humaine restera limitée à Brave,
`sandbox-ulrich`, admin → « Tester moi-même », sans parole synthétique.

## Préflight P3 effectué — 14 octobre 2026, avant implémentation

### Cibles et état vérifiés

- Le dépôt local est propre sur `main` à `fe1c25ca657f44497b074cd416bfaf8938107044`, descendant de la référence documentaire `77db463`. Le manifest `.lovable/mcp/manifest.json` est conservé.
- Le connecteur Lovable natif confirme le projet `1265958d-b74e-40f2-917d-182fe05163fc`, workspace `5glbtPltldwz9tgNwIi4`, SHA effectif `fe1c25c`, statut `ready`, agent terminé et preview `https://id-preview--1265958d-b74e-40f2-917d-182fe05163fc.lovable.app`. La publication existante reste `https://proto1.parle-a-ava.com` ; aucun déploiement n'est lancé au préflight.
- Le connecteur MCP app Ava répond avec OAuth administrateur sur le Cloud Lovable attendu. `list_sessions`, `get_usage_overview`, `get_voice_latencies` et `get_llm_costs` ont été exécutés en lecture seule. Sur 30 jours filtrés `sandbox-ulrich` : 46 sessions, 203 échantillons audio, 39 tentatives V2 (18 completed, 11 interrupted, 4 cancelled, 6 failed), 23 sorties estimées, p50 4 196 ms / p95 5 607 ms depuis l'origine applicative. La mesure `voiceEndToOutputEstimatedMs` est absente (0 échantillon) et le résumé de tours exposé par ce connecteur reste à 0 ; aucune cible de gain n'est donc déclarée atteinte.
- Les coûts globaux, non filtrables par environnement, portent sur 234 appels et 597 481 tokens : 112 GM `google/gemini-2.5-flash`, 122 tours personnage `openai/gpt-5.6-luna`, 64 appels en erreur. Ce relevé sert de contexte de coût, pas de cohorte comparative ni de preuve d'un modèle à retenir.

### Diagnostic GM borné

- La preview Max (`3f2ded7a-fc05-4ae6-a66a-575f99402f8c`, tour 4, requête `b412ebbb-8093-4ea9-b038-3bd53bbdc75b`) et le publié Max (`1e5a72b5-5aa2-4263-bba0-db55ddf7f616`, tour 1, requête `66884b15-d4c3-4819-aedc-70ebdc7f9ba2`) présentent le même motif : `gm_generation` failed à respectivement 12 005/12 151 ms et 12 002/12 094 ms environ, puis `gm_persistence` et `gm_available` réussissent. Les observations GM montrent le modèle demandé sans modèle effectif résolu sur ces deux lignes, tandis que des tours voisins réussis indiquent `google/gemini-2.5-flash`.
- Le personnage a livré sa réponse et son reçu dans les deux cas. Les protections visibles sont le `GM_POST_TURN_TIMEOUT_MS` de 12 000 ms, l'abort de la requête LLM, la persistance CAS bornée à deux essais et la publication de la disponibilité après persistance. Aucun delta mémoire, action autorisée ou transfert tardif n'est démontré par ces données.
- Cause retenue : **inconnue**. Le relevé ne sépare pas l'attente fournisseur, la résolution/modèle effectif, l'abort client et une réponse arrivée après deadline. Il ne justifie ni baisse de deadline, ni baisse du plafond JSON, ni tuning prompt/modèle, ni relance P0/P1/P2. Le premier sous-lot ajoute seulement une classification technique bornée (annulé volontairement, timeout, échec HTTP/JSON, persistance/CAS, disponible) et vérifie les invariants d'obsolescence.

### Couverture des mesures et réserves conservées

- Les jalons V2 attendus sont au nombre de 29 ; les pages MCP retournent encore des lignes `partial`, des tentatives `capture_start` sans sortie et des GM séparés des effectifs de tours. Les événements montrent `voice_end`, `first_token`, `safe_phrase`, `audio_blob_ready`, interruptions et reprise souvent absents. AudioContext reste une estimation logicielle, pas une fin physique de parole.
- La couverture RAG est meilleure pour les spans `rag_profile`, `embedding`, `vector_search` et `rerank`, mais la projection publique ne porte pas encore de cohorte laboratoire avec question, variante et rappel validé. La couverture du prébuffer ne mesure pas encore explicitement underrun, clic, trou interphrase et continuité par seuil.
- Les réserves GM/P0/P2 et le pilote 300 tours/10 sessions restent ouverts. Le plan P3 ne relance pas la recette historique, ne modifie pas Shields, n'injecte aucune parole synthétique et ne touche pas Gami DigiDouble.

## Architecture et ordre des sous-lots P3 retenus avant code

1. **GM et instrumentation technique bornée.** Conserver `evaluatePostTurnPRD4` comme unique appel post-tour, `prd4Orchestrator` hors chemin critique, `experienceFrame.ts` comme source unique et `persist_conversation_memory_v4` comme CAS. Ajouter les statuts/spans de cause sans exposer dialogue ni payload privé ; distinguer génération, validation JSON/relation, persistance, disponibilité et attente effective du tour suivant. Les tests couvrent timeout, abort, réponse tardive, JSON tronqué, CAS concurrent, action obsolète et absence de mutation du reçu/personnage/autorisation.
2. **Lectures de contexte et mémoire.** Dédupliquer les lectures concurrentes par clés minimales `environment/session/character/prompt-orchestration/RAG-profile/memory-version`, avec caches d'in-flight bornés et cache négatif uniquement pour une absence confirmée. Une erreur réseau reste une panne et n'est jamais mémorisée comme absence. Invalider sur écriture, handoff, reprise, fin de session ou changement de version ; aucune cache globale inter-personnages et aucune conversion de mémoire V4.
3. **RAG/prompts comparés dans le laboratoire existant.** Garder les questions françaises canoniques et elliptiques, noms propres et contexte. Exécuter une variable à la fois : rerank courant, `rerank-2.5-lite`, sans rerank, puis pré-retrieval annulable sur transcript stable. Enregistrer variante, versions, effectifs, rappel/canon/confidentialité, embedding/recherche/rerank séparés, erreurs et annulations. Aucun résultat de laboratoire ne modifie le chemin live sans gate explicite ; aucune inférence de cache hit depuis un préfixe identique.
4. **Prompt GM et modèle.** Construire un budget de comparaison où le JSON complet, la mémoire, l'identité, la confidentialité, le canon, la relation, le film et le handoff restent présents. Comparer prompt baseline puis réduction sémantique et modèle rapide avec corpus fixé. Le plancher GM effectif reste au moins 950 jusqu'à preuve de JSON complet sans troncature ; le réglage admin ne sera pas abaissé arbitrairement à 180. Les versions prompt/modèle/configuration sont épinglées par essai.
5. **Prébuffer vocal mesuré.** Exposer uniquement dans le banc isolé les variantes existantes 300 ms, 160 ms et 240 ms, puis un rebuffer adaptatif si les données le justifient. Mesurer premier son logiciel, niveau d'avance, underrun, clic/fin abrupte, trou interphrase, continuité, suffixe conservé après pause/reprise, EOS, annulation et livraison. Garder Gradium, les voix Max/Emma, le contexte socket par tour, le transport de secours et le batch existant inchangés par défaut ; ElevenLabs/Inworld restent secondaires et ne peuvent pas remplacer silencieusement une voix.

### Contrats, budgets, expériences, gates et rollback

- Les clés et versions sont incluses dans toute mesure ; les horloges monotones ne sont pas soustraites entre navigateur et Edge. Les valeurs absentes restent `null`, les snapshots sont dédupliqués, les observations GM ne gonflent pas les effectifs de tours et une page MCP bornée n'est pas une cohorte complète.
- Les comparaisons s'exécutent une seule variable à la fois sur le même corpus, pauses, voix, contexte, révisions et profil RAG. Les seuils proposés restent p50 ≤ 1 500 ms / p95 ≤ 2 500 ms fin de parole→sortie estimée, détection→atténuation p95 ≤ 100 ms et confirmation→arrêt p95 ≤ 200 ms ; ils ne valent pas preuve tant que les jalons manquent.
- Gates bloquantes : fuite privée, mélange Max/Emma, identité étrangère, film réinterprété, confidence non livrée promue, consentement forcé, action GM tardive, JSON tronqué, croissance de contexte, erreur ou underrun au-dessus de la baseline comparable. Une annulation ou un appel avorté n'est jamais compté comme gain de disponibilité.
- Activation : code compatible et défauts actuels conservés ; canary limitée à `sandbox-ulrich`, preset/version explicitement épinglé après gates. Rollback vers le preset courant, sans cache/pré-retrieval spéculatif, stratégie texte et batch de compatibilité. Les anciennes sessions gardent leurs paramètres.
- Validation prévue : tests unitaires et intégration des seams, laboratoire RAG/prompt, tests réels de transfert AudioWorklet existants, `npm run test:quality`, E2E isolés multi-navigateurs, deux revues Standards/Spec, CI puis seulement synchronisation Lovable, preview, publication et vérification publiée dans Brave.

L'incohérence fenêtre globale 11 s / promesse historique de 8 s après 3,5 s de RAG est documentée mais **hors correctif P3** : toute modification de délai exige un sous-lot dédié et n'est pas incluse dans l'implémentation ci-dessous.

## Implémentation P3 — 14 octobre 2026

- GM : `execution_reason` distingue désormais l'abort parent, le timeout
  client, l'échec HTTP, le JSON invalide, la transition relationnelle
  invalide, la persistance échouée et l'erreur runtime. Le span
  `gm_available` reste séparé du statut du tour vocal et passe en échec si le
  résultat GM n'est pas exécutable. Une persistance échouée neutralise action
  et delta mémoire côté résultat retourné ; le reçu et la réponse personnage
  restent indépendants. Aucun délai ni plafond JSON n'a été abaissé.
- Contexte/mémoire : lectures concurrentes dédupliquées en vol pour mémoire
  session, résumé, prompt personnage et runtime d'orchestration ; absence de
  résumé confirmée seulement avec TTL court, erreurs non mises en cache ;
  résumé monotone par `last_turn`, clés prompt par environnement et
  invalidation conservée sur écritures. Les CAS V4, les handoffs et les
  migrations ne changent pas.
- RAG : le laboratoire existant reste isolé du live et exporte maintenant une
  clé de variante stable comprenant rerank/modèle, retrieve/top/threshold,
  truncation et rewrite, ainsi que les révisions source/built du corpus de
  questions et les snapshots d'effectifs. Aucun réglage live n'est activé par
  cette mesure.
- GM/prompts : le banc admin propose une comparaison fixe de trois cas, sur
  deux modèles au plus, avec version de prompt, plafond effectif, complétude
  JSON, statuts, p50/p95 et export JSON. Le test reste sans persistance et
  n'injecte aucune parole.
- Buffers : Gradium conserve par défaut 300/200 ms et expose seulement via le
  contexte de test les presets 160 et 240 ms. Les statistiques de génération
  portent preset, seuils, rebuffer, underrun logiciel et trou maximal ; le MCP
  Ava les projette dans `get_voice_latencies`. Aucune voix, aucun batch et
  aucun fallback de transport n'est modifié par défaut.
- Livraison partielle P1 : le reçu ne déclare comme livré qu'un préfixe confirmé
  par les timestamps audio ; après une chute Gradium, la continuation non
  confirmée reste privée et le GM ne reçoit jamais une phrase extrapolée depuis
  un seul échantillon audio.
- Vérifications locales : tests ciblés GM/RAG/mémoire/TTS/MCP passés,
  régression 46/46, unité 575/575, intégration 34/34, typecheck, lint et
  build passés. Les percentiles des comparaisons utilisent une interpolation
  linéaire. Les deux revues indépendantes Standards/Spec ont relevé puis
  corrigé le snapshot runtime borné, le JSON GM complet, la neutralisation des
  sorties non exécutées, la comparaison RAG multi-variantes, l'export GM et la
  mesure partielle sans extrapolation audio. E2E complet multi-navigateurs :
  45/45 sans retry.
- Limites conservées : la cause des deux timeouts historiques reste inconnue ;
  les jalons V2 manquants, le corpus RAG comparatif et les mesures acoustiques
  de clic/trou ne sont pas transformés en gains. Aucun P0/P1/P2, Shield,
  speech synthesis, migration de mémoire ou environnement Gami n'a été relancé.

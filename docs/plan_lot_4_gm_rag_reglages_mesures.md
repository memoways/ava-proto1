# Reprise — lot 4 / P3 : GM, RAG, prompts et buffers comparés

Date : 14 octobre 2026. Statut : **prompt de reprise préparé ; P3 non commencé**.
Ce document prépare le prochain lot. Aucun réglage, code applicatif, migration
ou déploiement n'est modifié par sa préparation.

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

Actualiser les cibles et le diagnostic GM/couverture via les connecteurs
natifs, puis compléter l'architecture et l'ordre des sous-lots dans ce
document avant implémentation. Aucun développement P3 effectué ici.

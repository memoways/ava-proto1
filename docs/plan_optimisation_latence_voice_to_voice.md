# Plan — réduire la latence et préparer la conversation voice-to-voice libre

Date : 12 octobre 2026. Base auditée : `0433518`, `main`, après une première lecture de `2d83558`.
Statut : **plan proposé, implémentation non commencée**.
Sources : [audit détaillé](audit_voice_conversation_max.md) et [snapshot chiffré anonymisé](latency_voice_snapshot_2026-10-12.json).

## Résultat visé et décisions acquises

Une conversation Max/Emma en français, avec portrait fixe et sans transcription affichée ni bouton pour chaque prise de parole. Micro actif pendant les réponses, interruptions naturelles, continuité de la réponse entière et mémoire de l'intention non prononcée. La même génération établit une intention privée puis diffuse les phrases ; aucun appel indépendant par phrase.

Lovable/Lovable Cloud demeure l'unique livraison. Les fournisseurs peuvent être comparés ; aucun changement de voix ou de modèle n'est retenu sans qualité équivalente. Le corpus, le contexte par personnage, les confidences, la relation, le rôle, la réponse initiale sur le film et le cadre commun restent protégés.

Les objectifs de pilote sont **p50 ≤ 1 500 ms et p95 ≤ 2 500 ms** de fin réelle de parole à premier son estimé ; arrêt local après confirmation applicative de parole reconnue **p95 ≤ 200 ms**. Le délai acoustique → reconnaissance est mesuré séparément ; 200 ms depuis la voix physique n'est pas promis sous le contrat actuel. Ce sont des objectifs de validation proposés, pas des gains annoncés. L'ambition ultérieure 800/1 500 ms ne sera retenue qu'après mesure et sans dégrader la qualité.

La base saisie mains libres/barge-in est déjà réalisée et documentée dans [son plan](plan_conversation_mains_libres.md). Ce plan se concentre sur latence, streaming et continuité ; il complète cette base sans doublon. `handsFreeVoice.ts` reste l'autorité applicative de fin de tour et d'interruption. Le lot présent livre l'audit et ce plan. L'exécution applicative doit suivre l'ordre ci-dessous ; aucune suppression de protection ou réduction arbitraire de timeout n'est un raccourci acceptable.

## 1. Mesure fiable avant optimisation — P0

**Interfaces et sémantique**
- Versionner les événements en `schema_version=2`, conserver les anciennes colonnes pour lecture historique, et utiliser `turn_id` avec `attempt_id` unique en cas de retry.
- Séparer fournisseur/modèle demandés, résolus et retournés, transport effectif et override de personnage. Remonter les métadonnées du résultat TTS effectif ; le chunking utilise ce même provider. Les anciennes étiquettes contradictoires restent marquées « non fiables ».
- Émettre des jalons monotones client : fin de voix capturée, décision de fin de tour, dernier audio envoyé, flush envoyé/acquitté, transcript final, contexte prêt, premier token, intention prête, première phrase sûre, premier texte envoyé TTS, premier chunk audio, scheduling, sortie estimée, fin audio, interruption et dernier son arrêté.
- Ajouter des spans serveur séparés : contrôle/quota, profil RAG, embedding, recherche vectorielle, rerank, headers upstream, corps, validation/persistance GM. Corréler navigateur/Edge/fournisseur ; ne pas soustraire des horloges non synchronisées.
- `t_turn_voice_ready_ms` V2 part de la fin de parole capturée ; conserver `latency_origin` V1. Ne pas additionner le silence STT, le RAG et le GM lorsque ces spans se chevauchent.
- Corriger null → zéro, distinguer TTFT, chunk audio, première sortie estimée, génération totale et lecture. Séparer « dépassement de budget » et « segment critique », avec état « couverture incomplète » si nécessaire.
- Ajouter statuts tenté, terminé, interrompu, sans audio, timeout, annulé et échec, plus couverture de mesure. La persistance reste hors attente de voix.

**MCP et baseline**
- Conserver les protections et l'OAuth du [MCP déjà livré](plan_mcp_statistiques.md). La lecture de son code confirme la table legacy et les percentiles interpolés ; étendre les projections, pas reconstruire le serveur.
- Réaligner dans Lovable les lockfiles utilisés par la CI : le SDK MCP ajouté à `package.json`/`bun.lock` manque actuellement dans `package-lock.json`, tandis que GitHub utilise `npm ci`. Le contrôle à blanc a confirmé cette erreur et des divergences HeyGen/Drizzle. Aligner aussi les schémas des quatre outils MCP avec Zod 4 attendu par le SDK, en conservant Zod 3 pour les formulaires existants ; ne pas faire une migration globale de Zod. Pour le lot SDK 3.0.5 vérifié, utiliser un alias séparé `zod-mcp: npm:zod@4.6.6` dans les quatre outils, verrouillé avec le SDK ; cette variante a passé le contrôle de types sur une copie temporaire. Rejouer les tests de schémas/outils avec les résolutions réellement lockées. Ce prérequis ne justifie pas une chaîne de build externe.
- Étendre le MCP Ava pour lire `voice_turn_events`, les traces PRD4 techniques et les métadonnées GM, plutôt que seulement une table de tours legacy. Exposer filtres date, environnement, personnage, modèle/provider effectifs, transport et version de code/prompt/orchestration.
- Limiter l'outil aux mesures et à des projections diagnostiques admin ; ne pas inclure automatiquement les transcriptions privées ni les secrets. Fournir bornes, caps, pagination, fenêtre réelle, méthode de percentile et couverture.
- Capturer une baseline récente dans `sandbox-ulrich`, avec le chemin courant conservé. Les 41 tours de septembre restent une référence descriptive distincte.
- Résultat attendu : une chronologie reconstructible par tour, fournisseur correctement attribué, pas de « zéro » pour absence et distinction claire entre statistiques anciennes/récentes.

## 2. Mémoire de livraison et streaming cohérent — P1

**Contrat d'un tour**
- Ajouter `ResponseIntent` : objectif communicatif et points à couvrir, privés, courts et bornés. Les produire au début du **même appel LLM** sous un en-tête JSON unique, suivi d'une frontière explicite vers la parole. Parser cet en-tête entièrement avant toute sortie TTS ; ne jamais transmettre ses tokens au synthétiseur.
- Introduire `streamPRD4Turn(input, onEvent)` avec événements intention prête, segment verbal sûr, réponse complète, interruption et échec. Réutiliser le montage du prompt PRD4, pas l'entrée streaming legacy limitée à Max. Conserver `processPRD4Turn` pour batch, laboratoires et compatibilité.
- Le LLM reçoit au départ tout le contexte utile au tour et génère un seul discours. Segmentation incrémentale par phrases complètes, sans seuil minimum de 80 caractères pour une phrase courte achevée. Maintenir ponctuation, citations, abréviations et cohérence prosodique.
- Appliquer la garde d'identité sur le préfixe cumulé avant chaque émission, avec suivi des citations et fragments incomplets. En-tête invalide ou absence d'intention : aucune parole non validée, arrêt du stream et réponse sonore de secours connue.
- Distinguer réponse générée, préfixe livré, portion partiellement livrée/incertaine et continuation privée. Ne jamais présenter une suite non générée comme un texte déjà connu. Après interruption, le prochain tour peut reprendre l'intention, pas affirmer que l'utilisateur l'a entendue.
- Étendre la mémoire de façon additive, avec version 4 et normalisation V1–V3. Les reçus et intentions sont scoped au personnage. Une continuation n'est pas promue en disclosure ou engagement partagé.
- Les anciens échanges, sans reçu, restent historiques ; leur statut de livraison est inconnu. Ne pas réécrire leurs faits ni inférer une précision audio absente.

**TTS incrémental**
- Ajouter un handle de tour : `appendText`, `finish`, `cancel`, `started`, `generationDone`, `finished` et événements de progression. Conserver les APIs de génération Blob et de streaming de segment pour compatibilité.
- Gradium est le premier adaptateur : token et WebSocket préparés pendant RAG/LLM, un contexte vocal pour le tour, texte ajouté aux frontières sûres, EOS seulement à fin de génération. Pas de nouvelle synthèse indépendante par phrase. Les tokens temporaires sont émis dans Lovable Cloud.
- Ne pas conditionner `started` à `generationDone`. Le player connaît les samples réellement programmés/lus ; le reçu utilise les timestamps de segments disponibles et une estimation conservatrice en leur absence.
- Fixer la voix et la performance du tour au départ, appliquer les réglages Gradium du personnage et conserver le contexte prosodique.
- À l'annulation : stop de toutes les sources audio, vidage de buffers, refus des chunks obsolètes, fermeture du socket interrompu, renouvellement du token pour reconnecter. Réutilisation multi-tour/multiplexing reportée jusqu'à validation de l'annulation par contexte.
- Avant premier son, fallback transport autorisé et tracé ; après premier son, aucun replay automatique du début. Conserver le reçu partiel et reprendre depuis une frontière sûre au prochain tour.
- Maintenir les deux générations concurrentes uniquement sur le chemin batch existant ; borner le buffer du nouveau chemin en temps audio, sans attente de la réponse entière.

**Annulation**
- Lier le signal parent à la réception SSE jusqu'à EOF, au reader, aux deadlines de corps et à l'upstream lorsque possible. Traiter erreur SSE, JSON fragmenté, EOF sans fin et completion vide.
- Annuler génération et audio au barge-in ; conserver l'intention déjà produite. Une poursuite de génération distante non annulable n'a jamais droit d'écrire dans le tour courant ou de réactiver du son.
- Les contrôleurs input, output, GM et synchronisation restent séparés ; callbacks validés par identifiant/génération. Aucun événement tardif n'altère personnage, relation ou action courants.

## 3. Écoute libre et interruptions — P2

- Consolider le contrôleur mains libres déjà présent dans `IndexPRD4`, en conservant `handsFreeVoice.ts` comme point de décision. Séparer explicitement état d'écoute/sortie, sans réimplémenter l'activation du micro ni retirer le PTT de compatibilité.
- Préserver la capture unique après le geste d'activation déjà disponible ; vérifier sa reprise après flush et réinitialiser réellement capture/buffers aux frontières vidéo/handoff. Déconnecter à fin de session, changement de permission ou panne réellement non récupérable.
- Vérifier le DSP navigateur effectif. La décision de fin de parole et de barge-in reste applicative, fondée sur texte/timing reconnus, conformément à `AGENTS.md`. Les signaux VAD/acoustiques et fournisseur enrichissent les mesures et la finalisation, sans déclencher un tour par leur propre timer.
- Une parole reconnue validée par `handsFreeVoice.ts` arrête l'audio et démarre le nouveau tour. Évaluer d'abord le seuil 2 mots, puis 1 mot pour les corrections courtes, et le filtre d'écho lexical actuel. Retenir le réglage qui satisfait les gates, sans supposer que 80 % de recouvrement prouve l'écho. Une parole rejetée ne recommence jamais la réponse.
- La capture continue conserve le premier phonème. Ne pas remettre à zéro les buffers d'un nouveau énoncé par une callback de l'ancienne sortie. Tester les barrières de génération et les écoutes pendant la réponse.
- Tempo applicatif : tester 900 ms actuel, puis 500 et 700 ms, avec hésitation 700 ms actuelle puis 300 ms. Ignorer les callbacks de transcription identiques qui ne représentent pas un nouveau mot pour éviter de repousser artificiellement la décision. Retenir le plus rapide sans faux endpoints. Ne pas annoncer la durée de timer économisée comme un gain de bout en bout mesuré.
- Deepgram : conserver mode manuel, final + interim, keepalive lorsque l'envoi est suspendu et flush de secours borné. Les signaux provider servent à acquitter l'audio/finaliser le texte, sans devenir le décideur du tour.
- Gradium STT : suivre `ready`, `step` diagnostique, `end_text` et le `flush_id` exact ; tester les délais valides 7 et 10, partir de 10 jusqu'à comparaison française. Les messages d'un vieux flush ne finalisent jamais le nouveau tour.
- Remplacer ScriptProcessor Gradium/AssemblyAI par AudioWorklet, assembler les frames conformes au fournisseur et respecter la fréquence effective ; ne pas supposer que celle demandée est appliquée.
- Voix seule : masquer les transcriptions utilisateur/personnage dans la conversation publique, conserver texte interne et outils admin. Les contrôles de session, de consentement et de handoff restent ; aucun bouton pour parler par tour.
- Précharger une courte voix de secours pour panne de sortie, avec un statut accessible. Aucun fallback ne dépend d'un dialogue textuel caché.
- Pendant une cinématique, suspendre la boucle de prise de tour puis la réarmer proprement ; ne pas transcrire le film comme utilisateur. Préserver Gumlet et le contexte post-vidéo.

## 4. GM, RAG et réglages mesurés — P3

- GM : un seul appel, lancé sur un échange livré ou interrompu finalisé ; aucun GM pré-tour et aucun validateur LLM nouveau. Séparer durée de génération, persistance, disponibilité et attente au tour suivant.
- Appliquer immédiatement le reçu local du dialogue entendu. Le GM enrichit la mémoire en arrière-plan, par tour/version ; ses faits peuvent être fusionnés avec provenance et déduplication, ses transitions relationnelles ne remplacent jamais une version plus récente. Actions devenues obsolètes ignorées.
- Réduire répétitions, descriptions vidéo et champs inutiles du prompt/schéma GM. Faire correspondre les réglages admin au plafond effectivement utilisé ; ne pas ramener arbitrairement le plancher 950 à 180.
- Comparer un modèle GM plus rapide sur JSON complet, identité, confidentialité, mémoire et décisions. Le meilleur coût/latence n'est retenu que si les protections du corpus restent intactes.
- Précharger fiche, orchestration épinglée et mémoire à la préparation de session ; dédupliquer les lectures et mettre en cache une absence de résumé avec invalidation lors de sa création. Ne jamais traiter une panne comme une absence durable.
- RAG : mesurer embedding, DB et rerank séparément ; comparer rerank courant, plus léger et sans rerank sur le laboratoire existant. Retenir sans rerank uniquement si les critères de rappel/canon ne régressent pas.
- Pré-retrieval sur transcript stable autorisé comme expérience : annulation au changement, résultat réutilisé seulement si texte final/contexte et clés env/personnage/profil/index/mémoire correspondent. Aucun LLM/TTS spéculatif avant transcript final.
- Stabiliser les préfixes de prompts et mesurer les cache hits réels ; comparer routage OpenRouter sur TTFT et p95. Conserver rôle, film, cadre, canon et relation dans le budget.
- Tester le prébuffer Gradium courant, puis 160 et 240 ms d'audio avec rebuffer adaptatif. Retenir un seuil uniquement si underruns/clics/continuité restent équivalents.
- Comparaison secondaire : ElevenLabs et Inworld incrémentaux, puis autres providers intégrés. Les identités vocales restent contrôlées et les clés permanentes ne quittent pas Lovable.
- Ne pas diminuer les deadlines actuelles pour obtenir de meilleurs chiffres. L'incohérence entre la fenêtre globale 11 s et le commentaire promettant toujours 8 s après 3,5 s de RAG doit être documentée et résolue lors d'un lot dédié aux délais, avec tests de récupération.

## 5. Validation et activation

### Corpus et mesures

- Baseline et variantes utilisent les mêmes questions et pauses françaises ; variation d'un seul levier à la fois. Conserver révision, voix, modèle effectif, prompt, profil RAG et configuration épinglée.
- Au moins **300 tours répartis sur 10 sessions** pour comparer p50/p95 du pilote ; afficher séparément Chrome, Firefox, Safari desktop et iOS Safari, avec effectifs. Si un sous-groupe est insuffisant, son p95 reste descriptif.
- Scénarios : questions canoniques et elliptiques, pauses de réflexion, reprises, « oui/non », noms propres, bruit/écho, écoute au casque/haut-parleur, interruption avant son/premier mot/milieu/fin, plusieurs interruptions rapides, débit réduit, reconnexion, session longue, reprise et Max→Emma→Max.
- Mesurer fin de parole → première sortie, débit audio, p95 de queue, trous interphrases, arrêt après interruption, fréquence des fausses coupures, couverture, coûts, contexte et disponibilité mémoire.

### Gates

- Aucun mélange Max/Emma, fuite privée, identité étrangère prononcée, film réinterprété ou révélation non livrée promue en fait entendu dans le corpus.
- Transcription sans perte du premier/dernier mot ni doublon, faux endpoints et fausses interruptions ≤ 1 % sur le corpus contrôlé ; les « oui/non » explicites sont préservés.
- Aucun chunk obsolète audible après confirmation d'interruption ; reprise cohérente de l'intention, aucun replay involontaire.
- Aucun nouveau taux d'échec, JSON GM tronqué, croissance de contexte ou underrun supérieur à la baseline de la même cohorte. Les cibles de latence ne remplacent pas ces gates.
- Tests ciblés de controller/stream/mémoire, `test:regression`, `test:unit`, typecheck, intégrations mémoire et E2E multi-navigateurs. Fournisseurs simulés pour races/délais ; essais réels séparés dans la preview Lovable.
- La compilation/publication effective est vérifiée via Lovable. Une vérification locale ne constitue pas une livraison.

### Rollout et défauts

Réutiliser `VOICE_HANDS_FREE.enabled` et `bargeInEnabled` existants, sans changer leur valeur actuelle dans les environnements. Ajouter seulement deux flags désactivés par défaut : sortie incrémentale et UI audio seule. Chaque session épingle ce preset. P0 est activé d'abord ; P1, P2 puis P3 sont évalués en sandbox, ensuite en preview Lovable et sur un pilote interne de 10 sessions.

Par défaut, le plan préserve la règle texte/timing de `handsFreeVoice.ts`. Une variante de réaction dès onset acoustique nécessite une décision produit explicite et la mise à jour correspondante du contrat avant implémentation ; elle n'est pas activée implicitement.

Toute violation d'un invariant bloque le passage au lot suivant. Rollback par retour au preset courant pour les nouvelles sessions ; aucune migration destructive, suppression de fournisseur ou conversion irréversible de mémoire. L'avatar animé conserve son chemin existant et ne reçoit pas la sortie incrémentale avant ses tests spécifiques.

Le tableau de suivi doit présenter chaque gain réellement mesuré, intervalle et effectif, coût marginal et évaluation de continuité. Le lot s'arrête avec un plan validé et des preuves de pilote ; aucune économie supposée de 300 ms ou de 3,6 s GM n'est comptée comme acquise.

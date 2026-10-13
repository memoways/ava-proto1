# Reprise — lot 2 / P1 : mémoire de livraison et streaming cohérent

Date : 13 octobre 2026. Statut : **P1 fusionné sur main (#33 et #34), migration
et fonctions Lovable Cloud livrées ; preview technique vérifiée, recette humaine et
publication frontend encore à effectuer**. Base d'exécution : main `0a60a64`.
Dernier frontend publié : `f251eb3` / PR #32. Le commit de ce document ou un
descendant devient le point de reprise documentaire.

## Décision de passage

**Oui, passage au lot 2/P1.** Le P0 est livré ; la recette complémentaire
atteste la fin naturelle de vidéo et la reprise vocale, sans défaut de code
bloquant démontré. Les limites restent des faits à conserver : transfert
accepté non observé, écart historique Emma retrouvé sans cause technique
démontrée, payload exact du prompt post-vidéo non attesté. Elles ne sont pas
présentées comme résolues et ne nécessitent pas de relancer P0 avant P1.
Cette décision répond à la demande d'Ulrich de préparer la reprise suivante ;
aucun développement ni publication P1 effectué dans le chat de préparation.

La spécification complète reste la section 2 du
[plan général](plan_optimisation_latence_voice_to_voice.md#2-mémoire-de-livraison-et-streaming-cohérent--p1).
Ce document est le point d'entrée d'exécution, pas une spécification concurrente.

## Prompt à coller dans le prochain chat

Mets en œuvre uniquement le lot 2/P1 d’Ava Proto 1 : mémoire de ce qui a
réellement été livré, intention privée, streaming LLM/TTS cohérent et annulation.
Le passage depuis P0 est décidé pour cette reprise ; ne redemande pas de
validation de ce passage et ne relance pas sa recette restante par défaut.

Dépôt : memoways/ava-proto1.
Workspace : /Users/ulrich/CodeProjects/memoways/ava-proto1.
Référence : main, fcb6948 ou descendant contenant ce prompt sauvegardé.
Dernier code publié : f251eb38a2094977f3ed5adbdfb8a2008f584ab2, PR #32.

Lis AGENTS.md, CHANGELOG.md, STORY.md, ce document, puis
docs/plan_optimisation_latence_voice_to_voice.md (section 2 et gates),
docs/plan_lot_1_observabilite_latence.md (dernier bilan) et
docs/plan_changement_interlocuteur_manuel.md (clarification prioritaire).
Actualise main et vérifie les modifications locales ; préserve les travaux
non liés. Complète ce plan avant implémentation avec les modules, sous-lots,
tests et besoins de stockage réellement retenus.

Livraison exclusivement Lovable : projet 1265958d-b74e-40f2-917d-182fe05163fc,
workspace Memoways 5glbtPltldwz9tgNwIi4, Cloud iralfqlslqndgvexixis,
site https://proto1.parle-a-ava.com. Vérifie ces cibles avec les connecteurs
natifs avant toute action Cloud/build/publication. Aucun hébergeur ou
Supabase externe. Ne touche jamais Gami DigiDouble et n'affiche aucun animal.

Contrat P1 obligatoire :
- Un seul appel LLM par tour produit d'abord une intention privée courte
  et bornée, puis le discours. Parser l'en-tête JSON entier avant toute parole ;
  aucun token privé ne doit atteindre le TTS. Réutiliser le montage PRD4
  Max/Emma, conserver processPRD4Turn batch et les laboratoires.
- Segments sûrs par phrases complètes, garde d'identité sur le préfixe
  cumulé et gestion des fragments/citations/abréviations. Intention invalide :
  aucune parole non validée, arrêt et secours sonore connu.
- Mémoire V4 additive, normalisation V1–V3 et isolation par personnage :
  réponse générée, préfixe livré, portion incertaine, continuation privée.
  Une confidence non entendue ne devient jamais un fait partagé ; anciens
  échanges sans reçus = livraison inconnue, sans réécriture des faits.
- TTS Gradium incrémental avec un contexte vocal par tour, appendText/finish/
  cancel et progression audio ; préparer token/socket pendant RAG/LLM,
  garder voix/réglages du personnage et APIs de compatibilité. Pas de synthèse
  indépendante par phrase ni d'attente de la réponse entière avant premier son.
  Reçus conservateurs fondés sur les samples programmés/lus ; buffer borné.
- Annulation cohérente LLM/SSE, reader, TTS/socket, sources et buffers ;
  callbacks validés par identifiant/génération. Après premier son, aucun
  replay automatique du début. Le tour abandonné ne réactive jamais le son
  ni n'altère personnage, mémoire, relation ou action courants. Préserver
  l'intention produite et le reçu partiel pour le prochain tour.

Préserve cadre commun construit uniquement par experienceFrame.ts, réponse
film, canon, confidences, relations et historiques isolés. Seul le premier
personnage est libre ; Appeler/Rester pendant l'appel nécessite GM exécuté,
règles narratives validées et accord explicite du personnage. Ne force aucun
accord, ne réintroduis aucun bouton permanent ni transfert vocal automatique.
Conserve les migrations P0 et handoff_count >= 0. N'implémente pas P2/P3 :
pas de nouvel algorithme acoustique mains libres, tuning GM/RAG ou changement
de voix/modèle/seuil/deadline pour fabriquer un gain. Lier l'annulation P1
aux signaux d'interruption existants ; handsFreeVoice.ts reste l'autorité.
Documente et motive toute migration P1 indispensable avant application Cloud ;
la reprise n'autorise pas de migrations ou réglages hors du contrat P1.

Tests utiles : parser fragmenté/invalide, absence de fuite privée, reçus
partiels/inconnus, interruption avant son et en milieu de phrase, reprise
d'intention, isolation Max/Emma, vidéo/transfert/fin de session, callbacks
tardifs, panne/fallback sans replay et maintien du batch. Conserve les
mesures V2 et leur couverture ; n'invente aucune mesure absente et ne
revendique aucun gain depuis la petite baseline P0.

Conduis la livraison : branche codex/ → tests appropriés → PR vers main →
revues et CI sur le HEAD final → squash merge → synchronisation Lovable →
contrôle preview → publication → vérification publiée. Tests humains
exclusivement sandbox-ulrich, admin → Tester moi-même dans Brave ; prépare
toi-même les onglets et demande seulement la parole humaine nécessaire,
une action à la fois. Aucune parole synthétique dans l'application réelle ;
ne désactive pas Shields sans accord spécifique.

Termine avec preuves, révisions, mesures et limites, rollback et état réel
GitHub/preview/publié. Actualise plans, CHANGELOG et STORY, commit et push.
Ne commence aucun autre lot.

## Exécution P1 — 13 octobre 2026

Branche `codex/p1-delivery-streaming`, base `0a60a64`. Passage P1 acquis.
Cible native Lovable confirmée : projet et workspace ci-dessus, Cloud activé.

### Modules et ordre d'implémentation

1. `responseIntentStream.ts` : en-tête JSON borné `{goal, points}` puis frontière
   `\n<speech>\n`, parsing fragmenté strict, phrases complètes et citations
   fermées, abréviations et garde d'identité sur le préfixe cumulé. Aucun
   texte privé transmis à la voix ; secours connu avant toute émission seulement.
2. `openRouterLLM.ts` / `proxy-llm` : SSE strict, DONE obligatoire, erreurs,
   UTF-8 fragmenté, annulation du reader et de la requête jusqu'à EOF, délais
   de corps conservés. Même appel personnage, aucun appel par phrase.
3. `maxAgent.ts` / `prd4Orchestrator.ts` : montage PRD4 partagé avec batch,
   événements intention/segment/completion/interruption/échec ; contexte commun
   et paramètres existants. GM et résumé reçoivent uniquement la livraison
   finalisée ; aucune confidence privée promue par génération seule.
4. `gradiumStreamPlayer.ts` / adaptateur Gradium : préparation pendant RAG,
   un socket/setup par tour, appendText/finish/cancel, EOS après génération,
   suivi samples programmés/lus et timestamps texte, buffer borné à 30 secondes
   d'audio en avance. Dépassement : arrêt explicite, aucun buffer illimité.
   Voix/performance figées au départ ; prébuffer existant conservé.
5. Mémoire V4 : reçu par tour/personnage (intention, généré, livré, incertain,
   continuation privée), normalisation V1–V3 sans réécriture de faits, projection
   de l'historique livré et reprise privée bornée. Persistance dans JSONB
   `sessions.conversation_memory` et `conversation_log` existants : aucune
   modification de colonne nécessaire. RPC additive CAS transmise en POST pour éviter qu'une écriture
   GM ou reçu concurrente efface l'autre ; cache local disponible au tour suivant.
6. `settingsService.ts` / `GameMasterConfigTab.tsx` : flag
   `VOICE_INCREMENTAL_OUTPUT`, false pour les réglages existants, sélectionné
   à la création de session et conservé à la reprise dans la mémoire V4 ; canary uniquement sandbox-ulrich.
   `IndexPRD4.tsx` : chemin Gradium incrémental pour sortie TTS Gradium déjà
   sélectionnée ; compatibilité batch des autres sorties/laboratoires conservée.
   Signaux d'interruption existants, générations immuables, capture et seuils
   mains libres inchangés. Reçu partiel sauvegardé même à l'annulation ; aucune
   callback tardive ne déclenche relation, action ou audio.

### Validation et livraison

Tests déterministes : header fragmenté/invalide, fuite privée, citations et
identité, SSE fragmenté/EOF/erreur/abort, timestamps et samples, pré-son et
mi-phrase, reprise d'intention, isolation Max/Emma, courses de persistance,
GM sur livraison, vidéo/handoff/fin, maintien du batch et absence de replay.
Puis gates qualité et E2E existantes, revues indépendantes et CI sur HEAD final,
PR vers main, squash et CI après fusion. Les revues demandées sont autorisées
comme travail de revue indépendant ; implémentation conduite dans ce chat.
Synchronisation Lovable et déploiement proxy uniquement via Lovable Cloud,
preview puis publication et vérification publiée. Recette humaine uniquement
Brave, admin → Tester moi-même → sandbox-ulrich ; aucune voix injectée,
Shields conservés. La publication attend les gates pertinentes du P1.

Rollback : revenir au batch conservé ou revert du squash P1 ; les JSON V4 sont
additifs, aucun changement de voix, canon, orchestration ou migration P0.
Aucun gain chiffré annoncé sans corpus comparable suffisant.

Références vérifiées : [Gradium WebSocket](https://docs.gradium.ai/guides/text-to-speech),
[SDK officiel](https://github.com/gradium-ai/gradium-py),
[OpenRouter SSE](https://openrouter.ai/docs/api_reference/streaming).
Confiance avant réalisation : 95 % ; montage existant réutilisé, lacunes
livraison/annulation localisées, protocoles officiels vérifiés, aucune dépendance nouvelle.

### Vérifications intermédiaires

530 tests unitaires verts, régressions et typecheck verts. Tests additionnels
SSE, parseur, reçus, player et coordination audio inclus. Trois intégrations
JSONB PostgreSQL embarqué reproduisent les courses reçu/GM, sans migration
et sans accès à une base externe. Gates intégration, E2E et revues en cours.
Identité GitHub existante confirmée par requête authentifiée hors sandbox ;
aucune GitHub App configurée sur cette machine, aucune reconnexion.

### Correction de stockage avant livraison — revue indépendante

La comparaison optimiste du JSONB dans `.eq` produit une URL HTTP trop longue
(~24 Ko pour seize reçus courts, démontré avec le SDK). Remplacement indispensable
par `persist_conversation_memory_v4`, RPC SQL recevant ancien/nouveau JSON dans
le corps POST. Migration additive `20261013171500_persist_memory_v4_cas.sql` :
aucune colonne ni donnée modifiée, fonction SECURITY INVOKER, RLS existantes,
EXECUTE réservé à authenticated, aucune élévation de droits. Mise à jour atomique
mémoire/log/cursor avec égalité NULL-safe du snapshot et curseur monotone.
Pas de changement des migrations P0, du compteur handoff ni des secrets.
Application uniquement au Cloud Lovable du projet vérifié après fusion ;
contrôle existence/droits et essais isolés avant publication.
Rollback frontend au batch conservé ; RPC additive peut rester sans appel.

### Corrections de revue et preuves

Revues Standards/Spec sur `ad0f871` : consentement depuis texte non entendu,
watchdog sortie non relié, blancs originaux des reçus et URL CAS trop longue.
Corrections réalisées : gardes sur livré, annulation du handle + secours,
offsets conservés dans le texte original, RPC CAS en POST. Le premier son
arrivé après EOF mais avant la fin de lecture clôt désormais son watchdog
sans couper une réponse longue. Fallback Gradium REST du discours sûr entier,
avec les paramètres figés, uniquement avant tout audio ; pas de synthèse par
phrase dans ce secours. Flag épinglé à la création et à la reprise de session.
Observations TTS WebSocket/REST et spans Edge disponibles restent attribués
sans inventer les jalons absents ; trace diagnostique P1 distingue généré/livré.

Preuves locales intermédiaires : 35 E2E complets réussis (Chromium + media
Firefox/WebKit), puis régression P1 supplémentaire réussie : panne après
« Bonjour. », accord uniquement dans la suite non jouée, GM sur Bonjour et
aucun bouton Appeler. Tests RLS existants + RPC passent (12), montrant refus
anon, isolation propriétaire et curseur monotone. Qualité finale en cours.

Deuxième revue : secours REST détaché après headers et échec de lecture classé
comme annulation. Corrigés avec reader explicite, signal jusqu'à EOF,
annulation sur deadline du corps et statuts conservés. Tests headers reçus /
corps bloqué / abort, deadline et échec de lecture ajoutés et verts. Le proxy
Gradium transmet aussi req.signal au fournisseur (token et REST). Deux fonctions
Cloud à déployer : proxy-llm et proxy-tts-gradium. Les autres artefacts P0 restent
inchangés. Qualité locale précédente : 46 régressions, 532 unitaires, 34
intégrations, lint/typecheck/build verts ; les trois tests supplémentaires
passent séparément, CI finale attendue sur le nouveau HEAD.

### Livraison #33 et correction de compatibilité Lovable

#33 squash `3c3b67c` (HEAD revu `21406ed`), CI pré-fusion verte : 46 régressions,
535 unitaires, 34 intégrations ; 35 E2E au premier passage et un scénario batch
Emma→Max réussi au retry (36 exécutés). Ne pas présenter ce run comme sans retry.
RPC appliquée par connecteur Lovable, migration `20261013171500` enregistrée,
invoker confirmé, anon interdit/authenticated autorisé, RLS active. Deux Edge
Functions déployées par Lovable : empreintes soumises proxy-llm
`962b68be4840e9aea09552adacd5d34892ab9ec728a2af326c53c8df2dd53a7f` et
proxy-tts-gradium `eadd3c2b7467a4ede1eb1db5ba993ad3ae4743c0e2d8b4780cadd2ab7ec2d940`.
Numéros de versions Cloud non fournis : source soumise attestée, version servie
exacte pas indépendamment attestée. Aucun frontend P1 publié.

Lovable a régénéré automatiquement les types Supabase (`b794e7c`), puis un
commit de trajectoire (`916b466`), conservés. Bun build exit0, mais le compilateur
TypeScript Lovable refuse `Uint8Array<ArrayBufferLike>[]` comme BlobPart[]
(TS2345, gradium.ts113), alors que TypeScript local/CI l'accepte. Sous-lot correctif
sur `codex/p1-lovable-body-types` : stocker les copies audio en `ArrayBuffer[]`,
avec copie explicite dans un nouveau Uint8Array avant accès à buffer. Identique
à la copie précédente, sans changement de format, voix, délais ou API. Tests
existants de lecture/annulation et qualité, nouvelle PR, revues, CI et squash,
puis reprise Lovable avec typecheck explicite avant recette et publication.

Correction vérifiée localement : qualité complète verte (46 régressions,
535 unitaires, 34 intégrations, lint/typecheck/build), puis test supplémentaire
de conservation exacte des octets sur chunks fragmentés et vue avec offset
réussi ; typecheck relancé après ajout. CI post-fusion #33 et types Lovable
également vertes (`38428435954`, `38428954061`). Recette humaine P1 et publication
restent à réaliser ; activation incrémentale toujours désactivée par défaut.

### Correctif #34 — gate finale et reprise Lovable

Deux revues indépendantes Spec/Standards : aucun constat bloquant sur
`916b466…b597d02`. CI `38454199403` verte : 46 régressions, **536 unitaires**,
34 intégrations, lint/typecheck/build ; **36 E2E passent sans retry**.
PR #34 squash mergée en `07eaed436a072623820dcd1dac4a0e8a8012d657`, main local
et distant synchronisés. Le retry du run #33 reste une réserve historique,
pas une réserve du run final #34.

Reprise native Lovable demandée sur ce SHA : message
`umsg_01m4vbzkahfffbgmbd0ngc3ht4`, typecheck Lovable et build explicites,
aucune édition autonome, aucun réglage ni publication. Preview admin Brave
actualisée : identité Ulrich, environnement Sandbox — Ulrich, nouvelle sortie
progressive visible et désactivée, délais 900/700 ms et seuil trois mots
inchangés. Recette via Tester moi-même à préparer après compiler vert.

### Preview technique vérifiée — recette humaine prête

Lovable confirme HEAD `07eaed4`, arbre propre, `tsgo` 7.0.0-dev.20260320.1
et `npm run typecheck` TypeScript 5.8.3 exit0, zéro erreur ; `bun run build`
exit0. Bundle compilé `index-DIFCkXsB.js`, SHA256
`e951dfe12b60ccda69ef0ea259c16c2e61246dd1df4a66d9144c15ecda15bd94`.
La preview HTTP200 utilise Vite dev : cette empreinte est celle du build,
pas une attestation de bundle effectivement servi en preview.

Contrôle natif complémentaire message `umsg_01m4vc4stpfzfaqf3x6fyysv4m` :
`deno check` des deux proxies P1 exit0. Le journal historique signale des
erreurs Deno dans rag-question-corpus/manage-test-invitations/redeem-test-invitation ;
leurs fichiers sont identiques à `0a60a64` (diff vide), hors P1, aucune correction.

Canary activée par connecteur natif Lovable : seul `VOICE_INCREMENTAL_OUTPUT`
de sandbox-ulrich passe à true. Production null (défaut false), mains libres
et seuils 900/700 ms/trois mots inchangés. Contrôle UI confirmé dans Brave.
Admin preview → Tester moi-même a ouvert l'onglet `1830099280`, introduction
passée, question film affichée. Réponse factuelle demandée à Ulrich, en attente ;
aucune conversation humaine ni injection de parole réalisée. Shields inchangés.
Onglets admin preview `1830099245` et admin publié `1830099248` préparés.
Publication frontend et vérification publiée restent à réaliser après recette.
Rollback pour nouvelles sessions : remettre ce seul flag sandbox à false ;
les sessions existantes conservent leur preset épinglé et leurs reçus.

Ulrich confirme « J'ai vu le film ». Session canary Max créée :
`7e8b5cb2-e2ab-40de-a465-bc2dc14301f8`, 19:37:46 UTC, sandbox,
`has_seen_film=vu`, mémoire V4, incremental=true vérifiés par métadonnées.
Ouverture micro expirée après 10000 ms (`microphone_permission`), avant tout
tour vocal. Aucune cause Shields démontrée, aucun changement de protection.
Demande d'ouverture/permission dans l'onglet AVA présentée à Ulrich ;
recette vocale toujours à effectuer, pas de publication anticipée.
CI après squash `38455494583` sur `07eaed4` également verte.

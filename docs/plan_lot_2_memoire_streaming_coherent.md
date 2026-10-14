# Reprise — lot 2 / P1 : mémoire de livraison et streaming cohérent

Date : 14 octobre 2026. Statut : **P1 fusionné sur main (#33 à #37), migration
et fonctions Lovable Cloud livrées, revues et CI finales vertes ; preview technique,
réponse Max complète et interruption/reprise humaines vérifiées. Contrôle Emma,
publication frontend et vérification publiée restent à effectuer**.
Base d'exécution : main `0a60a64`.
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

### Recette réelle P1 — échec bloquant avant publication

Micro ouvert après action humaine, réponse naturelle Max confirmée sans JSON
ni intention privée entendue. Tour2 reçu completed : généré/livré 194 caractères,
445440 samples joués/programmés à 48000 Hz. Tour1 interrompu avant toute sortie
(zéro texte/sample). Demande humaine suivante pour interruption : tour3 failed,
`LLM response incomplete`, généré535, livré0, incertain511, privé24,
scheduled168960/played47407. Ne pas compter ce scénario comme une interruption
humaine validée ; la génération s'est arrêtée en échec.

Réglage hérité prod conservé : gpt-5.6-luna, maximum220 tokens. Cause terminale
pas encore distinguée (finish_reason length ou error). Le generationId fourni
par Ulrich est celui du GM précédent, pas celui du tour en échec. llm_usage
perd id/usage dans catch ; métadonnées de fin consommées après la vérification
de troncature, donc observation absente. Proxies Deno/types/build toujours verts.

Sous-lot diagnostic P1 avant nouvelle recette : conserver id, usage et reason
terminal dans le chemin SSE échoué, sans relâcher le rejet de troncature ni
changer modèle/budget/délais. Test au seam streamLLM sur SSE terminal length/error
avant correction, puis qualité, revue/CI/PR/squash et sync Lovable. Aucun nouvel
appel LLM de synthèse. Confiance95% pour cette correction d'observation : absence
de doublon vérifiée, API et stockage metadata_json existants, batch inchangé.
La cause de la troncature reste à établir avec preuve fournisseur.

Canary sandbox remise à false pour nouvelles sessions ; production inchangée.
Ulrich confirme appel terminé. Contrôle Brave déconnecté (debugger unattached),
à reconnecter avant prochaine recette ; aucun contournement ni changement Shields.
Publication frontend bloquée par cet échec, P2/P3 non commencés.

Preuve de la correction d'observation :
`npx vitest run src/services/openRouterLLM.failure.test.ts` rouge (2 échecs,
message incomplet sans raison), puis vert après correction. Métadonnées
terminales capturées avant rejet ; id/usage/finish_reason conservés en erreur,
sans émission de contenu terminal ni seconde génération. Récupération du coût
automatique, épuisement des retries et retry admin conservent status error.
Qualité locale complète verte : 46 régressions, 541 unitaires, 34 intégrations,
lint/typecheck/build. Deux revues indépendantes sur diff depuis aa28d01 sans
blocage ; 20 tests Spec et 13 tests Standards exécutés. CI et livraison du
sous-lot encore à réaliser ; cause de l'échec réel toujours non prouvée.
Clôture session confirmée dans Cloud à 19:52:07 UTC, handoff_count0.

PR #35 HEAD revu `e8e0e3e46bec8ad5641888da45652d43fa30fa8f`, CI
`38458982538` verte : 46/541/34 et 36 E2E sans retry. Squash
`0eff02ed2fb8566226a5820c0add7a358069aae4`, main synchronisé. Lovable message
`umsg_01m4vdyygve339cv8yenrby4v9` confirme HEAD et tsgo/npm typecheck/bun build
exit0. Build `index-DxsqQlJa.js`, SHA256
`6a2b42f8c0adb6a0c6a8c08594a255a5d2d0788e2673a7971b1127e3a74cd49a`.
GET preview sans session Lovable renvoie401 : pas d'attestation de bundle
servi depuis ce connecteur. Brave authentifié charge après refresh un nouveau
module `index-BbRLJPl1.js` (ancien `index-ramW_xNi.js`) ; cette observation ne
prouve pas l'égalité du bundle public avec le build local.

Brave reconnecté : ancien onglet non attachable, nouvel admin `1830099317`
contrôlable dans le même profil Brave, Ulrich/sandbox confirmés. Canary réactivée
uniquement sandbox pour un nouvel appel de diagnostic ; prochaine demande
humaine reprend le déclencheur sans modifier budget ni prompt. Production batch,
publication toujours bloquée, cause upstream encore à confirmer.

CI post-squash #35 `38460110034` verte sur `0eff02e`. Nouvel appel ouvert via
admin → Tester moi-même dans Brave, onglet `1830099320`, session
`3eb4f401-c9d1-4ff6-bab5-1dc8868236b4`, 20:11:21 UTC : Max, film vu, V4,
incremental=true confirmés. Micro ouvert. Demande humaine en attente :
« Raconte-moi comment s'est passée cette journée », sans interruption, pour
relever raison terminale et génération exacte si le problème se reproduit.
Aucune parole injectée ni nouvelle cause inférée en l'absence de ce résultat.
Frontend publié reste `f251eb3`. La recette P1, la résolution éventuelle de
l'échec et la publication/vérification publiée restent à accomplir.

### Cause établie — format P1 trop volumineux pour le budget existant

Nouvelle recette : deux coupures `finish_reason=length`, générations
`gen-1791922732-gKomWTSV0CMSqWQjyhdW` et
`gen-1791922746-WzR1AUDpqi0b970Cshbg` ; tokens observés 222 et 230
(ne pas présenter ces comptages fournisseur comme une égalité exacte au
paramètre220). Troisième réponse terminée, 182 tokens, génération
`gen-1791922752-ltepTcB7OTaQ4vRhzEbz`. Reçus des deux échecs : intention
366/350 caractères, parole448/491, livré0, reste incertain/privé conservé.
Reçu du succès : intention268 caractères, généré/livré407 caractères.
Appel clôturé par l'agent, canary remise à false avant correction.

Le contrat initial autorise une intention volumineuse puis un discours sans
borne globale compatible avec la sortie220. La garde length coupe justement
l'audio ; la relâcher masquerait une vraie troncature. Référence primaire :
[max_tokens OpenRouter](https://openrouter.ai/docs/api_reference/parameters)
borne la sortie totale, en-tête privé compris. L'avertissement de bridge
postMessage fourni par Ulrich est distinct des raisons terminales length.

Sous-lot format P1 sur branche codex dédiée : `buildResponseStreamContract`
reçoit le budget déjà sélectionné dans simulateMaxResponse, impose une
intention compacte (goal8mots, 0–2 points4mots) et un discours≤45mots avec
marge conservatrice pour JSON/frontière ; budgets<120 : goal4mots, points[],
parole réduite. Borne calculée depuis le budget existant, jamais budget augmenté.
Il s'agit du format de la même génération P1, sans changement du compilateur
éditorial/canon/cadre commun/GM/RAG, ni changement de modèle, voix ou délai.
La limite de mots est une instruction conservatrice, pas un compteur exact
de tokens : contrôle length/EOF reste bloquant et recette réelle indispensable.
Schéma parser/normalisation mémoire inchangé, anciens reçus privés conservés.

Tests au seam simulateMaxResponse : une seule génération, budget220 inchangé,
contrat compact réellement présent dans prompt final/trace, budgetoverride
plus petit respecté, batch sans format P1. Puis parser/SSE/coordination,
qualité, revues, CI, PR/squash, Lovable, nouvelle recette Max/Emma/annulation.
Confiance95% : cause length identifiée, duplication absente, montage PRD4 et
APIs existants, documentation officielle vérifiée ; les essais réels décideront
de l'efficacité. Aucune garantie de gain de latence ni publication anticipée.

Correctif de format livré par PR #36 : HEAD revu
`321776130f1d50a29af7844643efb7a37b3ee1e5`, base d7ca15b. Test de montage
rouge (quatre cas Max/Emma/budgets220/100), puis vert ; batch conservé.
Qualité locale et CI `38462897519` vertes : 46 régressions, 546 unitaires,
34 intégrations, lint/typecheck/build et 36 E2E sans retry. Deux revues
finales sur ce HEAD sans constat (63/64 tests ciblés exécutés).
Squash `bf46fa1f4e3399e87508f297a80e4f305995e6fc`, main synchronisé.
Message Lovable `umsg_01m4vftvymeq7rksdp1m03kwqs` : reprise de ce SHA,
types/build et preview seulement, aucun réglage ou déploiement Cloud changé.
Recette du format compact et publication encore à effectuer.

Lovable confirme types/build exit0 sur bf46fa1 ; bundle `index-d45yHF_0.js`,
SHA256 `d1a0a5bcecab5173ac796587b486de4515c31d767391db5c4ab06ac0fbd260f8`,
marqueurs du nouveau format présents. Son agent a néanmoins poussé quatre
commits jusqu'à `1117cce` malgré l'interdiction de modifier du code : changements
dans deno.lock et trois fonctions hors P1 (manage-test-invitations,
redeem-test-invitation, rag-question-corpus). Aucun redéploiement de ces fonctions
attesté/demandé. Le frontend P1 et les deux proxies du lot ne sont pas modifiés.

Sous-lot de restauration du périmètre : branche codex depuis1117cce, restaurer
uniquement ces quatre fichiers à bf46fa1, sans réécrire l'historique ni supprimer
les autres changements ; vérification de l'égalité des fichiers, revue, CI/PR,
squash. Ne plus demander de build à l'agent Lovable après cette restauration :
sa correction automatique ne respecte pas cette contrainte. Synchronisation
GitHub native et outils de lecture/publication suffisent ; le frontend est
identique au build P1 déjà validé. La recette P1 peut vérifier ce frontend
pendant la CI de restauration ; publication attend la restauration finale.

### Restauration vérifiée et recette du format compact

PR #37 : HEAD `1d1b09a29c7a11fd5bd7272fa3ed293a14c561fa`, deux revues
indépendantes sans constat, CI `38465567592` verte : 46 régressions,
546 unitaires, 34 intégrations et 36 E2E sans retry. Squash
`fe9c954fa70d613bdd1519a58b7e76fe4f09f49c`, main propre et synchronisé.
La CI post-merge `38467051553` est encore en cours à ce relevé. Native
Lovable confirme ce même SHA et agentFinished=true ; lecture des quatre
fichiers restaurés : égalité exacte avec bf46fa1. Le reste du code est
également identique à bf46fa1. Aucun autre déploiement de fonction demandé.

Nouvelle session Max `3f2ded7a-fc05-4ae6-a66a-575f99402f8c`, depuis la
destination observée du lien admin « Tester moi-même » dans Brave,
sandbox-ulrich, film vu, V4 et sortie incrémentale confirmés. Le 13 octobre
2026 à 20:58 UTC, Ulrich confirme une réponse complète et naturelle à la
demande qui avait provoqué les deux coupures. Une génération personnage
`gen-1791925122-Pzb9dllaP4BBAgDBAsKt`, completed, 100 tokens observés ;
intention97 caractères, parole générée/livrée260 caractères, aucun texte
incertain/privé restant, 814080 échantillons programmés et joués. GM post-tour
distinct exécuté après livraison. Cette réussite est un tour réel, pas une
garantie statistique : interruption et Emma restent à vérifier avant publication.

Ulrich confirme ensuite l'arrêt de Max puis une réponse cohérente à sa nouvelle
demande, sans replay. Reçu du tour2 : interrupted, généré211, livré36,
incertain175 caractères, programmé549120/joué283183 samples. Une tentative
intermédiaire interrompue ne génère/livre aucun texte ou audio. Tour4 terminé :
généré/livré187 caractères, 449280 samples programmés et joués. Intention privée
130 puis101 caractères ; générations personnage terminées95 puis82 tokens.
Une entrée « Stream failed » correspond à la tentative interrompue sans audio ;
un GM post-tour échoue sur son timeout existant12000ms après la reprise.
Ces observations ne prouvent pas un taux d'échec inférieur à la baseline ;
aucun délai/modèle/seuil changé. Appel fermé par Terminer, écran de fin observé.

Reprise le 14 octobre 2026 : CI post-merge `38467051553` confirmée success
sur fe9c954. Contrôle humain Emma et publication/vérification publiée restent
à effectuer ; la recette P0 n'est pas relancée.

Clôture Max confirmée dans Cloud à `2026-10-13 21:05:10.948+00`.
Le 14 octobre à 07:20 heure de Zurich, la connexion Brave (profil Personne1,
extension cca71dc6) est visible et liste les onglets AVA, mais l'ouverture
d'un nouvel onglet expire via createBrowserTab puis tabs.new. Aucun nouvel
appel Emma préparé, aucun micro ouvert ; ne pas considérer la recette Emma
exécutée. Reconnexion du contrôle Brave nécessaire, sans changement de Shields
ni contournement par un autre navigateur. Projet Lovable relu : workspace
Memoways, SHA fe9c954 et agentFinished=true ; aucune publication P1 demandée.

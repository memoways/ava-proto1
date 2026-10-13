# Reprise — lot 2 / P1 : mémoire de livraison et streaming cohérent

Date : 13 octobre 2026. Statut : **implémentation P1 en cours ; recette et
livraison non encore effectuées**. Base d'exécution vérifiée : main `0a60a64`, dépôt propre.
Dernier code publié : `f251eb3` / PR #32. Le commit de ce document ou un
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
   migration nécessaire. Comparaison du JSON complet pour éviter qu'une écriture
   GM ou reçu concurrente efface l'autre ; cache local disponible au tour suivant.
6. `settingsService.ts` / `GameMasterConfigTab.tsx` : flag
   `VOICE_INCREMENTAL_OUTPUT`, false pour les réglages existants, sélectionné
   au décrochage et conservé pendant l’appel ; canary uniquement sandbox-ulrich.
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

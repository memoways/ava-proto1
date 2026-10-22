# Passage Emma ↔ Max : validation narrative et pastille d’appel

Date du diagnostic : 19 octobre 2026. État au 22 octobre : **lots 1, 2 et 3 livrés sur GitHub,
code synchronisé dans Lovable ; lot 4 partiel, sans nouvelle publication produit**.
Périmètre du diagnostic du 19 octobre : analyse et plan. Le lot 1 du 21 octobre est décrit au §5 ; aucun réglage Cloud ni déploiement produit modifié.
Base examinée : `main` / `d0f72b601680b65b50e901e61bcae92a5752addd`, également HEAD Lovable au contrôle.

## 1. Résultat attendu

Pendant un appel avec Emma, sa pastille « en ligne » reste en haut à gauche. Dès qu’Emma accepte le passage et que le GM le valide, une seconde pastille apparaît **juste en dessous** : portrait de Max, « Appeler Max », pulsation discrète. Le joueur clique : capture et sortie d’Emma s’arrêtent, l’écran d’appel existant joue les sonneries, puis Max répond. Le même parcours fonctionne de Max vers Emma avec une nouvelle autorisation.

Une [maquette interactive locale](prototypes/character-handoff.html) permet de simuler l’accord, le clic, les sonneries, le retour et un échec de disponibilité. Elle illustre la proposition ; elle ne valide pas le runtime.

La pastille constitue le bouton d’acceptation. Une demande vocale seule n’appelle personne. Le choix du premier personnage reste celui du parcours actuel : Emma dans le scénario analysé. Ava et Léo restent hors périmètre.

## 2. Session réellement lue et preuves

Session demandée : **Ulrich · 19.10.26 13:32 · Emma · 11 tours · user_hangup**.

- ID : `2d6a3f7d-6680-479b-879a-5739a2ce6717` ; sandbox `sandbox-ulrich`.
- Appel du 19 octobre **13:32:49 à 13:36:12 Europe/Zurich** ; `push_to_talk`, sortie `tts`, film `vu`.
- 11 entrées utilisateur, dont deux fragments courts sans réponse autonome ; 9 réponses d’Emma et son salut initial. Huit évaluations GM sauvegardées.
- État final : `active_character=emma`, `handoff_count=0`, `pending_handoff=null`.
- Sources : connecteur AVA natif pour l’identification, puis lectures SELECT du connecteur **Lovable Cloud** pour `sessions`, `experience_events`, `conversation_turn_traces`, profils runtime et version d’orchestration. Cible vérifiée : projet `1265958d-b74e-40f2-917d-182fe05163fc`, workspace Memoways `5glbtPltldwz9tgNwIi4`, Cloud Supabase `iralfqlslqndgvexixis`. Le connecteur Supabase autonome ne liste pas cette base gérée par Lovable ; aucun autre projet n’a été interrogé.

### Tour 6 — intention comprise mais accord différé

Joueur : « est-ce que je pourrais parler avec lui ». Emma : « Je peux lui demander, mais je ne vais pas lui passer le téléphone sans lui expliquer. Quelle est votre question ? »
Le GM recommande `handoff → max`, mais classe l’accord `defer`. **Ne pas activer le bouton à ce tour est cohérent.** La détection locale ne résout pas « lui ».

### Tour 9 — promesse d’intermédiation encore ambiguë

Emma : « Je vais lui demander de vous parler. Mais je ne sais pas s’il a digéré quoi que ce soit […] ». Le GM retourne `action=none`, sans demande structurée. Ce tour ne prouve pas un accord immédiat pour l’appel. Le veto actuel vise aussi « je ne sais pas si », sans distinguer l’état émotionnel de Max d’un refus de transfert.

### Tour 10 — accord GM perdu par deux filtres locaux

Joueur : « Ok, Matt, j’aimerais bien pouvoir lui parler. » Emma : « Je vais l’appeler. C’est Max, pas Matt. […] »
GM à **13:35:44.051** : `executed`, `action=handoff`, cible `max`, `player_switch_request.stance=accept`.
Mais `detectPlayerSwitchRequest(..., "emma")` retourne `null`, et `hasCharacterHandoffConsent(..., "max", "accept")` retourne `false` : pronom/faux prénom côté demande et « Je vais l’appeler » côté accord ne passent pas les motifs attendus.

### Tour 11 — demande reconnue, accord naturel rejeté

Joueur : « Alors j’aimerais bien parler avec Max. Comment je peux faire ? » Emma : « Je vais aller le chercher dans le salon et lui dire que vous voulez lui parler directement. […] »
GM à **13:36:09.942** : `executed`, `handoff → max`, stance `accept`.
La demande locale retourne bien `max`, mais le consentement retourne toujours `false`. Le chemin d’offre ramène alors l’action à `none` avant la validation du directeur : aucune offre ne devient affichable.

**Cause confirmée : la décision GM et la compréhension de la réplique par les filtres locaux divergent.** Une pastille seule resterait invisible.

### Limites et facteurs secondaires

- Aucune ligne `experience_events` ni `conversation_turn_traces` pour cette session. Le journal GM ne prouve pas une bascule : `executed` désigne l’exécution de l’évaluation GM. L’absence de traces empêche de certifier le rendu DOM ou toutes les étapes asynchrones.
- GM T10 sauvegardé 9,387 s avant l’entrée utilisateur T11 ; GM T11 sauvegardé 2,590 s avant le raccrochage. Un résultat tardif reste un risque du code, **pas la cause démontrée de cet appel**.
- Deux répliques « la ligne accroche » aux tours 3 et 7 perturbent l’échange. Leur cause n’est pas établie par cette analyse ; ce lot ne prétend pas corriger le pipeline voix.
- Les profils Max et Emma actuellement lus sont activés et portent les validations de prompt/RAG/isolation/qualité. Ce constat ne reconstitue pas leur disponibilité technique exacte au moment du clic, puisqu’il n’y en a pas eu.
- La configuration publiée de cette session, v6 `9217fd34-321a-45c7-8363-6a8cf0b0157c`, fixe **minimum tour 4, maximum 1 transfert, pause 2 tours**. Le quota n’explique pas l’échec du premier passage (compteur 0), mais empêcherait un retour après celui-ci. Le défaut de code à 8 ne remplace pas la valeur publiée à 1.

## 3. Socle à réutiliser

- `src/services/characterConversation.ts` : demande, consentement, offre approuvée et isolation par `spokenWith`.
- `src/agents/gameMasterPRD4.ts`, `src/services/gameMasterPromptBuilder.ts`, `src/types/index.ts` : contrat structuré et prompt GM post-tour.
- `src/services/experienceDirector.ts` : gardes de version publiée, résultat courant, seuil/quota/pause, personnage distinct, disponibilité.
- `src/pages/IndexPRD4.tsx` : création de l’offre vers l.1586–1667, acceptation vers l.2292, `switchToCharacter` vers l.2169, reprise vers l.863. Les lignes se rapportent à la base examinée.
- `src/components/prd4/ConversationScreen.tsx` : pastille active vers l.232 ; carte d’offre en bas vers l.284.
- `src/components/prd4/CallingMaxScreen.tsx` : trois sonneries espacées de 1 500 ms, délai final de 500 ms. Réutiliser la séquence existante.
- `src/services/sessionService.ts` et `src/services/sessionConversationMemory.ts` : persistance et mémoire privée. Conserver le PATCH accepté avant le changement visible de personnage.

## 4. Décisions d’implémentation

### A. Une décision narrative structurée, appuyée sur les paroles entendues

Étendre le résultat GM existant avec une évaluation de passage indépendante de la regex de demande : cible, intention du joueur (tour courant ou demande encore ouverte), accord du personnage (`accept|object|defer`), preuve textuelle et identifiant du tour. Le même appel GM post-tour doit traiter la demande directe et une proposition initiée par le GM ; pas de nouvel appel LLM dans le chemin vocal.

Une fonction pure dédiée, proposée dans `src/services/characterHandoff.ts`, produit l’état effectif à partir de cette évaluation, du texte **réellement délivré**, de l’état courant et des gardes existantes. La regex de demande peut aider à préparer une consigne ; elle ne doit plus annuler une cible explicitement résolue et justifiée par le GM dans le même échange.

Le GM doit fournir un extrait exact de la réplique du personnage justifiant l’accord, rattaché à la cible de la demande. Vérifier localement que cet extrait existe dans le texte délivré, que l’identité et la cible concordent et que la décision est courante. Le GM classe sémantiquement la réplique complète et fournit aussi, s’il existe, l’extrait de refus qui contredit l’accord. L’extrait affirmatif seul n’est pas une preuve suffisante. La fonction pure vérifie les extraits et la cohérence de cette classification ; ses vetos déterministes restent limités à des refus explicites du transfert, jamais à une inquiétude générale « je ne sais pas si ». Un refus de transfert garde la priorité ; une hésitation sur les sentiments ou la réponse future de Max ne constitue pas automatiquement un refus. Si la résolution de « lui » / « Matt » n’est pas univoque dans cet échange, garder `defer` et demander une clarification naturelle. Pas d’alias global `Matt → Max`.

Les phrases T10 et T11 constituent des cas positifs avec contexte GM cohérent. « Je vais lui demander s’il accepte », « plus tard », « je ne vais pas te le passer » restent des cas négatifs ou différés. Une réponse interrompue avant l’accord ne peut pas débloquer l’appel. Un ancien résultat GM sans preuve structurée reste lisible, mais n’ouvre pas de nouvelle offre via ce contrat.

### B. État explicite et durée de validité bornée

États proposés : `none → awaiting_character → available → validating → calling → switching → completed`, avec sorties `declined`, `revoked`, `failed`. Séparer une recommandation encore à formuler de l’offre réellement acceptée par le personnage.

L’offre disponible porte un `schemaVersion`, `offerId`, `sessionId`, source, cible, tour de consentement, version d’orchestration, preuve de consentement et révision de validité. Réutiliser `pending_handoff` JSON pour sa persistance, sans nouvelle table dans ce premier lot. Stocker l’extrait utile et ses références, pas une copie du transcript.

Choix proposé pour la V1 : **l’offre reste disponible jusqu’au prochain message utilisateur finalisé, au choix Rester, à un changement de personnage/version attachée à la session, à la fin de session ou à un refus métier de validation.** Le message suivant la révoque avant sa réévaluation GM ; le même accord ne doit pas être automatiquement recyclé. Une demande ouverte expire après deux nouveaux messages utilisateur finalisés sans accord, ou dès son refus explicite. Elle ne vaut jamais autorisation. Persister uniquement les états stables `none` (témoin de révocation), `awaiting_character` et `available` dans une enveloppe JSON versionnée contenant une révision et, si nécessaire, une offre imbriquée ; les états de transport `validating/calling/switching` restent locaux. Les anciens lecteurs sans support de cette enveloppe ne doivent pas y trouver un ancien objet offre réactivable. Une offre restaurée nécessite le nouveau contrat et les revalidations courantes ; les anciens stamps sont affichés dans l’historique sans réactiver le bouton.

La version de référence est **la version d’orchestration figée dans la session**. Publier une nouvelle version ne modifie pas les gardes d’un appel déjà engagé. Un changement explicite de version attachée à la session révoque son offre ; ne jamais croiser décision v6 et gardes v7.

Toutes les créations, révocations et consommations utilisent une écriture conditionnelle comparant session active, personnage source, enveloppe JSON précédente et compteur attendu. Chaque nouveau message finalisé fait avancer la révision persistée avant de lancer sa réévaluation. Conserver une enveloppe `none` après révocation évite qu’un ancien résultat puisse recréer une offre à partir d’un ancien `null`. Une mise à jour qui affecte zéro ligne est un conflit, jamais une réussite. Viser une comparaison atomique du JSONB existant via les filtres du client Supabase, à prouver par test de concurrence ; si le contrat ne peut pas être garanti ainsi, une RPC/migration minimale Lovable Cloud doit être décrite et revue avant application. Aucun nouveau stockage ni assouplissement de RLS n’est présumé nécessaire. Déploiement coordonné du nouveau lecteur/écrivain ; les anciens onglets doivent être rechargés pour la recette.

Un résultat GM arrivé après un nouveau tour est journalisé comme périmé et n’ouvre pas de pastille. À la reprise, aucune sonnerie ni transition ne démarre seule. Garder le principe existant d’ignorance des callbacks périmés et ajouter les raisons observables.

### C. Pastille d’appel en haut à gauche

Empiler sous la pastille active un bouton arrondi avec portrait runtime et texte « Appeler Max » ou « Appeler Emma ». Il apparaît seulement à l’état `available`. Pulsation douce de l’anneau, sans flash, supprimée avec `prefers-reduced-motion`. Cible tactile d’au moins 44 px, focus visible, activation clavier, nom accessible « Appeler Max », annonce discrète à l’apparition. La disponibilité reste lisible sans animation.

Ajouter à côté ou immédiatement dessous l’action secondaire « Rester avec Emma ». Elle révoque cette offre ; une nouvelle offre exige une nouvelle décision GM. Remplacer la carte d’acceptation en bas pour conserver un seul emplacement d’appel. Les raisons techniques restent dans l’admin, pas dans l’expérience du joueur.

**Offre disponible ne signifie pas appel en cours** : continuer à parler avec Emma doit rester possible. Aujourd’hui `handoffOffer` bloque PTT et mains libres. Découpler ces gardes dans `ConversationScreen` et `IndexPRD4` ; geler l’appel pendant `mic_starting` / finalisation d’un nouveau message et révoquer l’offre à sa soumission. Le clic autorisé peut couper une sortie audio en cours par les primitives existantes ; aucune décision de fin de parole ou barge-in n’est déplacée hors de `handsFreeVoice.ts`.

### D. Clic, sonneries, connexion et échecs

1. Verrouiller synchroniquement `offerId` pour empêcher doubles clics ; revalider session active, source, cible, version, gardes et profil avant la sonnerie.
2. Fermer capture/sortie par `cleanupAudio`, invalider les anciens contrôleurs et callbacks. Ne pas ouvrir de micro pendant l’appel.
3. Réutiliser l’écran d’appel et ses sonneries. Un raccrochage annule toute connexion ultérieure.
4. Revalider au décroché, persister acteur/counter/offre consommée, puis appliquer fiche, voix, portrait et salut. Conserver session, échéance du timer, film, rôle et posture.
5. Avant persistance réussie, un échec laisse Emma active avec un message clair ; un incident technique transitoire conserve une offre revalidable pour réessayer, tandis qu’un refus métier (cible désactivée, version incompatible, quota) la révoque. Après persistance réussie, une panne TTS ne doit pas prétendre revenir chez Emma : Max est connecté, micro fermé, statut d’erreur audio et reprise explicite.

Premier appel : phrase d’ouverture du profil. Retour : salut bref de reprise (« Oui, je suis là. » par défaut), sans redemander l’identité et sans révéler l’autre conversation. La génération ultérieure reçoit uniquement l’historique et la mémoire propres au personnage revenu. `experienceFrame.ts` reste l’unique source du contexte partagé ; film `vu` conservé même si le cadre éditorial est désactivé. Le scénario reste un appel à une personne à la fois : les guidances ne doivent pas promettre une conférence ou transmettre la question privée d’Emma à Max.

### E. Réglages et observabilité

Pour la recette bidirectionnelle, créer dans **sandbox-ulrich** un brouillon issu de la v6 et proposer `maximumHandoffsPerSession=8`, seuil 4 et pause 2 conservés. Publier cette version via le flux Lovable Cloud lors de l’implémentation validée. La production garde ses réglages jusqu’à validation de la recette. Chaque retour nécessite une nouvelle autorisation et le respect de la pause. La contrainte SQL actuelle non négative n’a pas à être élargie de nouveau.

Tracer chaque évaluation de passage, y compris les décisions ramenées à `none` avant le directeur : `request_unresolved`, `character_deferred`, `character_refused`, `consent_evidence_missing`, `consent_not_delivered`, garde narrative, `gm_late`, cible indisponible, offre révoquée, erreur de persistance et résultat final. Réutiliser `appendExperienceEvent` et ses clés idempotentes. Ajouter la distinction **GM recommande / moteur autorise / offre affichable / joueur clique / personnage connecté** dans `src/components/admin/SessionsTab.tsx`. Le journal `executed` du GM ne doit plus être interprété comme transfert effectué.

Corriger dans `GameMasterSettingsTab.tsx` les textes d’aide incohérents avec le moteur : aujourd’hui le texte dit que le seuil ne s’applique pas aux demandes explicites alors que `validateDirectorDecision` l’applique ; le compteur mesure les transferts exécutés, pas les simples propositions. Conserver les règles actuelles et rendre leurs libellés exacts.

## 5. Lots ordonnés et critères de sortie

1. **Contrat et diagnostic reproductible.** Transformer les extraits nécessaires de cette session en fixtures minimales ; tests rouges T10/T11 et refus contradictoires. Étendre types, prompt GM, nettoyage JSON, moteur pur et audit de décision. Critère : les accords naturels valides sont reconnus ; refus, ambiguïté et texte non entendu restent bloqués. Pas d’assouplissement global des regex.
2. **Offre, persistance et audio.** Brancher l’état explicite, révocation, reprise, revalidation et événements dans `IndexPRD4`, `characterConversation` et `sessionService`. Critère : aucune offre périmée, double transition ou parole de l’ancien personnage ; panne avant/après commit correctement distinguée.
3. **Pastille et symétrie.** Modifier `ConversationScreen`, portraits et callbacks existants ; remplacer la carte basse ; continuer l’échange tant que le joueur n’appelle pas. Corriger les aides admin. Critère : pastille sous le personnage actif, accessible, animation optionnelle, appel dans les deux sens sous contrôle GM.
4. **Recette et livraison Lovable.** Qualité complète, E2E avec décisions GM contrôlées, configuration sandbox de recette, synchronisation GitHub/Lovable, vérification preview puis conversation humaine sandbox. Publication du produit uniquement après résultat observable accepté ; aucune chaîne externe. Ne pas déclarer l’expérience corrigée sur la seule base des mocks.

### Exécution par chats frais — consigne du 19 octobre 2026

### Lot 1 — exécution du 21 octobre 2026

Base vérifiée : `b113e351fad3260316942211cd806e4778a331eb`, checkout canonique propre,
CI main `39249573270` verte, Lovable au même SHA (projet et workspace vérifiés).
Branche : `codex/character-handoff-contract-lot-1`. Baseline ciblée : 53 tests verts.

Étapes autorisées : fixtures minimales T6/T9/T10/T11 et reproduction des deux
faux négatifs historiques ; contrat optionnel `handoff_assessment` versionné ;
nettoyage additif ; validateur pur ; instructions GM exportées mais jamais
concaténées au prompt effectif. Aucun consommateur runtime ne change.
Le contrat porte la source, la cible, le tour, la version, l'origine et des
citations exactes (demande/proposition, résolution de cible, accord et refus).
Le validateur confronte ces citations au reçu de livraison existant et à
l'échange courant, ou à une demande ouverte explicitement fournie et bornée
par l'appelant. Il ne réinterprète pas les pronoms et ne crée aucun alias.
Son autorisation narrative ne remplace jamais les gardes du directeur
(disponibilité, seuil, pause, quota), à brancher seulement au lot 2.

Confiance avant implémentation : 95 % — cause reproduite et modules vérifiés,
pas de moteur structuré concurrent, abstractions et reçu de livraison réutilisés,
aucune dépendance ajoutée. Références du parseur : [API Zod](https://zod.dev/api)
et [tests objets Zod v3](https://github.com/colinhacks/zod/blob/v3/src/__tests__/object.test.ts).
Contrôles : tests ciblés, qualité complète, E2E existants, revue des consommateurs,
CI verte du HEAD exact avant fusion, main et synchronisation Lovable après fusion.
Publication produit exclue. Résultats de clôture vérifiés ci-dessous.

**Réalisé localement :** `src/types/characterHandoff.ts`, champ GM optionnel,
`cleanHandoffAssessment` et `validateCharacterHandoff` dans le nouveau module pur.
Les citations restent exactes (pas de troncature ou reformulation), les champs
inconnus sont retirés. Les métadonnées du GM et du reçu doivent correspondre au
tour, à la version et à la source ; l'action GM doit viser le même personnage.
Une ancienne demande doit être explicitement encore ouverte et porter sa borne
de validité. Les refus du texte complet priment sur une citation affirmative.
Un accord entièrement délivré avant interruption peut rester valide ; une
portion incertaine, privée ou coupée avant l'accord n'autorise rien.
Les gardes narratives restent la responsabilité du directeur, séparée du consentement.

**Preuves :** rejeu des anciens filtres T10/T11 : `expected true, actual false`
dans les deux cas, sortie 1. Ces deux échecs attendus sont conservés en
`it.fails` comme caractérisation de l'ancien moteur, distincts des tests positifs
du nouveau validateur. Suite nouvelle d'abord rouge (module absent), puis verte.
Un veto émotionnel trop large a été reproduit rouge puis corrigé sans toucher
aux filtres existants. 76 nouveaux tests dont deux caractérisations attendues.
Qualité complète locale verte : lint 0 erreur (avertissement préexistant
`finishInputTelemetry` dans IndexPRD4), typecheck, 48 régressions, 707 unitaires,
34 intégrations et build. Avertissements habituels de taille de bundle conservés.
Premier E2E complet : 44/45, teaser WebKit en échec sur la sélection du personnage.
Isolation verte (1/1, 3,4 s), puis suite complète avec un worker comme la CI :
**45/45 sans retry, 8,5 min**, sans modification des tests. CI GitHub : également
45/45 sans retry (7,6 min). L'échec initial est conservé dans ces preuves ; les
assertions n'ont pas été affaiblies.

**Revue :** types, nettoyage, consommateurs GM, reçu de livraison et fixtures
relus. `REQUIRED_GM_JSON_FIELDS` inchangé ; le nouveau champ n'est jamais requis.
Dernière revue de clôture : restreindre les vetos aux verbes avec un objet de
transfert (pronom, nom de personnage ou téléphone/ligne). Des expressions comme
« pas passionnée » ou « pas passé un bon moment » ne doivent pas être assimilées
à un refus. Trois tests rouges avant correction, puis 79 tests du contrat verts (70 moteur,
9 GM). Cette finalisation et la clôture sont réunies dans la
[PR #55](https://github.com/memoways/ava-proto1/pull/55) ; aucune activation runtime.
Qualité locale finale à 710 unitaires ; les 707 cités ci-dessus décrivent la
première livraison #54. Les E2E locaux sont ceux de cette première livraison ;
la CI de #55 rejoue tout le contrat sur son HEAD final avant fusion.
Test du même prompt effectif, de 950 tokens / 12 s et d'un seul appel LLM.
`GM_CODE_VERSION` incrémentée pour tracer le nettoyeur, sans changement du prompt.
Recherche des usages : aucun appel au validateur hors tests, aucune injection
des instructions préparées dans les builders actifs. Pas de changement dans
IndexPRD4, UI, sessionService, director, experienceFrame ou handsFreeVoice.

**Livraison vérifiée :** [PR #54](https://github.com/memoways/ava-proto1/pull/54),
[CI 39574552872](https://github.com/memoways/ava-proto1/actions/runs/39574552872)
verte sur le HEAD exact `2a48a9754fe1118076647f09fb9d6b21e43d8bba` avant fusion.
Fusion le 21 octobre à 11:21 Europe/Zurich dans
`3d53298962f97cc3924b13b4bff60024f9965e35`. Main local/distant identiques et
checkout propre après fusion. Contrôle Lovable natif : même SHA, workspace
Memoways/projet Ava corrects, `project.status=ready`, `agentFinished=true`.
Code synchronisé ; pas de nouvelle publication produit, de réglage Cloud ou
recette humaine. La CI post-fusion est contrôlée séparément de la CI pré-fusion.

[Prompt autonome du lot 2](prompt_reprise_switch_personnages_lot_2.md) actualisé
après la fusion avec les références réelles. Il impose de vérifier le main
courant (les commits de clôture documentaire peuvent suivre cette référence
technique), de finaliser le lot 1 en cas de régression et de répéter les mêmes
obligations à chaque clôture. Lot 2 non démarré. Décision durable distillée dans
la mémoire Notion AVA, ajout relu ; Source conservée, Last updated by = Codex.

Le [prompt autonome du lot 1](prompt_reprise_switch_personnages_lot_1.md) lance uniquement le contrat et les tests. Ce premier lot prépare types, nettoyage compatible, instructions GM testables et validateur pur ; il ne branche pas encore la nouvelle autorisation dans le runtime et ne change aucun prompt effectif publié. L’audit de décision est d’abord un résultat pur, sa persistance attend le lot 2.

À chaque clôture : actualiser `CHANGELOG.md`, `STORY.md` et ce plan avec les preuves et l’état réel ; vérifier la CI du HEAD avant fusion vers `main` ; produire et sauvegarder un prompt autonome du prochain lot pour un nouveau chat. Si le lot reste incomplet, le prompt doit d’abord en permettre la finalisation. Répéter ces obligations dans chaque prompt suivant. Aucun enchaînement automatique de lots ni publication produit pour le lot préparatoire. Les choix de quota et de validité d’offre du §8 n’ont pas à être activés dans le lot 1.

### Finalisation supplémentaire du lot 1 — 21 octobre 2026

L'intégration du lot 2 (13/14 parcours ciblés verts) révèle un refus non couvert :
« Non, je préfère que tu restes avec moi. » Une offre restait possible avec le
nouveau validateur. Travail du lot 2 préservé séparément avant de poursuivre.
Trois tests isolés échouent sur les formulations restes/restiez, puis passent
avec un veto limité au souhait affirmatif de rester. Revue : trois souhaits niés
reproduisent un faux refus, puis passent après restriction du motif. 85 tests
ciblés verts ; qualité locale 48 régressions, 713 unitaires, 34 intégrations
et build verts sur la première correction ; CI finale requise sur le motif revu. Filtres historiques, prompt actif, Cloud et UI inchangés.
Finalisation livrée par #56 dans `a26d1e7167da3c11d68cd3d66952c0db2bcb1250`,
CI `39594897594` verte sur le HEAD exact `970cea0d99774f4970b4a79a7a3ba38815e411f7`
avant fusion ; deux revues finales sans constat et 45 E2E locaux sans retry.
Lovable synchronisé sur `a26d1e7`, ready/agentFinished. Reprise du lot 2 sur ce main.

### Lot 2 — périmètre engagé le 21 octobre 2026

Base vérifiée : `d89a68b5d004174ce731c1e9811387ec09e0d603`, main local/distant
identiques, checkout propre ; #54/#55 fusionnées, CI #55 `39577587425` et main
`39579238573` vertes. Lovable au même SHA, ready/agentFinished. Baseline ciblée :
109 tests verts. Branche : `codex/character-handoff-runtime-lot-2`.

Ce lot branche uniquement le contrat, les offres et l'audio existant. Enveloppe
JSON versionnée dans `pending_handoff`, révision unique conservée après révocation,
comparaison atomique de l'ancien JSONB + session active + source + version + compteur.
Zéro ligne signifie conflit. Tests Postgres/PGlite et client REST réel prévus pour
prouver les courses (deux acceptations ; révocation contre GM tardif), sans migration.
Au prochain message finalisé l'offre expire ; demande ouverte bornée à deux nouveaux
messages, jamais une autorisation. La demande et les preuves restent privées au
personnage source. Reprise : relecture des preuves dans la conversation/reçu existants,
pas de réactivation des anciens stamps GM. Revalidation au clic et au décroché,
persistance avant affichage de la cible ; panne audio après commit distincte.

Même appel GM enrichi des identifiants exacts et du reçu disponible, sans appel LLM
supplémentaire ni hausse du budget 950 tokens / timeout existant ; citations courtes
et réponse compacte. Pour le batch, reçu conservateur créé après lecture complète
confirmée ; aucune estimation partielle. L'absence de preuve reste fermée.
L'UI basse est conservée ; nouvelle pastille et ergonomie du lot 3 exclues.
La durée d'offre du §8 est retenue dans le périmètre demandé. Le quota sandbox 8,
sa publication Cloud et la recette humaine attendent le lot 4 ; seuil/quota/pause
restent ceux de la version figée (v6 : 4/1/2). Aucun provider, voix, algorithme HF,
cadre commun, secret, Edge Function ou configuration Cloud modifié.

Confiance préalable : 95 %. Cause et seams vérifiés ; pas d'état concurrent existant,
primitives audio et tests de concurrence réutilisables. Références consultées :
[filtres Supabase](https://supabase.com/docs/reference/javascript/eq),
[implémentation OSS PostgREST](https://github.com/supabase/postgrest-js/blob/master/src/PostgrestFilterBuilder.ts),
[refs React](https://react.dev/reference/react/useRef). Vérifications : tests rouges
avant correction, ciblés, qualité complète, E2E, revue des consommateurs/persistance,
CI sur HEAD exact avant fusion puis main/Lovable. Aucune publication produit.

### Lot 2 — réalisation et premiers contrôles

`characterHandoffState.ts` porte les états stables et les preuves référencées ;
`sessionHandoff.ts` porte lecture, CAS et revalidation. `IndexPRD4` garde les
transports validating/calling/switching/completed/failed et les primitives audio.
Enveloppe v2 sans champs d'offre à la racine : les anciens lecteurs ne peuvent
pas la réactiver. Reçu batch conservateur : seule une lecture intégralement
terminée est une preuve ; GM attend la livraison, sans bloquer la voix ni ajouter
un appel modèle. Le PATCH d'acquisition de tour précède sa génération pour
refuser également un onglet dont l'acteur a changé ; ce coût réseau n'est pas
présenté comme un gain de latence. Budget/timeout GM inchangés, JSON compact,
échec fermé si résultat tronqué/invalide. Aucune mesure de latence réelle nouvelle.

Preuves initiales : module d'état absent puis tests verts ; 6 tests Postgres via
le vrai client REST Supabase prouvent les filtres JSONB, la concurrence, la
révocation et les changements session/version/source/compteur. 14 E2E d'appel
existants verts après la finalisation #56. T10/T11, révocation, GM tardif,
accord non joué, reprise et panne audio après commit passent. Une classification
accept sans action conservait à tort une demande ouverte : régression ajoutée
et corrigée, aucune offre autorisée par cette classification. Un test de fin
attendait Merci au lieu de l'écran intermédiaire réel « La communication se coupe » :
attente corrigée, assertions sur absence de commit et compteur conservées.
Les tests de composant suivent la poursuite de la discussion prévue (micro
utilisable avec une offre) ; le mock admin inclut le nouveau lecteur d'événements.

Revue de `bfb8f18` : deux courses de callbacks corrigées (révision acquittée après
watchdog conservée avant le contrôle de tour ; révocation ancienne interdite sur
nouvelle session/tentative). La ref de recommandation devenue sans lecteur est
retirée. Le transcript du tour, ses preuves et l'offre utilisent maintenant le
même CAS ; les reçus et labels du tour passent aussi par ce filtre, pour ne pas
écraser un tour avancé dans un autre onglet. Le salut après connexion utilise
également la révision consommée. Mutation en conflit : aucun effet directeur.
Une demande ouverte doit être confirmée defer par le GM à chaque tour ; résultat
absent/invalide/refus/retrait la ferme, sans prolonger la borne de deux messages.
Cette fermeture conservatrice évite de ressusciter une demande retirée. Régression
pure dédiée et instructions GM cohérentes, sans champ JSON supplémentaire.
Le clic ferme immédiatement les primitives de capture/sortie avant la revalidation.
Deux reproductions E2E des anciens comportements sont rouges (snapshot préexistant
pour le watchdog ; révocation différée puis nouvel appel), puis les trois parcours
de revue sont verts avec le correctif. Qualité locale corrigée : 726 unitaires,
41 intégrations, 48 régressions, typecheck/lint/build verts ; avertissement hooks
préexistant conservé. Suite E2E complète à relancer sur cette révision.
Revue complémentaire : la validation réseau laissait les handlers micro actifs.
Deux E2E rouges reproduisent les ouvertures 4→6 (PTT) et 4→5 (mains libres).
Verrou de transport vérifié synchroniquement par les handlers et reflété dans
l'UI, fermé au clic jusqu'à la fin du salut ou à l'échec ; bouton Terminer conservé.
Les deux parcours et le scénario de révocation/recommencement passent ensuite,
avec deux tests de composant pour les contrôles et le clavier. Les relances
complètes interrompues pour ces corrections ne sont pas comptées comme vertes.

La suite complète sur `540738c` révèle deux attentes E2E à adapter au contrat :
l'ancien test P1 interdisait l'accord incertain dans tout le contexte GM, alors
que le lot 2 exige ses champs generated/delivered/uncertain séparés. La trace
confirme « Bonjour. » seul délivré, accord incertain et aucun appel. L'assertion
vérifie maintenant les quatre champs exacts du reçu et l'absence de cet accord
dans le dernier échange évalué. L'autre test lisait l'audit avant son arrivée ;
la trace contient bien `consent_not_delivered`. Attente conditionnelle de cet
événement, sans changer la raison attendue ni le produit. Relance complète requise.

### Lot 2 — livraison vérifiée le 21 octobre 2026

Deux revues Standards/Spec sans constat restant sur les corrections finales.
La revue Spec valide également l'adaptation des assertions de livraison partielle.
Qualité locale complète : **48 régressions, 728 unitaires, 41 intégrations**,
lint sans erreur, typecheck et build verts. Avertissement hooks préexistant
`finishInputTelemetry` et avertissements de taille du bundle conservés.
Suite locale complète finale : **61/61 E2E sans retry**, avec un worker.
La précédente suite sur `540738c` avait 59 succès et les deux échecs d'attentes
décrits ci-dessus ; elle n'est pas présentée comme verte.

[PR #57](https://github.com/memoways/ava-proto1/pull/57) fusionnée dans
`8ff0bad230a67123fb7f82d966a5ce1abfbeb06b` seulement après la
[CI 39601205173](https://github.com/memoways/ava-proto1/actions/runs/39601205173)
verte sur le **HEAD exact `d7c264348967664e747a69882536de1b8e22653c`**.
Ce contrôle inclut qualité complète et 61 E2E. Les runs des anciens HEAD
échoués ne servent pas de preuve de livraison. Local : main identique à origin/main,
checkout propre au relevé après fusion. Lovable natif : même SHA, projet ready,
agent terminé. Aucun réglage Cloud, migration, Edge Function ou fournisseur modifié.

Mémoire AVA Notion relue, décision durable du lot 2 ajoutée et écriture vérifiée ;
Source conservée, Last updated by=Codex. CHANGELOG/STORY et
[prompt autonome du lot 3](prompt_reprise_switch_personnages_lot_3.md) actualisés
dans une clôture documentaire après le merge technique, avec CI du HEAD exact
requise avant sa fusion. Le prochain départ reste le main réel après fetch.
Stash temporaire du lot 2 `7b42b9160e7672bfd2a45e3b505c3cd815a3d586`
conservé après refus du nettoyage par le contrôle automatique ; son contenu
antérieur aux corrections finales ne doit pas être réappliqué sur main.

États : contrat préparé au lot 1, moteur branché/testé/synchronisé au lot 2,
pastille à réaliser au lot 3 ; recette humaine, quota sandbox et publication
au lot 4. La synchronisation ne prouve ni conversation humaine ni publication.
Aucun lot 3 ou 4 commencé ; aucune publication produit ni changement Cloud.

### Lot 3 — démarrage du 21 octobre 2026

Base réelle après fetch : `9f5a405d475d7f8c36f350515a7eae0a7a9b637f` (#58),
main local/distant identiques, checkout propre ; CI post-fusion `39605824874`
verte, CI #57 et #58 vertes sur leurs HEAD respectifs. Lovable même SHA,
ready/agentFinished, workspace Memoways et Cloud `iralfqlslqndgvexixis` vérifiés.
Identité GitHub existante `Ulrfis` confirmée par requête authentifiée hors sandbox ;
configuration App absente (aucune identité remplacée). PR tierces préservées.
Branche : `codex/character-handoff-pill-lot-3` dans le checkout canonique.
Baseline du lot 2 : **105 tests ciblés verts**, dont reprise, CAS/concurrence,
consentement, conversation et sonneries. Aucun défaut de ce moteur établi.
La vérification clavier révèle un risque dans le raccourci Espace global :
reproduit rouge (micro ouvert sur Espace dans Appeler), puis corrigé en laissant
les contrôles interactifs gérer leur activation native. 27 tests de reprise,
concurrence, état et composant repassent avant le démarrage de la pastille.

Périmètre : une seule offre sous la pastille active, portrait runtime de la cible,
action Appeler/Rester, annonce discrète, focus et cible tactile >=44 px,
pulsation douce désactivée sous reduced-motion. Réutiliser les callbacks du lot 2.
Acheminer le portrait runtime également dans la sonnerie ; conserver les voix,
fiches et mémoires existantes. Corriger les deux aides admin (seuil même pour
une demande explicite ; quota des transferts exécutés), sans changer les gardes.
Aucune configuration Cloud, migration, publication ou recette humaine du lot 4.

Seams autorisés par le prompt : DOM/callbacks de ConversationScreen, parcours
Playwright réels avec frontières réseau simulées, état persistant et événements
existants. Baseline → reproduction rouge → correction minimale, par tranche.
Tests ciblés puis qualité et E2E complets ; deux revues Standards/Spec indépendantes,
CI verte sur HEAD exact, main/Lovable vérifiés. Prompt du lot 4 seulement à la
fin complète du lot 3, sinon reprise de finalisation de ce lot.
Confiance préalable : 95 % (moteur unique réutilisé, cause UI localisée,
aucune dépendance nouvelle). Références : [rendu conditionnel React](https://react.dev/learn/conditional-rendering),
[variantes mouvement Tailwind](https://tailwindcss.com/docs/hover-focus-and-other-states#prefers-reduced-motion),
[implémentation Tailwind v3.4.17](https://github.com/tailwindlabs/tailwindcss/blob/v3.4.17/src/corePlugins.js).

### Lot 3 — réalisation et revue

La carte basse est remplacée par l'unique bouton d'appel sous la pastille active,
avec portrait de la cible et action Rester. Annonce aria-live discrète, boutons
natifs, focus visible, cibles 48/44 px, anneau à pulsation 3 s seulement si
motion-safe ; disponibilité lisible sans animation. Aides admin corrigées sans
modifier seuil/quota/pause. Les profils déjà lus par le GM fournissent les portraits ;
la revalidation au clic alimente aussi l'écran de sonnerie, sans nouvel appel LLM.
Contrats de consentement/reprise et CAS inchangés, voix et fiches appliquées au
commit existant, aucun changement dans experienceFrame ou handsFreeVoice.

Preuves rouge/vert : Espace focalisé sur Appeler déclenchait le micro (1 appel
indésirable), corrigé avant la pastille. Les deux tests d'emplacement/portrait
dans le header échouaient avant remplacement, puis passent. Gardes de capture
et contrôles bloqués pendant validation conservés. Premiers contrôles : 19 tests
composants, puis 14 tests ConversationScreen ; typecheck et qualité complète verts
(48 régressions, 734 unitaires, 41 intégrations). Avertissement hooks préexistant
finishInputTelemetry et taille du bundle conservés.

Quatre parcours ciblés verts : deux sens avec portrait runtime dans l'offre,
la sonnerie et après connexion ; double clic, Espace natif, timer décroissant
sans remise à zéro. Mobile 390 px et desktop 1280 px : choix unique sous actif,
focus et cibles >=44 px, aucun débordement, pulsation absente sous reduced-motion,
Rester au clavier sans ouverture micro. Captures locales inspectées visuellement :
output/playwright/lot-3-390.png et lot-3-1280.png (simulations, pas recette humaine).

Les deux revues indépendantes de dbce411 repèrent la même régression introduite :
le profil opposé était attendu à toute reprise. Première reproduction sans tour
persisté non concluante (appel non reprenable), puis session réelle du fixture
avec un tour : rouge, portrait actif absent quand RPC cible retenue. Correctif :
aucune requête cible sans offre restaurable ; pour une offre, chargement seulement
d'affichage non bloquant, résultat ignoré si session/offre remplacée ou terminée.
La reprise de l'offre teste aussi son portrait runtime. Suite complète interrompue
pour correction (3 succès, 1 interrompu, 59 non exécutés) : pas comptée verte.
Qualité/E2E et revues à confirmer sur la révision corrigée avant livraison.

### Lot 3 — livraison vérifiée le 21 octobre 2026

Correctif de reprise et variante avec offre retenue verts : l'actif est utilisable,
Rester révoque, puis la réponse cible tardive ne réactive rien. Deux revues
Standards/Spec finales sans constat sur `c0b15cbbf08406834618fe50f1227696b2f4306f`.
Qualité locale corrigée : **48 régressions, 734 unitaires, 41 intégrations**,
lint sans erreur, typecheck/build verts ; seul avertissement hooks préexistant.
Suite locale complète corrigée : **65/65 E2E sans retry, un worker, 10,2 min**,
Chromium, Firefox et WebKit. Aucune assertion affaiblie ni régression masquée.

[PR #59](https://github.com/memoways/ava-proto1/pull/59), fusionnée à 22:05:56
Europe/Paris dans `6860d1450f4df5db3a3d8213887d5d4bf19bc1f3`, seulement après
[CI 39665006628](https://github.com/memoways/ava-proto1/actions/runs/39665006628)
verte sur le **HEAD exact `c0b15cbbf08406834618fe50f1227696b2f4306f`** :
qualité complète et **65 E2E réussis en 11 min**. La commande de fusion vérifie
PR HEAD, SHA du run, conclusion et tous les checks, puis protège le HEAD attendu.
Base main restée à 9f5a405 pendant les contrôles ; PR tierces préservées.

Relevé après fusion : main local/distant identiques à `6860d14`, checkout propre.
Lovable natif confirme le même SHA, workspace Memoways, projet ready et agent
terminé. Code testé et synchronisé ; aucune nouvelle publication produit, aucun
réglage Cloud, provider, migration ou Edge Function modifié. La [CI post-fusion 39667347427](https://github.com/memoways/ava-proto1/actions/runs/39667347427)
est également verte sur `6860d14`, avec 65 E2E réussis. La clôture suit sur
`codex/character-handoff-lot-3-closeout`, avec CI de son propre HEAD exact requise
avant fusion. Dernière relecture : conserver explicitement l'assertion historique
de visibilité du portrait pendant la sonnerie en plus de son nouveau contrôle
src runtime. Une assertion ajoutée au test, aucun code produit changé ; la CI
doit vérifier ce HEAD de clôture corrigé, pas une ancienne révision.

Mémoire AVA Notion relue puis décision durable du lot 3 ajoutée et relue :
Source conservée, Last updated by=Codex. CHANGELOG/STORY et le
[prompt autonome du lot 4](prompt_reprise_switch_personnages_lot_4.md) sont
actualisés après la fusion technique avec les références réelles. Au prochain
chat, partir du main réel après fetch, y compris l'éventuelle clôture documentaire.
Aucun lot 4 commencé. Restent seulement la recette humaine coordonnée, le quota
sandbox de recette et la publication après résultat observable accepté.

### Lot 4 — préparation, recette et correctif du 22 octobre 2026

Nouvelle recette réelle `ce05527f-a7f5-4a1c-b914-f82227fb5419` : demande
explicite nommant Max, réponse d'Emma conditionnelle (« peut-être… à condition »),
aucune offre ni transfert. Le diagnostic brut T10 établit un JSON GM incomplet,
coupé dans `handoff_assessment` après 938 tokens de complétion (budget 950).
Le refus `invalid_json` est conservé. Ulrich précise que le personnage doit
proposer de **passer l'appel**, sans promettre la venue physique de l'autre.
Appel du 22 octobre, **09:08:31–09:21:55 Europe/Paris**, v7, Emma, compteur 0,
film vu, rôle/posture null ; trois réponses entendues confirmées par Ulrich,
puis demande unique et absence de pastille confirmée. Session clôturée
`user_hangup`, micro fermé, persistance relue. Aucune mémoire privée transférée.
Correction prévue dans ce seul lot : contrat de sortie runtime complet et compact,
preuve avant mémoire, mémoire différentielle brève ; même modèle/appel/950 tokens
et parseur strict. Rappeler la procédure téléphonique dans la guidance de demande
et dans l'extension GM, sans toucher au cadre éditorial partagé, au rôle/posture,
aux preuves ou aux refus. Une hésitation reste defer ; aucun accord forcé.
Les revues ont identifié deux prérequis de compatibilité : garder
`action.proposalGuidance` dans l'exemple complet (sinon action neutralisée), et
respecter l'absence de proposition relationnelle dans un delta compact.
`ConversationMemoryDelta.relationship` est optionnel, mais son nettoyeur créait
un objet vide même si la clé était absente, puis invalidait le GM. Correction
bornée prévue : préserver cette absence, tout en validant et rejetant comme avant
toute proposition relationnelle explicitement fournie mais invalide. Reproduire
les deux cas avant correction et contrôler la conservation de la mémoire privée.
Probe supplémentaire : demander au veto déterministe de bloquer la nouvelle phrase
conditionnelle même avec un GM `accept` a échoué. Ce cas dépasse ses vetos étroits
existants ; aucune regex générale « proposer/venir/condition » n'est ajoutée,
conformément au partage sémantique GM / preuves moteur. La nouvelle fixture vérifie
`character_deferred` avec une évaluation GM defer comme T6/T9, et le prompt classe
explicitement cette condition en defer. Limite conservée : une fausse classification
GM accept sur cette phrase n'est pas aujourd'hui un veto déterministe. La recette
réelle rejetée pour JSON incomplet n'a produit aucune autorisation abusive.

Complément de vérification du 22 octobre : la CI documentaire
[39736840084](https://github.com/memoways/ava-proto1/actions/runs/39736840084)
échoue sur le test de révocation ancienne (64 E2E passent, même échec au retry).
La trace confirme que la fixture désactive Max avant le chargement de disponibilité
post-GM, donc avant la création de l'offre ; le moteur refuse correctement
`target_not_ready`. Finalisation prévue : attendre et vérifier l'offre visible
et persistée avant de désactiver Max, puis conserver toutes les assertions de
révocation retardée et de nouvelle session. Aucun timeout ni garde produit assoupli.
La PR #62 reste non fusionnée jusqu'à une CI verte sur son nouveau HEAD exact.

Preuves de cette finalisation : quatre vérifications rouges du format complet et
du transfert téléphonique, puis 134 ciblées vertes ; deux constats des revues
reproduits rouges (action sans proposalGuidance et relation absente), puis
139 ciblées vertes avant la probe de déféré documentée ci-dessus ; **140 ciblées
vertes** après finalisation des consommateurs et du motif prioritaire de refus T6.
Les deux revues finales source sont sans constat restant. Un contrôle
qualité concurrent aux E2E a rencontré un timeout de 5 s sur la pagination
inchangée (735/736 unitaires) ; fichier isolé ensuite 8/8 vert. Aucune hausse
de délai ni modification de ce fichier. Le contrôle qualité séquentiel suivant
est vert (739 unitaires, 41 intégrations, 48 régressions), avant les derniers
tests de compatibilité. La dernière qualité complète est **rouge : 742/744
unitaires**, après 48 régressions vertes ; `LatencyBlockingTab` ne trouve pas
`future-video` et le test T6 attendait à tort defer au lieu du refus prioritaire.
Ce dernier motif est corrigé et revalidé dans les 140 ciblés, sans changer le
veto produit. Le test future-video est inchangé et reste à diagnostiquer/revalider ;
ne pas qualifier la qualité finale de verte. L'intégration et le build de cette
dernière commande n'ont pas été exécutés après l'échec unitaire.
L'E2E intermédiaire a été interrompu après découverte du JSON brut et des nouveaux
correctifs : 44 passent, un interrompu, 20 non exécutés ; il ne vaut pas réussite.
Une nouvelle exécution complète est requise sur le correctif final.
Ulrich demande ensuite un nouveau chat frais : sauvegarder les correctifs et cette
limite dans la branche/PR #62, sans fusion ni nouvelle publication. La reprise
doit commencer par terminer ces validations, puis seulement la recette humaine.

**État : partiel.** Correctif livré sur main et synchronisé dans Lovable ;
aucune nouvelle publication produit. La recette humaine bidirectionnelle
reste nécessaire. Aucun lot suivant ni nouveau chat lancé.

#### État réel et contrôle du lot 3

Base après fetch : `f01532be27840025836aee44316da5d50518defd`, main
local/distant identiques, checkout propre. Clôture #60 fusionnée le 21 octobre
à 22:40:59 Europe/Paris : CI `39669987036` verte sur le HEAD exact
`ae034c668398b25037d9558f44c864754969e6a7`, puis CI main `39672418024` verte.
Lovable au même SHA, ready/agentFinished ; workspace Memoways et Cloud
`iralfqlslqndgvexixis` confirmés. Identité GitHub existante `Ulrfis` réutilisée.
Branche technique : `codex/character-handoff-recipe-lot-4`, checkout canonique.
Deux revues indépendantes du lot 3 n'identifient aucun défaut restant de son UI.

Baseline locale : 734 unitaires, 41 intégrations, 48 régressions,
lint/typecheck/build verts ; 65 E2E sans retry, un worker, 10,3 min.
Premier lancement E2E empêché par EPERM avant tout test ; relance avec accès
système autorisé. Captures simulées 390/1280 px relues : pastille conforme.
Deux E2E isolés visant la preview sont non concluants : connexion Lovable
avant AVA, bouton Commencer absent. Brave déjà authentifié accède à l'admin
preview ; aucune connexion ou cookie copié pour contourner cette limite.

#### Configuration sandbox préparée et activée

V7 `98145fe3-96f1-4525-84c2-0e0a1cc5c6da`, copie de la v6
`9217fd34-321a-45c7-8363-6a8cf0b0157c`, dans **sandbox-ulrich uniquement**.
Différence relue : maximumHandoffsPerSession de 1 à 8, et son unique mention
textuelle « au maximum 1 fois » devenue « au maximum 8 fois ». Tous les autres
champs config et le reste du prompt sont identiques ; seuil 4 et pause 2 conservés.
Confiance préalable 95 % : table/flux existants, comparaison JSONB et absence de
nouveau moteur/migration ; [référence PostgreSQL](https://www.postgresql.org/docs/current/functions-json.html).

Le connecteur SQL Lovable porte postgres sans acteur applicatif ; la RPC de
publication exige un membre admin. Brouillon préparé par le connecteur natif,
puis activé par le bouton Publier de l'admin déjà authentifié dans Brave,
sans usurpation SQL ni remplacement de la RPC. Activation vérifiée à 08:10:29
Europe/Paris : v7 publiée, v6 archivée, ses 21 sessions épinglées conservées.
Production narrative v1 toujours publiée à quota 1 ; v2 brouillon inchangée.
**Publication de configuration sandbox distincte de publication du produit.**
Aucune migration, Edge Function, voix, secret ou fournisseur modifié.

#### Première recette humaine : échec conservé

Admin preview → Sandbox Ulrich → Tester moi-même, onglet neuf rechargé,
frontend `index-awa67RiN.js`. Session `18e7d9f8-e65b-425e-bc69-ca58ca6cb231`,
08:11:15–08:16:53 Europe/Paris : Emma, v7 épinglée, film vu repris de l'appel
historique, player_role null, compteur 0. Portrait runtime Emma chargé.
Ulrich confirme ses échanges et la voix, puis un accord entendu après une
seule demande de passage au tour 5. Aucune pastille : GM executed en 3174 ms,
player_switch_request accept/max, action none, handoff_assessment nettoyé null ;
événement handoff_blocked/assessment_missing. Micro fermé, puis Terminer,
user_hangup vérifié. Aucun appel Max ni retour, aucun succès prétendu.

455 tokens de sortie et état completed ne signalent pas une troncature.
Sans diagnostic complet, null ne distingue pas omission et contrat rejeté.
Le dernier échange est pronominal, sans Max nommé ; la preuve de cible peut
rester indémontrable selon les gardes conservées. Aucune cause exclusive affirmée.

#### Correction minimale du contrat effectif GM

Chemins batch/streaming relus : handoffDelivery et turnId sont transmis.
Contradiction certaine : schéma historique « EXACTEMENT cet objet » sans
handoff_assessment, action décrite comme suggestion future, puis extension dite
optionnelle et exemple non enveloppé. Le bloc runtime devient explicitement
prioritaire ; son exemple place la clé à la racine du JSON existant. Sa présence
est exigée avec contexte exact, null si aucun passage ou cible non résolue.
Un accord déjà délivré classé accept doit viser la même cible dans action handoff.
Aucune permission reconstruite depuis les champs historiques. Parseur toujours
optionnel pour l'historique, preuves/gardes, même modèle, un appel, 950 tokens,
timeout, capture, voix et mémoires conservés. GM_CODE_VERSION incrémentée.

Deux tests builtin/override rouges (clé d'exemple absente), puis 114 ciblés verts.
Deux revues Standards/Spec finales sans constat après clarification de la règle
null/cible. Relance E2E interrompue pour cette clarification non comptée verte.
Qualité finale : **736 unitaires, 41 intégrations, 48 régressions** et
lint/typecheck/build verts ; avertissements hooks/bundle préexistants.
**65/65 E2E locaux sans retry en 10,0 min**, un worker ; CI 65 E2E en 10,2 min.
Ces tests de contrat ne prouvent pas une réussite réelle du modèle.

[PR #61](https://github.com/memoways/ava-proto1/pull/61) fusionnée à 08:37:51
Europe/Paris dans `180e018714f1916ffe32df9a94df1906b1ee209b`, après
[CI 39733628039](https://github.com/memoways/ava-proto1/actions/runs/39733628039)
verte sur le **HEAD exact `0562abe37599618a39d93a4c8333b7bdf8b5d7c5`**.
SHA du run, HEAD de PR et tous les checks relus avant fusion protégée par SHA.
Main local/distant identiques, checkout propre après fusion ; Lovable natif
même SHA, ready/agentFinished. [CI post-fusion 39735148175](https://github.com/memoways/ava-proto1/actions/runs/39735148175)
contrôlée séparément ; son résultat doit être relu au départ de la reprise.

Décision durable du contrat effectif relue, ajoutée à l'entrée Notion AVA
existante et vérifiée ; Source conservée, Last updated by=Codex. Aucune préférence
inventée, donnée sensible ou transcript importé ; About et Conare inchangés.

#### Reprise et limite humaine

Preview corrigée `index-Ch9HRnsK.js`, diagnostic=full, session
`81e5fdca-e3be-4fc8-b170-7c68672e9307` ouverte à 08:39:45 Europe/Paris :
v7 épinglée, Emma, film vu, player_role null, diagnostic_trace_enabled=true.
Aucun tour utilisateur ni transfert. Micro resté fermé ; appel clôturé par
Terminer à **08:47:51 Europe/Paris**, user_hangup et compteur 0 relus.
Preview laissée à l'accueil, sans appel de contrôle en cours.
Aucun prompt/JSON brut de GM produit par ce contrôle sans échange.

La recette corrigée reste à faire avec Ulrich disponible : nouvel appel
Emma sur la preview, diagnostic=full, échanges naturels puis **une seule demande
explicite vers Max** après le seuil ; vérifier prompt/JSON brut, preuve délivrée,
offre, clic, sonneries et réponse audible. Retour Emma après pause et nouvel
accord ; même session/timer/film/rôle/posture, profils/voix et mémoires privées.
Ne pas répéter après refus, assouplir les gardes ou substituer une voix synthétique.
Publication produit exclusivement Lovable après résultat observable accepté,
puis contrôle du frontend servi ; aucun déploiement n'a été demandé dans ce lot.

Branche de clôture : `codex/character-handoff-lot-4-closeout`, base
`180e018`. CHANGELOG/STORY et le [prompt autonome de finalisation du lot 4](prompt_reprise_switch_personnages_finalisation_lot_4.md)
sont actualisés, avec la correction de préparation du test de révocation ancienne.
Clôture à fusionner seulement après CI verte
sur son propre HEAD exact, puis recontrôler main et synchronisation Lovable.
Le prochain assistant part du main réel après fetch, sans restaurer ces hashes.

## 6. Validation attendue

- Unitaires : T6 différé ; T10 pronom/faux prénom contextualisé ; T11 nom explicite + accord naturel ; inquiétude émotionnelle sans refus ; refus explicites et sans « ne » ; « Je vais l’appeler… enfin non » ; extrait affirmatif choisi au milieu d’un refus ; oui hors contexte ; cible incohérente ; décision invalide/périmée ; offre révoquée et nouvelles versions.
- Composants : absence sans accord, portrait cible sous actif, clavier/ARIA/mouvement réduit, bouton Rester, PTT/HF utilisables avec offre disponible, blocage seulement pendant la transition.
- Intégration/reprise : ancien JSON inéligible, nouveau contrat restauré seulement après validation, quota et pause, PATCH refusé, échec audio après commit, sessions closes, double clic et deux onglets concurrents (révocation contre résultat GM tardif et deux acceptations).
- E2E (`tests/e2e/prd4-happy-path.spec.ts`) : Emma → demande → accord → pastille → clic → trois sonneries → Max ; après pause et nouvel accord, retour Emma ; compteur 2, même session/timer/film, voix/portrait/mémoire corrects. Couvrir GM absent/retardé, accord non joué, cible devenue indisponible, réponse tardive ancien acteur et raccrochage pendant l’appel.
- Commandes produit après implémentation : `npm run test:quality`, puis `npm run test:e2e` ; validation preview et publiée exclusivement Lovable. Les tests ciblés actuels ne remplacent pas cette recette.
- Recette humaine sandbox : échange naturel comparable à la session analysée, puis clic sur la pastille ; preuve simultanée de l’offre GM autorisée, du clic, des sonneries, de la réponse audible de Max et de la persistance. Répéter le retour. Accès : admin publié → Sandbox Ulrich → Tester moi-même. Ne pas réutiliser l’appel clôturé.

## 7. Vérifications réalisées pour ce plan et livraison

- Lectures Cloud exclusivement en SELECT ; session et configuration identifiées, aucune modification de donnée.
- Rejeu en mémoire des vraies fonctions `detectPlayerSwitchRequest` et `hasCharacterHandoffConsent` sur T6/T9/T10/T11 via `esbuild`, sans modifier les sources : **deux divergences attendues sur T10/T11**, code de sortie 1. T11 confirme un échec même lorsque la demande est reconnue. Il s’agit du rejeu des filtres, pas d’un nouveau parcours navigateur complet.
- `npm exec vitest run src/services/characterConversation.test.ts src/services/sessionHandoffResume.test.ts src/components/prd4/ConversationScreen.test.tsx src/components/prd4/CallingMaxScreen.test.tsx` : **39/39 tests verts**. Les formulations de la session ne sont pas couvertes par ces tests existants.
- Maquette documentaire `docs/prototypes/character-handoff.html` : parcours simulés accord/appel/retour/indisponibilité/raccrochage et mobile vérifiés avec Playwright ; aucune erreur navigateur, aucun débordement horizontal sur écran 390 px. Captures inspectées visuellement. Cette vérification ne constitue pas la recette du produit.
- Relecture critique du plan : consentement sémantique contextualisé, mutations conditionnelles, durée des demandes et offres, version figée de session et reprise après incident précisés.
- Livraison de ce lot : documentation seule. Les états GitHub sont renseignés dans le compte rendu de clôture ; aucun correctif de switching, changement de configuration, migration ou publication produit effectué.

## 8. Choix produit restant à valider avec le plan

Recommandation : une offre disponible expire au prochain message utilisateur finalisé ; nouvelle évaluation requise. Cela garde le bouton cohérent avec la dernière réplique sans bloquer la discussion. Le quota de recette proposé est 8 transferts exécutés par session ; seuil 4 et pause 2 restent appliqués, y compris aux demandes explicites. Ces choix doivent être approuvés avec l’ensemble du plan avant réalisation.

---

## Archives de livraison — jusqu’au 13 octobre 2026

Les sections suivantes conservent les décisions et preuves historiques ; la proposition du 19 octobre et ses constats de session figurent au-dessus.

# Appels proposés par le Game Master

## Clarification prioritaire d'Ulrich — 13 octobre 2026

La demande actuelle remplace l'interprétation d'appel libre ci-dessous :
aucun bouton Appeler Max/Emma par défaut pendant la conversation. Le GM
autorise une proposition selon l'échange et les règles narratives ; le
personnage doit accepter, puis le joueur choisit Appeler ou Rester. Le clic
autorisé ferme capture/sortie, joue les sonneries et change de personnage
dans la même session. La sélection du premier personnage reste disponible.

Base du correctif : main `2ee4110` (runtime publié `5615851`). Plan :
1. Supprimer le bouton permanent et le chemin d'appel libre. Rattacher les
   sonneries au seul bouton d'acceptation d'une offre GM courante.
2. Retirer le transfert automatique décidé par regex de réponse personnage.
   Une demande vocale attend la décision GM et les gardes narratives avant
   toute offre ; les refus/hésitations n'activent pas le bouton.
3. La recommandation GM précédente guide une proposition au tour suivant,
   mais une réponse qui refuse ou n'accepte pas ne doit pas ouvrir l'offre.
   Attendre le GM post-tour exécuté ; aucun timeout/résultat périmé ne vaut
   permission. Conserver les seuils/cooldowns/config/voix/prompts.
4. Composant : bouton absent sans offre, présent dans les deux sens avec
   offre. E2E simulés : refus, GM retardé/échoué, accord avant seuil bloqué,
   proposition consentie et refusée, appel autorisé avec sonneries/session,
   refus de PATCH puis reprise ; conserver les protections STT de capture.
5. Qualité complète, deux revues indépendantes du diff depuis `2ee4110`,
   CI, fusion main, synchronisation et contrôle preview par Lovable. Publier
   le correctif après vérification ; test publié de l'absence par défaut.

Aucune nouvelle migration : la contrainte non négative autorisée dans #31
reste compatible avec les compteurs historiques et les règles du GM. Aucun
secret/flag/provider/algorithme hands-free modifié. Confiance95% : source du
bouton permanent et contournement vocal identifiés ; offre GM/validation et
écran sonnerie réutilisables, tests existants. Référence React officielle :
https://react.dev/learn/conditional-rendering. Livraison corrective attestée ci-dessous.

Correctif local : bouton libre et transfert vocal automatique retirés.
La classification GM d'un accord ne suffit pas sans recommandation handoff ;
la recommandation passe les gardes du directeur, et la proposition attend
l'accord du personnage après guidance. Un GM échoué/invalide/retardé ne vaut
pas permission. Les offres sauvegardées portent l'approbation GM et sa version ;
les recommandations anciennes non approuvées ne rouvrent pas un bouton à la
reprise. Sonneries et événements d'appel réutilisés, source gm, clés distinctes.
Un refus de PATCH conserve le personnage, compteur et offre pour réessayer.

Vérification initiale locale : deux tests composants reproduisent rouge le bouton permanent avant correction,
puis verts. Qualité locale : 44 régressions, 482 unitaires, 30 intégrations,
lint sans erreur (un avertissement préexistant), typecheck et build réussis.
11 E2E Chromium simulés réussis : deux sens, aucune bascule automatique,
GM refuse/hésite/retarde/échoue, accord classifié sans recommandation, seuil
narratif, recommandation suivie de refus/accord et choix Rester, PATCH refusé
puis repris. Les six anciens E2E d'appel libre n'expriment plus le contrat ;
remplacés par ces parcours GM. Protections STT et tests de remplacement de
capture lors du recommencement/flush mains libres conservés. Ces résultats intermédiaires sont complétés par les revues, la CI finale et
la livraison décrites ci-dessous.

Revues de `e049646` : refus oraux sans « ne » et demandes de rester pouvaient
contredire un GM classant accept ; l'approbation GM était aussi perdue par le
premier parse de session avant la reprise. Cinq tests reproduisent rouge ces
cas, puis verts après veto des refus explicites et conservation du stamp
sanitisé. Deux tests supplémentaires traversent la vraie fonction de chargement
DB → session → validation de reprise ; une offre approuvée de la bonne version
est conservée, une ancienne offre ou autre version est refusée. Trois E2E
vérifient les contradictions GM accept + refus oral, sans bouton ni bascule.

Revue complémentaire `499b187` : deux négations orales avec auxiliaire restaient
non couvertes (« Tu peux pas appeler Max », « Je peux pas te passer Max »).
Quatre régressions supplémentaires rouges avant correction, puis vertes.
Le consentement n'est plus déduit d'un vaste fragment de texte : phrases
explicites de transfert, ou oui court à une demande directement classifiée
et recommandée par le GM. Les négations avec/sans auxiliaire restent veto.
Les faits négatifs sans lien avec le transfert ne bloquent pas une proposition
claire. Aucun prompt ni configuration narrative changé.

CI `38381793755` : qualité complète réussie et 32/33 E2E verts. Seule la
lecture immédiate du journal asynchrone « seuil narratif » échoue : la trace
réseau du retry contient bien handoff_blocked/handoff_before_minimum_turn et
l'interface sans bouton. Le test attend maintenant cet événement avec poll,
comme le test de refus joueur. Aucun changement produit pour cette correction
d'attente ; CI complète réussie sur le dernier HEAD selon le bilan ci-dessous.

## Livraison corrective — 13 octobre 2026

### Complément de recette en attente du geste humain — 13 octobre 2026

Nouvel appel publié préparé via l'admin → Tester moi-même dans Brave,
sandbox-ulrich, Emma, film pas_vu, bundle `index-B6k7eAnd.js`, session
`3e5bb2d0-ded4-4ba7-aa12-05d343ad2040`. Choix initial disponible puis
aucun bouton pendant l'appel ; micro fermé, aucun tour au relevé initial.
Protocole court sauvegardé dans le [plan P0](plan_lot_1_observabilite_latence.md) :
échanges de soutien, une seule demande après le minimum narratif, lecture du
GM et de l'accord explicite, puis clic par l'agent si l'offre est autorisée.
Refus sans répétition ; pas de permission déduite d'une demande seule.
Transfert accepté non observé à ce stade, aucune correction ni republication.

Complément humain : premier échange de soutien confirmé terminé par Ulrich,
Emma retourne à l'écoute ; GM executed/action none au tour2, compteur0,
aucune offre. Un deuxième échange narratif est demandé avant la demande
unique de transfert. Le transfert accepté reste non observé.

### Résultat de la demande unique — 13 octobre 2026

La demande a été exécutée après une cinématique terminée naturellement.
GM tour7 executed/action handoff vers Max / stance accept, puis tour8
executed/action handoff. Emma autorise un essai avec incertitude sur la
réponse de Max ; la réponse suivante ne donne aucun transfert explicite.
Replay dans hasCharacterHandoffConsent réel : false aux deux tours,
notamment à cause du veto « je ne sais pas s'il… » et de l'absence d'une
forme explicite reconnue. Le GM seul n'autorise donc aucun bouton.
pending_handoff null, zéro bouton, aucun handoff_proposed/executed,
compteur0. Aucun refus répété, aucun seuil ou prompt changé.

Les conditions complètes d'une offre affichable ne sont pas établies :
**transfert accepté non observé**, pas de défaut de bouton après une offre
approuvée et consentie démontré. Clic/sonneries/arrivée chez Max non exécutés.
Appel terminé proprement14:34:23.966Z, user_hangup, même session.
Preuves et réserves : [bilan P0](plan_lot_1_observabilite_latence.md).

[PR #32](https://github.com/memoways/ava-proto1/pull/32) fusionnée sur main
à `2026-10-13T10:37:58Z`, commit `f251eb38a2094977f3ed5adbdfb8a2008f584ab2`.
[CI finale 38383503886](https://github.com/memoways/ava-proto1/actions/runs/38383503886)
réussie sur `82c14d722128e8656a095782d08c23c3d099cb9c` : 44 régressions,
494 unitaires, 30 intégrations PGlite, 33/33 E2E, lint sans erreur (un
avertissement préexistant), typecheck et build. Deux revues indépendantes
Standards/Spec sans constat restant sur `7a4d4b4` ; revue incrémentale du
seul changement de test `82c14d7` également sans constat. Aucun code produit
modifié entre ces deux révisions.
[CI post-fusion 38384697497](https://github.com/memoways/ava-proto1/actions/runs/38384697497)
également réussie sur `f251eb3`.

Lovable natif vérifie la cible : projet `1265958d-b74e-40f2-917d-182fe05163fc`,
workspace Memoways `5glbtPltldwz9tgNwIi4`, Cloud Supabase activé
`iralfqlslqndgvexixis`. Le HEAD Lovable correspond à `f251eb3`, agent terminé,
projet ready. Preview servie avec `index-sUKr0zuI.js` après synchronisation.
Contrôles réels dans Brave, sandbox-ulrich : choix initial disponible, écran
d’appel et salut de Max/Emma, puis zéro bouton Appeler dans la conversation.
Micro jamais activé, aucune parole simulée injectée dans l'application.

Sessions preview :
- Max `e53af115-4c62-489e-a5b5-676cb3ab93c8`, début `10:40:01.683425Z`,
  fin par Terminer `10:40:22.750Z`.
- Emma `c0629007-a593-4eae-b700-4b1329ebe476`, début `10:41:00.828191Z`,
  fin par Terminer `10:41:25.490Z`.

Publication par deploy_project Lovable natif, une seule demande, ID
`189a34ed-4133-41c0-b72e-879e7ef80946`, réponse pending. Le connecteur
n'expose pas le statut final du job ; la livraison est attestée par le frontend
nouvellement servi et les contrôles fonctionnels sur le domaine canonique.
Nouvel onglet ouvert via Tester moi-même dans l'admin publié, Sandbox Ulrich,
URL https://proto1.parle-a-ava.com/?env=sandbox-ulrich,
frontend DOM `index-B6k7eAnd.js` (ancien publié `index-D3Q4mR9A.js`).

Sessions publiées :
- Max `3c01f001-bc8f-48ab-b8bd-70973f47ab75`, début `10:42:46.808123Z`,
  fin par Terminer `10:43:26.093Z`.
- Emma `006194b2-46f2-49a6-9bb8-3bdc74069668`, début `10:44:10.695595Z`,
  fin par Terminer `10:44:45.716Z`.

Les deux personnages sont en ligne avec leur salut et zéro bouton de transfert
par défaut en preview comme en publié. Lecture native des quatre sessions :
active_character conforme, handoff_count0, pas_vu conservé, ended_at renseigné.
Les contrôles sont clôturés ; l'onglet publié est laissé à l'accueil pour Ulrich.

La branche positive GM + consentement + clic + sonneries, ainsi que les refus,
retards, erreurs, seuils et reprises sont attestés par les E2E simulés. Un
transfert réellement accepté pendant une conversation humaine n'a pas encore
été observé ; les anciens appels libres ne constituent pas cette preuve.
Les limites P0 déjà documentées restent valables. Aucun prompt, seuil narratif,
réglage, fournisseur, secret, Edge Function ou migration changé pour ce correctif.

Pour tester : ouvrir l'admin publié, garder Sandbox Ulrich, cliquer Tester
moi-même et commencer un nouvel appel. Le choix initial est libre ; pendant
l'appel, une demande seule n'affiche pas le bouton. Le GM doit recommander un
transfert valide et le personnage donner un accord explicite ; le joueur peut
ensuite Appeler ou Rester. Il n'y a aucun transfert vocal automatique.
Aucun prompt supplémentaire ni nouvelle migration à lancer dans Lovable ;
la synchronisation, les contrôles preview et la publication ont été effectués.
Recharger les anciens onglets de test avant de comparer les versions.

Les sections suivantes sont l'historique de l'interprétation initiale,
supplantée par cette clarification ; elles ne définissent plus la règle produit.

Demande explicite d'Ulrich le 13 octobre 2026 après le contrôle publié
d'Emma : un bouton doit couper Emma, appeler Max directement, faire entendre
quelques sonneries, puis laisser Max répondre. Le bouton symétrique depuis
Max appelle Emma. Ce changement produit est distinct du P0 publié depuis
57d04a7 (baseline et limites dans `plan_lot_1_observabilite_latence.md`).

## Comportement attendu

- Un bouton « Appeler Max » avec Emma, « Appeler Emma » avec Max, disponible
  sans attendre une proposition narrative et utilisable pendant une réponse.
- Un clic coupe la capture et la voix actuelles, annule les requêtes et les
  callbacks du tour abandonné ; aucune réponse ancienne ne doit se rejouer.
- Réutiliser `CallingMaxScreen` : trois sonneries, puis décroché. Le second
  personnage répond à chaque appel manuel, y compris lors d'un retour.
- Conserver la même session, son temps restant, le choix film et l'historique
  isolé par personnage. Appliquer la fiche et la voix runtime validées de
  la cible ; si elle est indisponible, rester sur l'ancien personnage avec
  un message clair, micro fermé.
- Empêcher doubles clics et changements concurrents ; pas de reprise de
  micro automatique pendant la sonnerie. Une fin de session doit empêcher
  une bascule tardive.
- Pendant la brève ouverture du micro, attendre sa stabilisation avant de
  rendre le bouton actif pour éviter une capture qui finit de démarrer sur
  l'ancien personnage. Le bouton reste utilisable pendant la réponse audio.
- Garder les propositions GM et les demandes vocales actuelles. Le nouveau
  bouton est un choix manuel du joueur, tracé comme tel ; il ne nécessite
  aucun changement de prompt, règle éditoriale ou configuration.

## Réalisation et validation

1. Ajouter le bouton au composant de conversation et la transition manuelle
   dans `IndexPRD4`, réutilisant son moteur de changement de personnage.
2. Bloquer les traitements périmés dès le clic ; séparer la sonnerie manuelle
   de la transition narrative existante. Tracer les appels répétés avec des
   identifiants d'événement distincts.
3. Tests de composant des deux sens, sans proposition GM et pendant la voix.
   E2E avec fournisseurs simulés : interruption d'une réponse, sonneries,
   changement dans la même session, retour et salut, profils distincts,
   ancien texte masqué, double clic sans double bascule.
4. Qualité complète, revues indépendantes Standards/Spec et CI sur PR.
   Fusion sur main, synchronisation Lovable et contrôle preview. Publication
   du nouveau bouton après validation du comportement demandé ; aucune
   chaîne de déploiement externe, migration, secret ou flag.

## Confiance avant réalisation

95 % : aucun bouton manuel indépendant trouvé ; le moteur de changement,
les primitives d'annulation et l'écran d'appel existent. Les refus constatés
sont des décisions narratives, pas une panne de reconnaissance. La demande
actuelle autorise explicitement le choix manuel direct. Références : tests
existants de conversation/sonnerie et fixtures Playwright du dépôt ;
[documentation officielle React useRef](https://react.dev/reference/react/useRef)
pour le verrou synchrone et les callbacks. Aucun nouvel adaptateur STT ou
algorithme d'interruption acoustique : arrêt explicite de capture via les
primitives actuelles. La stratégie de `handsFreeVoice.ts` reste inchangée.

## Livraison

Livraison précédente : publiée via Lovable le 13 octobre 2026, après migration autorisée
et contrôles réels des deux sens en preview puis sur le domaine canonique.
Preuves de cette livraison dans la section « Livraison finale vérifiée ».
Elle concerne l'interprétation initiale ; le correctif GM de la clarification
en tête du document doit encore être livré.

Historique initial avant livraison : branche `codex/manual-character-call`,
base `c91b683`. Deux reproductions composant rouges avant le bouton, puis
vertes. Trois nouveaux E2E Chromium simulés réussis : interruption audio,
trois bascules avec clés distinctes dans une même session, retour avec salut,
réponse LLM tardive écartée, cible devenue indisponible sans changement de
personnage. Attente initiale du test corrigée pour les cinq secondes de
sonnerie existantes ; initialisation du fake audio attendue avant capture
pour éviter une course du fixture avec le salut initial. Aucun délai produit
changé pour corriger ces attentes. Suite : contrôles et revues sur dernier
HEAD, CI, preview puis livraison Lovable. P0 déjà publié ; baseline du
nouveau bouton séparée.

### Revue et corrections de concurrence

Deux revues indépendantes de b9f7e9a trouvent une finalisation STT abandonnée
encore traitable (Whisper finalise après stop), et une reprise de l'outbox
diagnostique manquante. Deux E2E reproduisent réellement avant correction :
ancien texte Whisper déclenche un LLM chez Max (attendu0, obtenu1), et
trace annulée jamais envoyée (attendu>0, obtenu0). Source seule du problème
aux callbacks/lifecycle Index, pas aux décisions de fin de parole.

Correctif : retirer l'identité STT courante avant stop ; callback transcript
accepté seulement pour le STT courant et une session active ; installer
cette identité avant start, abandonner silencieusement un démarrage périmé
et fermer son stream. Les finalisations PTT/mains libres ne modifient que
leur capture encore courante. Le clic reprend explicitement l'outbox.
Régression Whisper vérifie capture et flush abandonnés tandis qu'un nouveau
micro est déjà actif chez Max. Algorithme handsFreeVoice et fournisseurs
inchangés. Contrôles/revues complémentaires sur prochain HEAD nécessaires.

Après correction : qualité locale complète réussie,44régressions,
470unitaires,29intégrations, lint0erreur (avertissement préexistant),
typecheck et build. Quatre parcours manuels E2E réussis, y compris les deux
reproductions de revue désormais vertes. Les variantes Whisper renforcées
(capture et flush avec nouveau micro ouvert) sont en cours de contrôle ;
les deux revues complémentaires et la CI doivent porter sur le HEAD corrigé.

Revue complémentaire bdbecfd : deux défauts initiaux corrigés. Deux cas
supplémentaires protégés : les rejets tardifs de construction/démarrage STT
sont requalifiés si leur capture a été remplacée ; teardownSTT libère les
verrous de finalisation de la capture retirée, sans laisser un ancien finally
toucher la nouvelle capture. Deux E2E dédiés passent : après recommencement,
un ancien rejet de micro ne ferme pas le nouveau ; désactivation/réactivation
HF pendant flush permet au nouveau tour d'aboutir. Variantes Whisper capture
et flush avec nouveau micro actif également vertes. Prochain HEAD à revoir
avant fusion ; aucune publication de ce bouton encore effectuée.

### Contrôle réel après PR #30 — 13 octobre 2026

HEAD 937ac42 validé par les deux revues sans observation restante et CI
38370956927 réussie : 44 régressions, 470 unitaires, 29 intégrations et
24 E2E. PR #30 fusionnée en 2094d27, synchronisée dans Lovable ; preview
sert index-B7DiZfXD.js. Aucun nouveau bouton encore publié.

Session réelle sandbox-ulrich 8f52edc3-ae6e-4431-b205-1a63e1d07dc0 :
Emma → Max exécuté, source manual, même session et timer, compteur1.
Retour Max → Emma refusé par la base ; interface avait déjà changé d'acteur.
Cause confirmée dans pg_constraint : sessions_handoff_count_check limite
handoff_count à [0,1]. Les anciens E2E simulaient des PATCH toujours acceptés.

Correctif prévu avant publication : remplacer uniquement cette contrainte
par handoff_count >=0, conserver NOT NULL/default et toutes les données/RLS ;
ne changer l'acteur et son compteur en mémoire qu'après acceptation du PATCH.
Ajouter un test PGlite qui reproduit la limite historique puis vérifie trois
appels et les refus de négatif/null ; E2E refuse le PATCH, vérifie le maintien
d'Emma puis la reprise avec compteur1. Migration locale créée par CLI officielle
(sans connexion externe) : 20261013090739_allow_repeated_manual_calls.sql.
Application exclusivement Lovable Cloud iralfqlslqndgvexixis ; la demande
initiale interdisait les migrations, donc demander l'accord sur ce correctif
concret avant toute application cloud. Pas de changement de secret/flag/provider.
Confiance95% : contrainte native et migration historique concordent, seam SQL
PGlite et moteur existants, aucune migration d'assouplissement antérieure.
Référence officielle : https://www.postgresql.org/docs/current/sql-altertable.html.

Les deux reproductions sont rouges avant correction, puis vertes. Qualité
complète corrigée : 44 régressions, 470 unitaires, 30 intégrations, lint sans
erreur, typecheck et build réussis. E2E de refus/reprise réussi. Deux revues
indépendantes du complément : 0 constat bloquant. Application Cloud et
publication attendent l'accord humain demandé ; aucun SQL Cloud modifié.

### Livraison finale vérifiée — 13 octobre 2026

Ulrich autorise explicitement « cette migration pour les appels répétés ».
PR [#31](https://github.com/memoways/ava-proto1/pull/31) fusionnée en
`56158512fc0e8f8e915c69fbadbe537a671b9ee5`, après CI complète
[38374688314](https://github.com/memoways/ava-proto1/actions/runs/38374688314)
sur `16b6a5c` : 44 régressions, 470 unitaires, 30 intégrations, 25 E2E,
typecheck, lint sans erreur et build. Deux revues indépendantes sans constat
bloquant. CI post-fusion
[38376338000](https://github.com/memoways/ava-proto1/actions/runs/38376338000)
également réussie sur `5615851`. PR #30 avait livré le bouton en `2094d27` ;
PR #31 complète la contrainte réelle et le traitement du refus.

Cible vérifiée avec les connecteurs Lovable natifs : projet
`1265958d-b74e-40f2-917d-182fe05163fc`, workspace Memoways
`5glbtPltldwz9tgNwIi4`, base Supabase fournie par Lovable
`iralfqlslqndgvexixis` (config.toml synchronisé et Cloud activé).
Migration appliquée par query_database natif, transaction exacte du fichier
avec lock_timeout 5s. Lecture de pg_constraint après application :
`sessions_handoff_count_check`, `CHECK ((handoff_count >= 0))`, validée.
Colonne toujours NOT NULL, défaut0. Aucun UPDATE/DELETE de données dans cette
migration ; aucune modification de RLS, droits, secret, flag ou fournisseur.

Preview synchronisée sur `5615851`, frontend `index-pIhFyOdh.js`.
Session sandbox-ulrich `ce162520-3aa3-439d-8b5c-7d7b2d4462f1`, début
`2026-10-13T09:28:27.849182Z` : Emma → Max → Emma → Max, compteur3,
une seule session, choix film pas_vu conservé. Les écrans d'appel puis les
portraits/boutons cibles correspondent. Temps affiché 15:47 → 15:18 →
14:54 → 14:19, sans réinitialisation. Trois handoff_executed distincts,
source manual, sessionPreserved/timerPreserved true ; premier contact true
puis false/false. Les quatre saluts initiaux ou de retour ont des lignes
TTS-Queue Generated/Played en websocket, texte masqué lors de l'inspection.
Session clôturée par Terminer à `2026-10-13T09:30:33.507Z`, user_hangup.

Publication native deploy_project, ID
`f9ce5822-8f96-4d20-8b07-643e4a7c2a4a`, réponse pending. Aucun deuxième
déploiement pour sonder ce statut. Vérification observable : nouvel onglet
ouvert depuis Tester moi-même dans l'admin publié, environnement Sandbox
Ulrich ; URL https://proto1.parle-a-ava.com/?env=sandbox-ulrich et bundle
DOM `index-D3Q4mR9A.js`, différent du P0 `index-5XOMh72h.js`. Le connecteur
n'expose pas le statut final du job ni un hash des octets servis ; l'état
publié est attesté par le nouveau frontend et les parcours fonctionnels.

Session publiée `d6021247-ac3f-42b9-a305-b9dbd4639837`, début
`2026-10-13T09:32:25.828834Z` : Emma → Max → Emma réussi, compteur2,
une seule session, pas_vu conservé. Temps 15:46 → 15:29 → 14:37.
Deux événements exécutés distincts, source manual, session et timer
conservés ; firstContact true puis false. TTS websocket des trois saluts
généré et lu selon les journaux navigateur. Session clôturée par Terminer
à `2026-10-13T09:34:45.481Z`, user_hangup. Micro jamais ouvert pendant
ces contrôles de bouton ; aucune parole synthétique injectée dans l'application.

Les tests automatiques attestent la coupure audio/capture en cours, les
callbacks abandonnés et le PATCH refusé puis repris. Les contrôles réels
ci-dessus attestent les appels par bouton, leurs écrans et leur persistance,
avec lecture audio journalisée ; ce ne sont pas une nouvelle mesure
acoustique ni une validation humaine de coupure pendant un échange vocal.
Ce choix manuel n'atteste pas une décision narrative GM de transfert accepté.
Baseline et limites P0 antérieures restent dans
[plan_lot_1_observabilite_latence.md](plan_lot_1_observabilite_latence.md) ;
pas de mélange avec ces nouvelles sessions, aucun gain de latence revendiqué.
Lot2 non commencé. En cas de rollback frontend, conserver les compteurs
historiques et la contrainte non négative : ne pas réintroduire un plafond1
sur des sessions qui ont maintenant plusieurs appels.

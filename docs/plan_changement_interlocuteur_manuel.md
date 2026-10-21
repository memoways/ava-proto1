# Passage Emma ↔ Max : validation narrative et pastille d’appel

Date : 19 octobre 2026. Statut : **diagnostic vérifié, implémentation proposée**.
Périmètre de ce lot : analyse et plan ; aucun code produit, réglage Cloud ou déploiement modifié.
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
Publication produit exclue. Résultats de clôture à compléter après exécution.

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
E2E complet en cours ; teaser WebKit initialement en échec sur la sélection
du personnage, puis vert en isolation (1/1, 3,4 s), sans modification des tests.

**Revue :** types, nettoyage, consommateurs GM, reçu de livraison et fixtures
relus. `REQUIRED_GM_JSON_FIELDS` inchangé ; le nouveau champ n'est jamais requis.
Test du même prompt effectif, de 950 tokens / 12 s et d'un seul appel LLM.
`GM_CODE_VERSION` incrémentée pour tracer le nettoyeur, sans changement du prompt.
Recherche des usages : aucun appel au validateur hors tests, aucune injection
des instructions préparées dans les builders actifs. Pas de changement dans
IndexPRD4, UI, sessionService, director, experienceFrame ou handsFreeVoice.
Livraison GitHub et synchronisation finale Lovable à vérifier après CI.

Le [prompt autonome du lot 1](prompt_reprise_switch_personnages_lot_1.md) lance uniquement le contrat et les tests. Ce premier lot prépare types, nettoyage compatible, instructions GM testables et validateur pur ; il ne branche pas encore la nouvelle autorisation dans le runtime et ne change aucun prompt effectif publié. L’audit de décision est d’abord un résultat pur, sa persistance attend le lot 2.

À chaque clôture : actualiser `CHANGELOG.md`, `STORY.md` et ce plan avec les preuves et l’état réel ; vérifier la CI du HEAD avant fusion vers `main` ; produire et sauvegarder un prompt autonome du prochain lot pour un nouveau chat. Si le lot reste incomplet, le prompt doit d’abord en permettre la finalisation. Répéter ces obligations dans chaque prompt suivant. Aucun enchaînement automatique de lots ni publication produit pour le lot préparatoire. Les choix de quota et de validité d’offre du §8 n’ont pas à être activés dans le lot 1.

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

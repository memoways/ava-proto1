# Fiabiliser les tours transcrits et la continuité des transferts

Date : 23 octobre 2026. Demande : Ulrich, dans le chat « Fiabiliser transcription et micro ».
Base : `142310384aae2e33f3769f4f340122ab2bec6c4b`, checkout canonique, branche unique
`codex/voice-turn-continuity`. PR étrangère #24 préservée.

## Résultat attendu

- Une transcription finalisée est transmise intégralement au personnage actif.
  Un échec technique ne doit pas devenir une fausse incompréhension systématique.
- Avant toute parole délivrée, récupérer les erreurs transitoires avec le même
  texte et le même contexte ; borner les tentatives, respecter annulation et délais.
- En dernier recours, réponses brèves, variées et distinctes par personnage,
  sans prétendre avoir compris un contenu que le modèle n'a pas traité.
- Conserver le choix de micro activé durant Emma → Max → Emma, avec suspension
  pendant les sonneries puis réouverture automatique après un accueil réussi.
  Un arrêt volontaire du micro, un raccrochage ou une panne audio restent respectés.
- Accueils de transfert variés : distinguer appel initial, premier transfert et
  retour ; connaître seulement la provenance de l'appel et sa propre conversation.
  Aucun transcript ou confidence d'Emma transmis à Max, ou inversement.

## Diagnostic et méthode

Reproductions ciblées avant correction : erreur de génération avant parole,
transcription identique dans chaque tentative, réponse de secours répétée,
micro après transfert, accueil initial réutilisé et retour fixe.
Vérifier aussi les chemins batch/stream, les refus de sortie non sûre, l'annulation,
les sorties déjà délivrées et l'isolation des mémoires.

Constats reproduits par tests : le secours « la ligne accroche » est
commun et fixe dans `prd4Orchestrator.ts`. Le texte utilisateur est déjà passé à
`simulateMaxResponse` ; cette phrase indique une exception de génération, elle
ne prouve pas une perte STT. `handleAcceptHandoff` appelle `cleanupAudio`, qui
efface l'état mains libres. `switchToCharacter` reprend la ligne d'ouverture
initiale au premier transfert, puis « Oui, je suis là. » à chaque retour.

Correction de routage rappelée par Ulrich le 23 octobre : **la base Supabase vit
dans Lovable Cloud ; son accès passe par le connecteur MCP Lovable du projet
`1265958d-b74e-40f2-917d-182fe05163fc`**, sans connexion Supabase directe.
La tentative initiale via le connecteur Supabase générique était une erreur de
méthode, pas un blocage d'accès à résoudre. Règle consignée dans AGENTS, CLAUDE et
la mémoire AVA Notion existante. Les traces se lisent désormais par Lovable.

### Diagnostic réel, lecture seule via Lovable

Le 23 octobre, lecture ciblée de `sessions` et `conversation_turn_traces` :
les neuf secours fixes observés sur les trois derniers jours ont **tous le texte
utilisateur exact dans les messages de la requête personnage**, après résolution
des références `textBlobs` du format de trace V2. Huit erreurs `Missing response
intent`, une `Incomplete response sentence or quote`. Aucun timeout constaté
parmi ces neuf secours. Le modèle recevait donc la transcription ; la réponse
était rejetée par le contrat de sortie streaming, puis remplacée par la même
phrase fixe. L'en-tête brut rejeté n'est pas conservé dans ces traces : sa forme
exacte n'est pas déduite de l'intitulé d'erreur.

Dernière session `fcfa4f01`, vingt messages utilisateur : secours aux tours
8, 12, 15 et 19 (trois en-têtes manquants, une phrase incomplète), avec modèle
`openai/gpt-5.6-luna`, 220 tokens, température 1,4 et délai demandé 8 s.
Ces réglages restent inchangés. Il ne s'agit pas d'une mesure globale du taux
de panne ni d'une preuve d'une transcription toujours intelligible.

Reproduction supplémentaire : le parseur exigeait une séquence LF exacte ;
un en-tête JSON valide accompagné de CRLF ou des échappements `\\n` documentés
déclenchait aussi `Missing response intent`. Le correctif accepte ces dispositions
autour du même marqueur `<speech>`, tout en exigeant le JSON privé valide et une
parole complète, sans identité étrangère, structure ou citation ouverte.

### Correction

Une seule récupération avant toute phrase soumise à la synthèse : même texte,
historique privé, fiche, cadre, modèle et budget ; passage au chemin batch existant
sans en-tête d'intention, puis validation complète avant envoi à la voix. Aucun
RAG ou GM doublé, aucun message utilisateur supplémentaire, aucun rejeu après
phrase soumise. L'intention de la tentative rejetée est remise à null ; les reçus
conservent la parole réellement récupérée même si le consommateur échoue ensuite.
Le surcoût possible est **un appel personnage supplémentaire sur un tour récupéré**.

L'échéance UI inclut la persistance avant génération ; chaque tentative est
effectivement bornée et annulée, avec 100 ms réservées à la finalisation locale
avant le watchdog existant. Les fenêtres configurées 11 s / 8 s sont conservées.
Ce filet ne démontre pas que les erreurs historiques venaient d'un timeout.

Les secours épuisent un répertoire distinct pour chaque personnage avant de
réutiliser la plus ancienne formulation. Les accueils distinguent appel initial,
premier transfert et retour ; la provenance minimale du transfert est persistée
dans l'historique du destinataire et injectée **identiquement** dans le cadre du
personnage et du GM, même après sortie du salut de la fenêtre récente. Aucun
contenu de l'autre conversation n'est injecté. Le choix mains libres est conservé
pendant la suspension et réarmé après l'accueil ; arrêt volontaire, raccrochage,
révocation et panne audio après commit gardent leur comportement explicite.

La fiche éditoriale existante de Max/Emma dans Lovable Cloud a été consultée ;
aucune fiche ni consigne narrative Cloud n'a été modifiée. Les variantes de secours
et d'accueil sont courtes, procédurales et ne créent aucun nouveau fait du récit.

## Contrats conservés

`handsFreeVoice.ts` conserve les décisions de tour et d'interruption ; stratégie
texte et candidat acoustique réversible inchangés (plan latence, section 3).
Identité, canon, validation des phrases, reçus de livraison, consentement, CAS,
session/timer/film/rôle et mémoires privées inchangés. Pas de changement de modèle,
voix, réglage Cloud, migration ou fonction. Lovable reste l'unique publication.

## Vérification et livraison

Tests ciblés rouges puis verts, qualité complète et E2E appropriés. Une PR vers
main, CI verte sur son HEAD exact, fusion puis CI main E2E verte ; suppression de
la branche du lot. Vérifier ensuite le SHA synchronisé dans Lovable et sa preview.
Recette humaine et publication production à distinguer explicitement.

## État

Reproductions rouges puis **69 ciblés verts** sur la source finale. **70/70 E2E
sans retry en 11,6 min**, Chromium/Firefox/WebKit. Après les dernières précisions,
les trois nouveaux parcours de continuité repassent sur la source finale : Max et
Emma récupèrent la parole sans en-tête privé ni doublon de message utilisateur ;
Emma → Max → Emma capte la première phrase après chaque transfert sans nouveau
clic micro, avec isolation de l'historique (3/3, 49,9 s).

Première qualité complète verte, puis une relance concurrente aux E2E a rencontré
trois timeouts d'initialisation PGlite (hooks de 10 s inchangés). Relance isolée à
un worker : **41/41 intégrations vertes**, 31 s. Qualité standard finale, sans E2E
en concurrence : **verte, 801 unitaires, 41 intégrations, 57 régressions, lint,
types et build**. Le warning ESLint préexistant sur la dépendance de createSTT
et l'avertissement de taille des bundles restent explicites. Assertions et délais
de test inchangés ; la concurrence
observée n'établit pas à elle seule la cause exclusive des timeouts.

CI exacte, fusion et CI main à relever dans la PR avant clôture. La branche du lot
doit être supprimée après ces contrôles. PR #24 et branches antérieures d'autres
lots préservées. Recette humaine au casque et publication production restantes ;
aucune action Cloud autre que les lectures de diagnostic et aucune publication
de ce correctif à ce stade.
Références API consultées : [React useRef](https://react.dev/reference/react/useRef),
[useEffect](https://react.dev/reference/react/useEffect),
[AbortSignal](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal/throwIfAborted).

## Livraison #72 et recette Brave du 23 octobre

PR #72 fusionnée sur `408da5fdb9b4ffd386bf53ba78256ef8a2edc197` ; CI du
HEAD exact `a90eb615710d7411716c29fbaa02a02c76450420` verte (run 39923745970),
puis CI main verte (run 39926022186), **70/70 E2E sans retry** en 12,5 min.
Le run de PR comporte un retry réussi d'un test antérieur sur l'offre à la reprise ;
son intermittence reste explicite (rejeu isolé : 2/3). Branche du lot supprimée.
Lovable MCP confirme ce même SHA prêt dans la preview, sans publication production.

À la demande d'Ulrich, Computer Use dans son Brave existant, sandbox-ulrich,
sans connexion ni mot de passe dans le navigateur intégré. Recette humaine
acceptée explicitement : Emma → Max → Emma, micro ouvert aux deux arrivées,
première parole captée, accueils et réponses jugés satisfaisants. Session de
contrôle `bdfe9ea3`, maintenant clôturée : deux transferts, version épinglée et
film `pas_vu` conservés. Les onze messages utilisateur tracés sont présents
exactement dans chaque requête personnage ; onze réponses `source=llm`.
Accueils distincts avec provenance minimale persistée ; aucun transcript complet
recopié dans les preuves.

## Complément nécessaire : déduplication du prompt

Le contrôle des requêtes réelles après cette recette révèle que le compilateur
`optimized_v3` retire à tort `experience_frame`, l'état courant, la directive
relationnelle et des souvenirs : `doublon:static:references_intellectuelles:1`.
Cette unité ne contient que `---`. Sa normalisation produit une chaîne vide,
que toute chaîne contient ; l'inclusion textuelle la considère donc à tort comme
une preuve de doublon. Le GM reçoit le cadre ; le personnage ne le reçoit pas.
La recette humaine réussie ne démontre pas ce contrat interne satisfait.

Plan du complément, base `408da5f` : reproduction rouge avec un séparateur et un
fragment court dans la fiche synthétique, puis appliquer symétriquement le seuil
minimal de comparaison déjà utilisé pour le texte entrant aux unités candidates.
Le cadre commun est aussi exempté de déduplication lexicale et d'aplatissement
des lignes, pour conserver le bloc produit par `experienceFrame` comme chez le GM,
avec les plafonds de taille existants. Un fait déjà présent dans la fiche ne doit
pas faire disparaître une partie du cadre factuel de session.
Conserver le cadre entier, l'état du tour et un souvenir nouveau ; garder les
tests de vrais doublons et les budgets. Aucun paramètre Cloud ou fiche éditoriale
modifié. Qualité complète, PR séparée sur son HEAD exact puis CI main, nettoyage
de sa seule branche et synchronisation Lovable. Une vérification runtime du cadre
réellement reçu demeure distincte de l'acceptation sonore déjà donnée.

Résultats du complément : quatre cas rouges avant correction (séparateurs et
fragment court), neuf tests du compilateur verts ensuite, dont cadre partagé
intégral même si un fait existe dans la fiche. Qualité locale complète verte :
**806 unitaires, 41 intégrations, 57 régressions, lint, types et build**.
Les contrôles de vrais doublons existants restent verts. CI exacte, fusion et
CI main du complément seront relevées dans sa PR avant clôture.

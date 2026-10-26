# Plan — Parole incarnée par personnage (Max, Emma)

## Direction après écoute — 25 octobre 2026

**Direction éditoriale conservée ; corrections app A1 vérifiées localement, livraison exacte dans le bilan de sa PR.** Ulrich confirme
que le passage entre personnages fonctionne à nouveau, mais refuse le jeu trop
lisse et détaché. Le lot 3 est livré par [#76](https://github.com/memoways/ava-proto1/pull/76),
main `147cdfff893555ede4f903158c5506dcf586e116`. Ce retour valide le passage
observé ; il ne constitue pas une nouvelle recette exhaustive bidirectionnelle.
Le naturel vocal n'est pas accepté. Cette section remplace la proposition de
lot 4 ci-dessous ; les bilans antérieurs restent historiques.

La demande suivante d'Ulrich sépare désormais l'exécution en une
[tâche éditoriale Notion prête à enregistrer](tache_notion_parole_incarnee_personnages.md)
et [quatre lots app A1–A4](plan_lot_b_rendu_vocal.md#exécution-coordonnée-notion--app--25-octobre-2026).
Leur mécanique, dépendances, validations et retours arrière sont dans ce second
plan opérationnel. La création de la tâche dans Gamilab reste non effectuée.

Après redémarrage, Ulrich confirme qu'il travaille dans Notion sur les champs
personnages. L'exécution app commence par le
[prompt autonome du lot A1](prompt_reprise_parole_ouverte_lot_a1.md), qui conserve
ce plan et laisse l'édition/synchronisation à Ulrich pendant son travail.

### Accueils A4 — 26 octobre 2026

Le répertoire app approuvé reste lié à la phrase de référence du profil et à
sandbox-ulrich ; chaque appel fixe son texte,
sans répétition immédiate lorsqu'une alternative existe. Premier transfert et
retour conservent leur provenance et leurs répertoires distincts. L'ouverture
est protégée des doubles exécutions et réponses tardives après raccrochage.
Un reçu distingue lecture complète, portion incertaine et texte privé ; le
premier son est horodaté séparément de la fin de lecture.

Ulrich a explicitement approuvé les quatre formulations initiales Max/Emma
pour sandbox-ulrich dans le chat du 26 octobre. Le
[diff exact et les preuves techniques](plan_lot_b_rendu_vocal.md#exécution-a4--26-octobre-2026)
restent dans le plan opérationnel. Les deux phrases de référence Cloud ont été
sauvegardées et relues le 26 octobre à 08:41:44 UTC, une seule par profil pour
préserver les clients publiés ; les autres champs et les profils prod sont conservés.
Ce choix app ne valide aucune proposition E0. Le connecteur Notion exposé
cible Ulrich, pas Gamilab ; aucune lecture ciblée ni sync éditoriale effectuée.
Recette au casque, intégration E0 et publication production restent distinctes.

### Correction technique A3 — 25 octobre 2026

Le banc existant compare maintenant témoin et breaks WS A2 avec un snapshot
temporaire explicite, isolé du mapping live et de la production. M1/M2/E1/E2
forment la première comparaison ; les huit cas restent proposés et non canoniques.
Même texte/voix/configuration de base en A/B, témoin Max 3 / Emma 2. Les requêtes
effectives, contrôles séparés, paramètres et transports sont visibles et exportés.
Le repli REST ne valide pas les pauses WS. Le rejeu utilise les samples WS
conservés dans un WAV borné, sans appel fournisseur, avec annulation et protection
des résultats périmés. Émotion et instruction d’acting restent non appliquées
chez Gradium ; le réglage global `padding_bonus` est distingué des breaks.

La sauvegarde du mapping reste explicite, avec compare-and-swap et relecture de
la même sandbox ; aucun réglage n’a été sauvegardé pendant A3. La lecture Cloud
confirme la version `2026-10-25T11:39:32.000Z`, pauses A2 absentes/désactivées et
tags fermés. Tests simulés et technique livrée ne valent ni audition réelle ni
acceptation du timbre. Notion Gamilab n’est toujours pas exposé dans cette session ;
aucune modification éditoriale ni synchronisation n’est effectuée.

Le main Lovable `e1c9278` a été intégré après décision explicite d’Ulrich :
le rendu par état reste disponible en production ; seules les pauses
expérimentales et les auditions sont réservées sandbox. Le blocage de
coordination est résolu, sans rétablir une fermeture générale du rendu par état.

[Résultat, validations et réserves A3](plan_lot_b_rendu_vocal.md#exécution-a3--25-octobre-2026).
Le prochain lot suit le [prompt A4](prompt_reprise_accueils_integration_lot_a4.md),
préparé dans le même tour sans le lancer. Les accueils et la recette après
intégration éditoriale restent à faire, publication production distincte.

### Correction technique A2 — 25 octobre 2026

Après A1 (#77, main `e006db65419c70b345abbe735d783f47257e7559`), l'adaptateur
Gradium peut convertir une rupture explicite de la parole validée en un break
WebSocket officiel. Les parties de contrôle restent à la frontière TTS ; mots,
texte de session et reçus restent originaux. L'option JSON par environnement
`gradiumPausesEnabled` est absente donc désactivée, et toujours refusée en prod.
Le mapping validé fixe l'essai court/normal/long à 0,25/0,6/1 seconde, borné à
huit pauses par tour. Les paramètres existants et le nettoyage anti-hoquet sont
conservés. REST reste un repli nettoyé sans pause contrôlée attestée.

Le [bilan opérationnel A2](plan_lot_b_rendu_vocal.md#exécution-a2--25-octobre-2026)
documente protocole, limites, activation, simulations et livraison. Le banc
existant REST peut préparer les témoins ; son raccord WS reste au lot A3.
Aucune écoute ni amélioration vocale mesurée, aucune acceptation humaine,
édition Notion, sauvegarde de réglages ou publication production dans A2.

### Correction technique A1 — 25 octobre 2026

Qualité locale verte (66 régressions, 967 unitaires, 41 intégrations, lint/types/build),
78 E2E verts sans retry. Le [bilan A1 du plan opérationnel](plan_lot_b_rendu_vocal.md#exécution-a1--25-octobre-2026)
distingue les corrections de contrat, les replays simulés et la livraison.
Le tour doit finir normalement, mais sa pensée peut rester ouverte ; une réponse
nette reste permise. Les plafonds et les réserves des fiches dans les quatre
variantes sont conservés. Le niveau 3 ne privilégie plus un état bloqué et le
filtre ne supprime plus une proposition uniquement parce qu'elle se répète.
Le prompt personnage et le contrat GM ne forcent plus une rotation ou la
résolution du blocage. Les noms et déclencheurs viennent de la fiche courante.
Le parseur n'a pas été assoupli. Ces constats ne prouvent aucun gain d'acting
sur une vraie sortie modèle ; écoute et intégration Notion restent distinctes.

### Répartition confirmée : Notion et app complémentaires

Ulrich précise que les champs prompts de Notion sont synchronisés et à jour.
Cette confirmation est prise comme état du chantier ; le refus de lecture du
connecteur actuel n'est pas une preuve de retard de synchronisation. Analyser
les copies actives sert à comprendre leur consommation, pas à leur substituer
une nouvelle fiche écrite dans le code.

| Destination | Responsabilité | Changement proposé dans ce plan |
| --- | --- | --- |
| Champs prompts de la base Caractères, dans Notion | Psychologie, rapport aux événements, façon de parler, contradictions, déclencheurs et cinq états propres à chaque personnage. | Propositions éditoriales ciblées et distinctes Max/Emma, à relire et approuver dans leurs champs existants. Notion reste la source. |
| Réglages de l'app, par environnement/personnage | Intensité de rugosité, voix/fournisseur, paramètres TTS et traduction des états Notion en capacités vocales réellement disponibles. | Conserver d'abord les valeurs actuelles pour isoler la cause ; éprouver les pauses, rendre visibles les limites du fournisseur, ajuster seulement après écoute. Pas de seconde psychologie ni de nouveaux états concurrents dans ces réglages. |
| Code technique de l'app | Transmission complète des champs, compatibilité des consignes, validation d'une fin volontaire, segmentation et rendu des pauses, sous-titres/reçus. | Retirer les obstacles qui contredisent ou neutralisent la fiche. Aucune direction d'acteur commune ajoutée en dur, aucun exemple de dialogue injecté comme règle globale. |

Les brouillons Max/Emma et les exemples plus bas sont des **propositions pour
le contenu éditorial Notion**, pas des réglages à coller dans l'app. Le mapping
vocal interprète les états issus de Notion ; il n'en redéfinit ni les causes ni
le sens. Les accueils fixes sont signalés séparément : ils sont actuellement
des contenus du profil app, pas une sortie des prompts Notion.

### Direction confirmée et proposition de jeu

Réponses explicites d'Ulrich : une pensée peut être abandonnée sans répondre
à la question ; des éclairs restent très nets. Souffle, silences, reprises et
voix qui se retient dominent ; les débordements vocaux sont rares. L'agitation
intérieure peut être fréquente sans devenir un effondrement permanent.

La parole est une tentative qui se fait pendant l'appel. Le personnage essaie
de dire quelque chose, bute sur ce que cela implique, se corrige ou se raccroche
à du concret. Il ne connaît pas d'avance la conclusion de sa réplique. Les
morts et les transformations pèsent sur son présent, même quand il ne raconte
pas ces événements. Une rupture doit avoir une cause dans la scène : un mot,
un souvenir autorisé, une possibilité d'espoir, la peur du lien familial perdu.
Une réponse pratique parfaitement nette reste possible.

Différenciation **confirmée par Ulrich dans cet échange** : Max retient, contourne puis lâche
brusquement ; Emma cherche à agir, enchaîne, se corrige puis perd son assurance.
Tous deux ont de rares éclairs très nets ; des arrêts et un élan d'espoir restent
possibles. Aucun quota
d'hésitations, aucune rotation obligatoire des états, aucun « euh » ajouté par
post-traitement. Ne pas confondre leur vertige avec une amnésie inventée : leur
lieu, les événements et ce que chacun sait restent canoniques.

### Ce qui a été vérifié

Lectures seules, code de main et MCP Lovable du projet Ava. **Correction de
routage explicitement donnée par Ulrich : les sources Notion Ava sont TOUJOURS
dans Gamilab**, voir [la règle permanente](../AGENTS.md#notion-ava--workspace-gamilab-obligatoire).
Le `fetch self` précédent confirmait le workspace personnel Ulrich : il ne
validait donc pas la cible Ava. Les `NOT_FOUND` ont été obtenus depuis cette
mauvaise cible et ne démontrent aucun défaut de partage des fiches ni de sync.
Aucune lecture directe de leur version actuelle dans Gamilab n'est revendiquée ;
Ulrich confirme les copies synchronisées à jour. Les anciens IDs des fixtures
ne sont pas les sources des profils sandbox actuels.

| Couche | Constat vérifié | Conséquence / hypothèse à tester |
| --- | --- | --- |
| Fiches réellement synchronisées | Max Lorenzo et Emma Munz, champs Cloud datés du 24 octobre. Manière de parler contient déjà cinq états propres, phrases cassées, reprises, non-dit et refus du vocabulaire de psy. | Ajouter encore une consigne « hésite » ne traite pas à lui seul le problème. La priorité et la mise en jeu doivent être éprouvées. |
| Posture de Max | Qui tu es dit « Tu es dans l'acceptation de la réalité : tu ne nies rien ». | Hypothèse de lissage : formulation trop générale. Distinguer connaissance des faits et incapacité à les absorber, sans autoriser un déni factuel. |
| Réplique réellement délivrée | Session sandbox commencée à 15:31:52 UTC, un transfert persisté ; à T13 Emma commence par « Je me sens terrifiée » et poursuit avec « J'ai besoin de ». État déclaré : Les questions en cascade. | Écart textuel établi avec la fiche, avant même le rendu audio ; le nom d'état ne prouve pas son interprétation. Pas de nouvel enregistrement ni d'écoute automatisée. |
| Réglages actifs | Rugosité épinglée de cette session : Max 3, Emma 2 ; mapping sandbox activé, version 2026-10-25T11:39:32.000Z. | Ce n'est pas simplement une rugosité restée à zéro. Le niveau 3 du directeur privilégie les états bloqués ; il peut favoriser un jeu monotone plutôt qu'une pensée vivante. |
| Variante et budget | Réglage sandbox optimized_v3 : une à trois phrases généralement ; contrat commun de sortie : 45 mots maximum à 220 tokens et « achève ta réponse ». Température LLM enregistrée 1,4, top_p 0,9. | Le contrat autorise déjà les fragments mais la complétude sémantique reste ambiguë. Les règles 1–2 phrases concernent d'autres variantes. Ne pas leur attribuer directement l'essai actuel. Ne pas augmenter la température pour fabriquer du jeu. |
| Sortie sûre | Le parseur permet déjà une suspension terminale ou un tiret volontaire à EOF ; il protège citations, identité, structures privées et troncatures. | Reformuler l'obligation de finir le tour sans obliger à finir la pensée. Ne pas ouvrir le parseur à toute phrase techniquement coupée. |
| Rendu Gradium | prepareTextForGradium remplace les ellipses internes par des virgules, les finales par des points ; les tirets espacés sont lissés. | La rupture écrite perd son effet temporel. Le nettoyage avait une raison : éviter clics et hoquets ; ne pas seulement le supprimer. |
| Mapping vers Gradium | Pour un état de parole, applyGradiumPerformance module seulement padding_bonus depuis pauses. Les champs émotion, instruction, delivery et speed n'y deviennent pas une direction d'acteur. Setup fixé avant le texte incrémental. | Le réglage peut faire varier le débit, sans garantir souffle, voix étranglée ou changement d'affect à l'intérieur d'une réplique. L'interface doit montrer cette portée réelle. |
| Accueil | opening_line fixe joué avant génération : Max « Bonjour, qu'est-ce qui t'amène à me contacter ? » ; Emma « Bonjour. Qui êtes vous, que me voulez-vous ? ». | La première impression demande un chantier éditorial propre ; modifier le prompt seul ne la change pas. |

### Changements proposés dans les fiches Notion

Sources actives : [Max Lorenzo](https://app.notion.com/p/3f762322e59581ba8241c7f6b28f31fd)
et [Emma Munz](https://app.notion.com/p/3f762322e59581f9880fe309adec7075).
Les propositions suivantes visent leurs propriétés existantes ; pas de nouveau
catalogue commun ni de réécriture des souvenirs/timelines. Relire les sources
accessibles avant toute édition pour produire un diff exact.

| Propriété | Max | Emma |
| --- | --- | --- |
| Identité fondamentale / Qui tu es | Faire du lendemain du carnage un présent encore impossible à absorber. Remplacer l'acceptation générale par la tension entre faits connus, refus intérieur et promesse de protéger devenue intenable. | Préciser que la compétence, les convictions et l'action maternelle tiennent par intermittence ; son assentiment de principe ne lui donne aucune sérénité pour Ava, son corps ou le couple. |
| Manière de parler | Arrêts qui évitent un mot, détour pratique, phrase brusquement nette, puis perte d'appui. Une pensée abandonnée n'a pas besoin d'une conclusion de remplacement. | Phrase lancée pour agir, question qui déborde sur une autre, correction qui change le sens, reprise d'autorité pratique ; une pensée sur elle peut rester sans retour immédiat et automatique à Ava. |
| Dynamique de la conversation | Vouloir un contact et se soustraire à ce qu'il oblige à dire. Faire sentir le désir de retrouver la famille sans le transformer en confession analysée. | Vouloir tenir la famille tout en n'arrivant plus à savoir comment ; pouvoir repousser une consolation, s'y accrocher un instant et la laisser retomber. |
| Ce que tu ne fais jamais | Garder les interdits factuels et de confidence ; placer les comportements anti-exposé et anti-conclusion près des consignes positives de jeu. | Même principe ; vérifier particulièrement les sorties « Je me sens… », « J'ai besoin de… », explications psychologiques et fins qui résolvent tout. |
| Tes états de parole | Garder les cinq noms. Affiner déclencheur, obstacle et issue possible, y compris éclat clair ou abandon. | Garder ses cinq noms. Retirer l'obligation de toujours compenser une rupture par une réponse nette ou un retour automatique au même sujet. |

Brouillons de direction, **à valider, pas encore inscrits dans les fiches** :

Max : « Tu sais ce qui s'est passé. Par moments tu peux même le dire très
nettement ; puis ce que ces mots veulent dire pour Emma et les enfants te
rattrape. Tu essaies de continuer et tu n'y arrives pas toujours. Tu peux
laisser tomber cette pensée. Ne la remplace pas par une explication de toi-même.
Quand tu promets que tu seras là, la promesse peut être nette ; comment y
arriver, tu n'en sais rien. »

Emma : « Tu commences souvent avec des mots et une chose à faire. Puis une
autre pensée arrive trop vite, tu changes un mot, tu retires ce que tu venais
de dire. Parfois tu peux seulement donner une consigne très claire. Ce que tu
crois sur le principe ne suffit plus quand il s'agit d'Ava, de ton corps, de
Max. Tu n'as pas à rendre cette contradiction compréhensible à ton interlocuteur
dans la même réplique. »

Exemples de calibration **inventés, non canoniques**, utilisables seulement si
le sujet et le niveau de confidence sont déjà autorisés. Les ponctuations
indiquent ici une intention ; elles ne garantissent aucun effet acoustique :

- Max, morts évoquées : « Ils sont morts. Voilà. Je peux le dire. Mais après… »
- Max, désir de famille : « Qu'on soit tous… enfin, Mona est pas là. Je sais.
  Je sais bien. »
- Max, espoir qui accélère : « Attends. Chez qui ? Ils ont pu… tu sais où ils
  sont, ces gens ? » — réponse à une piste évoquée, jamais preuve de guérison.
- Emma, transformation évoquée : « Moi, ça va. Non. J'en sais rien. Mais elle… »
- Emma, éclat net : « Je la laisserai pas toute seule. »
- Emma, refus d'une consolation : « Vous dites demain. Mais demain, elle va…
  Attendez. »

### App et code : ordre du travail après accord

1. **Calibrer le texte avant de toucher aux voix.** Valider les deux directions
   et un petit corpus de huit répliques : deux accueils, un blocage/reprise,
   un espoir ou débordement par personnage. Inclure dans ces cas les morts,
   la transformation, le lien familial et un éclair clair. Donner le contexte
   et le niveau de confidence ; pas de phrases à réciter dans chaque appel.
2. **Proposer le diff des seules propriétés utiles dans Notion.** Après accord
   éditorial et accès direct aux sources, y appliquer les changements retenus,
   puis synchroniser ces nouveaux champs vers sandbox-ulrich. La synchronisation
   actuelle est déjà à jour et n'est pas à réparer. Comparer source,
   copie et prompt final ; aucun rebuild RAG nécessaire pour ces seules
   propriétés, aucun changement production. Vérifier le rendu et les plafonds
   des quatre compilateurs avant de grossir les blocs protégés.
3. **Lever les obstacles techniques aux champs Notion.** Dans le contrat commun, distinguer
   fin technique normale et pensée inachevée. Remplacer l'attente de phrase
   complète par une courte prise de parole qui peut rester ouverte, dans le
   budget existant, sans ajouter une direction de jeu commune dans le code.
   Conserver l'en-tête privé compact ; il doit pouvoir représenter les intentions
   permises par la fiche, sans exiger une explication émotionnelle ni une réponse
   résolue. Examiner la priorité à Bloqué imposée par le niveau 3 du directeur :
   le curseur doit moduler les possibilités de la fiche, pas remplacer ses
   déclencheurs ou forcer une variété. Vérifier
   les prompts effectifs et quelques sorties, pas seulement la présence des
   bonnes consignes. Ne changer modèle ou budget que si un échec résiduel
   précis le justifie dans une proposition distincte.
4. **Faire des pauses un effet réellement entendu.** Adapter les suspensions
   volontaires après validation en contrôles Gradium autorisés. Documentation
   WebSocket : break de 0,1 à 2 secondes ; première audition proposée autour
   de 0,25 / 0,6 / 1 seconde, valeurs à écouter, pas prescriptions universelles.
   Pas de pause sur chaque virgule ou après chaque fragment ; des accélérations
   doivent rester possibles. Vérifier REST, streaming, frontières de segments,
   mapping des mots/reçus et interruption pendant une pause ; préserver les
   décisions mains libres existantes. Un silence intentionnel n'est ni une
   panne réseau ni un déclencheur de secours. Pas de faux souffle ajouté avec
   des mots ni de tag émotionnel spéculatif. Les mots restent identiques dans
   les sous-titres et les preuves ; les tags ne viennent jamais du LLM.
5. **Réglages lisibles et auditions bornées.** Garder Max 3 / Emma 2 pour
   isoler d'abord les effets, avec témoin actuel ; comparer Emma 3 seulement
   ensuite si utile. Montrer dans TTS Config ce que Gradium applique réellement
   et ce qu'il ignore. Températures et voix conservées pour la comparaison.
   Répertoire d'accueils distincts sans appel IA supplémentaire, en respectant
   initial / transfert / retour. Quatre textes A/B au maximum puis finalistes,
   cache de réécoute, coût/appels visibles ; pas de matrice fournisseurs.
6. **Décider à l'oreille puis livrer.** Tester séparément les mots, les pauses
   et l'affect vocal. Si les mots sont justes mais le timbre demeure détaché,
   déclarer la limite de la voix actuelle et proposer une audition isolée de
   deux alternatives au plus via le banc existant, après validation ; aucun
   remplacement automatique du fournisseur actif. Vérifications ciblées,
   qualité/E2E selon le contrat du dépôt, PR et CI requises, synchronisation
   Lovable ; recette humaine Max/Emma avant toute demande de production.

La documentation actuelle de Gradium décrit padding_bonus comme contrôle de
débit et temp comme diversité, pas comme directions « peur » ou « sanglot ».
Elle indique aussi cfg_coef ignoré par le nouveau modèle TTS ; ce champ ne
doit donc pas être présenté comme un levier d'émotion. Compatibilité exacte du
modèle/proxy Ava à vérifier avant tout ajustement. Sources primaires consultées
le 25 octobre : [pauses WebSocket](https://docs.gradium.ai/guides/text-to-speech#flushing-and-pauses),
[réglages](https://docs.gradium.ai/guides/voice-settings),
[REST](https://docs.gradium.ai/guides/text-to-speech-rest).

### Critères d'acceptation et invariants

- Une réplique peut s'arrêter avant l'explication ; les morts et transformations
  ont un poids perceptible sans exposition forcée ni confidence anticipée.
- Max et Emma ne partagent pas un même bégaiement. Des phrases parfaitement
  claires contrastent avec des pensées perdues. Aucune répétition mécanique
  d'une amorce, d'un juron ou d'un motif de pause.
- Une déclaration privée Bloqué ou Cascade ne vaut pas preuve d'acting.
  Ulrich doit entendre la différence avec le témoin et reconnaître la retenue,
  le souffle et l'espoir fragile ; quelques débordements, pas de mélodrame continu.
- Les abandons grammaticaux balisés existants restent acceptés ; vrais échecs
  de longueur, citations ouvertes, tags/identité privés et parole incertaine
  restent refusés. Pas de réécriture après son ni de rejeu.
- Un conflit affectif peut rester ouvert ; un refus de transfert ou sa
  rétractation conserve son sens. Un accord courant est clair et réellement
  délivré avant offre/clic. Le passage désormais fonctionnel reste acquis.
- Cadre partagé experienceFrame, lieux, timeline, mémoires privées, scènes
  autorisées, capture et décisions handsFreeVoice conservés. Pas de nouvel
  appel LLM systématique, de configuration production ou de publication.
- Mesurer premier son séparément des silences voulus et de la durée de voix ;
  aucune latence ni qualité acoustique déduite des seuls tests simulés.

**État de cette préparation :** plan local proposé ; aucun code, réglage Cloud,
prompt Notion, sync, audition payante, nouvelle branche/PR/CI ou production
modifiés/déclenchés. La revue directe Notion attend l'utilisation effective du
MCP natif **Gamilab**. Diagnostic corrigé : les connexions notion_gamilab et
notion_ulrich_fischer sont déjà configurées et activées ; le CLI 0.157.0 hors
sandbox reconnaît leur authentification OAuth enregistrée. Dans la session,
le démarrage MCP Gamilab renvoie pourtant « OAuth authorization required » ;
la cause précise de cette divergence reste à établir. Cela ne démontre pas
une expiration et ne justifie pas de refaire la connexion. Le plugin Notion
utilisé précédemment répond pour Ulrich, ce qui ne valide pas la cible Ava.
Le choix Gamilab est enregistré dans les instructions globales et du dépôt ;
il n'est plus à redemander. Les demandes précédentes de partager les fiches
avec Ulrich ou de rétablir la connexion n'étaient pas justifiées. Aucun
identifiant modifié, login/logout lancé, navigateur ou déplacement des sources
utilisé pour contourner ce point.

## Suite après recette — proposition du 25 octobre 2026

**Historique avant livraison : lot 3 alors en cours ; lot 4 proposé.** Le lot 2
est livré par [#75](https://github.com/memoways/ava-proto1/pull/75), main
`5b56c0e987b04caf98f09726dae8ed62bd2d61cc`. Sa recette humaine n'est pas
acceptée. Cette section actualise la suite ; les bilans précédents restent
historiques. [Prompt du premier lot](prompt_reprise_fiabilisation_recette_lot_3.md).

### Ce qui est acquis et ne doit pas être refait

Les quatre compilateurs conservent les unités éditoriales propres à chaque
personnage sous leurs budgets. Le mapping sandbox a été sauvegardé et relu,
version `2026-10-25T11:39:32.000Z`. La session réelle
`abb58e39-763d-465e-baeb-203c3f99bae0` utilise ces protections et Gradium :
il ne faut plus attribuer cet essai à un ancien onglet. Production non publiée.

### Quatre écarts observés

| Point | Preuve et limite | Résultat attendu |
| --- | --- | --- |
| Bug de réponse | T2 : parole ponctuée suivie de `</speech` tronqué ; rejet `Incomplete response sentence or quote`, reproduit localement. Cause amont de la fermeture tronquée inconnue. | Le protocole ne casse pas une parole complète ; les vraies troncatures, citations ouvertes, structures privées et identités étrangères restent refusées. |
| Emma ne prend pas l'appel | T8 : décision périmée ; T9 : `consentRef=currentUserMessage` hors schéma ; T12 : accord délivré rejeté par le veto sur « Non… pas encore ». | Un accord courant réellement livré peut produire l'offre cliquable ; refus, différés et décisions périmées restent bloqués. |
| Parole artificielle | Six des huit réponses livrées déclarent « Bloqué ». Les suspensions deviennent de la ponctuation ; l'acting libre n'est pas envoyé comme émotion Gradium. | Reprises motivées par la pensée et l'émotion, silences irréguliers, diversité justifiée ; aucun bégaiement systématique. |
| Accueil répétitif/sec | `IndexPRD4.tsx` joue `profile.openingLine`, avant toute génération personnage. La session commence par « Bonjour, qu'est-ce qui t'amène à me contacter ? ». | Accueil varié : personnage tiré de ses pensées, surpris, qui rejoint progressivement l'appelant, sans hostilité. |

Les 126 tests existants du parseur/passage passent alors que deux replays
ciblés reproduisent les défauts : le manque porte aussi sur la couverture.
Le validateur de passage n'a pas changé dans #75 ; ne pas présenter toute
la panne comme une régression causée par ce lot.

La télémétrie estime le premier son 4 à 8,7 s après transcription finale.
Elle ne mesure pas isolément la connexion d'Ulrich. Les durées TTS globales
ne sont pas toutes un temps d'attente avant son. La session contient 33
tentatives, 24 annulées avant premier token et 23 interruptions confirmées :
cela explique la nécessité de tester la concurrence, sans prouver un défaut
du détecteur ou du réseau. Aucun chantier mains libres ajouté.

### Lot 3 proposé — réponse sûre et transfert fiable

Deux défauts techniques dans un seul lot, sans toucher au jeu vocal :

1. **Reproduire avant de corriger.** Fixtures minimales de T2/T8/T9/T12,
   sans copie de transcript ou prompt complet. Tester Max → Emma et Emma → Max.
2. **Protocole de sortie.** Empêcher la fermeture parasite dans le contrat.
   Définir explicitement le traitement de son éventuel résidu terminal à EOF :
   seulement une fermeture connue, fin normale confirmée et parole déjà valide.
   Ne jamais convertir une fin SSE `length`, un abandon ou une phrase coupée
   en succès, ni avaler un tag arbitraire. Si cette distinction n'est pas
   démontrable, garder le rejet sûr et corriger l'émission/récupération existante.
   Aucun rejeu après début sonore, aucune répétition d'un segment déjà entendu.
3. **Refus contextualisé.** Corriger le faux veto sur une négation de l'action
   passée suivie d'un accord présent. Ne pas supprimer les vetos de véritable
   refus ou de rétractation (« je te la passe… enfin non »). La preuve GM,
   le reçu et toutes les gardes restent requis ; pas d'autorisation par regex seule.
4. **Référence GM.** Rejouer la référence invalide de T9 : elle doit rester
   invalide. Rendre le contrat compact plus clair sur `speech_N`, avec les
   exemples au bon niveau ; ne pas réparer arbitrairement la réponse du modèle.
   Vérifier tous les prompts publiés effectifs dans le même budget/appel GM.
5. **Résultat tardif.** Rejouer réponse/lecture/GM/nouvelle soumission, y compris
   interruption et reprise. Une décision périmée ne crée pas d'offre. Un accord
   confirmé au tour courant doit pouvoir aboutir sans ressusciter l'ancien.
   Examiner la course de persistance de T8 avant de lui attribuer une cause ;
   ne pas bloquer la voix ou modifier capture/interruptions pour attendre le GM.

**Sortie du lot :** nouveaux replays rouges puis verts sur les défauts corrigés,
contrôles négatifs toujours rouges côté autorisation, tests d'intégration du
vrai évaluateur et E2E de la chaîne jusqu'au clic/connexion dans les deux sens.
`test:quality` et E2E requis ; PR/CI sur HEAD exact, main/CI/E2E, nettoyage de
la seule branche du lot, synchronisation et preview Lovable vérifiées. Une
recette humaine courte de transfert reste distincte. Pas de promesse de naturel
à ce stade. Pas de production. [Détail passage](plan_changement_interlocuteur_manuel.md#suite-de-recette--25-octobre-2026).

### Exécution du lot 3 — 25 octobre 2026

Base `5b56c0e987b04caf98f09726dae8ed62bd2d61cc`, branche unique
`codex/recette-lot-3-safe-response-handoff`. Quatre documents locaux reconnus et
intégrés ; PR étrangère #24 sans recoupement de fichiers, préservée. Identité
GitHub Ulrfis réutilisée (aucune App configurée), Lovable initialement au même SHA.
Workspace Notion vérifié par son ID ; fiche et PRD historiques relus.

**Défauts reproduits avant correction :**

- Parseur + validateur : **4 rouges, 142 verts** par
  `npx vitest run src/services/responseIntentStream.test.ts src/services/characterHandoff.test.ts`.
  Résidu exact T2 rejeté et faux refus T12 symétrique, plus contrat d'émission.
- Véritable évaluateur GM : référence T9 refusée sans raison spécifique et
  annulation pendant persistance classée `persistence_failed`. Deux replays
  supplémentaires d'adaptateurs résolus après annulation, génération/persistance,
  retournaient encore `executed` ; ils échouent avant ajout des barrières.
- Condition différée après suspension : « Je te la passe maintenant… si elle
  accepte. » était acceptée malgré la condition, dans les deux sens ; désormais
  différée. Le choix terminal du joueur « si tu veux » conserve l'accord
  présent et le clic, avec un test symétrique ; il ne dispense jamais des preuves.
  La sélection de preuve des tests est réellement présente, y compris
  dans les rétractations ; ils ne passent pas seulement par preuve manquante.

**Comportement implémenté :**

- Le contrat commun interdit de fermer `<speech>`. Le parseur ne tolère que
  `</speech>` ou le résidu exact `</speech`, exclusivement terminal, après `stop`
  confirmé et `[DONE]` SSE (ou stop batch). Complétude, citations, identité et
  absence de structure restent contrôlées ; aucun retrait arbitraire après `<`.
  EOF sans DONE, raison absente pour ce résidu, length/error/filtrage/outils et
  abandon restent des échecs. Le code ne requalifie pas le reçu historique T2.
- La preuve de fin normale traverse le client, simulateMaxResponse et le vrai
  point d'appel de l'orchestrateur ; tests à toutes les frontières de tokens
  et octet par octet en SSE. Un résidu toléré ne déclenche aucune régénération.
  Après son soumis, les erreurs conservent delivered/uncertain/private sans
  fallback ni répétition. Avant son, la récupération existante reste unique et
  bornée : même tour/contexte, aucun RAG/GM utilisateur supplémentaire.
- Seul le préambule initial « Non… pas encore. », antérieur à la citation exacte
  d'accord courant, est exclu des vetos locaux. Tout le reste est inspecté.
  Aucune autorisation par mot-clé : GM, preuve délivrée, source/cible, tour/version,
  seuil, quota, pause, persistance atomique et clic restent nécessaires.
- Le contrat effectif ajouté après tout prompt, dont v7, exige `speech_N` pris
  dans speechEvidence ; currentUserMessage/openRequest ne sont que les sources
  de demande. T9 reste refusé, sans remapping, avec diagnostic persisté
  `handoff_proof_rejected / consent_reference_invalid`, visible dans Sessions.
- Barrières après génération et après persistance GM : un résultat résolu malgré
  l'annulation ne transmet aucune action. Annulation pendant persistance :
  `parent_aborted`, distinct d'une vraie `persistence_failed`. Un ancien tour
  reste gm_late côté interface/CAS ; un nouvel accord ne reprend pas l'ancien.

**Preuves Cloud minimales relues via MCP Lovable :** T2 `failed`, 0 caractère
confirmé, 137 caractères incertains et suffixe `</speech` ; T8 GM failed /
persistence_failed, audit gm_late, erreur diagnostique absente ; T9 référence
currentUserMessage ; T12 preuve « Je te la passe maintenant. » et faux veto.
Six GM persistés, zéro transfert ; versions de départ confirmées. Le prompt v7
Cloud (10 415 caractères) et la fixture existante ont le même MD5 après retrait
du retour final : 82f57f2ce02633dccb1fbd9f1e01feca. Cause amont de
la fermeture et cause historique précise de l'échec T8 **non établies**. Les
courses corrigées sont reproduites localement, sans attribution au réseau.

**Validation/livraison :** qualité finale verte : lint, types, build,
66 tests régression, 941 unitaires, 41 intégration. **78 E2E complets verts**
sur code final (Chromium, Firefox/WebKit média, 12,7 minutes). E2E v7 batch et Gradium déjà réussis dans les deux sens,
avec résidu T2 et accord T12 jusqu'au clic/connexion, sans partage des confidences.
Bilan final, SHA et liens CI dans la PR de ce lot ; recette humaine restante.
Aucune configuration Cloud, fiche, mapping sandbox, voix, capture, décision mains
libres, modèle, budget 950 ou timeout GM modifiés. GM code version
`gm-2026-10-25-safe-response-handoff`. Pas de production ni de lot 4 commencé.

**Complément CI avant fusion :** premier run
[40200403020](https://github.com/memoways/ava-proto1/actions/runs/40200403020)
rouge : 75 E2E verts, deux échecs et un scénario réussi seulement à la relance.
Traces examinées, sans extrapolation au runtime réel : assertion v7 à
666099,449 ms, CAS awaiting_character à 666170,2 ms (environ 71 ms après) ;
reload du scénario de reprise à 640176,601 ms, écriture GM à 640240,3 ms.
La fin audio, le départ de l'appel GM et networkidle ne prouvent pas sa
persistance. Le test de reprise doit établir l'offre avant de la recharger.
Correction limitée aux attentes E2E : poll de l'état différé réellement persisté,
offre visible/persistée avant reload. Aucun délai ni garde runtime modifié.
Les trois scénarios passent chacun deux fois (6/6, 49,6 s) après cette correction.
Nouveau HEAD et CI exacte à vérifier avant fusion, sans relance aveugle du rouge.

Le [second run 40202367382](https://github.com/memoways/ava-proto1/actions/runs/40202367382)
a validé 77 scénarios, dont les trois attentes corrigées, mais a révélé une
assertion T9 Max encore immédiate sur le journal GM. Le reçu et le tour étaient
présents ; le journal asynchrone n'était pas encore écrit au point de lecture.
Même correction pour le journal, et audit des assertions d'événements des
nouveaux tests tardifs : attente explicite du motif consent_reference_invalid et de
l'offre/audit courant, sans délai fixe. Quatre scénarios T9/tardif, chacun deux
fois : **8/8 verts**, 1 minute. Complément limité aux tests et à ce bilan ;
aucun nouveau correctif runtime ni assouplissement des résultats attendus.

Référence protocole : [OpenRouter — streaming](https://github.com/OpenRouterTeam/docs/blob/main/api_reference/streaming.mdx)
et [finish_reason](https://github.com/OpenRouterTeam/docs/blob/main/api_reference/overview.mdx),
consultés le 25 octobre 2026. Architecture existante réutilisée, aucun nouvel appel
systématique, aucune dépendance ajoutée ; défauts et contrôles reproduits avant fix.

### Lot 4 proposé — accueil et parole vivante

1. **Accueil sans nouvel appel IA.** Petit répertoire éditorial distinct Max/Emma,
   choisi une fois par nouvel appel, sans répéter immédiatement la même entrée
   lorsque plusieurs sont disponibles. Réutiliser le répertoire de transfert/
   retour en préservant ses trois contextes, sans réécrire les fiches Notion.
   Tester plusieurs ouvertures et l'absence de confidence précoce. Un changement
   de script ne suffit pas à valider le ton entendu.
2. **Pensée avant hésitation.** Préserver les mots abandonnés/repris et le non-dit
   de chaque fiche ; éviter l'injection mécanique de « je… je » ou de « euh ».
   Distinguer l'état déclaré/livré de la proposition GM. Diagnostiquer pourquoi
   « Bloqué » domine, sans forcer une rotation ni relabelliser artificiellement
   le reçu. La colère contre soi, la retenue et l'émotion doivent varier avec
   la scène ; Max et Emma gardent leurs cinq états propres.
3. **Pauses Gradium contrôlées.** Vérifier la capacité documentée `break` dans
   l'adaptateur réel, batch et streaming, puis essayer des pauses sobres et
   irrégulières sur un corpus borné. Les contrôles sont créés seulement à la
   frontière TTS après validation ; aucun tag LLM accepté dans la parole.
   Les sous-titres et preuves gardent les mots, aucune pause technique ne devient
   une confidence. Pas de changement de température pour simuler l'émotion.
4. **Écoute courte avant généralisation.** Huit textes proposés : par personnage,
   deux accueils, une reprise interrompue puis continuée, une émotion qui monte
   sans explication psychologique. Comparaison A/B sur quatre textes au plus,
   puis seulement les candidats retenus ; pas de matrice fournisseurs ou de
   session synthétique massive. Réécoute depuis cache et coût visible si connu.
   Ulrich juge mots entendus, tics, pauses, accueil et émotion. Si Gradium ne
   rend pas la voix étranglée crédible, déclarer cette limite et proposer une
   audition séparée, sans changer le fournisseur de jeu ni la production.

**Sortie du lot :** accueil varié testé, rendu batch/streaming cohérent,
sécurité et reçus conservés, réglages sandbox sauvegardés/relus si modifiés,
comparaison audible acceptée puis un parcours Max/Emma. Premier son et latence
voix-à-voix mesurés séparément ; aucune performance revendiquée sans mesures.
[Détail vocal](plan_lot_b_rendu_vocal.md#suite-de-recette--25-octobre-2026).

### Organisation pour éviter de recommencer

- Deux lots, une branche par lot ; livrer le lot 3 avant de commencer le lot 4.
- Pendant la préparation présente : documents locaux seulement, pas de code,
  Cloud, PR ni nouvelle CI. Les documents seront intégrés à la branche du lot 3.
- Lire d'abord les preuves présentes ; nouvelle enquête seulement si l'état a
  changé ou si elle départage une cause encore inconnue. Aucun nouveau contrôle
  de connexion GitHub si l'identité authentifiée existante fonctionne.
- Donner une seule URL de recette avec SHA et environnement vérifiés. Ne pas
  prendre un lien reçu pour une acceptation. Réserver l'écoute humaine aux
  points qu'une simulation ne peut pas trancher.

## Lot 2 — protection effective et Gradium, 25 octobre 2026

Base vérifiée : main `53baa8618eb388714c23612bb7154f5b5cb17491`, PR #74,
CI PR puis main/E2E vertes (runs 40185859015 et 40187022790), Lovable synchronisé
et ready. PR étrangère #24 sans recouvrement, préservée avec toutes ses branches.
Checkout canonique, branche `codex/parole-incarnee-lot-2`, aucun autre agent.

1. Figer comme fixtures les deux fiches éditoriales sandbox lues par MCP Lovable ;
   reproduire les pertes dans les quatre prompts effectifs. La sélection dans
   legacy/rich/optimized existe déjà ; elle ne garantit pas la conservation.
2. Réserver un bloc atomique pour « Manière de parler » intégrale et le paragraphe
   « Ce que tu veux vraiment, sans le savoir », propre à la fiche. Réallouer les
   budgets existants, sans catalogue commun ni réécriture Cloud des fiches.
   La peur de Max pour Emma/Ava, l'amour, le couple et l'identité restent sous
   la surface ; aucune confession parfaitement analysée imposée à l'ouverture.
3. Protéger les suspensions et reprises aux frontières incrémentales, sans
   accepter une réponse tronquée, citation ouverte, structure ou identité étrangère.
   Contrôler déclaration privée, états inconnus, reçus et variété ; vérifier
   séparément le repli neutre temporaire du runtime autorisé.
4. Aucun mapping `ava_speech_performance` présent lors du SELECT initial :
   sauvegarder puis relire seulement sandbox-ulrich avec ses dix états exacts.
   Vérifier paramètres Gradium batch/incrémental et version ; aucune voix prod.
   Documentation officielle relue : padding = rythme, pas pause intra-phrase
   garantie ; aucun tag émotionnel documenté/activé.
5. Tests ciblés avant/après, test:quality, E2E, revue du diff, PR/CI sur HEAD exact,
   squash, CI main/E2E puis suppression de la seule branche du lot. Vérifier
   main/preview Lovable ; recette au casque Max/Emma avec Ulrich distincte des
   simulations. Aucune publication production autorisée.

Sources Gradium : https://docs.gradium.ai/guides/text-to-speech et
https://docs.gradium.ai/guides/voice-settings (consultées le 25 octobre).
Invariants du plan latence conservés : experienceFrame, mémoire privée, capture,
interruptions, mains libres, budget GM, preuve/gardes/clic de passage inchangés.

### Résultats du diagnostic et corrections

- Fixtures : les deux fiches sandbox réellement lues le 25 octobre, sans
  modernisation. Max : Manière de parler 1 835 caractères, moteur intime 765 ;
  Emma : 1 556 et 926. Les cinq noms et descriptions sont vérifiés littéralement
  dans chaque prompt final ; aucun texte de l'autre fiche n'y est injecté.
- Avant : quatre variantes en échec dans le test des prompts effectifs.
  rich_v2 sélectionnait déjà le champ mais son plafond 1 800 coupait Max ;
  priorités/réserve pouvaient omettre des unités. optimized_v3 sélectionnait
  déjà le champ au score 850, mais la déduplication et le budget 4 500 en
  supprimaient des unités. Le moteur intime était aussi éligible à omission.
  compact_v1 n'avait pas ce champ ; legacy pouvait l'évincer derrière la fiche.
- Après : deux unités éditoriales atomiques, réservées avant sélection/déduplication
  dans les quatre chemins ; aucun prompt commun inventé ni fiche Cloud modifiée.
  Les plafonds restent 7 000/12 000 compact, 12 000/18 000 rich,
  4 500/11 000 optimized et 20 000/24 000 legacy. Le header identité/passage
  est désormais déduit du budget statique rich : le test a révélé un dépassement
  réel à 12 892 caractères avant cette comptabilité.
- Les suspensions internes restent avec leur reprise jusqu'à une frontière sûre,
  pour ne pas transformer « Je… je » en deux segments « Je. » / « je » chez
  Gradium. Une suspension terminale ou un tiret volontaire reste possible à EOF,
  mais une phrase non ponctuée, citation ouverte, structure ou identification
  interrompue reste refusée. SSE tronqué reste une erreur ; aucun rejeu après son.
- Contrôles séparés conservés : déclaration privée facultative, état inconnu →
  null, jamais trois propositions identiques, reçu réellement livré avant GM.
  Échec/timeout du réglage autorisé : rugosité 0 pour le seul tour, pas de version
  inventée, réponse tardive ignorée, nouvelle lecture au tour suivant.
- Les suggestions GM ne sont jamais une preuve de l'état joué. Le mapping
  Gradium n'invente pas une émotion audible ; il garde température/voix et module
  le rythme documenté. Diction, naturel et latence réels restent non mesurés.

Confiance avant correction : reproduction rouge, chemins et doublons examinés,
architecture existante conservée, documentation et exemples officiels Gradium
consultés ; aucune dépendance ni appel LLM ajouté.

### Vérifications locales du lot 2

- `npm run test:quality` vert : lint (avertissement useCallback préexistant),
  typecheck, **64 régression, 882 unitaires, 41 intégration**, build.
- `npm run test:e2e` : **72/72 verts**, 10,6 minutes, Chromium et contrôles média
  Firefox/WebKit. Les dernières extensions de la garde de fragments sont couvertes
  par les unitaires et un rejeu E2E ciblé P1 Max/Emma sur le code final.
- Tests rouges avant/après conservés : quatre prompts effectifs en perte avant
  réservation ; contrôles de tiret volontaire et d'identité interrompue en échec
  avant correction. Reprises/suspensions/citations testées à chaque frontière SSE.
- Le SELECT de contrôle et l'admin connecté confirment le mapping activé en sandbox,
  dix états exacts, version `2026-10-25T11:39:32.000Z`. Aucun audio réel généré.
- Recette humaine encore requise : aucun verdict de naturel/diction ni p50/p95
  acoustique. Aucune publication production. La livraison GitHub/CI/Lovable est
  rapportée avec ses identifiants vérifiés dans la PR et le compte rendu final.

Sera aussi enregistré dans `docs/plan_parole_incarnee_personnages.md`.

## Compréhension

- Les fiches Notion de Max et Emma ont été réécrites le 24.10 (même page ID). Les archives en « Backup » ne sont pas synchronisées.
- Aucun prompt commun de « parole » : tout vient de chaque fiche. `experienceFrame` reste limité au cadre de l'appel.
- Nouveau champ « Manière de parler », qui contient la liste « Tes états de parole ».
- Le GM post-tour propose l'état du tour suivant. Le personnage déclare l'état joué dans son en-tête privé.
- Un seul nouveau réglage : la rugosité (0 à 3) par personnage.
- Pas d'appel IA en plus, budget de 45 mots et 220 tokens inchangé, sandbox uniquement.

## Constats et conflits relevés dans le code

1. **sync-notion écrit `environment_id: 'prod'` en dur** (ligne 629). Une synchronisation lancée aujourd'hui pousserait les nouveaux textes **directement en production**, et le nouveau champ serait ignoré.
2. **`speechModes.ts` est du code mort** : seul son test l'importe. Je propose de le supprimer (catalogue codé en dur et propre à Max, contraire à la règle).
3. L'en-tête privé est strict (`{"goal","points"}`, 1 100 caractères maximum). Ajouter `"parole"` (≤ 40 caractères) reste dans la limite, mais un nom d'état inconnu doit être ignoré sans faire échouer le tour.
4. Le GM produit déjà `next_turn_guidance` (texte libre). L'état proposé sera un champ séparé, `next_speech_state`, validé contre la liste du personnage, avec un repli neutre.
5. La règle de variété (jamais trois fois de suite) se calcule localement à partir des traces, sans appel IA.

## Étapes (chacune testable et réversible)

1. **Synchronisation sandbox** : sync-notion reçoit un paramètre `environment_id` (par défaut `sandbox-ulrich` depuis l'admin, `prod` seulement sur choix explicite).
2. **Champ « Manière de parler »** : migration qui ajoute `maniere_de_parler` et `speech_states` (jsonb) à `character_prompts`, plus l'alias Notion. Le service de prompts compile une section dédiée au même rang que les 8 autres. Le champ est éditable dans l'admin.
3. **États de parole** : analyse des lignes `- Nom : description` de la sous-liste « Tes états de parole » pendant la sync, stockage par personnage et affichage en lecture dans l'admin. Un avertissement apparaît si la liste est vide. Suppression de `speechModes.ts`.
4. **En-tête privé** : ajout du champ `"parole"` ; rien n'en sort dans `<speech>` ; la garde d'identité reste inchangée.
5. **GM post-tour** : `next_speech_state` est choisi d'après le sujet, l'émotion et le palier. Le prompt du GM reçoit la liste d'états du personnage actif, l'arc d'espoir par palier, les règles sur la promesse de guérison et sur l'absence de solution, et les interdits (pas de raccrochage spontané, silences autorisés, jamais « suicide » pour Emma). Le JSON reste complet et validé.
6. **Rugosité 0 à 3** dans les réglages personnages : versionnée, épinglée sur la session. Elle module la fréquence des états bloqués et des ruptures et la tolérance au silence, pas les faits. 0 = comportement actuel.
7. **Traces et évaluation** : pour chaque tour, l'état proposé, l'état joué, le palier, l'étape de l'arc et la rugosité. Cinq nouveaux critères dans le banc d'évaluation automatique.

## Quand synchroniser avec Notion

- **Pas maintenant.** Le code actuel écrirait en production et perdrait le nouveau champ.
- **Première synchronisation : après les étapes 1 à 3**, en sandbox-ulrich. Elle apporte les nouveaux textes, « Manière de parler » et les états analysés. On vérifie ensuite dans l'admin les 5 états de Max et les 5 d'Emma.
- Avant cette synchronisation, il faut que le champ « Manière de parler » existe dans la base Notion avec ce nom exact et que les deux fiches actives ne soient pas en « Backup ».
- La production ne sera synchronisée qu'après la recette humaine, sur décision explicite.

## Vérifications

- Tests : analyse des états (formats variés, liste vide), en-tête avec `parole`, parole sans fuite, GM avec état inconnu suivi du repli, règle des trois fois de suite, rugosité 0 identique au comportement actuel.
- Recette humaine en sandbox sur Max et Emma ; surveillance de la latence (médiane ≤ 2 s, p95 ≤ 4 s).

## Questions ouvertes

- Rugosité par défaut : 0 pour Max et Emma (décision d’Ulrich, 24.10, à tester).
- Faut-il plutôt garder la modification manuelle de « Manière de parler » dans l'admin, sachant que la prochaine synchronisation l'écrasera ?

## Avancement (24.10.2026, Lovable)

- Étapes 1 à 3 faites en sandbox : colonnes `maniere_de_parler` et `speech_states` ajoutées, alias Notion « Manière de parler », sync-notion écrit dans l'environnement actif de l'admin (`environment_id`, défaut `prod` pour les anciens appels), états analysés et affichés dans l'admin, `speechModes.ts` supprimé.
- sync-notion déployé le 24.10 (source_sha256 d4d16bc6…cf95d). Synchronisation sandbox « champs seulement » possible.
- Limite : les embeddings RAG restent globaux (non séparés par environnement). En mode `full`, une synchronisation sandbox réindexe le RAG partagé avec la production. Pour la sandbox, utiliser « champs seulement ».
- Étapes 4 à 7 faites le 24.10 (Lovable) : champ `"parole"` dans l'en-tête privé
  (optionnel, ≤40 caractères, jamais diffusé, valeur malformée ignorée) ;
  `next_speech_state` du GM validé contre la liste du personnage (inconnu → null) ;
  rugosité 0–3 dans `character_runtime_profiles.rugosite` (migration
  `character_rugosite`), réglable dans Réglages personnages, épinglée à la session,
  injectée chez le personnage et le GM (0 = rien d'injecté) ; traces de l'état
  proposé, de l'état joué (`speech_state_played` dans le log GM) et de la rugosité.
  `GM_CODE_VERSION` = `gm-2026-10-24-speech-states`. 854/854 tests, build vert.
- Reste : recette humaine en sandbox (tester rugosité 1 à 3 sur Max et Emma) et
  configuration des cinq critères dans le banc d'évaluation automatique.

## Finalisation du lot A — 24.10.2026

- Remplacer la lecture directe du profil protégé par une fonction runtime limitée
  au personnage et à l'environnement autorisés ; ne pas rendre les profils publics.
- Épingler en base la valeur et la version du réglage par session/personnage,
  sans conserver une ancienne valeur entre deux nouvelles sessions.
- Injecter les états dans tous les chemins de prompts, notamment rich_v2,
  sans ajouter de style commun : le contenu éditorial reste celui de la fiche.
- Valider l'état joué, conserver les deux derniers états propres au personnage,
  empêcher une troisième proposition identique et tracer proposition/jeu/palier/arc/rugosité.
- Ajouter les cinq critères au même appel juge, sans nouvel appel IA en jeu.
- Vérifier par tests locaux et lecture authentifiée des réglages, sans session
  ni audio synthétiques ; l'écoute Max/Emma reste une recette humaine.
- Lot B exclu : attendre le texte fourni par Ulrich. Aucune publication production.

### Résultat vérifié

- Fonction runtime appliquée dans Lovable Cloud, colonne de snapshot vérifiée.
- Lecture connectée sans création de session : Max 3 et Emma 2, sans erreur ;
  contrôle affiché dans la preview admin. Aucun niveau sauvegardé modifié.
- 863/863 tests locaux verts, compilation automatique Lovable verte.
- Manquaient réellement : champ éditorial absent de rich_v2/optimized_v3,
  consigne absente de rich_v2/compact, lecture protégée sans accès joueur,
  faux épinglage navigateur, déclaration batch absente, anti-répétition absent,
  traces palier/version incomplètes et cinq critères juge non intégrés.
- Restent : écouter de nouvelles conversations Max/Emma pour juger le naturel
  et mesurer les latences. Pas de conversation synthétique exécutée.
- GitHub main, CI et branches non vérifiables depuis ce sandbox ; ce lot n'est
  pas déclaré livré sur main. Production non publiée. Lot B attend son texte.

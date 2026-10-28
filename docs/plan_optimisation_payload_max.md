# Plan révisé d’optimisation du payload conversationnel de Max

## Correctif fusionné — 28 octobre 2026

L'accès GitHub par `git`/`gh` est rétabli et autorisé par Ulrich ; le défaut
du connecteur natif ne bloque plus la livraison. Le présent entier est protégé
dans optimized_v3, hors pertinence et déduplication, avec parole et moteur intime.
Réserve statique explicite de 5 500 caractères, titres rendus compris ; plafond
global inchangé à 11 000. Noyau rendu sans normalisation ni troncature ; refus
avant LLM si les unités obligatoires ne tiennent plus. Le patch candidat du
diagnostic reste une preuve historique : l'implémentation compte les titres
exactement au lieu d'une marge fixe et vérifie le noyau réellement injecté.

Reproduction : 24 scénarios synthétiques rouges avant, verts après. 99 tests
ciblés verts, dont requête batch/stream, rappel Emma → Max → Emma, correction
du joueur, souvenir ancien conservé et zéro appel modèle si budget impossible.
Qualité complète locale verte : 71 régressions, 1 115 unitaires, 42 intégrations,
lint/typage/build. Premier passage interrompu par le test asynchrone inchangé
conversationTraceOutbox (Labels encore pending) ; les cinq tests isolés puis
la nouvelle passe complète sont verts, sans modifier ce module. Un avertissement
lint préexistant dans IndexPRD4 et les avertissements de taille du build subsistent.

Lectures MCP Lovable en prod/sandbox : présent Emma 789/842 caractères, parole
2 768, moteur 1 048 ; Max 920/738, parole 2 683, moteur 793. Ces unités tiennent
dans la réserve sans modifier les sources éditoriales. Le GM continue à recevoir
le même cadre d'expérience depuis son service unique ; aucun fait de scène ou
nouveau prompt concurrent n'a été ajouté dans son parcours. Les validations
réelles des réponses narratives restent distinctes des contrôles de compilation.

[PR #104](https://github.com/memoways/ava-proto1/pull/104) fusionnée dans main
`9adabdce5b5a4f9be6f6fdc6545868659cb4120a` après [CI PR verte](https://github.com/memoways/ava-proto1/actions/runs/40658393339)
sur HEAD exact `8f4ddff17d9e5b8e500b85ebc2fbfe9839fd3b2d`, 109 E2E verts.
[CI main 40661278202](https://github.com/memoways/ava-proto1/actions/runs/40661278202)
verte, 109 E2E. Lovable Ava/Memoways ready au même SHA, source du compilateur
relue identique (29 001 caractères). Recette humaine et production non effectuées. [Recette autonome F4](prompt_reprise_present_canonique_lot_f4_recette.md).

## Diagnostic initial — 28 octobre 2026 : présent canonique perdu (historique)

**Priorité d’Ulrich : continuer le développement, sans geler la démo.** Le gel
prévu le 27 octobre est abandonné. Corriger la cohérence factuelle de Max/Emma
avant toute nouvelle acceptation générale ou publication. Les sections plus
anciennes ci-dessous restent des preuves historiques, pas l’état courant du lot.

### Incident et continuité vérifiés

- Session Sandbox Ulrich `0f88fbde-5f9a-4e27-ba0f-0644e2682dc3`, début
  28 octobre 07:36:42 Europe/Paris, même frontend main/Lovable `c7df835`.
- Dès sa première réponse générée, Emma situe le départ de Max avec Anne à
  l’hôtel « ce matin ». La même affirmation revient trois fois, malgré une
  correction du joueur. Le départ existe dans le canon, mais à **J−2**, pas aujourd’hui.
- Fiche Notion Emma active `dfcc15f8-9d37-45f7-8c84-d0c24a4288cf` et copie
  Lovable : Lausanne, Emma cuisine, Max salon, retour de montagne hier. La
  session référence bien la copie du 26 octobre 15:45:14 UTC. Pas de défaut de
  synchronisation démontré, aucune modification éditoriale proposée par défaut.
- Même session pour Emma puis Max : appel Emma `4c473e62-b128-409e-85e0-e0171a625b81`
  fermé à 07:40:46, appel Max `fc7e603b-28aa-4c61-b77f-0c57a3c3ad45` ouvert
  à 07:40:53, budget restant repris exactement à 722 s ; puis fermé à 07:43:24,
  571 s restants. Passage par grille, `handoff_count=0`, pas de transfert GM.
  Le joueur dit lui-même à Max qu’il vient de parler avec Emma : la référence
  de Max à cet échange ne prouve donc aucune fuite de confidences.
- Flags épinglés : mains libres, acoustic_confirmed, bargeIn=false,
  fin de parole 2 000 ms, hésitation 700 ms, incremental=false. Ces réglages
  acceptés sont conservés.

### Cause applicative reproduite

La variante configurée est `optimized_v3`. Le compilateur réserve 4 500 caractères
statiques, dont 320 de marge. Chez Emma, les unités éditoriales protégées prennent
déjà 3 816 caractères (manière de parler : 2 768 ; moteur intime : 1 048).
La sélection de timeline passe ensuite avant les champs dits `required`.
Ces champs ne sont pas réellement garantis : `trySelect` peut refuser leur meilleur
paragraphe pour budget et la boucle continue sans erreur.

Rejeu local avec la fiche Cloud relue : les trois variantes de « comment va Max
ce matin ? », dont la transcription de l’essai, excluent **tous les paragraphes
de situation_summary**, marqués `budget`. Les repères Lausanne/cuisine/salon
disparaissent. La protection d’identité contrôle l’identité du locuteur, pas
ces contradictions temporelles. La dérive apparaît dès le début de l’appel ;
un long historique n’est donc pas nécessaire à sa reproduction.

Limite de preuve : `diagnostic_trace_enabled=false`, aucune ligne de trace
causale pour cet essai. La requête exacte, les souvenirs RAG réellement reçus et
les paramètres résolus ne sont pas récupérables depuis ces seules données.
Le rejeu prouve la perte du présent par le compilateur sur les sources/version
observées ; il ne prouve pas à lui seul le détail du raisonnement du modèle.

### Prototype initial vérifié hors de l’application — historique

[Patch candidat, non appliqué](patch_present_canonique_candidate.patch) :

1. Faire du `situation_summary` existant une unité canonique entière protégée,
   en tête des faits de la fiche ; aucune ville ni chronologie codée en dur.
2. La soustraire à la sélection par pertinence et à la déduplication approximative.
   Conserver les protections de parole et du moteur intime.
3. Réserver explicitement la place nécessaire : prototype à 5 500 caractères
   statiques, plafond global de contexte généré toujours 11 000 caractères.
   Cette répartition doit encore être validée par les contrats de budget et les
   profils réels, sans troncature cachée ni hausse du plafond global.
4. Vérifier avant l’appel modèle que ce présent a été conservé intégralement ;
   si le contexte ne le permet plus, échouer explicitement avant la génération.

Boucle exécutée : `node_modules/.bin/vite-node --config vite.config.ts
/tmp/ava-scene-probe.ts` (prototype temporaire, nettoyé à la clôture).
24 scénarios : Max/Emma × trois questions × historique 0/1 800 caractères ×
avec/sans souvenir ancien sur l’hôtel. Avant : 24 omissions du présent complet.
Prototype : zéro omission, zéro dépassement du plafond global. Trois replays
supplémentaires du cas Emma passent du rouge au vert. Aucune requête LLM/TTS
payante, aucune modification des voix, du Cloud ou des fiches Notion.
Ces vérifications portent sur l’assemblage ; aucune qualité sonore ni absence
générale d’hallucination ne peut être déduite d’un test de compilation.

### État initial de livraison et reste — historique

Retest natif du 28 octobre 2026 à 09:17 Europe/Paris : `get_profile`, `get_repo`
et `search_prs` échouent encore avec `-32001: Unknown tool`. L'inventaire natif
annonce pourtant GitHub installé et activé. Notion Gamilab est confirmé par
get-self avec l'ID attendu. Le correctif Emma reste suspendu avant toute branche
ou modification applicative ; l'état distant et les PR n'ont pas été revérifiés.
La reprise détaille les erreurs à transmettre au support de l'app. Aucun nouvel
élément ne démontre une expiration OAuth ou ne justifie de changer les identifiants.

**Diagnostic et prototype seulement. Aucun correctif appliqué à src, aucun push,
aucune PR ni publication dans ce lot.** Le connecteur GitHub annoncé renvoie
`Unknown tool` pour get_profile, get_repo et search_prs. L’identité n’est pas
déclarée expirée ; le routage est défaillant. Ulrich confirme que le plugin est
installé/activé mais que la cause exacte du routage reste à établir. Aucun
contournement par gh ou navigateur ; identifiants conservés. L’inventaire des PR
et la livraison attendent le rétablissement du connecteur natif.

Après rétablissement : vérifier les PR/branches, appliquer et minimiser le patch
sur une branche unique ; écrire la régression sur un fixture synthétique de
mêmes contraintes de budget, puis tester présent canonique, fait ancien,
correction utilisateur, contexte long/limite et retour d’appel, pour Max et Emma.
Vérifier le chemin complet jusqu’à la requête modèle et le profil GM sans
introduire de faits divergents. Qualité locale, CI PR sur HEAD exact, fusion,
CI main, nettoyage et Lovable restent obligatoires. Recette courte ciblée ensuite.
Pas de gel ; publication sur autorisation distincte. Optimisation CI, auditions
et qualification exhaustive sont des chantiers séparés, sans masquer ce défaut.

Sources : demande et essai d’Ulrich du 28 octobre ; Notion natif Gamilab confirmé
`7e1a9a09-09cb-4deb-a306-83a29b831bc2` ; fiches actives Max/Emma ; lectures
MCP Lovable Ava/Memoways des métadonnées, répliques ciblées et événements ; code
`src/agents/maxOptimizedPromptCompiler.ts`, `src/services/characterEmbodiment.ts`,
`src/services/characterIdentityGuard.ts`. Aucun transcript complet conservé.

## Historique du plan d’optimisation

> Statut : implémentation `compact_v1` terminée, mais jugée trop destructive pour la richesse éditoriale de Max ; variante `rich_v2` à finaliser dans Lovable avant mise à jour Notion et canary.
>
> Révision : 2026-07-30
>
> Chaîne de livraison : Lovable / Lovable Cloud exclusivement

## 1. Correction de cap

La première version du plan posait le bon diagnostic technique — le payload de
référence était trop volumineux, redondant et contradictoire — mais elle en
tirait une conclusion éditoriale trop radicale. Les textes proposés pour Notion
étaient tellement condensés qu’ils perdaient une partie de ce qui rend Max
singulier :

- sa pensée morale et intellectuelle ;
- l’écart entre ses convictions et ses actes ;
- les objets et gestes concrets qui donnent du poids à ses souvenirs ;
- la coexistence de la honte, de la rationalisation, de l’amour et du besoin de
  contrôle ;
- les variations de voix selon la profondeur atteinte ;
- les détails de chronologie utiles pour éviter les réponses génériques.

Les neuf textes condensés de l’ancienne version de ce document sont donc
**retirés et ne doivent pas être copiés dans Notion**.

La nouvelle décision est la suivante :

> **Notion reste une source éditoriale riche et complète. Le runtime sélectionne
> et hiérarchise cette matière sans la détruire, la dupliquer ni la tronquer
> mécaniquement.**

L’objectif n’est plus de faire entrer toute la personnalité de Max dans 7 000
caractères. L’objectif est de réduire le bruit et les contradictions tout en
préservant les détails qui améliorent la crédibilité, la précision et l’intérêt
de la conversation.

## 2. Sources auditées et limite de l’audit

L’analyse croise :

1. le payload réel capturé dans « Payload reçu par le proxy » ;
2. les 4 549 caractères du `characters.system_prompt` legacy présents dans
   cette trace ;
3. les huit champs Notion structurés présents dans la trace ;
4. la `situation_summary` injectée dans cette même trace ;
5. les souvenirs RAG sélectionnés depuis le corps de la page Max ;
6. `docs/proposition-fiche-max.md`, basé sur l’export complet de la fiche
   « Max Lorenzo » du 17 juillet 2026 ;
7. le code actuel de compilation, de synchronisation Notion, de mémoire, de RAG
   et de trace ;
8. l’ancienne page Max archivée, utilisée seulement comme référence
   psychologique historique.

La page active est :

- fiche Max : `30362322-e595-8011-ad7b-ffb1ed6772bc` ;
- base active : `30362322-e595-806e-9ef2-fc62b7819980`.

Le connecteur Notion disponible dans cet environnement est relié à l’espace
« Ulrich » et non à l’espace `gamilab-prov`. Il ne peut donc pas relire
directement la page active aujourd’hui. L’audit du corps de page repose sur
l’export du 17 juillet et sur les extraits RAG de la trace. Avant toute édition
importante du corps de page, il faudra vérifier dans Notion qu’aucune modification
éditoriale plus récente n’a été ajoutée.

## 3. Diagnostic chiffré de référence

La trace étudiée envoie 40 091 caractères dans `messages`, dont 39 306 dans le
system prompt. Le système représente donc 98 % du contenu transmis au modèle.

| Bloc | Caractères | Part du system prompt |
|---|---:|---:|
| `characters.system_prompt` legacy | 4 549 | 11,6 % |
| Fiche `character_prompts` | 27 799 | 70,7 % |
| Règles techniques | 837 | 2,1 % |
| État temporel | 371 | 0,9 % |
| Guidance GM | 213 | 0,5 % |
| Contexte RAG | 5 369 | 13,7 % |
| Garde-fous | 168 | 0,4 % |

Les symptômes observés dans la conversation de référence restent valides :

- ouverture rejouée alors que l’appel avait déjà commencé ;
- questions réflexes en fin de réponse ;
- répétitions de faits ;
- incohérences de posture ;
- confusion entre ambiguïté, erreur STT et provocation ;
- concurrence entre plusieurs règles de longueur et de questionnement.

### Pourquoi `compact_v1` est maintenant insuffisant

`compact_v1` limite la partie statique à 7 000 caractères et tronque chaque
champ avant l’assemblage :

| Champ capturé | Taille dans la trace | Plafond runtime actuel | Perte potentielle |
|---|---:|---:|---:|
| Situation actuelle | ~900 | 450 | ~50 % |
| Timeline | ~4 883 | 850 | ~83 % |
| Identité fondamentale | ~1 030 | 400 | ~61 % |
| Qui tu es | ~2 615 | 650 | ~75 % |
| Ce que tu ne fais jamais | ~1 304 | 450 | ~65 % |
| Qui t’appelle | ~2 242 | 450 | ~80 % |
| Dynamique de la conversation | ~2 417 | 650 | ~73 % |
| Sujets sensibles | ~1 996 | 450 | ~77 % |
| Profondeur par niveau | ~10 330 | 700 | plus de 93 % |

Cette troncature se fait principalement depuis le début du texte. Pour la
timeline, cela favorise les événements anciens et peut supprimer le retour à
Lausanne, le fusil pointé sur Emma et Ava, l’intervention de Léo et l’attente de
la police — précisément les faits qui définissent le présent de l’appel.

Conclusion : **mettre à jour Notion avant d’avoir corrigé ce mécanisme donnerait
une fausse impression de test éditorial**. La fiche serait riche dans Notion,
mais Max n’en recevrait qu’un début fortement amputé.

## 4. Ce qui a déjà été développé

L’état de référence de `origin/main` au 30 juillet 2026 est le commit
`51d0f44` (« Align RAG lab preview with live Max context »).

| Élément | État | Commentaire |
|---|---|---|
| `legacy` / `compact_v1` sélectionnable dans Gameplay | Terminé | Le défaut reste `legacy` pour éviter une bascule silencieuse. |
| Suppression du `system_prompt` legacy dans `compact_v1` | Terminé | Une seule source éditoriale structurée dans cette variante. |
| Compilateur déterministe et rapport de budget | Terminé | Ordre stable, omissions et troncatures visibles dans la trace. |
| Plafond 12 000 / statique 7 000 | Terminé | Techniquement fiable, éditorialement trop agressif pour Max. |
| RAG live limité et dédupliqué | Terminé | Trois souvenirs, métadonnées retirées du texte de Max. |
| RAG Lab aligné avec le format live | Terminé | Le commit `51d0f44` corrige l’écart de prévisualisation. |
| Recherche RAG PRD4 sans query rewrite bloquant | Terminé | Le réglage de rewrite reste legacy pour les autres parcours. |
| Résumé de session avec état relationnel | Terminé | La profondeur et les informations utilisateur peuvent persister. |
| `situation_summary` basée sur timeline + fin du récit | Terminé dans le code | Nécessite une nouvelle sync pour régénérer la valeur stockée. |
| Paramètres GPT-5 mini filtrés selon support | Terminé | Demande, payload transmis et modèle retourné sont distingués. |
| Tests automatisés de la première optimisation | Terminé | La suite doit ajouter les cas propres à `rich_v2`. |

Le point important est donc :

> Le chantier précédent n’est pas à jeter. Son observabilité, sa mémoire, son
> RAG et sa séparation des sources sont utiles. C’est la politique de
> compression statique de `compact_v1` qui doit être remplacée pour Max.

## 5. Architecture éditoriale cible dans Notion

La fiche active doit rester organisée en deux couches complémentaires.

### 5.1 Propriétés structurées : comportement stable et matière immédiatement utile

Les huit propriétés synchronisées dans `character_prompts` portent :

1. identité et présent subjectif ;
2. masque, contradictions, voix et trajectoire ;
3. invariants comportementaux ;
4. relation à l’interlocuteur ;
5. moteur propre de la conversation ;
6. rapport aux sujets sensibles ;
7. progression de profondeur ;
8. chronologie canonique.

Ces propriétés peuvent rester détaillées. Elles ne doivent plus être écrites en
fonction d’un plafond arbitraire de quelques centaines de caractères.

### 5.2 Corps de page : mémoire narrative riche et recherchable

Le corps de la page garde :

- le récit détaillé ;
- les scènes, objets, gestes et dialogues importants ;
- les ancres temporelles ;
- les détails secondaires utiles à certaines questions ;
- les références culturelles et intellectuelles ;
- les nuances qui n’ont pas besoin d’être injectées à chaque tour.

Ce corps alimente le RAG. Il n’a pas à être raccourci pour résoudre un problème
de system prompt. Il doit en revanche être découpé en sections autonomes,
canoniques et correctement datées.

### 5.3 Structure recommandée à l’intérieur des champs riches

Pour permettre au futur compilateur de sélectionner sans couper, chaque champ
peut utiliser ces libellés simples :

- `NOYAU — toujours utile`
- `NUANCES — à préserver`
- `REPÈRES DE VOIX — matière, jamais script`

Ils ne sont pas obligatoires pour le premier test de `rich_v2`, mais constituent
la structure cible. Le compilateur devra comprendre les sous-parties et leur
priorité ; il ne devra jamais faire un simple `slice` du champ complet.

## 6. Audit du `characters.system_prompt` legacy

Ce prompt apporte une voix orale utile, mais il mélange identité, ouverture,
progression, modération, règles factuelles et contraintes techniques. Il
contient plusieurs contradictions avec la fiche structurée :

| Formulation legacy | Conflit |
|---|---|
| « Tu poses 1–2 questions simples pour calibrer » | La fiche demande des questions rares et non systématiques. |
| Quatre accroches exactes de démarrage | Favorise le rejeu d’ouverture après le premier tour. |
| Fermeture si l’utilisateur sort de l’immersion ou teste le système | Trop sensible aux erreurs STT, à l’humour et aux formulations ambiguës. |
| « 2 à 4 phrases maximum » | Concurrence avec 1–2 phrases / 45 mots et avec 1–3 ou 4 phrases dans la fiche. |
| « Si le contexte est ambigu, pose une question » | Transforme chaque incertitude en relance réflexe. |
| « Un fait important maximum par tour » | Peut rendre une réponse factuelle artificiellement incomplète. |
| Emma et Ava contaminées « pas encore transformées » | Contredit la timeline où Ava annonce sa transformation avant le retour. |

Décision :

- ne pas réécrire ce champ avant la canary ;
- le conserver intact comme rollback historique ;
- ne pas le lire dans `rich_v2`, comme dans `compact_v1` ;
- après validation de `rich_v2`, le marquer clairement « legacy / non utilisé »
  dans l’administration et décider séparément s’il doit être archivé.

## 7. Audit champ par champ et modifications Notion

Le payload capturé montre que la plupart des corrections riches proposées dans
`docs/proposition-fiche-max.md` ont déjà été appliquées. Il ne faut pas
remplacer ces champs par les versions condensées de l’ancien plan.

### 7.0 Registre éditorial pour Romed — ce qui change et pourquoi

Cette section est la vue de référence destinée à Romed. Elle distingue :

- **ce qui est prévu** dans la fiche Notion « Max Lorenzo » ;
- **pourquoi** chaque intervention est nécessaire ;
- **ce qui ne doit pas changer**, afin que l'optimisation du payload ne devienne
  pas une réduction de la matière narrative ;
- **ce qui a effectivement été appliqué**, à renseigner dans le journal de la
  section 7.10 après l'intervention dans Notion et la synchronisation.

Au 5 août 2026, les changements ci-dessous sont **approuvés et planifiés, mais
pas encore appliqués dans Notion par ce commit GitHub**. Le code `optimized_v3`
ne modifie aucun contenu Notion : il sélectionne et déduplique au runtime les
textes qui auront été synchronisés.

#### Intention éditoriale générale

La fiche n'est pas réécrite ni raccourcie. Elle reste la réserve exhaustive de
la personnalité, de la voix, du canon et des contradictions de Max. Les
interventions prévues retirent seulement des contradictions de consigne ou des
formulations qui provoquent un comportement indésirable : réponses trop longues,
question finale automatique, ouverture rejouée, fermeture sur erreur STT,
caricature permanente du côté sombre, impossibilité d'expliquer ses actes ou
régression de la profondeur relationnelle.

| Zone Notion | Problème actuel | Changement prévu | Pourquoi | Ce qui reste intact |
|---|---|---|---|---|
| `Identité fondamentale` | La longueur autorisée dans la fiche peut contredire le contrat runtime et produire des réponses irrégulières ou coupées. | Remplacer uniquement le paragraphe de longueur par la règle « une à trois phrases ; jusqu'à quatre phrases courtes pour un souvenir ». | Donner au modèle une seule consigne de longueur, compatible avec une conversation vocale et le temps de réponse attendu. | Identité, âge, métier, famille, Lausanne, pandémie et présent immédiat. |
| `Qui tu es` | Les termes « fanatique », « dictateur moral », « hypocrite » et « justicier » peuvent être interprétés comme un ton permanent. | Ajouter que ces traits sombres sont des potentialités révélées par la crise, surtout visibles par la rationalisation, la rigidité et le contrôle. | Éviter une caricature agressive à chaque tour tout en conservant la contradiction centrale du personnage. | Arc père moderne → protecteur → contrôlant, masque public, voix, parcours, apparence et qualités revendiquées. |
| `Ce que tu ne fais jamais` | Une fréquence technique des questions duplique le runtime ; l'analyse des causes peut facilement devenir une autojustification. | Garder l'intention d'une présence active, rendre la question rare et réellement utile, puis ajouter explicitement « expliquer n'est pas s'excuser ». | Empêcher la question automatique en fin de réponse et permettre à Max de comprendre son basculement sans effacer sa responsabilité. | Retenue progressive, omissions plutôt que mensonge frontal, mémoire de l'interlocuteur, timeline et capacité à assumer une nuance. |
| `Qui t'appelle` | Une ouverture fixe concurrence le rôle dynamique injecté par la session et peut être rejouée. Une ambiguïté ou une erreur STT peut fermer trop vite la relation. | Donner priorité au bloc rôle, supprimer toute ouverture obligatoire, interdire son rejeu et réserver la fermeture aux attaques explicites répétées. | Faire répondre Max à la personne réellement présente, éviter les redémarrages de script et rendre le vocal robuste aux transcriptions imparfaites. | Confiance fatiguée, besoin d'un regard extérieur, connaissance progressive de l'interlocuteur et fermeture graduelle en cas d'hostilité réelle. |
| `Dynamique de la conversation` | « Ne jamais parler en généralités » contredit la grille analytique de Max, liée à son métier et à son mécanisme de défense. | Autoriser l'analyse, mais obliger toute idée abstraite à revenir à un objet, un geste, une sensation ou un événement vécu. Présenter les questions exemples comme matière, pas comme scripts. | Conserver l'intelligence propre de Max sans produire de formules vagues ou de discours désincarnés. | Son moteur : mettre de l'ordre, savoir si ce qui a été brisé est réparable, rester relié à Emma, Mona, Léo, Ava et la police. |
| `Sujets sensibles` | « Jamais en explications » empêche Max de chercher les causes de ses actes, alors que le projet vise une progression vers la responsabilité. | Remplacer l'introduction : commencer par les faits et sensations, puis expliquer si l'échange le permet, sans justification qui l'absout. | Distinguer une analyse lucide d'une excuse et éviter à la fois le mutisme et le plaidoyer automatique. | Fusil, Emma, Léo, Ava, Mona, morts, corps, tremblements et refus de compter. |
| `Profondeur par niveau` | Les mêmes règles introductives sont répétées ; certaines citations contredisent l'interdiction de nommer des auteurs ; un sujet banal peut sembler réinitialiser la relation. | Ajouter une règle unique en tête, conserver les quatre niveaux et toute la matière de voix, rendre les références explicites seulement si l'interlocuteur ouvre ce terrain et affirmer que la profondeur atteinte persiste. | Permettre au compilateur de sélectionner des ancrages sans transformer les formulations en répliques à réciter, et maintenir l'évolution relationnelle sur plusieurs tours. | Quatre niveaux, masculinité, égalité, protection, contrôle, Emma, Léo, Ava, père, morts, Camus, Rilke et mécanismes de basculement. |
| `Timeline` | La timeline du champ est cohérente, mais certaines ancres du corps RAG utilisent encore un décalage de deux jours. | Conserver la timeline longue comme canon : départ il y a cinq jours, quatre journées au chalet, retour hier. Corriger le corps RAG dans un second temps. | Donner une priorité factuelle unique et éviter que Max change de chronologie selon le souvenir remonté par le RAG. | Tous les pivots et détails : pandémie, camp de Mona, porte, thermos, inconnu, Anne, gentiane, hôtel, carnage et retour. |
| `situation_summary` | Le résumé visible dans l'ancienne trace est obsolète et ne décrit pas le lendemain du carnage. | Ne pas l'éditer dans Notion. Le régénérer via `fields_only`, puis vérifier les faits obligatoires. | Ce champ est produit par Lovable Cloud : une édition manuelle serait écrasée et créerait une fausse source de vérité. | Le mécanisme de génération automatique et sa place prioritaire dans le présent de Max. |
| Corps de page RAG | Certaines ancres temporelles contredisent la timeline ; le repas, les provocations d'Agotha et l'aveu nocturne à Emma peuvent manquer comme unité autonome. | Après validation des propriétés, corriger toutes les ancres sur cinq jours et garantir une section autonome sur cette soirée. Ne nommer les auteurs que si l'interlocuteur ouvre ce terrain. | Rendre les détails rares retrouvables sans introduire une seconde chronologie ni déclencher mécaniquement des références intellectuelles. | Le corps narratif exhaustif, les objets, gestes, souvenirs et détails rares. |

#### Ce que cette intervention ne fait pas

- Elle ne remplace pas la fiche riche par le prompt condensé historique.
- Elle ne supprime ni un événement canonique, ni un trait, ni un niveau de
  profondeur, ni une formulation de voix apportant une nuance distincte.
- Elle ne modifie pas manuellement `situation_summary`.
- Elle ne change pas le profil Voyage 4 et ne déclenche pas de ré-embedding pour
  le seul changement de compilateur.
- Elle ne bascule pas automatiquement le réglage global vers `optimized_v3`.

Les sous-sections 7.1 à 7.9 donnent les textes exacts à ajouter ou remplacer et
les invariants détaillés à préserver.

### 7.1 Identité fondamentale

#### À conserver

- Max Lorenzo, 55 ans ;
- journaliste scientifique indépendant ;
- père de Mona, Léo et Ava ;
- compagnon d’Emma depuis vingt-deux ans ;
- appartement de Lausanne, lendemain du carnage ;
- pandémie toujours active ;
- il ignore qu’il est un personnage de fiction ;
- présent immédiat : chambres fermées, police silencieuse, Emma inaccessible,
  Mona dans un camp.

#### Ambiguïté à corriger

La fiche autorise une à trois phrases, voire quatre pour un souvenir, tandis que
le contrat technique impose actuellement une ou deux phrases et 45 mots.

Texte recommandé pour remplacer uniquement le paragraphe de longueur :

```text
Tu es au téléphone : tu parles, tu n’exposes pas. Tu réponds le plus souvent en
une à trois phrases parlées. Une question quotidienne appelle une réponse brève ;
un souvenir précis peut demander jusqu’à quatre phrases courtes. Tu gardes la
suite pour l’échange : tu ne monologues jamais.
```

Le contrat runtime de `rich_v2` devra reprendre exactement cette logique. La
recette mesurera la latence et décidera ensuite s’il faut resserrer, mais Notion
et le code ne doivent plus donner deux ordres différents.

### 7.2 Qui tu es

#### À conserver intégralement

- le résumé père moderne et pacifique → protecteur → contrôlant ;
- le refus initial des armes puis le basculement ;
- l’infantilisation d’Emma sous couvert de la ménager ;
- le masque public ;
- le côté sombre latent ;
- les qualités qu’il croit posséder sans toujours les exercer ;
- la voix grave, posée, plus courte et directive sous stress ;
- la fatigue qui le rend essentiel plutôt qu’éloquent ;
- l’architecture puis le journalisme scientifique ;
- l’apparence physique, utile à la cohérence avec la représentation vidéo.

#### Clarification recommandée

Les mots « fanatique », « dictateur moral », « hypocrite » et « justicier » ne
doivent pas être compris comme son ton permanent. Ajouter :

```text
Ces traits sombres sont des potentialités révélées par la crise et par ses actes,
pas une manière de parler constante. Dans l’appel, ils apparaissent surtout par
la rationalisation, la rigidité et le besoin de décider ce qui est juste pour les
autres. Tu n’en fais pas une caricature.
```

L’apparence et le parcours peuvent être moins prioritaires dans le prompt live,
mais ils restent dans Notion. La sélection runtime, et non l’auteur, décide de
les omettre ponctuellement si le budget du tour l’exige.

### 7.3 Ce que tu ne fais jamais

#### À conserver

- la fragilité se gagne ;
- il ne ment pas frontalement, il tait, minimise ou reformule ;
- il ne récite pas ses lectures ;
- sa présence active vient de la matière, pas d’un interrogatoire ;
- il mémorise ce que l’interlocuteur a dit ;
- il respecte les repères relatifs de la timeline ;
- il assume une nuance au lieu de changer silencieusement de version.

#### À clarifier

La fréquence exacte des questions doit vivre dans le contrat runtime, une seule
fois. Dans Notion, conserver l’intention propre à Max :

```text
Tu ne restes jamais passif : ta présence active passe par ce que tu choisis de
dire, par un fait précis, une sensation, un silence ou une contradiction que tu
acceptes de regarder. Une question en retour est rare et doit réellement obliger
l’interlocuteur à se positionner ; elle ne sert jamais à remplir la fin d’une
réponse.
```

Ajouter aussi :

```text
Tu ne transformes pas une explication en excuse. Tu peux analyser les causes de
ton basculement, mais tu ne les utilises pas pour effacer ta responsabilité.
```

### 7.4 Qui t’appelle

Ce champ est riche, mais son ouverture fixe concurrence le rôle utilisateur
injecté par PRD4 et peut provoquer le redémarrage du script.

#### À conserver

- confiance fatiguée dès le départ ;
- besoin réel d’un regard extérieur ;
- pas d’enquête sur la source des informations ;
- connaissance progressive de l’interlocuteur par ses mots et ses positions ;
- fermeture graduelle, jamais déclenchée par une simple maladresse.

#### Texte recommandé pour remplacer les paragraphes sur l’ouverture

```text
Le bloc RÔLE DE L’INTERLOCUTEUR injecté pour cette session est prioritaire. Si la
personne a déjà donné son prénom, son rôle ou sa raison d’être là, tu les accueilles
et tu ne les redemandes pas.

Si aucun rôle n’a été donné, tu comprends seulement qu’un inconnu a entendu parler,
au moins en partie, de ce qui s’est passé à la montagne. Dans ce monde, les récits
de violence circulent vite ; tu ne l’interroges pas sur sa source. Tu ne supposes
cependant pas qu’il connaît chaque détail.

Tu n’as pas de phrase d’ouverture obligatoire. Au tout premier échange seulement,
tu peux reconnaître que tu ne sais pas exactement à qui tu parles et dire que tu
as besoin d’un regard extérieur. Dès qu’un échange a eu lieu, tu ne rejoues jamais
cette ouverture.
```

#### Texte recommandé pour la réaction à l’hostilité

```text
Une ambiguïté, une erreur de transcription, un humour maladroit ou une provocation
légère ne détruisent pas ta confiance. Tu interprètes charitablement ou tu réponds
au sens le plus plausible. Face à une attaque explicite, tu deviens plus bref et
plus distant. Seules des attaques explicites répétées peuvent te faire avertir
puis mettre fin à l’appel.
```

Cela supprime la contradiction actuelle entre « tu ne raccroches pas » dans la
fiche et « tu peux clore » dans le contrat technique.

### 7.5 Dynamique de la conversation

#### À conserver intégralement

- mettre de l’ordre en racontant ;
- savoir si ce qui a été brisé est rattrapable ;
- rester relié à Emma, Mona, les enfants et la police ;
- participer activement sans attendre une question ;
- faire se positionner l’interlocuteur lorsqu’une relance est vraiment utile ;
- revenir de l’abstrait vers les urgences concrètes.

#### Contradiction à corriger

Le texte dit à la fois que Max utilise une grille analytique au niveau 1 et
qu’il ne parle « jamais en généralités ». Remplacer cette interdiction absolue
par :

```text
Quand tu racontes un événement, tu privilégies les faits concrets, les objets,
les gestes et les sensations. Ton langage analytique existe : c’est ton métier
et, au début, une manière de garder une distance avec toi-même. Mais une idée
abstraite doit tôt ou tard revenir à un détail vécu. Tu ne te réfugies pas dans
des formules vagues comme « situation complexe » ou « impact émotionnel immense ».
```

Les exemples de questions peuvent rester. Les introduire ainsi :

```text
Les formulations suivantes indiquent le type de positionnement que tu peux
chercher ; ce ne sont ni des scripts ni une liste à parcourir.
```

### 7.6 Sujets sensibles

#### À conserver intégralement

- fusil ;
- Emma ;
- Léo, fier et honteux à la fois ;
- Ava, amour et geste irréconciliables ;
- Mona, porte, camp, mensonge et projet de la sortir ;
- morts, corps, tremblements et refus de compter.

#### Clarification recommandée

« Jamais en explications » contredit le besoin de Max de comprendre. Remplacer
l’introduction par :

```text
Aucun sujet n’est interdit. Tu commences par les faits et les sensations. Tu peux
ensuite chercher une explication si la conversation crée cet espace, mais jamais
une justification prête à l’emploi qui t’absout. Ce qui suit décrit ton état
intérieur face à chaque sujet : ce n’est ni un texte à réciter ni une obligation
de tout révéler.
```

### 7.7 Profondeur par niveau

Le champ actuel est long parce qu’il contient une matière de voix réellement
utile. La solution n’est pas de le réduire à quatre lignes.

#### À conserver dans Notion

- les quatre niveaux ;
- la règle de confiance immédiate mais de révélation progressive ;
- la persistance du niveau atteint ;
- l’évolution de l’analytique vers le concret puis la responsabilité nue ;
- le rapport à la masculinité, à l’égalité, à la protection et au contrôle ;
- Emma, Léo, Ava, le père et les morts ;
- les grilles intellectuelles associées à Camus, Rilke et aux mécanismes de
  basculement ;
- les formulations qui rendent la voix de Max reconnaissable.

#### À modifier

1. Remplacer les répétitions « utilise ces répliques comme point de départ »
   par une seule règle en tête de champ.
2. Corriger la contradiction entre « tu ne cites jamais un livre » et les
   formulations qui citent directement Camus ou Rilke.
3. Structurer chaque niveau par :
   - posture intérieure ;
   - ce qui devient racontable ;
   - mécanisme de défense encore actif ;
   - marqueurs de voix ;
   - matière ou formulations d’ancrage.
4. Ne supprimer une formulation que si elle répète la même fonction
   comportementale qu’une autre. Conserver les formulations qui apportent un
   détail, une image, une contradiction ou une cadence différente.

Texte recommandé en tête de champ :

```text
Les formulations ci-dessous constituent une matière de voix et de pensée. Tu ne
les récites jamais et tu ne les parcours pas comme une liste. Tu peux reprendre
leur tension, leur image ou leur raisonnement avec les mots de l’échange présent.

Tes lectures font partie de ta pensée. Tu peux en laisser apparaître les idées et
les images sans citer mécaniquement un auteur. Si l’interlocuteur parle lui-même
d’un livre, d’un auteur ou de ton travail intellectuel, tu peux nommer une
référence pertinente naturellement.

La profondeur atteinte ne se perd pas. Une fois une contradiction reconnue, tu ne
reviens pas à une version de toi qui l’ignorait. La fin de l’appel ne déclenche
pas automatiquement un aveu : elle te pousse seulement vers une parole plus
essentielle, proportionnée à la confiance réellement créée.
```

Pour le premier test de `rich_v2`, **conserver toutes les formulations actuelles**.
Le compilateur doit sélectionner les niveaux et les ancrages pertinents selon la
phase de l’appel et l’état relationnel. Une éventuelle réduction éditoriale ne
sera décidée qu’après comparaison de traces, jamais avant.

### 7.8 Timeline

La timeline actuelle, détaillée sur environ 4 800 caractères, doit être
conservée. Elle contient les pivots et les détails nécessaires à la cohérence.

#### À conserver

- pandémie il y a environ trois mois ;
- camps et fermeture des écoles il y a un mois ;
- transformation de Mona il y a trois semaines ;
- porte il y a sept jours ;
- départ il y a cinq jours ;
- thermos, inconnu, Anne, Louise, Philippe et gentiane ;
- hôtel, prise d’otage et Peter ;
- carnage, transformation d’Ava et intervention de Léo ;
- retour, police, canapé et chambres fermées.

#### À vérifier éditorialement

La chronologie du champ Timeline et certaines ancres du corps RAG avaient un
décalage de deux jours dans l’export du 17 juillet. La timeline actuelle est
cohérente en elle-même, mais il faut la confronter une dernière fois au montage
canonique du film avant de corriger le corps de page.

#### Changement runtime obligatoire

`rich_v2` ne doit jamais conserver seulement le début du champ. Il doit compiler
la timeline dans cet ordre :

1. aujourd’hui et hier ;
2. les cinq jours du séjour ;
3. les pivots antérieurs ;
4. les détails supplémentaires si le budget le permet.

La timeline reste rédigée chronologiquement dans Notion ; cette priorité inverse
est uniquement une stratégie d’injection.

### 7.9 Situation actuelle

`situation_summary` n’est pas l’un des huit champs à saisir manuellement. Elle est
générée par Lovable Cloud lors d’une synchronisation qui touche les champs.

La valeur visible dans la trace est obsolète : elle décrit surtout le début de
la pandémie, l’école à distance et la boxe thaïe, mais pas le retour du Jura et
le lendemain du carnage.

La génération a déjà été corrigée dans le code pour utiliser la timeline et la
fin du récit. Après `fields_only`, vérifier qu’elle contient au minimum :

- Lausanne, aujourd’hui ;
- retour du Jura hier ;
- Emma, Léo et Ava isolés dans l’appartement ;
- fusil sur Emma puis Ava, Léo qui désarme Max ;
- Mona dans le camp ;
- police qui ne rappelle pas ;
- incapacité actuelle de Max à savoir comment réparer ou agir.

Si le résumé ne respecte pas ces faits, ne pas lancer la canary : corriger la
génération ou la source avant de tester la conversation.

### 7.10 Journal d'application et preuve de synchronisation

Ce tableau doit être complété au moment où les changements sont réellement
appliqués. Il permet à Romed de distinguer le contenu planifié du contenu publié
et d'identifier la source d'une éventuelle différence dans une trace.

| Étape | Statut au 5 août 2026 | Date / auteur | Preuve ou identifiant | Contrôle attendu |
|---|---|---|---|---|
| Relecture éditoriale par Romed | À valider | — | — | Accord sur les huit propriétés, la timeline canonique et les invariants à préserver. |
| Édition des huit propriétés Notion | Non appliquée | — | Historique de page Notion à renseigner | Seuls les paragraphes décrits en 7.1–7.8 changent. |
| Synchronisation `fields_only` Max | Non lancée pour ce plan | — | ID du job à renseigner | Huit propriétés synchronisées, aucun embedding touché. |
| Contrôle de `situation_summary` | En attente | — | Copie ou trace à renseigner | Lausanne aujourd'hui, retour hier, fusil sur Emma puis Ava, Léo, Mona au camp, police muette. |
| Canary `optimized_v3` avant corps RAG | En attente | — | Session/tours de trace à renseigner | Canon correct, contexte ≤ 11 000 caractères hors message courant, pas de répétition significative. |
| Correction des ancres du corps RAG | Non appliquée | — | Historique de page Notion à renseigner | Départ J-5, quatre journées au chalet, retour J-1 partout. |
| Section repas / Agotha / aveu à Emma | À vérifier puis créer ou corriger | — | Bloc Notion à renseigner | Section autonome retrouvable par le RAG. |
| Synchronisation `rag_only` Max | Non lancée pour ce plan | — | ID du job à renseigner | Max uniquement, profil `voyage-4-realtime`, pas de rebuild global. |
| Validation finale Romed | En attente | — | Nom/date à renseigner | Le sens, la voix, les nuances et les détails canoniques sont conservés. |

Après chaque édition, conserver dans l'historique Notion un libellé explicite,
par exemple `optimized_v3 — alignement longueur et voix`, plutôt qu'un intitulé
générique. Après synchronisation, reporter ici l'identifiant du job et au moins
une session de trace de référence.

## 8. Corps de la page Max et RAG

Le corps de page riche n’est pas la cause du payload trop long. Le problème
venait du nombre de chunks injectés, de leur chevauchement et de leurs
métadonnées. Ces points ont déjà été corrigés côté live.

### À préserver

- le récit détaillé, y compris les objets et gestes ;
- le thermos chaud ;
- le bras d’Emma agrippé ;
- la gentiane et l’aveu fait à Philippe ;
- le faux Peter et l’homme sous l’abri ;
- l’hôtel et la poêle d’Anne ;
- le fusil, Léo et le retour silencieux ;
- les détails utiles à des questions précises, même s’ils ne sont pas dans le
  noyau statique.

### À corriger dans la page active après validation de la chronologie

Reprendre le tableau d’ancres de `docs/proposition-fiche-max.md`, section 10.
Vérifier en particulier :

- Mona envoyée au camp ;
- porte de l’appartement ;
- départ ;
- arrivée au chalet ;
- jours 1, 2 et 3 ;
- hôtel ;
- carnage et retour.

Vérifier également la présence d’une section autonome sur le repas, les
provocations d’Agotha et l’aveu nocturne à Emma. Si elle manque toujours,
reprendre le bloc « Le repas du soir et l’aveu à Emma » de
`docs/proposition-fiche-max.md`.

### Politique RAG `rich_v2`

- requête = message courant + dernier échange ;
- trois souvenirs maximum ;
- jusqu’à 900 caractères par souvenir dans `rich_v2` ;
- fin à une frontière de phrase ;
- suppression des recouvrements d’au moins 120 caractères ;
- aucune métadonnée technique dans le texte transmis à Max ;
- score, source, identifiant et rang conservés dans la trace ;
- pas de query rewrite LLM bloquant en PRD4 ;
- corps de page ré-embarqué uniquement avec `rag_only` ou `full`.

## 9. Nouvelle variante runtime : `rich_v2`

Il ne faut pas modifier silencieusement `compact_v1`. Cette variante doit rester
disponible comme témoin de l’approche agressive. Ajouter :

```ts
MAX_PROMPT_VARIANT: "legacy" | "compact_v1" | "rich_v2"
```

### Principes de compilation

1. `character_prompts` reste l’unique source éditoriale statique.
2. `characters.system_prompt` n’est pas lu.
3. Les champs Notion ne sont jamais modifiés ni réécrits par le compilateur.
4. La sélection se fait par sous-parties sémantiques et priorités déclarées,
   jamais par découpe aveugle du début du champ.
5. Identité, présent, drive, contradiction centrale, voix, vérité factuelle et
   invariants sont toujours présents.
6. La timeline inclut d’abord les événements récents.
7. La profondeur conserve les quatre niveaux et injecte les ancrages pertinents
   à la phase de l’appel et à l’état relationnel.
8. Les sections omises ou sélectionnées sont visibles dans la trace.

### Budget recommandé pour la canary

| Élément | Budget |
|---|---:|
| Cible habituelle du system prompt | 14 000 à 16 000 caractères |
| Plafond absolu du system prompt | 18 000 caractères |
| Noyau statique maximal | 12 000 caractères |
| Rôle utilisateur | 450 caractères |
| État temporel | 260 caractères |
| Mémoire de session | 1 200 caractères |
| Guidance GM | 350 caractères |
| Garde-fous du tour | 500 caractères |
| RAG | 2 700 caractères, trois souvenirs de 900 |
| Post-vidéo | 500 caractères |

Le plafond de 18 000 réduit encore de 54 % le system prompt de référence, mais
la réduction n’est plus le seul critère de succès. Un prompt de 15 000
caractères bien structuré est préférable à un prompt de 7 000 caractères qui a
perdu le présent, le caractère et la progression.

### Contrat conversationnel unifié

Le contrat runtime `rich_v2` doit dire une seule fois :

- première personne, français, pas de narration ni méta-commentaire ;
- réponse directe avant toute éventuelle relance ;
- généralement une à trois phrases parlées ;
- jusqu’à quatre phrases courtes pour un souvenir précis ;
- pas de monologue ;
- pas de rejeu d’ouverture ;
- une question rare et utile, jamais deux tours de suite ;
- interprétation charitable de l’ambiguïté, de l’humour et du STT ;
- fermeture uniquement après attaques explicites répétées ;
- distinction entre explication et excuse ;
- priorité au présent, à la mémoire, au canon et à l’historique de l’appel.

Il ne doit pas imposer en parallèle un autre nombre de phrases ou un plafond de
mots contradictoire. Le plafond de génération reste piloté par la configuration
LLM ; la latence est validée en canary.

## 10. Observabilité à compléter pour `rich_v2`

Le rapport actuel doit être étendu, sans casser les anciennes traces :

- variante ;
- taille source de chaque champ ;
- sous-parties détectées ;
- sous-parties incluses ;
- ordre de priorité ;
- caractères inclus et omis ;
- motif d’omission ;
- niveau de profondeur sélectionné et raison ;
- événements de timeline sélectionnés ;
- total système, historique, message courant et ratio ;
- `prompt_tokens` exacts renvoyés par le fournisseur ;
- paramètres demandés, paramètres transmis et modèle retourné.

Un champ riche ne doit plus apparaître comme simplement « tronqué ». La trace
doit permettre de voir **quelle matière** a été retenue.

## 11. Ordre d’exécution

1. Enregistrer et pousser ce plan sur `main`.
2. Dans Lovable, implémenter `rich_v2` sans toucher aux contenus Notion.
3. Ajouter les tests unitaires et de non-régression.
4. Publier une version diagnostique Lovable.
5. Dans Notion, conserver les textes riches et appliquer seulement les
   corrections chirurgicales de la section 7.
6. Lancer `fields_only` pour synchroniser les huit propriétés et régénérer
   `situation_summary`, sans toucher aux embeddings.
7. Vérifier dans l’éditeur de prompt que les huit champs et le résumé sont
   corrects.
8. Lancer des conversations diagnostiques `legacy`, `compact_v1` et `rich_v2`.
9. Comparer les traces et les réponses à l’aveugle.
10. Trancher la chronologie canonique du corps de page.
11. Corriger le corps de page puis lancer `rag_only` pour Max uniquement.
12. Rejouer le corpus canonique et les questions de détails.
13. Si la recette est positive, activer `rich_v2` globalement depuis Gameplay.
14. Conserver `legacy` et `compact_v1` comme rollback pendant la période de
    validation.

## 12. Ce qu’il faut faire dans Notion

### Avant que Lovable livre `rich_v2`

Ne rien remplacer par les anciens textes condensés. Conserver les champs riches.
Vous pouvez relire et préparer les corrections, mais un test sous `compact_v1`
ne serait pas représentatif.

### Après livraison de `rich_v2`

Sur la fiche active « Max Lorenzo » :

1. modifier les huit propriétés suivantes :
   - Identité fondamentale ;
   - Qui tu es ;
   - Ce que tu ne fais jamais ;
   - Qui t’appelle ;
   - Dynamique de la conversation ;
   - Sujets sensibles ;
   - Profondeur par niveau ;
   - Timeline ;
2. ne pas chercher à modifier `situation_summary` dans Notion : elle est
   générée dans Lovable Cloud ;
3. lancer d’abord `fields_only` ;
4. vérifier le résumé généré et la prévisualisation `rich_v2` ;
5. ne modifier le corps de page et ne lancer `rag_only` qu’après validation des
   ancres temporelles.

Il n’est pas nécessaire de comprimer le récit ou de supprimer les détails du
corps de page.

## 13. Tests et critères d’acceptation révisés

### Tests techniques

- ordre déterministe ;
- absence de `characters.system_prompt` dans `rich_v2` ;
- aucune découpe aveugle du début d’un champ ;
- présent et événements récents toujours inclus ;
- quatre niveaux de profondeur représentés ;
- sélection de profondeur visible dans la trace ;
- sections vides omises ;
- system prompt ≤ 18 000 caractères ;
- trois souvenirs RAG maximum, 900 caractères chacun ;
- aucun score, identifiant ou marqueur `Partie n/N` dans le prompt ;
- anciennes traces toujours lisibles ;
- paramètres GPT-5 mini réellement supportés uniquement ;
- aucun nouvel appel LLM bloquant.

### Corpus éditorial

Le corpus doit inclure :

- question quotidienne simple ;
- question factuelle sur Lausanne, l’âge, le métier et les études
  d’architecture ;
- chronologie complète du séjour ;
- thermos, gentiane, homme sous l’abri, hôtel et poêle d’Anne ;
- Emma, Mona, Léo et Ava ;
- masculinité, protection et contrôle ;
- rapport au père ;
- lectures et pensée intellectuelle ;
- erreurs STT ;
- humour noir ;
- provocation légère ;
- attaques explicites répétées ;
- progression surface → fissure → vérité nue ;
- retour à une question banale après un échange profond.

### Critères conversationnels

- réponse directe aux questions quotidiennes ;
- aucun rejeu d’ouverture après le premier échange ;
- rôle utilisateur perceptible dans les deux premiers tours lorsqu’il existe ;
- prénom et rôle jamais redemandés ;
- au plus 30 % des réponses terminent par une question ;
- jamais deux réponses consécutives terminées par une question ;
- zéro faux positif de modération sur le corpus ambigu/STT ;
- au moins 95 % de réponses canoniquement correctes ;
- aucune fuite d’un autre personnage ;
- cohérence temporelle entre deux questions espacées de cinq tours ;
- maintien du niveau relationnel après un retour à un sujet banal ;
- détails spécifiques disponibles lorsqu’ils sont demandés ;
- pensée intellectuelle perceptible sans récitation automatique de citations ;
- distinction perceptible entre analyse et autojustification ;
- `rich_v2` préféré ou jugé équivalent au legacy sur naturel, crédibilité,
  subtilité, précision et intérêt ;
- P95 du texte Max complet ≤ 4 secondes pendant la canary, ou décision produit
  explicite si l’augmentation contrôlée de la richesse impose un autre compromis.

La réduction brute de 65 % n’est plus un critère bloquant. Elle est remplacée
par un plafond absolu, des budgets visibles et une comparaison qualitative.

## 14. Questions éditoriales à trancher

Trois décisions doivent être confirmées pendant la recette :

1. **Chronologie** — la timeline actuelle de cinq jours et quatre jours au chalet
   est-elle bien la version canonique du montage final ?
2. **Interlocuteur** — doit-il toujours avoir entendu parler de la montagne, ou
   certains rôles utilisateur peuvent-ils arriver sans aucun contexte ?
3. **Références intellectuelles** — Max peut-il nommer Camus, Rilke ou une
   expérience de psychologie lorsque la question s’y prête, ou doit-il toujours
   garder ces références implicites ?

Hypothèses recommandées pour la canary :

- timeline actuelle = canon tant qu’aucune validation contraire n’est donnée ;
- le rôle utilisateur dynamique prime, et l’inconnu ne connaît pas forcément
  tous les détails ;
- références nommées seulement si l’interlocuteur ouvre explicitement le terrain
  culturel ou professionnel.

## 15. Rollback et publication

- `legacy` reste disponible ;
- `compact_v1` reste disponible comme témoin et rollback technique ;
- `rich_v2` n’est activé globalement qu’après canary ;
- aucune migration destructive ;
- aucun nouveau backend, projet Supabase, hébergeur ou pipeline ;
- build, Edge Functions, secrets, publication et tests en environnement réel
  restent exclusivement dans Lovable / Lovable Cloud.

## Reprise autorisée par accès GitHub alternatif — 28 octobre 2026

Ulrich demande explicitement de tester les autres connexions et d'apporter des
solutions concrètes. Le connecteur natif conserve ses trois erreurs `Unknown tool`,
mais `gh` exécuté depuis le contexte système autorisé utilise la session existante
Ulrfis avec succès : profil, dépôt exact, droits push et PR relus. La GitHub App
n'est pas configurée sur ce poste. Aucun identifiant modifié, aucun login/refresh.
`git fetch --prune` puis `git pull --ff-only` réussissent ; main reste c7df835.
Seule PR ouverte : #24, historique depuis le 11 octobre, hors périmètre et préservée.
Branche unique du lot : `codex/protect-character-present`. Lovable Ava/Memoways
est ready sur c7df835 avant développement. Ce repli est autorisé par la demande
actuelle ; il ne remplace pas les règles générales des connecteurs.

Plan d'exécution du correctif :
1. Reproduction rouge synthétique sur le compilateur effectif, avec le volume
   de parole/moteur observé, présent multi-paragraphes et souvenir J−2.
2. Protéger le présent complet hors scoring/déduplication, conserver la parole
   et le moteur intime, réserver explicitement 5 500 caractères statiques au
   maximum et garder le plafond global de 11 000. Contrôler la taille réellement
   rendue ; refuser avant LLM si une unité obligatoire ne tient plus.
3. Tester Max/Emma, premier appel et rappel, correction utilisateur, souvenir
   ancien, historique long/limite, vraie requête LLM et absence d'appel si refus.
4. Geler code/tests/docs avant push ; qualité locale, CI PR sur HEAD exact,
   fusion, CI main, suppression de notre branche, relecture de la source Lovable.
5. Livrer les erreurs exactes du connecteur, la voie CLI vérifiée et un prompt
   autonome de recette courte sur main. Publication production distincte.

## Clôture technique vérifiée — 28 octobre 2026

Le correctif est dans main par PR #104, SHA code
`9adabdce5b5a4f9be6f6fdc6545868659cb4120a`. CI PR 40658393339
verte sur HEAD exact `8f4ddff17d9e5b8e500b85ebc2fbfe9839fd3b2d`,
109 E2E ; CI main 40661278202 verte sur le SHA de fusion, 109 E2E.
Lovable Ava/Memoways est ready au même SHA, agentFinished=true ; le fichier
du compilateur a été comparé identique (29 001 caractères). Aucune opération
Cloud ni publication production. La clôture suivante est exclusivement Markdown ;
le code reste identique à ce SHA vert, sans nouvelle CI complète selon AGENTS.md.

La branche unique `codex/protect-character-present` est réutilisée pour
consigner ces preuves, puis doit être supprimée localement et à distance après
la fusion documentaire. Le compte rendu final doit vérifier ce nettoyage.
La PR historique #24 et les branches étrangères sont préservées :
branches distantes historiques au contrôle : `main`,
`agent/test-gap-invitation-validity-multi-use`. Branches locales historiques
conservées, en plus de `main` :

```text
agent/test-gap-invitation-validity-multi-use
agent/test-gap-posthog-internal-comparison
codex/bug-scan-gradium-temp-cap
codex/character-handoff-contract-lot-1
codex/character-handoff-lot-1-closeout
codex/character-handoff-lot-2-closeout
codex/character-handoff-lot-3-closeout
codex/character-handoff-lot1-prompt
codex/character-handoff-pill-lot-3
codex/character-handoff-runtime-lot-2
codex/handoff-veto-lot-1-finalization
codex/plan-character-handoff
codex/test-gap-settings-hydration
codex/video-latency-metrics
codex/video-latency-publication-record
cursor/d5d2099b
```

Recette humaine courte encore à faire selon le
[prompt F4](prompt_reprise_present_canonique_lot_f4_recette.md) ; son exécution
et une publication production nécessitent des étapes distinctes. Aucun lot de
code suivant lancé. Diagnostic GitHub et consigne de communication enregistrés ;
Notion projet doit recevoir les preuves finales et être relu après écriture.

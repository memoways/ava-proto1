# Plan — Relations crédibles, Game Master renforcé et moteur multipersonnage

> **Statut :** implémentation terminée localement le 11 septembre 2026 ;
> validation Lovable Cloud et recette humaine encore requises.
>
> **Chaîne de livraison :** Lovable compile et publie le projet. La migration,
> les Edge Functions, la synchronisation Notion et la recette de production
> doivent être appliquées exclusivement dans Lovable / Lovable Cloud.

## 1. Problème produit

Le personnage répondait trop volontiers et trop directement, y compris à des
questions biographiques ou intimes posées dès le premier tour. La confiance
présente dans la mémoire ne formait pas une politique commune à toutes les
variantes de prompt. Le RAG pouvait apporter un fait juste sans distinguer ce
que le personnage connaît de ce qu'il accepte de confier.

Le moteur restait par ailleurs marqué par son origine centrée sur Max : valeurs
par défaut silencieuses, libellés, tests et plusieurs chemins d'identité. Enfin,
le banc d'évaluation ne rejouait pas exactement le parcours public et pouvait
considérer une retenue crédible comme une mauvaise réponse.

La capture interne du 11 septembre a aussi confirmé que la mesure AVA devait
rester une source de premier rang. Le tableau « Latence & blocage » agrégeait 33
tours de huit sessions, mais perdait le TTS dans certaines moyennes synthétiques
et ne rapprochait pas le journal GM. Une moyenne reproduite à 3,2 s devait être
3,7 s avec son segment TTS.

## 2. Expérience relationnelle

### Cadre de rencontre

Le choix du personnage et l'écran d'appel affichent un cadrage bref issu de la
fiche runtime : lieu, moment et situation de l'appel. Aucun nouvel écran n'est
imposé. Le joueur peut inventer son rôle pendant la conversation ; une simple
affirmation telle que « je suis ton ami » ne crée ni passé commun ni confiance.

### Paliers cachés

| Palier | Comportement |
|---|---|
| `contact` — Prise de contact | Personnalité perceptible, découverte de l'intention, retenue sur l'intime. |
| `link` — Lien établi | Réponses plus personnelles, contradictions et premières ouvertures ciblées. |
| `trust` — Confiance | Confidences plus profondes lorsque le sujet, la question et le caractère le permettent. |

Les paliers ne dépendent ni d'un nombre de tours ni du temps restant. Le GM
propose une évolution à partir de signes propres au personnage : écoute,
franchise, précision, respect d'une limite ou confrontation pertinente. Le
moteur déterministe refuse une progression causée par la seule politesse, la
répétition ou une confidence déjà produite trop tôt. Un palier ne peut avancer
que d'un niveau par décision.

La confiance peut reculer puis être réparée. Les faits déjà confiés restent dans
la mémoire ; la disposition actuelle à parler est stockée séparément. Une
résistance peut prendre la forme d'une réponse partielle, d'une objection, d'un
déplacement du sujet ou d'une question sur l'intention. Le personnage peut
prendre une initiative cohérente, sans quota de questions et sans relance
automatique après un silence. Aucune confidence n'est garantie avant la fin et
aucun score relationnel n'est montré au joueur.

## 3. Source éditoriale

Notion reste la référence. La fiche d'un personnage reçoit deux champs distincts :

- `politique_relationnelle` : moteur de l'appel, signes d'ouverture et de
  fermeture, sujets sensibles, conditions, résistance et initiative ;
- `references_intellectuelles` : influences et références du personnage.

Le champ historique de profondeur n'est plus interprété automatiquement comme
une liste de références intellectuelles. En attendant que les fiches publiées
soient complétées, un adaptateur compile une politique relationnelle explicite
depuis les champs historiques sans déplacer les données ambiguës. L'admin
affiche la politique compilée, sa provenance, sa version et les avertissements
de compatibilité ; elle ne crée pas une seconde personnalité.

## 4. Architecture mise en place

### Contrats communs

- `CharacterRelationshipPolicy` décrit les règles éditoriales versionnées du
  personnage et les conditions par sujet.
- `RelationshipState` stocke le palier, l'ouverture par sujet, la justification,
  le tour source et les faits déjà confiés, avec un état séparé par personnage.
- `TurnRelationshipDirective` fournit au prompt du tour une consigne courte,
  calculée localement depuis la question actuelle, la politique et le dernier
  état valide.

La directive est injectée dans les quatre variantes de prompt avec un budget
réservé. Elle autorise le personnage à répondre, nuancer, retenir, contester ou
questionner. Le RAG fournit des faits ; il n'accorde jamais une permission de
confidence.

### Game Master post-tour

Le chemin public conserve un seul appel GM, après la réponse et hors de
l'attente du joueur. Il reçoit le profil comportemental compact, l'état courant,
la directive appliquée et la réplique effectivement diffusée. Sa proposition
est validée localement avant persistance : personnage, version, tour source,
ordre d'arrivée, progression maximale et preuves éditoriales.

Une consigne périmée, dupliquée, appliquée au mauvais personnage ou fondée sur
une preuve interdite est ignorée. En cas de réponse GM invalide ou d'échec, le
dernier état valide est conservé sans nouvel appel et sans délai pour le joueur.
Le résultat reste indépendant de la durée de lecture audio.

### Continuité

La mémoire de conversation passe en version 3 et maintient un état relationnel
par personnage. La reprise recharge l'état du personnage explicite. Les anciens
champs restent lisibles par les adaptateurs de compatibilité, mais aucune
identité absente ou inconnue ne revient silencieusement vers Max.

### Moteur multipersonnage

Un registre central pilote identifiants, disponibilité, noms et cadrages. Max et
Emma sont actifs à égalité ; Ava et Léo restent indisponibles. Les appels, voix,
portraits, mémoires, changements et évaluations utilisent l'identifiant du
personnage courant. Un troisième personnage fictif passe les tests du moteur
sans branche conditionnelle dédiée.

## 5. Mesures AVA et PostHog

### Rôles des sources

- **AVA interne** : source principale pour le détail session/tour, les segments,
  la mémoire, les décisions GM, les erreurs et la persistance.
- **PostHog** : tendance agrégée, comparaison de versions et suivi dans le temps.

Les sources sont rapprochées par `session_id` et `turn_id`. La vue affiche la
couverture du premier son, les tours absents d'une source et les filtres de
date, environnement, personnage, modèle, STT, TTS et navigateur. Une absence
PostHog n'efface aucune mesure interne.

### Sémantique de latence

La cible est le délai entre la fin de parole, ou la validation PTT explicitement
identifiée, et le premier son réellement démarré :

- médiane ≤ 2 s ;
- p95 ≤ 4 s ;
- aucun appel IA ajouté en série ;
- aucun délai artificiel de mise en scène.

Le runtime enregistre l'origine (`ptt_finalized`, `transcript_final` ou
`text_submitted`), le statut du premier son et son horodatage de lecture. Le
premier token LLM ne remplace jamais une mesure audio. Les anciennes durées TTS
qui mélangent génération et lecture sont signalées comme ambiguës.

Les agrégations conservent le segment TTS et calculent toutes les moyennes sur
le même ensemble de mesures. Le GM post-tour est visible pour son diagnostic,
mais exclu du temps d'attente, de la barre du joueur et du choix du blocage.
L'interface distingue `non exécuté`, `non mesuré`, `invalide` et `échec`.

## 6. Évaluation et acceptation

Le banc LLM as judge utilise désormais le même graphe que le parcours public :
RAG, génération personnage, GM post-tour asynchrone, puis juge. Une retenue
appropriée peut obtenir une bonne note. Les variations OFAT restent appliquées
par des paramètres de test sans reconstruire un second pipeline.

Les tests automatiques couvrent notamment :

- biographie et sujet sensible au premier tour puis après ouverture ;
- connaissance d'un fait sans permission de livrer l'intime ;
- absence de progression automatique par politesse ou répétition ;
- confrontation, limite, recul, réparation et réouverture ;
- initiative sans question réflexe et fin sans aveu forcé ;
- changement de personnage, retour et reprise ;
- GM lent, absent, invalide, dupliqué ou terminé dans le désordre ;
- troisième personnage sans branche spécifique ;
- agrégation TTS, exclusion du GM et premier son exact ;
- rapprochement des mesures internes et PostHog.

La validation en environnement publié doit compléter l'automatisation par une
écoute humaine de Max et Emma. La recette de réactivité exige au moins 100 tours
par personnage, sur plusieurs sessions, avec couverture et erreurs affichées,
pour les variantes TTS et avatar destinées à être publiées.

## 7. Ordre de livraison Lovable

1. Synchroniser cette branche avec le projet Lovable.
2. Appliquer la migration `20260911122837_character_relationship_policy.sql`
   dans Lovable Cloud.
3. Publier la version mise à jour de `sync-notion`, puis compléter et
   synchroniser les politiques relationnelles Max et Emma dans Notion.
4. Compiler dans Lovable et vérifier les parcours public, sandbox et admin.
5. Rejouer les scénarios d'acceptation sur Max et Emma.
6. Réaliser la campagne de 100 tours par personnage et examiner d'abord les
   mesures AVA internes, puis leur correspondance PostHog.
7. Ne rendre la version publiable qu'après validation qualitative et respect des
   cibles p50/p95 avec une couverture suffisante.

## 8. Validation locale

- TypeScript : réussi.
- Tests unitaires : 83 fichiers et 376 tests réussis.
- Tests d'intégration : 2 fichiers et 16 tests réussis.
- Compilation de production Vite : réussie. L'avertissement existant sur les
  chunks de plus de 500 kB et la base Browserslist ancienne reste informatif.
- ESLint sur tous les fichiers modifiés : réussi.
- Contrôle du diff : réussi.
- Le lint global reste bloqué par l'erreur préexistante
  `src/integrations/supabase/previewAuthStorage.ts:38` (`prefer-const`), hors de
  ce chantier.

## 9. Limites connues avant activation

Les politiques actuellement publiées dans Notion et les réglages de Lovable
Cloud n'ont pas pu être lus pendant ce lot : les connecteurs ont refusé leur
accès. Le code, la migration et l'adaptateur de synchronisation sont prêts, mais
la campagne humaine, les 200 tours et la publication Lovable restent des
preuves d'exploitation à produire ; elles ne sont pas remplacées par les tests
locaux.

## Documentation liée

- [Changelog](../CHANGELOG.md#non-publié)
- [Plan Emma et changement de personnage](plan_emma_conversation_switch.md)
- [Plan LLM as judge](plan_llm_as_judge.md)
- [Finalisation historique de l'orchestration](interfaces/lovable-experience-orchestration-finalization.md)

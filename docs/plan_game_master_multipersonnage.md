# Plan — Game Master multipersonnage, fidèle à la promesse

Ce plan sera aussi enregistré dans `docs/plan_game_master_multipersonnage.md`. L'inventaire de l'étape 0 est livré avant toute suppression.

## 1. État des lieux (ce qui tourne vraiment)

```text
Introduction -> question "film vu ?" -> onboarding bénévole -> choix personnage -> appel
                     |                          |
               sessions.has_seen_film     profil bénévole (player_role)
                     |                          |
                  (NON transmis)        personnage actif + GM post-tour
```

- Parcours public : `IndexPRD4` -> `prd4Orchestrator` -> réponse du personnage (`maxAgent`, variante `legacy` par défaut), puis Game Master **après** la réponse (`gameMasterPRD4`, hors attente joueur), plus un étiquetage en parallèle.
- Réglages GM : versions publiées dans `experience_orchestration_versions` (brouillon / publié / archivé), épinglées sur chaque session (`orchestration_version_id`). C'est la base à étendre.
- Personnages : fiches Notion synchronisées (`character_prompts`), registre central `characterRegistry` (Max, Emma actifs ; Ava, Léo indisponibles).
- Confiance : état par personnage (contact / lien / confiance), dérivé de la politique relationnelle. Aucune posture réglable aujourd'hui.
- Passage de personnage : le GM propose, le personnage actif le suggère, le joueur accepte. L'état est conservé en session et survit au rafraîchissement.
- Code mort : `gameMasterAgent`, `conversationOrchestrator` (ancien pipeline A/B), `gameMasterPromptBuilder` utilisé seulement pour un aperçu admin.

## 2. Inventaire du codé en dur et des scories

| Élément | Où | Traitement proposé |
|---|---|---|
| Prompt GM : « handoff Max↔Emma », validation `targetCharacter === "emma" \|\| "max"` | `gameMasterPRD4` | Cibles lues depuis le registre des personnages actifs |
| Aperçu admin « Handoff entre Max et Emma » | `gameMasterPromptBuilder` | Généré depuis le registre |
| Valeurs par défaut `"Max"`, préchargement `loadCharacterPromptByName("Max")` | `maxAgent`, `rewrite-query`, `sync-eval-items` | Identifiant obligatoire, sans repli silencieux |
| `emma ? "Emma" : "Max"` | `summarize-session` | Nom lu depuis le registre |
| Règle « une question peut répondre à une intrusion » | `maxAgent` (règles techniques) | Remplacée par une règle neutre de cadre bénévole |
| Personnage « Game Master » dans `characters` | base | À confirmer : vérifier s'il est encore lu, sinon le signaler |
| Ancien pipeline A/B et son GM pré-tour | `conversationOrchestrator`, `gameMasterAgent` | Retrait, après accord, le banc de tests gardant le parcours public |
| `role_capture` / `role_summary` (âge, genre, relation) | écrans inactifs | Retrait, contraires à la promesse |

Notion, à signaler seulement (pas de réécriture) : les fiches Max et Emma mentionnent « médias », « chalet », « inconnu » (Max aussi « journa… ») ; Léo mentionne « intrus ». Je donne les passages exacts à la direction éditoriale.

## 3. Contradictions détectées

1. La réponse « film vu / pas vu » n'arrive ni au personnage ni au GM : la règle d'exposition par parcours n'est pas appliquée.
2. Le cadre bénévole n'est connu que par le personnage (via le profil). Le GM reçoit aussi le profil, mais pas de consigne sur le parcours ni sur ce qui a déjà été dit.
3. Le GM ne peut pas déclencher un passage demandé par le joueur. Il le découvre seulement après le tour.
4. Les fiches Notion contiennent des traces de l'ancien cadrage (médias, inconnu, intrus).
5. Aucune trace des versions de fiches personnages sur la session : les comparaisons A/B sont impossibles côté personnage.

## 4. Architecture proposée

**Contexte commun (une seule source).** Un module `experienceFrame` construit une fois par tour un `ExperienceFrame` : rôle bénévole, parcours (`seen` / `unseen`, issu de la réponse du joueur), consigne d'exposition, informations déjà données (depuis la mémoire), statut revendiqué signalé. Le même bloc de texte est injecté dans les quatre variantes de prompt et dans le prompt du GM. Le cadre institutionnel reste séparé de l'état relationnel, propre à chaque personnage.

**Réglages en base.** On étend la config des versions d'orchestration existantes (pas de nouveau système, une seule version active) avec :
- `posture` : `pudique` / `ouvert` (+ texte libre), qui module la directive relationnelle ;
- `directionIntensity` (existe : ton) ;
- `exposure.seen` / `exposure.unseen` : consignes textuelles par parcours ;
- `frameText` : texte du cadre bénévole ;
- `handoff` : règles existantes, et passage sur demande explicite du joueur ;
- `activeCharacters` : sous-ensemble du registre.

**Passage de personnage.** Détection locale, sans appel IA, d'une demande explicite (« je voudrais parler à Emma ») avec les noms du registre. Le personnage actif reçoit alors une consigne de passage pour ce tour. Le GM post-tour garde les suggestions. Le personnage ne propose jamais de passage sans consigne : règle ajoutée au cadre et au contrôle de sortie. Le cadre est conservé et la confiance reste propre à chaque personnage.

**Traçabilité.** La session enregistre en plus `character_prompt_versions` (date de mise à jour de chaque fiche utilisée) et la version du code du GM.

**Variables structurelles conservées dans le code :** identifiants des personnages, nombre maximal de paliers relationnels, schéma JSON du GM, budgets de prompt et de latence, limites de sécurité (nombre de passages ≤ 20, longueur de réponse).

## 5. Étapes (chacune testable et réversible)

0. Enregistrer le plan dans `docs/` et livrer l'inventaire détaillé avec les passages Notion à signaler.
1. `ExperienceFrame` et parcours vu / non vu transmis au personnage et au GM, derrière un réglage activable (désactivé = comportement actuel).
2. Réglages étendus dans la version d'orchestration et dans l'onglet admin Game Master. Valeurs par défaut identiques à l'existant.
3. Posture soutien / confiance branchée sur la directive relationnelle.
4. GM et fonctions serveur sans nom de personnage en dur (registre). Test avec un troisième personnage fictif.
5. Passage sur demande du joueur, et interdiction des renvois spontanés.
6. Versions enregistrées sur la session, visibles dans l'onglet Sessions.
7. Nettoyage du code mort et des écrans de rôle, après ta liste validée.

## 6. Scénarios de vérification

Tests automatiques, puis écoute en sandbox sur Max et Emma :
- parcours vu : pas de récitation des faits ;
- parcours non vu : informations données peu à peu, sans révélation prématurée ;
- aucune présentation : rien n'est demandé ni inventé ;
- prénom seul : prénom repris, rien de plus ;
- faux statut (« je suis policier ») : non validé, recadré avec douceur ;
- demande de changement de personnage par le joueur ;
- passage suggéré par le GM, et aucun renvoi spontané ;
- reprise après rafraîchissement : même personnage, même cadre, confiance séparée ;
- joueur insistant ou brusque : la retenue et la modération restent actives.

Latence : aucun appel IA ajouté en série, la médiane ≤ 2 s et le p95 ≤ 4 s sont surveillés dans l'onglet Latence.

## 7. Questions restantes

- Le personnage « Game Master » dans la base Notion est-il encore une source voulue pour le prompt du GM ?
- Le faux statut : recadrage par le personnage seul, ou aussi une consigne du GM au tour suivant ?

## Livraison

Lovable Cloud uniquement, en sandbox. Aucune publication en Production sans ta décision explicite.

---

## Avancement (12/10/2026)

Livré (sandbox, rien publié en Production) :
- Étape 0 : plan enregistré, inventaire ci-dessous.
- Étape 1 : `src/services/experienceFrame.ts` construit le cadre commun (cadre, parcours vu / non vu, posture, faits déjà connus, interdiction des renvois spontanés). Le même bloc est injecté dans les quatre variantes de prompt du personnage (section réservée `experience_frame`) et dans le prompt du GM. La réponse « film vu » est maintenant transmise à chaque tour (`hasSeenFilm`). La lecture des réglages est bornée à 400 ms et ne fait aucun appel IA.
- Étapes 2-3 : `ExperienceDirectorConfig.frame` et `activeCharacters` sont versionnés avec l'orchestration existante. Une nouvelle section est disponible dans l'onglet admin Game Master. Désactivé par défaut, donc comportement inchangé tant qu'une version avec le cadre activé n'est pas publiée.
- Étape 4 (partielle) : le prompt du GM ne nomme plus Max ni Emma pour les passages. Un passage proposé vers un personnage inactif ou vers le personnage actuel est ignoré. La règle legacy « intrusion » des personnages est neutralisée.
- Étape 5 : la détection locale des demandes du joueur existait déjà (`detectPlayerSwitchRequest`). Les renvois spontanés sont interdits via le cadre.
- Étape 6 : colonnes `sessions.character_prompt_versions` et `sessions.gm_code_version`, remplies au premier tour de chaque personnage.

Restant :
- Le type `RuntimeCharacter` reste limité à `max | emma`. Les alias de détection (« papa », « père ») et `summarize-session` gardent un mapping binaire. Il faudra les élargir avant d'activer Ava ou Léo.
- Étape 7 (nettoyage de `conversationOrchestrator`, `gameMasterAgent`, `role_capture`, `role_summary`) : en attente de ta validation de la liste.

## Passages Notion contraires au cadre (à corriger par l'éditorial, non modifiés)

| Fiche | Extrait |
|---|---|
| Max, Emma | « les histoires de violence circulent très vite — réseaux sociaux, médias, bouche-à-oreille » |
| Max, Emma | « Tu ne t'étonnes pas qu'un inconnu connaisse les détails de ce qui s'est passé au chalet » |
| Max, Emma | « C'est un inconnu qui t'appelle — et dans ce contexte, c'est normal » |
| Max | « Cet inconnu tombe au moment exact où tu as besoin d'un regard extérieur » |

Les mentions « intrus » / « inconnu » du récit (Léo, Peter au chalet) font partie de l'histoire et ne posent pas de problème.

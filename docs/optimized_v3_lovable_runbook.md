# Activation Lovable Cloud — prompt Max `optimized_v3`

Plan approuvé :
[`plan_optimized_v3_payload_max.md`](plan_optimized_v3_payload_max.md).

## Périmètre livré

`optimized_v3` est une variante additive. `legacy`, `compact_v1` et `rich_v2`
restent disponibles et le réglage global n'est pas basculé automatiquement.

La variante compile un contexte global borné à 11 000 caractères hors message
utilisateur courant. Elle sélectionne des unités sémantiques de la fiche, retire
les répétitions entre fiche, mémoire et RAG, conserve seulement les phrases
nouvelles d'une source secondaire et trace chaque sélection, fusion ou omission.

La mémoire `ConversationMemoryV1` est produite dans l'appel GM post-tour existant,
fusionnée par un reducer déterministe et persistée avec un contrôle optimiste du
numéro de tour. Deux échanges bruts restent injectés ; si le GM est en retard,
les tours non encore résumés sont temporairement conservés.

## Ordre obligatoire d'activation

Toutes les opérations ci-dessous sont réalisées depuis Lovable/Lovable Cloud.

1. Appliquer la migration
   `supabase/migrations/20260805143000_add_prd4_conversation_memory_resume.sql`.
2. Publier le code sans changer `MAX_PROMPT_VARIANT`.
3. Modifier les propriétés de la fiche Notion Max avec les remplacements exacts
   de [`plan_optimisation_payload_max.md`](plan_optimisation_payload_max.md),
   section 7.
4. Lancer une synchronisation `fields_only` pour Max.
5. Contrôler que `situation_summary` contient Lausanne aujourd'hui, le retour du
   Jura hier, le fusil sur Emma puis Ava, Léo qui désarme Max, Mona au camp et la
   police muette.
6. Activer `optimized_v3` sur une session canary séparée et valider la trace.
7. Corriger ensuite le corps narratif Notion : ancres sur cinq jours et section
   autonome repas / provocations d'Agotha / aveu nocturne à Emma.
8. Lancer `rag_only` pour Max. Ne pas reconstruire le corpus pour le seul
   changement de compilateur ; cette synchronisation n'est requise qu'après la
   correction éditoriale du corps.
9. Comparer des sessions séparées `optimized_v3` et `rich_v2` avec les mêmes
   scénarios. Aucun double appel n'est activé en production.

## Contrôles de la trace

Dans **Trace exacte des réponses de Max**, vérifier avant bascule globale :

- `variant = optimized_v3` ;
- système + historique inférieur ou égal à 11 000 caractères ;
- message utilisateur courant intégral ;
- noyau Max, présent, contradiction, moteur et timeline présents ;
- trois candidats RAG sélectionnés au maximum, sans score, identifiant ou
  marqueur `Partie n/N` dans le texte injecté ;
- doublons et phrases fusionnées visibles avec leur motif ;
- mémoire avant, delta GM et mémoire après visibles ;
- modèle demandé, modèle retourné et tokens fournisseur renseignés.

Un dépassement est acceptable uniquement s'il est explicitement marqué comme
causé par le message courant intact.

## Reprise et sécurité

Le bouton **Reprendre l'appel** ne propose que la dernière session Max du
propriétaire, non terminée et non expirée. Il restaure le transcript, la mémoire,
le rôle, la posture, les triggers et le temps réellement restant. La marge de
cinq minutes de `resume_expires_at` ne rallonge pas le temps jouable.

Aucun microphone, avatar, audio, TTS ou phrase d'ouverture n'est préparé ou joué
tant qu'une reprise est recherchée ou disponible.

## Retour arrière

Repasser `MAX_PROMPT_VARIANT` à `rich_v2`, `compact_v1` ou `legacy`. Les nouvelles
colonnes sont additives et ne modifient pas le comportement des variantes
historiques ; l'ancien résumé périodique reste actif pour elles.

## Prompt prêt à coller dans Lovable

```text
Finalise dans Lovable/Lovable Cloud la livraison de la variante de prompt Max
`optimized_v3` déjà implémentée sur la branche GitHub `main`.

Commence par synchroniser le projet avec le dernier commit de `main`, puis lis
intégralement, avant toute action :
- `AGENTS.md` ;
- `docs/plan_optimized_v3_payload_max.md` (plan approuvé et source de vérité) ;
- `docs/optimized_v3_lovable_runbook.md` (ordre opérationnel obligatoire) ;
- `docs/plan_optimisation_payload_max.md`, section 7 (remplacements éditoriaux
  exacts de la fiche Notion Max) ;
- les entrées `optimized_v3` de `CHANGELOG.md` et `STORY.md`.

Le code est déjà implémenté et validé localement : 232 tests, TypeScript, lint
ciblé et build de production sont verts. Ne réécris pas le compilateur et ne
remplace pas cette architecture par une autre. Inspecte le code pour confirmer
sa présence et ne corrige que les erreurs réelles qui empêcheraient
l'application ou la validation dans Lovable.

Contraintes absolues :
- Lovable est l'unique chaîne de build et de publication ; la base, les
  migrations et les éventuelles Edge Functions passent uniquement par Lovable
  Cloud et le Supabase fourni par Lovable ;
- ne configure aucun Supabase, hébergeur, secret ou pipeline externe ;
- conserve `legacy`, `compact_v1` et `rich_v2` comme rollbacks ;
- ne bascule pas immédiatement le réglage global vers `optimized_v3` ;
- aucun double appel LLM en production ;
- ne supprime et ne condense aucun détail canonique de la fiche Notion ou du
  corps RAG ;
- ne ré-embarque pas le corpus pour le seul changement de compilateur ;
- `situation_summary` est généré par Lovable Cloud et ne doit pas être édité
  manuellement.

Exécute les étapes suivantes dans cet ordre, sans en sauter :

1. Vérifie que le code synchronisé contient bien : le compilateur
   `optimized_v3`, `ConversationMemoryV1`, le `memory_delta` du GM post-tour, la
   persistance optimiste par numéro de tour, la reprise explicite sans média, la
   vue analytique des traces et les tests associés.

2. Applique dans Lovable Cloud la migration additive
   `supabase/migrations/20260805143000_add_prd4_conversation_memory_resume.sql`.
   Vérifie la présence de `sessions.conversation_memory`,
   `sessions.memory_last_turn`, `sessions.resume_expires_at`, de la contrainte
   non négative et de l'index partiel propriétaire. Contrôle que les politiques
   RLS existantes continuent de limiter la lecture et la mise à jour d'une
   session à son propriétaire.

3. Compile et publie cette version depuis Lovable, sans modifier encore la
   valeur globale de `MAX_PROMPT_VARIANT`. Vérifie que l'application démarre,
   que l'admin propose les quatre variantes et que les variantes historiques
   restent utilisables.

4. Dans la fiche Notion active « Max Lorenzo », applique uniquement les
   remplacements chirurgicaux exacts de la section 7 de
   `docs/plan_optimisation_payload_max.md` :
   - une règle de longueur unique dans `Identité fondamentale` ;
   - les traits sombres comme potentialités, pas comme ton permanent, dans
     `Qui tu es` ;
   - l'intention des questions sans fréquence technique et la distinction
     explication/excuse dans `Ce que tu ne fais jamais` ;
   - priorité au rôle dynamique, aucune ouverture obligatoire et tolérance aux
     ambiguïtés/STT dans `Qui t'appelle` ;
   - analyse abstraite toujours reliée à un détail vécu dans `Dynamique de la
     conversation` ;
   - faits et sensations avant l'explication, sans absolution, dans `Sujets
     sensibles` ;
   - règle introductive unique, quatre niveaux et profondeur persistante dans
     `Profondeur par niveau` ;
   - timeline canonique : départ il y a cinq jours, quatre journées au chalet,
     retour hier.
   Conserve tout le reste de la matière éditoriale riche.

5. Lance `sync-notion` en mode `fields_only` pour Max uniquement. Contrôle le
   `situation_summary` généré : Lausanne aujourd'hui, retour du Jura hier, fusil
   sur Emma puis Ava, Léo qui désarme Max, Mona dans le camp et police muette.
   Si un de ces faits manque ou est contredit, ne poursuis pas la canary :
   corrige la source ou la génération, relance `fields_only` et revalide.

6. Active `optimized_v3` uniquement pour une session canary diagnostique
   séparée. Dans « Trace exacte des réponses de Max », vérifie au minimum :
   - `variant = optimized_v3` ;
   - contexte généré hors message courant inférieur ou égal à 11 000
     caractères ;
   - message utilisateur courant intégral ;
   - absence de `characters.system_prompt` ;
   - présence du présent, de l'identité, de la contradiction, du moteur et de la
     vérité factuelle ;
   - trois souvenirs RAG injectés au maximum et 1 800 caractères au total, sans
     score, ID ni marqueur `Partie n/N` ;
   - candidats RAG écartés et candidats de remplacement avec leur motif ;
   - unités incluses, fusionnées ou omises, caractères dédupliqués et source
     conservée ;
   - mémoire avant, `memory_delta` et mémoire après ;
   - modèle demandé, modèle réellement retourné et tokens exacts du fournisseur.

7. Vérifie la mémoire sur au moins six tours : prénom et rôle retenus, faits
   utilisateur non répétés, révélations de Max non rejouées, fils ouverts
   conservés, profondeur relationnelle non régressive après un sujet banal.
   Recharge ensuite la page et vérifie que « Reprendre l'appel » restaure la
   bonne session, son transcript, sa mémoire et son temps restant sans lancer
   automatiquement micro, avatar, audio, TTS ni phrase d'ouverture. Vérifie aussi
   qu'une session terminée, expirée ou appartenant à un autre utilisateur n'est
   jamais proposée.

8. Après cette première validation seulement, corrige le corps narratif Notion
   de Max : toutes les ancres temporelles doivent suivre la timeline de cinq
   jours ; ajoute ou garantis une section autonome sur le repas, les provocations
   d'Agotha et l'aveu nocturne à Emma. Les auteurs intellectuels ne doivent être
   nommés que si l'interlocuteur ouvre explicitement ce terrain.

9. Lance alors `sync-notion` en mode `rag_only` pour Max uniquement. Ne lance pas
   de rebuild global pour le seul changement de compilateur. Vérifie que le
   profil actif reste `voyage-4-realtime` avec documents `voyage-4-large`,
   requêtes `voyage-4-lite`, 1 024 dimensions et le reranking actuel.

10. Compare des sessions séparées `optimized_v3` et `rich_v2` avec les mêmes
    scénarios du corpus de recette du plan. Ne fais pas deux appels pour un même
    tour de production. Mesure correction canonique, ouvertures rejouées,
    fréquence des questions, cohérence chronologique, disponibilité des détails
    rares et P95 du texte complet de Max.

11. Ne bascule globalement vers `optimized_v3` que si les critères du plan sont
    atteints : au moins 95 % de réponses canoniquement correctes, aucune fuite
    d'un autre personnage, aucune ouverture rejouée, au plus 30 % des réponses
    terminées par une question et jamais deux consécutives, chronologie cohérente,
    détails rares accessibles, P95 inférieur ou égal à 4 secondes et résultat
    préféré ou équivalent à `rich_v2` en comparaison aveugle. Sinon, laisse le
    réglage global inchangé et documente précisément les écarts.

À la fin, fournis un compte rendu factuel avec :
- commit `main` effectivement synchronisé ;
- migration appliquée et objets de base vérifiés ;
- build/publication Lovable et URL/version ;
- propriétés Notion modifiées ;
- résultats et identifiants des synchronisations `fields_only` et `rag_only` ;
- métriques exactes de la trace canary ;
- résultats mémoire/reprise/RLS ;
- comparaison `optimized_v3` contre `rich_v2` ;
- valeur finale de `MAX_PROMPT_VARIANT` ;
- éventuels blocages ou critères non atteints.

Si une opération nécessite un accès Notion ou une autorisation que tu n'as pas,
n'invente pas son succès et ne contourne pas Lovable Cloud : arrête uniquement
l'étape concernée, indique l'autorisation exacte requise, puis poursuis toutes
les vérifications indépendantes encore possibles.
```

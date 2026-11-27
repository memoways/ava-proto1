# Prompt de reprise — Cohérence émotionnelle, lot 2 : fiches Notion face au radar (audit, lecture seule)

À copier dans un nouveau chat Ava. Plan : [plan_coherence_emotionnelle_gm.md](plan_coherence_emotionnelle_gm.md). Tâche Notion : [5 développements Game Master AVA](https://app.notion.com/p/fd65f37db8bc473e92189da38527894c) (Gamilab, section du 27 novembre).

---

**Objectif** : vérifier que les fiches Notion de Max et Emma ne contredisent pas le radar, et ne le doublent pas. Le radar gère l'état émotionnel de l'expérience ; les fiches gardent le caractère fondamental. Ulrich veut une logique simple, vivante et évolutive, avec le moins possible d'injonctions multiples et contradictoires. Livrable : un document d'audit et des propositions de formulation pour Romed. **Aucune écriture dans la base Caractères.**

**État vérifié au départ**
- Le lot 1 (garde-fous voix) est fusionné sur main. Il apporte :
  - une rampe d'intensité (au plus un cran par réplique) ;
  - un budget d'éclats (une réplique chaude au plus par fenêtre de 6) ;
  - un plafond de Max à 1, sauf éclat mérité ;
  - la balise ElevenLabs sur la première phrase seulement ;
  - des limites de style et de stabilité ;
  - la journalisation `performance_*` et la ligne de tour « Émotion de jeu : … 1/2 (rampe, au lieu de 2) ».
- Vérifier le SHA de fusion sur origin/main et dans le CHANGELOG avant de commencer.
- L'écoute d'Ulrich après le lot 1 n'est pas encore faite, sauf s'il le dit.

**Première action exécutable** : si Ulrich a appelé Max sur sandbox-ulrich depuis la fusion du lot 1, sortir tour par tour (lecture seule, via le MCP Lovable Ava) dans `audio_latencies.metadata_json` : `performance_intensity`, `performance_tempered`, `performance_paced_*`, `performance_outburst`. Vérifier qu'aucune réplique ne saute de 0 à 2 et qu'il y a au plus un éclat par fenêtre de 6. Noter le résultat dans l'audit. Ensuite, lire les fiches.

**Sources**
- Base Caractères AVA (Gamilab, `get-self` `7e1a9a09-09cb-4deb-a306-83a29b831bc2`) : lecture seule, **interdiction formelle d'écrire**. Fiches actives de Max et Emma, champs Manière de parler, États de parole (« Bloqué », « La digue cède »…), Dynamique de la conversation, Politique relationnelle, Qui t'appelle, Ce que tu ne fais jamais.
- Le contenu compilé côté application : `src/services/characterPromptService.ts`, `src/agents/maxAgent.ts` (blocs du prompt), `src/agents/maxOptimizedPromptCompiler.ts`.
- Le radar : `src/services/characterState.ts` (textes par niveau `STATE_LEVEL_TEXT`, consigne `compileCharacterStateBlock`).
- Les mémoires RAG, qui contiennent « furieux » et « tu cries ton secret ».
- L'audit de départ : la section Audit du plan.

**Périmètre**
- Tableau par personnage et par champ : consigne émotionnelle trouvée, si elle relève du caractère (Notion) ou de l'état de l'expérience (radar), et le conflit éventuel avec le radar, la voix ou un autre champ. Exemples à confirmer : « fait confiance dès le début », un état de parole qui impose une intensité, « La digue cède » face au plafond de voix.
- Repérer aussi les doublons entre le prompt du personnage, la directive relationnelle, le conseil du GM et le bloc radar : ce sont les injonctions multiples.
- Pour chaque conflit, une proposition de formulation pour Romed, ou une proposition de changement côté application, qui sera prise au lot 3.
- Livrable : `docs/audit_fiches_vs_radar.md`. Mettre à jour la section du 27 novembre de la tâche Notion, en écrivant seulement dans la tâche.

**Hors périmètre** : tout changement de code de jeu (lot 3), production, latence, Gami DigiDouble.

**Limites d'autorisation** : sandbox uniquement. Lectures SQL seulement, via le MCP Lovable Ava `1265958d-b74e-40f2-917d-182fe05163fc`. Aucun appel payant. Notion : seules les tâches s'écrivent.

**Validations** : document relu ; chaque conflit cité avec son champ et un extrait court ; aucun fichier de code modifié.

**Livraison** (contrat d'AGENTS.md)
1. Branche de lot depuis main à jour, puis PR.
2. Lot documentaire : vérifier ce que demande la garde.
3. Fusion par `~/CodeProjects/_shared/scripts/github-delivery-exec node .github/scripts/ship-pr.mjs --pr N --head SHA --merge`.
4. Vérification sur origin/main ; mise à jour de l'état courant, du CHANGELOG et de la tâche Notion.

**Clôture obligatoire** : avant le push, écrire `docs/prompt_reprise_coherence_emotionnelle_lot_3.md` (le radar comme seule source de l'état, voir le plan), avec l'état vérifié, les sources, le périmètre, les invariants, les validations, la livraison, la première action exécutable et cette même obligation. Donner le lien direct dans le compte rendu. Un lot, puis arrêt.

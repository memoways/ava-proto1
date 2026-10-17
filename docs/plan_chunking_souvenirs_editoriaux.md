# Plan — souvenirs éditoriaux en chunks entiers

Lot du 17 octobre 2026. Aucune écriture Notion, aucune synchronisation, aucune réindexation, aucun changement de profil actif.

## Sources relues

- Tâche : [Améliorer la rédaction et le chunking](https://app.notion.com/p/3fb62322e59580c2ba77ecccf1a6b0b9), état En cours.
- Appel du 16 octobre avec Romed : les séparateurs éditoriaux définissent le chunk ; ne pas lancer de chunking automatique tant que le contenu et la mécanique ne coïncident pas. Politique relationnelle, jugée contradictoire et laissée vide, a ensuite été retirée.
- Fiches relues le 17 octobre, dernière modification le 16 octobre, état En cours :
  - [Max Lorenzo](https://app.notion.com/p/3f762322e59581ba8241c7f6b28f31fd) : 124 souvenirs `### SOUVENIR`. Corps le plus long : 1 693 caractères dans l’export (audit : 1 694). Avec la période parente, le plus long bloc fait 1 756 caractères (`MAX J-5.04`). 31 corps dépassent 1 000 caractères (audit : 32).
  - [Emma Munz](https://app.notion.com/p/3f762322e59581f9880fe309adec7075) : 122 souvenirs. Corps le plus long : 1 476 caractères (audit : 1 491). Avec la période : 1 539. 33 corps dépassent 1 000 caractères.
- Identifiants réels : `MAX J-7.01`, `EMMA permanent.04`, `MAX aujourd'hui.01`. Le modèle `MAX-J1-001` n’est pas exigé.
- Chaque souvenir a un titre de niveau 3, Point de vue, Quand et Lieu. Le titre de niveau 2 au-dessus est la période.
- Propriétés de prompt, non indexées comme souvenirs : Identité fondamentale, Qui tu es, Qui t'appelle, Dynamique de la conversation, Sujets sensibles, Références intellectuelles, Timeline, Ce que tu ne fais jamais. La Timeline reste un index de titres dans le prompt. Politique relationnelle a été retirée de Notion, de l'application et de `character_prompts` : le champ était vide et n'est plus lu. Rôle familial et Âge ne vont pas dans le RAG.
- Ava Munz et Léo Munz restent hors de ce lot : pas d’indexation, pas de modification de fiche.

## Limite Voyage

`voyage-4-large` et `rerank-2.5-lite` acceptent 32 000 tokens par texte. Une estimation haute (1 token pour 3 caractères) place le plus long bloc actuel vers 600 tokens. Aucun souvenir de Max ou d’Emma ne dépasse 32 000 tokens. Les 1 000 caractères de `ragProfiles.ts` restent le découpage des pages sans marqueur `SOUVENIR`. Le profil actif reste `voyage-4-realtime`. `voyage-context-4` n’est pas activé.

Si un souvenir dépasse 32 000 tokens estimés, il reste un seul chunk. La synchro le nomme dans `editorial_oversized` et recommande une seule coupe sur une articulation narrative réelle. Elle ne le découpe pas.

## Comportement

1. Un titre `### SOUVENIR` ouvre un chunk et le ferme au souvenir suivant. Deux souvenirs ne sont jamais fusionnés, même s’ils tiennent ensemble sous 1 000 caractères. Pas de recouvrement entre souvenirs.
2. Chaque chunk contient la période (titre de niveau 2 parent), l’identifiant, le titre, Point de vue, Quand, Lieu et le récit complet.
3. Le préambule (« TA MÉMOIRE COMPLÈTE », mode d’emploi) n’est pas un souvenir : il n’est pas indexé quand la page a des marqueurs `SOUVENIR`.
4. Une page sans marqueur `### SOUVENIR` garde le découpage actuel (sections, taille, recouvrement de 150 caractères). Les titres de niveau 3 qui ne commencent pas par `SOUVENIR` restent des titres `##`, pour ne pas déplacer les frontières des autres pages.
5. À l’injection, un souvenir qui ne tient pas entier dans le plafond ou dans le budget restant n’est pas injecté. Il n’est plus coupé au milieu.
6. La déduplication compare le récit, pas l’en-tête partagé Point de vue / Quand / Lieu, ni la période, ni le titre.
7. Le filtrage par `character_id` reste inchangé : Max ne reçoit pas un souvenir d’Emma, et l’inverse.
8. Retrieve K, top K, seuil et reranker ne sont pas modifiés.

## Budget d’injection

Le nombre maximal de souvenirs injectés reste **3**.

| Plafond | Avant | Après |
|---|---:|---:|
| Caractères par souvenir | 700 (rich_v2 : 900, optimized_v3 : 700) | **2 000** |
| Budget total du bloc | 2 100 (rich_v2 : 2 700, optimized_v3 : 1 800) | **6 100** |

2 000 couvre le corps maximal actuel (1 694), la période parente (58 caractères pour la plus longue) et le préfixe `Personnage : …` conservé après nettoyage. 6 100 = 3 × 2 000 plus les libellés `Souvenir N` (11 + 13 + 13) et une marge. Les variantes `legacy`, `compact_v1`, `rich_v2` et `optimized_v3` utilisent ce même plafond, sinon un souvenir de 1 694 caractères serait encore coupé ou écarté par l’ancienne variante.

Si le plafond système restant est plus petit que le bloc déjà formaté, les souvenirs de la fin sont retirés entiers. Le premier n’est pas amputé.

## Fichiers

- `supabase/functions/_shared/notionPageContent.ts` — niveau du titre `SOUVENIR`, découpage.
- `supabase/functions/sync-notion/index.ts` — appelle ce découpage et rapporte un souvenir trop long.
- `supabase/functions/_shared/ragProfiles.ts` — constante 32 000 tokens ; `chunkSizeChars` limité aux pages sans marqueur.
- `src/services/ragService.ts` — budget et injection sans coupe.
- Plafonds de section qui réinjecteraient l’ancienne coupe : `maxPromptCompiler.ts`, `maxRichPromptCompiler.ts`, `maxRagVariant.ts`, `maxOptimizedPromptCompiler.ts`, `maxAgent.ts`.

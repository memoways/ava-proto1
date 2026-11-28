# Prompt de reprise — Cadre de l'appel, lot 1 : diagnostic des réponses trop permissives

À copier dans un nouveau chat Ava, **seulement quand Ulrich lance ce chantier**. Ce lot seulement.

## Demande d'Ulrich (28 novembre)

Les personnages sortent du contexte de l'appel et répondent comme un assistant serviable à n'importe quelle demande, proposition ou question. C'est trop ouvert. Il veut mieux cadrer ce qui est possible dans la conversation et comprendre ce qu'il peut régler lui-même, sans code.

## État au 28 novembre (à revérifier sur origin/main)

La liste des sujets sensibles est corrigée ([plan](plan_latence_conversationnelle_llm_tts.md), section « Mémoire et relation, lot 3 ») ; aucune recette sur appel réel. Elle ne règle que la confidence, pas ce qui est accepté dans l'appel. Variante de prompt : `optimized_v3` partout.

Lu dans le code, effet non mesuré :

- Règle « hors-champ » déjà présente : `src/agents/worldBoundary.ts`.
- Contrat de conversation et hiérarchie : `src/agents/maxOptimizedPromptCompiler.ts` (« Interprète charitablement… Une fermeture exige des attaques explicites répétées » ; hypothèse à vérifier).
- Consigne relationnelle écrite en dur : `src/services/relationshipEngine.ts` ; elle ne reprend que 500 caractères de « Dynamique de la conversation ».
- Réglable sans code : fiche Notion (« Ce que tu ne fais jamais », « Dynamique de la conversation », « Sujets sensibles »), Admin › Expérience › Orchestration (cadre, posture, notes) : `src/services/experienceFrame.ts`.

## À faire

1. Relever en lecture seule des réponses réelles trop permissives, les classer et mesurer leur fréquence ; demander à Ulrich deux ou trois exemples qui le gênent.
2. Pour chaque famille, trouver la consigne reçue (ou absente) à partir des traces de prompt quand elles existent.
3. Expliquer à Ulrich en langage simple, avec exemples, ce qui laisse passer et ce qu'il pourrait régler ; proposer un plan dans `docs/`. Aucun code avant son accord.

## Limites

Aucune migration, écriture en base, réglage ni prompt modifié sans accord. Production non publiée. Base Caractères Notion en lecture seule (une évolution de fiche se propose dans `docs/`). Gami DigiDouble exclu.

## Hors de ce lot

Synonymes des sujets sensibles ; identifiants de mémoire proposés comme sujets ; recette des lots mémoire et relation 1 à 3 (appel sur `sandbox-ulrich`) ; post-tour annulé au raccrochage.

## Livraison et clôture obligatoire

Selon `AGENTS.md` : contrôles adaptés (`test:quality` et `test:delivery` verts si code), PR, CI, fusion par la garde. Consigner dans le plan, `docs/etat_courant.md`, STORY et le CHANGELOG. S'il reste un travail identifié, écrire le prompt du lot suivant avec cette même obligation ; sinon le dire.

**Première action :** lire `AGENTS.md`, `docs/etat_courant.md`, `git status`, puis `worldBoundary.ts` et `OPTIMIZED_V3_CONVERSATION_CONTRACT`.

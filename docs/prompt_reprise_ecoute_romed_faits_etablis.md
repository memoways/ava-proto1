# Prompt de reprise — écoute de Romed et arbitrages éditoriaux (faits établis)

À coller dans une nouvelle conversation, dépôt `memoways/ava-proto1`, checkout canonique, branche de lot depuis `main`
à jour.

---

**Objectif.** Préparer et recueillir l'écoute de Romed sur Max et Emma (appels complets en sandbox-ulrich) après la
suppression de la coupe des faits établis, et consigner ses arbitrages. Tâche Notion :
https://app.notion.com/p/a5a62322e59583969fff016553449c09 (Gamilab, get-self `7e1a9a09-…`).

**État vérifié (23 novembre).** Voir `docs/eval/faits_etablis_sans_coupure_lot_2_20261123.md`. Le paragraphe des faits
passe en entier ; noyau + 900 car., ≈ + 233 tokens d'entrée par tour (3 967 → 4 200) ; avertissement visible si le bloc ne
tient pas. Mesuré : « son père a envoyé Mona au camp » et « qui a su quand » corrigés ; le fusil (« ce n'est pas Max
qui l'a pris ») reste contredit dans les 4 runs ; le juge n'est pas calibré.

**Avant tout :** `sandbox-romed` n'a aucune fiche Max/Emma (relevé du 23 novembre) et plusieurs réglages diffèrent de `sandbox-ulrich` ; Romed teste depuis SA sandbox. Lui transmettre `docs/guide_romed_test_faits_etablis.md` (message à copier en tête) et attendre son retour.

**Périmètre.** (1) Dire à Ulrich quoi faire écouter à Romed (3 ou 4 appels, questions sur Mona, le fusil, qui a su
quand). (2) Reporter ses réponses dans la tâche Notion. (3) Décisions à lui faire prendre : champ « Ce que tu sais
aujourd'hui » (non rempli, ou paragraphe déplacé tel quel), ordre des faits, faute « elle sais », fait du fusil dans
les timelines, champs longs jamais transmis. (4) Calibrer le juge de factualité avec ses dix réponses notées, si
fournies. Aucun code de jeu sauf demande explicite.

**Limites.** Base Caractères AVA en lecture seule (aucune modification de fiche sans demande d'Ulrich). Pas de
production. Un seul lot ; pas de nouveau champ.

**Livraison.** Contrat Ava (CI verte, garde `ship-pr.mjs` via `github-delivery-exec`, SHA final), puis le prompt du lot
suivant ou « rien ne reste ». Cette obligation de prompt de reprise s'applique aussi à ce lot.

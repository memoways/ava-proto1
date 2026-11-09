# Parole sous le choc : état des lieux et lot C1

Date : 9 novembre 2026. Tâche Notion :
[Ava : parole sous le choc](https://app.notion.com/p/40462322e59580ca98a4d6148d8ce406) (En cours).
Contrainte d'Ulrich : la base Caractères AVA reste **en lecture seule**. On ne
complexifie pas, on part de l'existant.

## Le constat d'Ulrich

Max et Emma restent trop « méta ». Ils expliquent la situation trop clairement,
comme s'ils l'avaient déjà comprise. Surtout, ils **énumèrent des faits sans dire
ce que ces faits font à leur vie et à leur famille**. Les faits paraissent
détachés de leur réalité, alors que l'impact devrait être énorme.

## Ce qui a été réalisé avant ce lot

- **Notion, 25 octobre (E0).**
  - Création de nouvelles fiches actives : Max `ef4cfaa6…`, Emma `dfcc15f8…`. Les anciennes passent en Backup.
  - Champs retravaillés, par personnage : Résumé, Identité fondamentale, Qui tu es, Manière de parler, Dynamique, Ce que tu ne fais jamais.
  - Direction du jeu : une pensée peut s'arrêter, les états de parole ne tournent pas en cycle, pas d'auto-analyse.
  - Ulrich a ensuite déplacé le vécu (« Ce que tu vis aujourd'hui ») en tête de la Dynamique, sous « Ce que tu cherches dans cet appel — ton moteur ». La copie sandbox est datée du 29 octobre.
  - La fiche Max a encore été retouchée dans Notion le 3 novembre. Cette version n'est pas encore dans la copie sandbox du 29 octobre.
- **App (lots A1–A4, octobre).**
  - La pensée ouverte est autorisée et la rotation forcée des états est retirée (A1).
  - Pauses expérimentales (A2), banc d'audition (A3) et accueils (A4).
  - Voir [plan_lot_b_rendu_vocal.md](plan_lot_b_rendu_vocal.md) et [plan_parole_incarnee_personnages.md](plan_parole_incarnee_personnages.md).
- **Toujours ouvert.**
  - L'écoute A4R avec Ulrich.
  - Le corpus de huit répliques test (M1–M4 pour Max, E1–E4 pour Emma), qui n'est pas figé.

## Pourquoi les faits restent détachés

En sandbox, la variante de prompt active est `optimized_v3`. Le texte réellement
envoyé au modèle ne contient presque rien du vécu écrit dans Notion, et il est
construit autour d'un inventaire de faits.

1. **PRÉSENT est un inventaire placé en tête du noyau.**
   - Ce texte n'est pas écrit par Ulrich : un LLM le génère pendant la synchro (`supabase/functions/sync-notion/index.ts`, `generateSituationSummary`).
   - La consigne de génération impose « 3e personne », « faits denses et vérifiables », « pas d'interprétation psychologique », et une « OBLIGATION DE COUVERTURE » de chaque fait.
   - Une réplique de recette documentée (31 octobre) le reproduit presque mot pour mot :
     > « Peter, Agotha et Philippe sont morts. J'ai ligoté un homme… il est mort dans un abri effondré. Et Léo, c'est lui qui nous a ramenés. »
2. **Le vécu écrit par Ulrich était découpé.**
   - Le noyau dispose de 5 500 caractères pour des fiches d'environ 45 000.
   - Seuls « Manière de parler » et « Ce que tu veux vraiment » étaient protégés.
   - Le paragraphe « Ce que tu cherches dans cet appel » (« Admettre un fait ne veut pas dire pouvoir le supporter », la peur pour la famille, Mona au camp, Ava…) entrait en concurrence par mots-clés. Il arrivait en fragments, ou pas du tout.
3. **Les souvenirs RAG arrivaient comme des fiches d'archive.**
   - Ils sont injectés sous « SOUVENIRS COMPLÉMENTAIRES » avec l'en-tête du découpage (« Personnage: … | Archétype: … »).
   - Rien ne dit d'en parler comme d'un vécu. Le contrat les range au contraire dans une hiérarchie de sources factuelles.
4. **Facteurs secondaires, non traités dans ce lot.**
   - Le contrat de flux demande de livrer « d'abord ton contenu » et prévoit des `points` privés à transmettre (`src/services/responseIntentStream.ts`).
   - Le cadre « film non vu » demande de donner « les éléments nécessaires pour comprendre ».
   - Une remarque éditoriale, présentée ici comme proposition seulement : les fiches décrivent surtout la *mécanique* de la parole (« tu peux t'arrêter », « pas obligatoire »). Elles décrivent peu le concret de ce qui a changé dans la vie de la famille.

## Lot C1 : livré dans cette PR

Ce lot réutilise le texte Notion tel quel. Il ne touche à aucun champ Notion,
ne crée ni variante ni réglage, et concerne `optimized_v3` seulement.

- **« CE QUE ÇA TE FAIT » protégé.**
  - Le paragraphe Notion « Ce que tu cherches dans cet appel » de la Dynamique entre en entier dans le noyau. Pour une ancienne fiche, c'est « Ce que tu vis aujourd'hui » de Qui tu es.
  - Il est placé avant les faits et compté une seule fois.
  - Code : `characterLivedImpact()` dans `src/services/characterEmbodiment.ts`.
- **PRÉSENT devient « REPÈRES — CE QUE TU SAIS (jamais une liste à réciter) ».** Le contenu est inchangé, donc la cohérence factuelle F1–F4 l'est aussi.
- **Souvenirs.**
  - L'en-tête « Personnage | Archétype | Partie » est retiré.
  - Une ligne d'usage est ajoutée : « Ce sont tes souvenirs, pas un dossier : … ce qui en remonte, c'est ce que ça te fait maintenant, jamais leur contenu récité. »
  - Cette ligne n'apparaît jamais seule, sans souvenir.
- **Budgets.**
  - Le noyau passe de 5 500 à 7 000 caractères, et le plafond de contexte de 11 000 à 12 500.
  - Mesuré sur les fiches sandbox réelles au pire cas (1 200 caractères d'historique, cadre commun de 1 400 caractères, trois souvenirs longs) : rien d'autre ne perd de place par rapport à main. Le cadre commun reste entier.
  - Coût : environ 1 500 caractères, soit à peu près 350 tokens de prompt.
- **Tests.**
  - `maxOptimizedPromptCompiler.livedImpact.test.ts`, sur la copie sandbox du 29 octobre (`__fixtures__/speechSandbox20261109.json`) : vécu entier avant les repères, budget respecté, cadre commun conservé, souvenirs sans en-tête, ancien format reconnu.
  - Les variantes `legacy`, `compact_v1` et `rich_v2` sont inchangées.

## Après ce lot (à décider après écoute)

1. Écoute en sandbox, sur les mêmes questions que les recettes documentées :
   - « Qu'est-ce qui s'est passé à la montagne ? » ;
   - « Des nouvelles de la police ? » ;
   - « Et Emma ? » / « Et Max ? ».

   Avec ces critères :
   - moins d'énumération ;
   - l'impact sur la famille s'entend ;
   - aucun fait inventé ;
   - Max et Emma restent distincts.
2. Si l'énumération persiste, adoucir la consigne du générateur PRÉSENT : retirer l'« OBLIGATION DE COUVERTURE » et passer à la 2e personne. Cela demande une resynchro des champs seulement, sans reconstruction RAG.
3. Revoir la formulation « livre d'abord ton contenu » du contrat de flux.
4. Notion : aucune modification d'ici. Une évolution éditoriale éventuelle passe par une proposition d'Ulrich.

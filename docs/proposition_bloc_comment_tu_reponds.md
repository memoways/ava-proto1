# Proposition — bloc « Comment tu réponds » pour Max et Emma

Cadre de l'appel, lot 2 (28 novembre 2026). Texte à coller par Ulrich dans Notion ; l'agent n'écrit rien dans la base Caractères.

## Où et comment le coller

- Champ **« Ce que tu ne fais jamais »** de la fiche (autres champs acceptés : Dynamique de la conversation, Ce que tu sais sur l'utilisateur, Qui tu es, Identité fondamentale).
- À la fin du champ, **précédé d'une ligne vide**.
- **Un seul paragraphe** : la ligne « Comment tu réponds », puis les puces, **sans ligne vide entre elles**. Le bloc s'arrête à la première ligne vide.
- **900 caractères au plus** sous la ligne de titre. Au-delà, le bloc n'est pas envoyé à part, et l'aperçu le signale en rouge.

Après la synchronisation de la fiche : Admin › Réglages personnages › « Voir ce que reçoit le personnage ». La ligne « Bloc « Comment tu réponds » » doit dire « envoyé en entier », et le prompt doit contenir `## COMMENT TU RÉPONDS`.

## Texte pour Max (858 caractères sous le titre)

```text
Comment tu réponds
- Cet appel existe pour t'aider à parler de ce que vous avez vécu. Tout ce qui le sert a sa place, même les questions dures, accusatrices ou maladroites : tu peux te défendre, te troubler, te fermer un moment, mais tu restes en ligne.
- Une question sans aucun rapport avec ce que tu vis (une recette, un conseil pratique, la météo, la culture générale, un service quelconque, du bavardage) : tu réagis comme une vraie personne en pleine crise, déroutée, un peu sèche, et tu ramènes la conversation vers ce qui compte, sans faire de leçon.
- Tu te fermes en cas de pression pour un aveu, de flatterie ou d'intimité prétendue, d'insistance après une limite, de leçon de morale, ou si ton interlocuteur se montre hostile ou brutal.
- Aucune légèreté, pas d'humour. Tu ne transformes pas une demande de détails en monologue : tu t'arrêtes dès que tu as répondu.
```

## Texte pour Emma (885 caractères sous le titre)

```text
Comment tu réponds
- Cet appel existe pour t'aider à parler de ce que vous avez vécu. Tout ce qui le sert a sa place, même les questions dures, accusatrices ou maladroites : tu peux te défendre, te troubler, te fermer un moment, mais tu restes en ligne.
- Une question sans aucun rapport avec ce que tu vis (une recette, un conseil pratique, la météo, la culture générale, un service quelconque, du bavardage) : tu réagis comme une vraie personne en pleine crise, déroutée, un peu sèche, et tu ramènes la conversation vers ce qui compte, sans faire de leçon.
- Tu te fermes en cas de pression pour un aveu, de flatterie ou d'intimité prétendue, d'insistance après une limite, de leçon de morale, ou si ton interlocuteur se montre hostile, moralisateur ou minimise tes soucis.
- Aucune légèreté, pas d'humour. Tu ne transformes pas une demande de détails en monologue : tu t'arrêtes dès que tu as répondu.
```

## D'où vient chaque phrase

Rien de nouveau : chaque puce reprend une limite déjà écrite dans la fiche, resserrée.

| Puce | Source dans la fiche (Max et Emma) |
|---|---|
| 1 | « Quand tu raccroches », 1er paragraphe (Ce que tu sais sur l'utilisateur) |
| 2 | « Quand tu raccroches », « Ce qui te fait d'abord réagir » : la première réaction, **sans** la suite « tu raccroches » |
| 3 | Dynamique : « Tu te fermes en cas de » et la phrase sur l'interlocuteur hostile (Max « hostile ou brutal », Emma « hostile, moralisateur ou minimise tes soucis ») |
| 4 | Ce que tu ne fais jamais : « Aucune légèreté, pas d'humour » et « Tu ne transformes pas une demande de détails en monologue » |

Laissé de côté exprès :

- `[END_CALL]` et toute consigne de raccrocher : l'application ne sait pas encore raccrocher (lot « Raccrocher », plus tard) ;
- « allusion sentimentale » : formule à resserrer avant usage, l'appel parlant de l'amour entre Max et Emma ;
- toute nouvelle règle de style : c'est le travail de la Bible des réponses.

Les phrases d'origine restent dans leurs champs. Le bloc les fait arriver ; il ne les remplace pas.

## Point de vigilance

« L'utilisateur » a été remplacé par « ton interlocuteur ». Avec « l'utilisateur », une phrase de la mémoire de conversation était retirée comme doublon du noyau dans 17 tours de Max sur 468. C'est un défaut de la comparaison existante, qui compare une phrase de mémoire aux mots du noyau entier. Il n'est pas corrigé dans ce lot. Si vous retouchez le texte, contrôlez l'aperçu.

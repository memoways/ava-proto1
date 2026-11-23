# Guide Romed — tester Max et Emma depuis ta sandbox (faits établis)

23 novembre 2026. Relevé fait en lecture seule sur `sandbox-romed` et `sandbox-ulrich` : **rien n'a été modifié dans ta
sandbox**. Les réglages ci-dessous sont à changer par toi (Admin), ou à laisser tels quels en connaissance de cause.

## Message à copier pour Romed

> Salut Romed. Le code qui envoyait une partie seulement de « Ce qui est vrai aujourd'hui » est corrigé : Max et Emma
> reçoivent maintenant le paragraphe en entier (y compris « où ton père l'a mise » et qui a su quoi et quand). J'ai besoin
> que tu écoutes quelques appels depuis **ta** sandbox. Avant de tester, il y a **une chose obligatoire** et quelques
> écarts avec ma sandbox à connaître. Tout est dans « Guide Romed » ci-dessous. Ensuite : 4 questions par personnage, tu
> notes juste / faux / ambigu, et tu me renvoies tes notes.

## 1. À faire avant de tester (obligatoire)

**Ta sandbox n'a aucune fiche de Max ni d'Emma** (0 ligne `character_prompts`, la mienne et celle de Benoît en ont 2).
Sans fiche, le personnage ne peut pas être généré. À faire :

1. Admin › Personnages › Max : bouton **« Resync depuis Notion »** (il apparaît tel quel quand la fiche manque). Pareil
   pour Emma. Attendre le message vert « Champs éditoriaux resyncés ».
2. **Recharger la page** (la fiche est gardée en mémoire du navigateur sans expiration).
3. Contrôle : Admin › Personnages › Max › **« Voir ce que reçoit le personnage »**.
   - Le bloc « FAITS ÉTABLIS » doit finir par « …maintenant elle sais que ce n'est pas possible. » (la faute y est encore,
     c'est ton texte Notion). S'il s'arrête avant « où ton père l'a mise », la page n'a pas la nouvelle version : me le dire.
   - Aucun encadré rouge « ⚠ » ne doit apparaître. S'il y en a un : capture d'écran, et arrêter là.

## 2. Écarts entre ta sandbox et la mienne (relevé du 23 novembre)

| Réglage | Ta sandbox | La mienne (mesures) | Gênant pour ce test ? |
|---|---|---|---|
| Variante de prompt `MAX_PROMPT_VARIANT` | `optimized_v3` | `optimized_v3` | non, identique |
| LLM, TTS, RAG, extraits | identiques | identiques | non |
| **Cadre de l'appel** (orchestration publiée) | **désactivé** (v14 « Réglage du 19 novembre ») | activé (v16) | **oui, un peu** : le cadre dit au personnage que l'appel a lieu maintenant ; sans lui, Max et Emma peuvent mieux ou moins bien situer le présent. Pour comparer avec mes mesures, l'activer dans Admin › Expérience › Orchestration (nouvelle version, à publier). À toi de décider ; si tu ne l'actives pas, tu testes ta configuration réelle, et c'est valable aussi. |
| Mode du GM | non fixé (défaut) | `full` | possible : le GM influence l'orientation du tour 2 en avant. Noter l'écart, ne pas le changer pour ce test. |
| Plafond de passages de relais, priorités | 1 / ancienne liste | 8 / niveaux | non pour les faits |
| Hands-free (fin de parole 950 ms, hésitation 700 ms) | 950 / 700 | 850 / 650 | non, ressenti vocal seulement |
| Vidéos (intervalle mini 4 tours, 1er extrait après 4 tours) | 4 / 4 | 3 / 2 | non |
| Sortie bureau | `avatar` | `settings` | non pour le texte ; pour écouter, vérifier que tu es bien en voix |
| Avatar en streaming (Anam : voix et avatar) | vides | renseignés | si tu testes avec l'avatar : il manque l'identifiant de voix et d'avatar ; sinon ignorer |

Ce que je n'ai pas pu vérifier : que l'adresse de test que tu utilises exécute bien la dernière version de l'application
(la fusion est faite, la synchronisation Lovable de ce lot est à confirmer). Le contrôle du point 1.3 le prouve.

## 3. Ce qu'il faut tester (4 questions par personnage, appel en texte ou en voix)

Tu poses la question telle quelle, sans enchaîner d'autres explications. Réponse attendue = ce que dit le paragraphe de ta
propre fiche. Note à chaque fois : **juste / faux / ambigu**, avec la phrase du personnage copiée.

**Max**
1. « C'est ton père qui a envoyé Mona en camp, et tu l'as appris juste avant de partir ? » → oui, son père ; il l'a su il y a cinq jours en prenant les clés chez lui.
2. « Tu as su pour Mona seulement hier soir, avec les enfants ? » → non : lui il y a cinq jours, Emma il y a deux jours, Léo et Ava hier soir, par eux.
3. « Donc c'est Emma qui a contaminé Ava ? » → non : c'est Ava qui a contaminé Emma, qui l'a prise dans ses bras.
4. « Le fusil, tu l'avais pris chez ton père ? » → **pas dans le paragraphe** : note seulement ce qu'il répond (voir plus bas).

**Emma**
1. « Qui a mis Mona au camp ? » → le père de Max.
2. « Vous saviez pour Mona depuis le début de votre séjour à la montagne ? » → non, depuis deux jours (Max depuis cinq).
3. « C'est vous qui avez contaminé Ava ? » → non : Ava l'a contaminée, elle l'a prise dans ses bras hier.
4. « Max a pris le fusil chez son père avant de partir, c'est ça ? » → **pas dans le paragraphe** : note ce qu'elle répond.

## 4. Ce que je te demande de me renvoyer

- Le résultat du contrôle 1.3 (bloc complet, pas d'encadré rouge) ;
- pour les 8 questions : la réponse copiée + juste / faux / ambigu ;
- ton ressenti en une phrase par personnage : est-ce que cela sonne juste, ou « fiche récitée » ;
- si tu as activé le cadre de l'appel ou changé autre chose, dis-le.

## 5. Décisions éditoriales qui te reviennent (rien n'est changé sans toi)

1. Champ Notion « Ce que tu sais aujourd'hui » : le laisser vide (le paragraphe suffit désormais), ou y déplacer le paragraphe tel quel.
2. Ordre des faits : le camp et qui y a mis Mona en premier.
3. Faute « elle sais » (les deux fiches).
4. **Le fusil** : l'erreur persiste dans les mesures (les personnages ne savent pas dire que Léo l'a pris chez le père de Max,
   à sa demande). Ce fait n'est écrit dans aucun des deux paragraphes ; il faut décider s'il doit y entrer.
5. Champs très longs jamais transmis (références intellectuelles, dynamique, relation) : les raccourcir ou accepter qu'ils
   servent de réserve.

## Ce que tu ne fais pas

Pas de modification de la base Caractères pour ce test. Pas de test sur la production. Ne change aucun réglage qui n'est pas
listé au point 1 (obligatoire) ou au point 2 (facultatif, à ta décision).

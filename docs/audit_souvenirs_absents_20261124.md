# Audit — souvenirs absents du prompt de Max et Emma (sessions Romed du 23 novembre)

24 novembre 2026 · pour Ulrich et Romed · **diagnostic, aucun code de jeu modifié, rien en production.**
Lectures faites : code `main` à `8cf58ee6`, base Lovable en lecture seule (`sessions`, `experience_orchestration_versions`).
Version lisible sans jargon : [état des lieux](etat_des_lieux_souvenirs_max_emma.md). Suite : [prompt de reprise lot 1](prompt_reprise_souvenirs_absents_lot_1.md).

**Mis à jour le 24 novembre (après-midi)** : la cause principale est désormais **mesurée** (rejeu, section « Mesure »), et l'audit est comparé à celui de Cursor (section « Comparaison »). Le plan de correction est révisé en conséquence.

## Contexte

Romed a joué deux longues sessions le 23 novembre (14:31 Max→Emma, 65 tours ; 16:33 Emma→Max, 70 tours ;
`5215c870…` et `783f4a09…`, version d'orchestration `a9448fee`, trace diagnostique non activée). Dans le PDF,
le jaune montre ce que Max ou Emma nient ou ignorent, le rouge les souvenirs Notion qui disent le contraire (J-5.01,
S-3.01, S-3.02, J-7.01, J-3.11). Le motif est constant : le personnage ne ment pas, **il dit ne pas savoir**
(« je n'ai pas ce fait avec certitude », « je ne sais pas comment ce fusil est arrivé »). C'est ce qui se passe quand
le souvenir n'est pas dans le prompt et que le contrat dit « en cas d'incertitude, dis-le ».

## Constats (vérifiés dans le code et en base, lecture seule)

### 1. L'écran « Ce que reçoit Max » est trompeur, sans être la cause
`CharacterReceivedPreview.tsx` compile la fiche **sans tour** : `userMessage: "(message du joueur)"`, pas de
souvenirs, pas de cadre, pas de GM, pas de mémoire. Les lignes « absent (section_vide) » veulent dire « non simulé
ici », pas « bloqué en jeu ». Mais il cache le vrai problème : il ne montre jamais ce qui reste de place une fois tout
ajouté. Le seul chiffre révélateur : **Canon pertinent = 208 car.**, même sans historique.

### 2. Cause principale : les souvenirs passent en dernier, quand il ne reste plus de place
`buildOptimizedPromptAssembly` (`src/agents/maxOptimizedPromptCompiler.ts`, l. ~650-782) ajoute les sections dans
cet ordre, chacune dans la place restante d'un plafond `13 900 − historique` :
contrat (5 052 en jeu, 3 044 dans l'aperçu) → noyau (≈ 7 675) → cadre → directive relationnelle → parole → état radar (≈ 790) → état du tour →
mémoire (≤ 1 200) → canon pertinent → post-vidéo → vidéos vues → **souvenirs**.

Calcul sur ces sessions (historique ≈ 800-1 200 car. via `selectOptimizedConversation`) :
- plafond ≈ 12 700-13 100 ; contrat + noyau ≈ 10 750 → il reste ≈ 2 000-2 300 ;
- cadre ≈ 700 (présent de l'appel + transfert), état ≈ 790, mémoire jusqu'à 1 200 (résumé présent : `memory_last_turn` 64/69)
  → **il ne reste rien** pour le canon et les souvenirs ;
- un souvenir fait 1 000 à 1 750 car. et `trimRagContextToWholeSouvenirs` ne l'injecte qu'entier : la section tombe
  en `budget_contexte_epuise`.

Le RAG est bien appelé à chaque tour (`rag_ms` ≈ 700 ms dans `conversation_log.pipeline`) : on paie la recherche,
le résultat est jeté à l'assemblage. Plus la conversation avance (mémoire pleine, transfert d'appel), plus c'est vrai.
**Confirmé par la mesure** (section 2 bis) : aucune trace de ces sessions ne gardait les sections incluses, le rejeu les reconstitue.

Historique : le budget global a été fixé avant que le noyau grossisse (vécu +1 500, hiérarchie +500, faits +900 le
23 novembre). Chaque ajout a été « payé » en relevant le plafond d'autant, en supposant que le reste gardait sa place ;
mais le reste n'a pas de place réservée, il prend ce qui reste.

### 2 bis. Mesure : rejeu des questions de Romed (24 novembre)

Rejeu sans appel au modèle, sur `sandbox-romed`, réglages hydratés de la base (`optimized_v3`, top K 4, seuil 0,35,
retrieve K 11, rerank actif) : vraie fiche, vrai `conversation_log` jusqu'à la question, `conversation_memory` de la
session, orchestration `a9448fee`, vraie recherche `query-rag`, puis `buildMaxSystemPrompt` (même assemblage qu'en jeu).
Script temporaire non versionné. Le profil radar n'a pas été chargé dans ce rejeu (état vide) : en jeu il ajoute
≈ 790 car., ce qui ne peut qu'aggraver le manque de place.

| Question (tour) | Souvenir attendu | Rang trouvé par le RAG | Retenu par le tri | Envoyé au modèle |
|---|---|---|---|---|
| Max 12 — pourquoi pas opposé au père | J-5.01 | **1** (0,82) | oui | **non** |
| Max 37 — d'où vient le fusil | J-3.08 | **1** (0,61) | oui | **non** |
| Max 10 — comment Mona s'est contaminée | S-3.01 | 4 (0,59) ; J-1.11 en 1 | J-1.11 oui | **non** |
| Emma 20 — Mona, culpabilité, revoir | S-3.01 / S-3.02 | 1 et 5 | S-3.01 oui | **non** |
| Emma 58 — comment le fusil est arrivé | J-3.11 | **1** (0,74) | oui | **non** |

Sur les cinq tours, les sections `conversation_memory`, `character_canon` **et** `rag_context` sont toutes en
`budget_contexte_epuise`. Le prompt système atteint exactement sa limite (ex. Max tour 12 : limite 13 236, système
13 226) avec : règles techniques 5 052, noyau 7 173 à 7 435, cadre 282, directive relationnelle 307 à 539, état du
tour 49 à 129. (La question S-3.01 d'Emma « comment Mona a été contaminée » n'a pas été retrouvée telle quelle dans
le journal : quatre questions sur cinq du PDF sont couvertes, plus une proche.)

**Correction d'un chiffre de la première version** : les règles techniques pèsent **5 052 car.** en jeu, pas 3 044.
L'aperçu admin ne passe pas l'invariant d'identité au compilateur, d'où son chiffre plus bas. Il sous-estime donc
aussi la place prise.

**Conséquence de plus** : le résumé de la conversation ne part pas non plus. En jeu, le personnage ne voit que les
3-4 dernières répliques (≈ 700-1 000 car. d'historique).

### 3. Le cadre « bénévole » n'est jamais envoyé
En base, `experience_orchestration_versions.a9448fee` (et la dernière, `3613d91e`) : `frame.enabled = false`.
`buildExperienceFrame` n'envoie alors que le présent de l'appel, le film et le transfert. La phrase « L'interlocuteur
est une personne bénévole… » n'arrive pas : d'où « je peux demander aux bénévoles » adressé… à un bénévole.

### 4. La directive GM est vide dans ces sessions
`gm_post_turn_log[].injected.text` est vide sur tous les tours (moyenne 0 car.). Ce n'est pas elle qui prend la place ;
à noter seulement pour la lecture.

### 5. Contrat qui transforme le manque en déni
Contrat l. 63 : « En cas d'incertitude, dis-le. » + hiérarchie « les faits de ta fiche » d'abord. Sans souvenir dans
le prompt, le modèle conclut « je ne peux pas confirmer ». Correct si la donnée manque vraiment ; nuisible ici.

### 6. Points éditoriaux (Romed, pas de code)
- Paragraphe des faits de Max : « Tu l'as su il y a cinq jours, en prenant les clés chez lui » → le modèle en déduit
  « il ne me l'a pas dit, je l'ai découvert en prenant ses clés », contraire à J-5.01 (« ton père t'a lâché une
  nouvelle »). Reformuler.
- Le fusil donné par le père à Léo (J-3.11) et la raison du père (J-5.01) ne sont que dans les souvenirs : ils
  dépendent entièrement du point 2.
- Max « n'a jamais essayé de sortir Mona » : rien dans le noyau ne l'interdit ; à ajouter aux faits si c'est un fait.

## Comparaison avec l'audit de Cursor (24 novembre)

| Point | Cursor | Cet audit | Verdict après mesure |
|---|---|---|---|
| Aperçu admin « section_vide » = non simulé | oui | oui | d'accord |
| Canon pertinent ≈ 200 car. (titres seulement) | oui | oui | d'accord ; en jeu, **0** (évincé) |
| Phrase « en prenant les clés » contraire à J-5.01 | oui | oui | d'accord (Romed) |
| Fusil absent des faits établis | oui | oui | d'accord (Romed) |
| Ligne d'usage « jamais leur contenu récité » + « en cas d'incertitude, dis-le » | oui | partiel | d'accord : à corriger |
| Cadre bénévole désactivé | oui | oui | d'accord |
| Sessions sur `sandbox-romed` | oui | non précisé | Cursor a raison ; corrigé ici |
| **Cause principale** | le souvenir désigné n'est pas retrouvé (titres dévalués, 3 sur 124 par vecteurs) | le souvenir est évincé faute de place | **mesure : retrouvé au rang 1 dans 4 cas sur 5, puis évincé dans 5 cas sur 5** |
| **Correctif** | identifiants de souvenirs devinés depuis la question, préposés dans `query-rag` | place réservée dans l'assemblage | le correctif Cursor seul **n'aurait aucun effet** : la section entière tombe ; il ajoute en plus un déploiement d'Edge Function |

Conclusion : les constats secondaires de Cursor sont justes et sont repris. Son lot principal ne doit pas être fait
maintenant. L'idée d'adresser un souvenir par son identifiant reste une piste pour plus tard, si une mesure montre
des souvenirs mal classés une fois la place rendue.

## Plan de correction révisé (un lot à la fois)

### Lot 1 — place garantie, trace et alertes (code, prochain lot)
1. **Budget par section** dans `buildOptimizedPromptAssembly` : réserver une place minimale à la mémoire (1 200), au
   canon pertinent (`minCanonChars` 650), à l'état radar (900) et aux souvenirs (3 souvenirs entiers, plafond actuel
   6 100), et relever `generatedContextChars` de la somme nécessaire, calculée sur les fiches réelles (≈ +6 000 car.,
   ≈ +1 700 tokens d'entrée, ≈ +40 % ; à confirmer). Ordre inchangé ; seul le budget devient réservé. Réglable
   (constante unique ou réglage admin) pour pouvoir revenir en arrière.
2. **Trace légère toujours enregistrée** dans `conversation_log[].pipeline` : sections incluses / évincées et
   identifiants des souvenirs envoyés. Lisible dans Admin › Sessions.
3. **Alertes** `souvenirs_evinces`, `memoire_evincee`, `canon_evince` dans `budget.warnings` (aperçu, `eval:judge:sheets`).
4. **Aperçu admin** : invariant d'identité inclus (chiffres justes) et option « simuler un tour long ».
5. **Tests de non-régression** : fixture des fiches réelles Max/Emma (copie lecture seule) ; tour long → noyau,
   mémoire, canon et ≥ 2 souvenirs présents ; test qui échoue si une future fiche plus longue fait de nouveau
   tomber une section.
6. **Mesures** : rejeu des questions de Romed (ce rejeu, versionné cette fois comme outil `eval`), factualité
   `eval:judge:sequences --focus factuality` avant/après avec bruit, tokens d'entrée réels et latence sur ≥ 10 tours.

### Lot 2 — consignes et cadre
- Ligne d'usage des souvenirs : « si on te le demande, tu dis le fait qui est dans ce souvenir ; tu ne récites pas
  le souvenir de toi-même ». Contrat : un souvenir présent fait foi ; « je ne sais pas » seulement si rien n'en parle.
- Réactiver le cadre bénévole dans l'orchestration publiée (décision d'Ulrich ; ≈ +900 car., déjà dans le budget).
- Mesure : même rejeu + écoute Romed.

### Lot 3 (éventuel) — adresser un souvenir par son identifiant
Seulement si, place rendue, des souvenirs pertinents restent mal classés (piste Cursor).

### Romed (Notion, hors code)
« En prenant les clés » ; fusil dans les faits établis ; « Max n'a jamais essayé de sortir Mona ».

## Vérification
- Lot 1 : tests de non-régression verts ; rejeu → mémoire, canon et ≥ 2 souvenirs envoyés sur les tours longs ;
  lecture de `conversation_log[].pipeline` d'une partie sandbox ; factualité, tokens et latence avant/après.
- Lot 2 : même rejeu ; écoute Romed sur les questions du PDF.

## Hors périmètre
Aucune écriture dans la base Caractères Notion ; aucune modification de production hors Lovable ; le classement du RAG
n'est pas modifié : il retrouve le bon souvenir au rang 1 dans 4 cas sur 5 (section 2 bis).

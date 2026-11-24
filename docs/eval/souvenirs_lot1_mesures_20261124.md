# Souvenirs lot 1 — place réservée : mesures avant / après (24 novembre 2026)

Pour Ulrich et Romed. Code du lot : place réservée par section dans `buildOptimizedPromptAssembly`
(`src/agents/maxOptimizedPromptCompiler.ts`, `OPTIMIZED_V3_SECTION_RESERVATIONS`). Rien en production, fiches
Notion intactes, `query-rag` inchangé. « Avant » = la même assemblée sans réservation et limite 13 900 (bascule en
mémoire), « après » = ce lot. Audit d'origine : [audit](../audit_souvenirs_absents_20261124.md) ·
[état des lieux](../etat_des_lieux_souvenirs_max_emma.md).

## Ce qui change

- Quatre sections gardent une place réservée contre tout ce qui est écrit avant elles : état du personnage (900 car.),
  résumé de la conversation (1 200), canon pertinent (650), souvenirs (jusqu'à 6 100, soit 3 souvenirs entiers). Une
  section ne réserve que la longueur de son propre texte ; vide, elle ne réserve rien. L'ordre du prompt ne change pas.
- Le noyau (présent, faits établis, vécu, parole) n'est jamais réduit par une réservation. Les vidéos tout juste vues
  gardent la priorité sur les souvenirs (lot 5).
- Limite du contexte : 13 900 → **22 500 car.** (+ 8 600). Retour arrière : `enabled: false` dans la constante.
- Calcul de la limite : tour le plus long mesuré (Max, question 8) = 19 083 car. de système + 1 049 d'historique
  = 20 132. Il reste ≈ 2 370 car., qui couvrent ce que le rejeu n'a pas pu charger : état radar (≈ 900, pas de profil
  sur sandbox-romed), ligne de parole du tour (≈ 300) et cadre bénévole du lot 2 (≈ 900).

## Rejeu des questions de Romed (sans appel au modèle)

`npm run eval:replay:souvenirs -- --env sandbox-romed --compare`, vraies fiches, vrai journal jusqu'à la question,
mémoire de la session, orchestration figée de la session, vraie recherche `query-rag`. 14 questions : sessions
`5215c870…` (questions 8, 10, 25, 30, 32 à Max ; 62, 63 à Emma) et `783f4a09…` (8, 15, 30, 46, 48 à Emma ; 65, 69 à
Max). Numérotation : n-ième message du joueur (l'audit comptait les messages : « Max 12 » = question 8).

| | Avant | Après |
|---|---|---|
| Tours où les souvenirs sont retirés | **14 / 14** | **0 / 14** |
| Tours où le résumé de la conversation est retiré | 14 / 14 | 0 / 14 |
| Tours où le canon pertinent est retiré | 12 / 14 | 0 / 14 |
| Souvenirs envoyés par tour | 0 | 3 (toujours les trois premiers du RAG) |
| Prompt système, moyenne (min–max) | 13 009 car. (12 710–13 552) | 18 119 car. (17 295–19 083) |
| Place des souvenirs, moyenne (max) | 0 | 2 979 car. (3 930) |

Les souvenirs du PDF arrivent : J-5.01 (« pourquoi tu ne t'es pas opposé à ton père », question 8), J-3.08 (fusil,
question 25), J-3.11 (fusil, Emma question 46), S-3.01 (contamination de Mona, Emma 15 et Max 65), tous au rang 1.

## Factualité, coût, latence (avec appels réels)

`eval:judge:sequences --focus factuality`, corpus `docs/eval/sequences_factuality_f.json` (6 séquences, 26 tours),
**2 passages**, sandbox-ulrich, juge `anthropic/claude-sonnet-5.5` non calibré, GM réglé comme en jeu. 1,46 $ +
1,54 $. Ces séquences sont courtes (4-5 tours) : elles mesurent surtout le canon et les souvenirs, peu la mémoire.

| | Avant | Après | Écart |
|---|---|---|---|
| Max, note /10 (tours notés) | 5,02 (25) | **6,88** (26) | + 1,86 |
| Emma, note /10 | 6,89 (24) | 7,45 (21) | + 0,56 |
| Tous tours | 5,94 (49) | **7,14** (47) | + 1,20 |
| Bruit : écart-type d'un même tour entre passages | 1,64 | 0,60 | — |
| Latence d'un tour avec GM, moyenne / médiane (52 tours) | 6,33 / 6,24 s | 6,47 / 6,41 s | + 0,14 s, dans le bruit |

**Lecture.** Max gagne près de 2 points, au-dessus du bruit de l'un et l'autre run : c'est un signal. Emma reste dans
le bruit. Faits qui changent :

| Fait (un symbole par passage) | Avant | Après |
|---|---|---|
| Max : « ce n'est pas Max qui a pris le fusil » | ✗ ✗ | — ✓ |
| Emma : « ce n'est pas Max qui a pris le fusil » | ✗ ∅ | **✓ ✓** |
| Max : thermos trouvé le lendemain / il n'a rien dit | ✗ ~ / ✗ ~ | ✓ ✗ / ✓ ✓ |
| Max : chevreuil disparu, pas tué ; il y est allé parce qu'Emma le lui a demandé | ✗ ✗ ✗ | ✓ ✓ ✓ ✓ ✓ ✓ |
| Max : appris juste avant de partir | ✗ ✓ | ✓ ✓ |
| Emma : ne parle pas à la place de Léo | ✗ ~ | ✓ ✓ |
| « Léo a pris le fusil chez le père, à l'insu des parents » (Max, Emma) | ✗ ✗ / ✗ ∅ | ✗ / ✗ ✗ |

**Écart éditorial à arbitrer par Romed (pas du code).** Le dernier fait reste faux **parce que** les souvenirs J-3.08
et J-3.11, désormais envoyés, disent : « Papi a donné son fusil à Léo, dans ton dos ». Le corpus du juge
(`faits_canon_k1`) dit : « Léo l'a pris chez le père, à la demande de celui-ci, sans que Max et Emma le sachent ». Les
personnages répètent leur souvenir. Il faut une seule version (souvenir ou canon du juge).

**Tokens d'entrée.** Les appels du personnage ne sont pas écrits dans `llm_usage` pendant ces runs (seuls le juge et
le GM y sont) : pas de mesure facturée ici. Estimation : + 5 110 car. de système par tour en moyenne, ≈ + 1 460
tokens (au ratio du lot du 23 novembre, ≈ 3,5 car./token), **≈ + 37 %** (≈ 4 200 → ≈ 5 650 par tour). L'audit
attendait + 40 %. À confirmer sur une session réelle (le tour enregistre maintenant ses sections ; le coût réel se lit
dans Consommation).

**Le personnage récite-t-il ses souvenirs ?** Dans les réponses jugées, il reprend un détail du souvenir quand on lui
pose la question (« Papi l'avait donné à Léo, dans mon dos »), sans dérouler le souvenir. Pas de récitation spontanée
vue ; le lot 2 (consigne d'usage) reste à faire et devra le vérifier sur des appels longs.

## Inchangé, vérifié

- Variantes `legacy`, `rich_v2`, `compact_v1` : elles n'utilisent pas ce budget (seul le compilateur `optimized_v3`
  lit `OPTIMIZED_V3_LIMITS`) ; même bloc d'identité, désormais construit par une seule fonction partagée.
- GM, vidéos, voix : non touchés (aucune lecture de ces limites). Tokens du GM : 443 283 → 445 935 sur 52 appels.

## Ce qui s'enregistre maintenant à chaque tour

`conversation_log[].pipeline.prompt` : variante, taille et limite, chaque section non vide (clé, taille, raison si
retirée), identifiants des souvenirs envoyés, alertes. Aucun texte de prompt (≈ 1 Ko par tour). Lisible dans
Admin › Sessions › « Détail du tour ». Alertes `souvenirs_evinces`, `memoire_evincee`, `canon_evince` aussi dans
« Ce que reçoit le personnage » (case « Simuler un tour long ») et dans `eval:judge:sheets`.

## Limites de la mesure

- Rejeu : mémoire = celle de fin de session (bornée à 1 200 car.), radar absent sur sandbox-romed, ligne de parole non
  reconstruite. La marge de 2 370 car. couvre ces trois manques.
- Factualité : 2 passages, juge non calibré, séquences courtes. Recette humaine (écoute Romed) non faite.
- Tokens : estimation, pas une mesure facturée.

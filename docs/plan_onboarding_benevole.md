# Plan — Onboarding du bénévole (« Où est Ava ? »)

Plan approuvé le 2026-09-16, archivé aussi dans
`.lovable/plan/onboarding-du-bénévole-plan-d-implémentation-2026-09-16.md`.

## Objectif

Insérer une étape courte entre l'introduction (teaser / question film) et le
choix du personnage, expliquant que la personne incarne un·e bénévole d'un
dispositif de soutien, sans aucune collecte de données personnelles, et rendre
ce cadre disponible au personnage, à la mémoire et au Game Master dès le
premier tour.

## Format retenu

Séquence de trois cartes plein écran (fond sombre, titre serif, une idée par
carte, progression discrète, `Retour` / `Continuer` / `J'ai compris`) :

1. **Tu es bénévole.** — dispositif de soutien après un événement traumatique,
   services officiels débordés, présence humaine complémentaire.
2. **Ton rôle : être là.** — écouter, soutenir, comprendre ; ni psychologue ni
   professionnel·le de santé, aucune solution à apporter.
3. **Ce que tu sais déjà.** — compte rendu transmis aux autorités, donc certains
   faits connus ; aucune relation préalable ; présentation personnelle libre.

Aucun nom d'association, aucun formulaire, aucun quiz.

## Implémentation

| Élément | Fichier |
| --- | --- |
| Textes, cadre personnage, profil système, persistance locale | `src/services/volunteerBriefing.ts` |
| Écran (mode onboarding et mode relecture) | `src/components/prd4/VolunteerBriefingScreen.tsx` |
| Phase `volunteer_briefing` | `src/types/index.ts` |
| Insertion dans le parcours, analytics, relecture | `src/pages/IndexPRD4.tsx` |
| Lien « Revoir le contexte » | `src/components/prd4/CharacterSelectScreen.tsx` |
| Tests | `src/services/volunteerBriefing.test.ts`, `src/components/prd4/VolunteerBriefingScreen.test.tsx`, `tests/e2e/prd4-happy-path.spec.ts` |

Points clés :

- `enterAfterIntroduction()` remplace les transitions directes vers
  `character_select` depuis le teaser (continuer / passer) et depuis la réponse
  « film déjà vu ». Si l'onboarding est déjà terminé, on va directement au choix
  du personnage.
- Le cadre est transmis via le canal joueur existant : `buildVolunteerRoleProfile()`
  alimente `state.userRoleProfile`, donc `summary_for_max` dans
  `prd4Orchestrator` → prompt du personnage, mémoire et Game Master. Générique :
  aucun personnage n'est nommé, tout nouveau personnage en bénéficie.
- Le profil système ne contient ni nom, ni âge, ni genre (`age`/`gender` vides,
  `created_by_system: true`).
- Persistance locale versionnée (`ava_volunteer_briefing`) : `completed`,
  `lastCardIndex`, `replays`. Un rafraîchissement reprend à la carte en cours ;
  après complétion l'écran ne se rejoue plus. Le profil joueur est aussi
  enregistré dans `sessions.player_role`, donc restauré à la reprise d'appel.
- Relecture depuis le choix du personnage (`onReviewContext`) : repart de la
  première carte, ne modifie pas la complétion, compte les relectures.
- Aucune migration de base, aucun changement du teaser, du choix du personnage
  ni du fonctionnement des conversations.

## Analytics (PostHog, sans donnée personnelle)

- `prd4_volunteer_briefing_shown` — `version`, `resumed_at_card`
- `prd4_volunteer_briefing_card_viewed` — `version`, `card_index`, `card_id`, `review`
- `prd4_volunteer_briefing_completed` — `version`, `duration_ms`
- `prd4_volunteer_briefing_reviewed` — `version`, `replays`

Abandon = `shown` sans `completed` ; la transition vers le choix du personnage et
le premier tour se lit avec les évènements existants (`prd4_phase_changed`,
`prd4_session_started`).

## Vérification

- Unitaires : longueur du texte, absence de nom fictif ou de personnage,
  interdictions du cadre, profil sans donnée personnelle, versionnement du
  stockage.
- Composant : progression, complétion, reprise à la carte interrompue, relecture
  sans effet sur la complétion.
- Bout en bout : le parcours Chromium traverse désormais l'onboarding avant le
  choix du personnage (`completeVolunteerBriefing`).
- Manuel : lisibilité mobile et tablette, cohérence des premiers échanges de Max
  et Emma (aucune relation inventée).

# Prompt de reprise — cinématiques en superposition, lot 2 (fréquence et pertinence)

À copier dans un nouveau chat Ava (Claude Code, Codex ou Cursor).

---

Objectif : en mode « Superposer à la réponse », obtenir **autant de cinématiques que les réglages du backoffice le
permettent** et **des vidéos en phase avec ce qui se dit**, sans changer le mode « Interrompre la conversation ».

Demande d'Ulrich (recette du 19 novembre 2026, deux sessions sandbox, Max) : « je n'ai eu qu'une fois une cinématique,
sur beaucoup de tours de parole […] la cinématique montrée n'avait aucun lien avec la discussion en cours. Assurer
qu'il y ait plus de cinématiques (selon ce qui est demandé dans les réglages du back-office) et surtout une meilleure
adéquation avec la conversation. »

## État vérifié (19 novembre 2026)

Lot 1 sur `main` (`e4fa178`, PR #202) ; `main` actuel inclut aussi `f1a7ec1` (PR #203, guidage GM A/B). Sélection
dédiée sur le texte de la réplique : `src/services/overlayVideoSelector.ts` (échéance 2 s, confiance ≥ 0,6), câblage
`src/pages/IndexPRD4.tsx` (bloc « Overlay: the GM judges a turn only after… »), machine
`src/services/cinematicTransition.ts`. [Plan du lot 1](plan_cinematiques_interruption_superposition.md).

Diagnostic en lecture seule (MCP Lovable, `experience_events` et `llm_usage`, sessions `969600fd…` et `b6ba2c63…`) :

1. **Cause principale de la rareté : la sélection n'a presque jamais répondu à temps.** 22 tentatives après les
   garde-fous : 20 `overlay_selection_timeout` (≈ 2 001 ms), 1 `overlay_selection_error` (tour interrompu), **1 seule
   sélection réussie** (944 ms). `llm_usage` (`prd4_overlay_video_selection`, `google/gemini-2.5-flash`) : 19 erreurs
   « Conversation turn aborted » (notre abandon à l'échéance), 1 réussite (1 820 tokens d'entrée, 97 de sortie).
2. **Hypothèse forte sur la latence** : `supabase/functions/proxy-llm/payload.ts` ne désactive le raisonnement que pour
   les modèles OpenAI/DeepSeek/Grok listés dans `isReasoningModel` ; `reasoning: false` n'envoie donc rien pour
   Gemini 2.5 Flash, qui garde sa réflexion dynamique par défaut. À vérifier (mesure de latence avec/sans
   `reasoning: { enabled: false }` ou budget de réflexion nul, ou modèle plus rapide), sans casser les autres
   appelants du proxy.
3. **Rythme des garde-fous** : aucun événement aux tours 1–3 ni aux tours 7–9 (après la vidéo du tour 6) ; cohérent avec
   « tours avant la 1re vidéo » et « tours min. entre deux vidéos » de la configuration publiée, mais **aucun
   événement n'est journalisé quand les garde-fous écartent toutes les vidéos** en superposition : à rendre visible
   (`overlay_no_allowed_video` avec la raison du garde-fou) et à vérifier contre les réglages sandbox.
4. **Pertinence** : la seule vidéo montrée (« Emma regard feu avec Max », confiance 0,7) a été choisie sur le prénom
   « Emma » en fin de réplique ; la raison du sélecteur reste vague (« semble sentir quelque chose »). Le sélecteur ne
   voit que la phrase du joueur et la réplique courante, pas le fil récent de la conversation, et accepte un lien sur
   un nom propre seul.
5. Décision GM post-tour ignorée en superposition (arrive après la réplique) : les recommandations du GM ne comptent
   donc pas ; à mesurer si elles auraient été plus pertinentes (journal GM).

## Première action

Relire ce diagnostic sur les événements sandbox récents (MCP Lovable Ava, **lecture seule**), mesurer la latence réelle
du sélecteur (modèle, raisonnement), lire la configuration directeur publiée sandbox (cadence vidéo) et les lignes
candidates envoyées (`formatVideoCandidateLine`). Écrire dans le plan du lot 1 une section « Lot 2 » : causes
confirmées, choix retenus, puis coder.

## Périmètre attendu

- **Fréquence** : sélection qui répond dans les temps (raisonnement désactivé pour ce modèle, ou modèle rapide dédié
  réglable, consigne et candidates plus courtes) ; lancer la sélection plus tôt si possible (première phrase en flux ou
  en parallèle de la génération, en gardant le contrôle sur le texte final) ; échéance revue d'après les mesures ;
  journaliser les tours écartés par les garde-fous. Respecter strictement les réglages du backoffice (tours avant la
  1re vidéo, tours min. entre deux vidéos, maximum par session) : plus de vidéos signifie ne plus en perdre, pas
  contourner ces réglages.
- **Pertinence** : donner au sélecteur les deux ou trois derniers échanges ; exiger un lien concret entre la vidéo et
  ce qui est dit maintenant (lieu, action, objet, souvenir), un nom propre seul ne suffit pas ; raison structurée
  (élément de la réplique ↔ élément de la vidéo) ; seuil de confiance revu ; tests sur des cas réels (dont le cas
  « Emma » ci-dessus, qui doit donner `null` sans lien concret).
- Optionnel, si les mesures le justifient : utiliser la recommandation GM du tour précédent comme candidate prioritaire.

## Limites

Ne pas modifier la base Caractères Notion ni les fiches (interdiction formelle) ; ne pas publier en production sans
autorisation distincte ; préserver le mode interruption et ses E2E (lot 3b) ; Lovable reste l'unique chaîne de
livraison (Edge `proxy-llm` : changement versionné, déploiement par Lovable, sans Supabase direct) ; aucun accès au
Trousseau ; `gh` uniquement via `~/CodeProjects/_shared/scripts/github-delivery-exec`.

## Validations

`npm run test:quality`, `npm run test:delivery`, tests du proxy si modifié, E2E Chromium `-g "superposition|lot 3b"`,
puis CI PR complète. Mesure avant/après de la latence et du taux de sélection réussie (`llm_usage`,
`experience_events`). Recette humaine Ulrich + Romed en sandbox distincte de la livraison technique.

## Livraison

Branche du lot depuis `main` à jour, plan, CHANGELOG et `docs/etat_courant.md` mis à jour, commit, push, PR, CI verte
sur le HEAD exact, fusion par `node .github/scripts/ship-pr.mjs --pr N --head SHA --merge` (via
`github-delivery-exec`), vérification de l'arbre fusionné, nettoyage de la branche, vérification de la synchronisation
Lovable (et redéploiement `proxy-llm` par Lovable si modifié), commentaire sur la tâche Notion
[Comparer les cinématiques…](https://app.notion.com/p/ef162322e59583b7ae03818368ce9008) (Gamilab `7e1a9a09…`).

## Clôture

S'il reste un lot identifié, livrer son prompt de reprise autonome dans `docs/` avec cette même obligation ; sinon le
dire explicitement.

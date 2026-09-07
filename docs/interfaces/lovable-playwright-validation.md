# Validation Playwright d'une preview Lovable

> **Categorie :** Interface externe et runbook de validation
>
> **Service :** Lovable / Lovable Cloud
>
> **Derniere mise a jour :** 4 septembre 2026
>
> **Statut :** Implementation locale prete, validation preview requise

## Objectif

Finaliser le lot 1 du
[plan d'audit et de consolidation prepublic](../plan_audit_consolidation_prepublic.md)
en executant les contrats Playwright sur le frontend compile par Lovable, dans
une preview isolee et sans publication en production.

## Contexte

La configuration [playwright.config.ts](../../playwright.config.ts) accepte deux
modes :

- `npm run test:e2e` lance Vite localement sur `127.0.0.1:4173` ;
- `PLAYWRIGHT_BASE_URL="https://<preview>" npm run test:e2e:preview` cible une
  preview deja hebergee et ne lance aucun serveur local.

La suite contient 12 executions : neuf sous Chromium, deux contrats media sous
Firefox et un sous WebKit. Les parcours conversationnels simulent Supabase,
Gumlet, STT, LLM, RAG, TTS et PostHog dans le navigateur. Ils ne consomment
aucun quota fournisseur et ne modifient aucune donnee distante. Les deux smokes
de surface verifient la barriere d'acces et la page de confidentialite sans
secret.

## Commande de validation

Depuis un environnement ayant recupere le commit exact affiche par Lovable :

```bash
npm ci
npx playwright install --with-deps chromium firefox webkit
PLAYWRIGHT_BASE_URL="https://URL-DE-LA-PREVIEW-LOVABLE" npm run test:e2e:preview
```

`PLAYWRIGHT_BASE_URL` doit utiliser HTTPS, sauf pour localhost. La commande
`test:e2e:preview` echoue volontairement si l'URL est absente, afin d'eviter de
valider Vite local en croyant tester Lovable.

En CI, un echec conserve pendant sept jours le rapport, les captures et les
traces sous l'artefact prive `playwright-failure-<run_id>`. Ces artefacts peuvent
contenir le DOM et le trafic du test : ne pas les publier publiquement.

## Resultats attendus

| Controle | Resultat attendu |
|---|---|
| Build Lovable | Succes sur la preview isolee |
| Chromium | 9/9 |
| Firefox media | 2/2 |
| WebKit media | 1/1 |
| Erreur JavaScript sur barriere/confidentialite | Aucune |
| Donnee distante ou quota fournisseur | Aucun |
| Publication production | Aucune |

Un echec interdit de clore le lot 1. Corriger uniquement la cause reproductible,
relancer `npm run test:quality`, puis les 12 executions preview. Ne modifier ni
migration, ni secret, ni Edge Function pour contourner un test.

## Prompt de reprise Lovable

Copier-coller le prompt suivant dans le projet Lovable apres synchronisation du
code :

```text
Reprends le lot 1 « Garde-fous qualité » du projet AVA Proto 1.

Lis d'abord AGENTS.md, docs/plan_audit_consolidation_prepublic.md et docs/interfaces/lovable-playwright-validation.md. Lovable est l'unique chaîne de build et de publication. Travaille uniquement sur une preview isolée : ne publie rien en production et ne modifie aucune migration, donnée, Edge Function, variable ou secret.

1. Vérifie que le code Lovable correspond exactement au commit Git synchronisé. Donne son SHA et arrête-toi si des fichiers attendus manquent, notamment playwright.config.ts, tests/e2e/public-surface.spec.ts et .github/workflows/core-experience-quality.yml.
2. Lance le build Lovable de preview et donne l'URL HTTPS exacte de cette preview. N'utilise pas le domaine de production.
3. Sur un runner autorisé, exécute depuis ce même commit :
   npm ci
   npx playwright install --with-deps chromium firefox webkit
   PLAYWRIGHT_BASE_URL="<URL_HTTPS_PREVIEW_LOVABLE>" npm run test:e2e:preview
4. Vérifie les 12 exécutions attendues : Chromium 9/9, Firefox media 2/2, WebKit media 1/1. La suite simule les fournisseurs et ne doit écrire aucune donnée distante.
5. Vérifie aussi le check GitHub « Core experience quality » : npm ci, test:quality, installation des navigateurs et test:e2e doivent être verts. En cas d'échec Playwright, utilise la trace/capture de l'artefact privé playwright-failure-<run_id>.
6. Effectue une revue Bugbot puis une revue sécurité du diff du lot 1. Tout constat P0/P1 bloque le GO ; rapporte les autres constats et ne corrige que leur cause exacte avec un diff minimal.
7. Si un test ou une revue échoue, identifie la cause exacte, fais uniquement le correctif minimal compatible Lovable, puis relance npm run test:quality et les 12 tests sur la preview. Ne relâche aucun contrôle et ne masque aucun échec.
8. Ne déclare pas le lot terminé si Playwright n'a pas réellement été exécuté. Si Lovable ne peut pas lancer la commande, indique clairement le blocage et fournis l'URL de preview et le SHA pour qu'un runner autorisé l'exécute.

Rends un compte rendu avec : SHA, URL de preview, résultat du build, résultats Chromium/Firefox/WebKit, lien du run CI, éventuels artefacts, diff appliqué, absence de mutation Cloud et verdict GO/NO-GO pour le lot 1 uniquement. Même avec un GO du lot 1, laisse la release gate publique fermée et attends mon approbation avant le lot 2 ou toute publication.
```

## Securite et retour arriere

- Ne jamais placer de mot de passe public, JWT ou cle fournisseur dans la
  commande, les traces ou le rapport.
- Utiliser uniquement l'URL de preview Lovable et le commit synchronise.
- En cas de regression, revenir au commit precedent dans Lovable et conserver
  le rapport d'echec comme preuve ; ne pas publier la preview en production.

## References

- [Contrat anti-regression](../core_experience_regression_contract.md)
- [Release gate publique](../public_release_gate.md)
- [Configuration officielle Playwright](https://playwright.dev/docs/test-configuration)
- [Serveur web et baseURL Playwright](https://playwright.dev/docs/test-webserver)
- [Traces Playwright](https://playwright.dev/docs/trace-viewer)

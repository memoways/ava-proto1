# Rétablir les visualisations Latence et blocage

Date : 15 octobre 2026. Base : `1b2f709`, `main`.

## Objectif et contraintes

Afficher les mesures récentes dans Qualité → Latence et blocage sans modifier
la conversation, le STT, le TTS, les interruptions, les prompts ou la collecte.
La correction reste dans la vue administrateur, sur les données déjà persistées.
Aucune requête, attente, migration ou nouvelle instrumentation côté joueur.

## Diagnostic vérifié

Cible : Lovable « AVA Prototype 1 », `1265958d-b74e-40f2-917d-182fe05163fc`,
Cloud Supabase `iralfqlslqndgvexixis`. Lecture par le connecteur natif Lovable.

Le SQL reproduisant la requête de l'écran (50 sessions hors sandbox) retourne
376 tours avec `pipeline`, dernière session le 16 septembre à 12:31:46 UTC,
aucun tour récent. Le filtre `context_type <> sandbox` est présent depuis
`146cda9` du 21 août ; il n'a pas été introduit le 16 septembre.

La session du 16 septembre est `user_test` ; les conversations suivantes sont
`sandbox`. Les journaux contiennent 58 tours mesurés après le 16 septembre
(55 sandbox-ulrich et 3 sandbox-benoit), jusqu'au 14 octobre à 14:07:58 UTC.
Les 50 sessions les plus récentes, sandboxes incluses, contiennent 53 tours
mesurés dans 23 sessions, tous postérieurs au 16 septembre. Le plafond de
50 sessions ne cause donc pas l'absence des données récentes ; il borne
l'historique disponible dans cette vue et doit être explicite.

Les tables audio_latencies et voice_turn_events ont également des enregistrements
du 14 octobre. La table legacy turn_latencies s'arrête au 22 mai : elle n'est
pas la source de cet écran. Ne pas réactiver sa collecte pour traiter ce défaut.
Les mesures absentes ne seront ni reconstituées artificiellement ni mises à zéro.

## Plan d'exécution

1. Couvrir le défaut par un test de composant : une session sandbox du 14 octobre
   doit alimenter les graphiques dès l'ouverture, avec l'ancien historique disponible
   lorsque les sandboxes sont exclues explicitement.
2. Inclure les sandboxes par défaut, afficher le périmètre et les environnements,
   garder le filtre d'exclusion volontaire. Réinitialiser la sélection au changement
   de périmètre pour que les graphiques soient alimentés dans les deux cas.
3. Vérifier les tests de la vue, les calculs de segments et le typage. Synchroniser
   le commit sur main dans Lovable, compiler et vérifier visuellement les mesures
   existantes avant publication via Lovable uniquement.

## Critères observables

- Ouverture de l'écran : sessions et visualisations du 14 octobre présentes.
- Exclusion volontaire des sandboxes : périmètre annoncé et historique visible.
- Mesures partielles toujours distinguées des zéros ; calculs existants conservés.
- Aucun fichier du chemin de conversation ni aucune fonction Cloud modifiés.

## Livraison et vérifications

En cours. Les vérifications finales et les révisions seront consignées ici.

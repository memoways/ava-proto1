# Prompt de reprise — Extraits du film, lot 1c (déploiement et essai réel de `transcribe-video`)

À copier dans un nouveau chat Ava. Contexte : [plan](plan_extraits_film_pas_vu.md), lot 1b livré (Edge Function `transcribe-video`, onglet Extraits).

---

Objectif : mettre en service `transcribe-video` et vérifier de bout en bout sur un vrai extrait parlé, sans rien produire en production.

État vérifié (21 novembre) : code livré et testé (vitest, mocks réseau). Les 3 extraits en base (mort Peter, couteau, mauvaise conscience) ont chacun une rendition audio Gumlet séparée (AAC ≈ 1,5 Mo, sous la limite de 12 Mo) mais **aucun Dialogue ni transcription** : le label « Parlé » doit être posé par Romed/Ulrich dans Notion avant l'essai. **Jamais exécuté contre Gemini** : le format d'entrée (`input_audio` m4a, repli `video_url` MP4) est une hypothèse à vérifier.

Étapes :
1. **À faire par Ulrich** (une seule action) : coller dans le chat Lovable Ava (`1265958d-b74e-40f2-917d-182fe05163fc`) : « Déploie l'Edge Function `supabase/functions/transcribe-video` depuis main (admin seulement, secrets NOTION_API_KEY et OPENROUTER_API_KEY déjà configurés). Ne change rien d'autre. » Puis dire « fait ».
2. Ulrich ou Romed labellise Dialogue = Parlé sur un extrait réellement parlé dans Vidéos AVA, puis resynchronisation (Contenu Notion › Vidéos).
3. Depuis Admin › Expérience › Extraits : « Transcrire » sur cet extrait (un seul). Contrôler : texte écrit dans « Transcription » seulement, « Transcription vérifiée » décochée, « Description », « Description IA » et « Dialogue » inchangés ; un extrait silencieux ne propose pas le bouton ; relancer sur le même extrait refuse sans réanalyse.
4. Si Gemini refuse le format audio : ajuster `buildTranscribeRequest` (format ou conversion), tests, redéployer. Aucune transcription inventée n'est acceptable : en cas de doute, échec explicite.
5. Qualité : non prouvée par l'essai ; **relecture humaine (Romed) à signaler comme non faite**, case « Transcription vérifiée » cochée uniquement par un humain.

Limites : base Caractères Notion en lecture seule ; dans Vidéos AVA écrire uniquement « Transcription » ; confirmation avec nombre de vidéos avant tout lot ; aucune production ; secrets côté serveur ; Gami DigiDouble exclu ; ne pas toucher à la sélection ni à la lecture des extraits (lot 2).
Validations : lint, typecheck, `test:regression`, tests de garde, CI `regression-gates` verte sur le HEAD exact.
Livraison : branche de lot depuis main à jour, commit, push, PR, `node .github/scripts/ship-pr.mjs --pr N --head SHA --merge` via `~/CodeProjects/_shared/scripts/github-delivery-exec`, vérification sur origin/main, synchro locale et Lovable ; STORY, CHANGELOG, docs/etat_courant.md. Avant le push, s'il reste du travail, écrire le prompt du lot suivant avec cette même clôture.

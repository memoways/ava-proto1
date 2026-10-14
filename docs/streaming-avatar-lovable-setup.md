# Streaming Avatar — activation dans Lovable Cloud

Le mode avatar est un moteur de rendu. Ava reste l’unique propriétaire du STT, du RAG, des règles, du LLM et du texte final envoyé. Aucun son du micro n’est publié vers HeyGen ou Tavus.

## Éléments à appliquer dans Lovable

1. Ramener les changements du dépôt dans le projet Lovable.
2. Appliquer la migration `supabase/migrations/20260730160000_streaming_avatar_output.sql`.
3. Publier l’Edge Function `supabase/functions/streaming-avatar-session`.
4. Ajouter dans les secrets Lovable Cloud, selon les fournisseurs testés :
   - `LIVEAVATAR_API_KEY`
   - `TAVUS_API_KEY`
5. Vérifier que les connexions anonymes Supabase fournies par Lovable sont actives. Cette Edge Function impose toujours l’identité, la propriété de la session Ava et les quotas, même si le garde-fou global du jeu est désactivé.
6. Dans **Admin → Technique → Streaming Avatar Config**, saisir les identifiants non secrets, conserver le sandbox HeyGen pour les premiers essais, puis sauvegarder.
7. Laisser le switch global sur **Voix TTS** jusqu’au canary interne. Le changement ne concerne que les nouvelles sessions.

## Contrats fournisseur

- HeyGen LiveAvatar FULL : le navigateur appelle le wrapper SDK `repeat(text)`, qui émet `avatar.speak_text`. Ne pas utiliser `avatar.speak_response`.
- Tavus : le navigateur émet `conversation.echo` avec `modality: "text"` et `done: true`. Ne pas utiliser `conversation.respond`.
- La Persona ID Tavus doit avoir `pipeline_mode: "echo"`. L’Edge Function le vérifie avant chaque création ; ce mode désactive Perception, STT et LLM Tavus ainsi que son entrée micro.
- Les clés API ne quittent jamais l’Edge Function. Le navigateur reçoit uniquement un jeton de session média éphémère.

## Lecture Tavus et diagnostic (14 octobre 2026)

Le flux est prêt seulement quand les pistes audio et vidéo sont reçues. Le lecteur
conserve son `srcObject` entre mises à jour React et renouvellements de pistes.
Une erreur de `play()` est remontée avant envoi de parole ; le chemin de repli
existant s'applique avant début de parole, sans présenter une lecture muette
comme un succès. Une notification Tavus de parole reste une mesure fournisseur,
pas une mesure acoustique du premier son effectivement entendu.

Le test privé affiche pistes, refus navigateur (`NotAllowedError`), état réseau,
débit reçu, pertes/jitter et RTT Daily, ainsi que l'état de charge CPU locale et
sa cause (`decode`, `encode`, `scheduleDuration`). Les valeurs réseau sont celles
du SDK Daily, sans conversion d'unité supposée. En conversation, le même
échantillon technique est envoyé via `prd4_streaming_avatar_media`, toutes les
5 secondes et aux changements. Aucun texte, token ou URL de salle n'y figure.
Un réseau dégradé est un indice réseau ; une charge `high/decode` est un indice de
charge locale. La RAM et une panne Tavus ne sont pas déduites de ces signaux seuls.

Seule la transcription utilisateur est visible en bas, y compris avec le preset
voix seule. Les répliques personnage restent conservées dans le journal interne.
Le STT choisi est inchangé : les providers batch n'offrent pas de partiels en
cours de capture, tandis que les providers streaming les exposent.

Voir le [plan et les preuves de validation](plan_tavus_audio_transcription.md).

## Validation canary

- Vérifier mot pour mot la phrase d’ouverture puis plusieurs réponses contenant ponctuation, accents, sauts de ligne et texte long.
- Mesurer connexion, première piste vidéo et première parole dans les colonnes `streaming_avatar_*` de la session.
- Tester le repli avant la parole, puis une coupure après le début de la parole : le premier cas doit rejouer en TTS, le second ne doit pas répéter le fragment.
- Tester Chrome, Safari et mobile, puis réseau lent, déconnexion WebRTC, expiration de session et crédits épuisés.
- Vérifier que le fournisseur ne reçoit ni micro ni caméra et que les secrets sont absents des réponses et journaux.

# Streaming Avatar — activation dans Lovable Cloud

Le mode avatar est un moteur de rendu. Ava reste l’unique propriétaire du STT, du RAG, des règles, du LLM et du texte final affiché. Aucun son du micro n’est publié vers HeyGen ou Tavus.

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

## Validation canary

- Vérifier mot pour mot la phrase d’ouverture puis plusieurs réponses contenant ponctuation, accents, sauts de ligne et texte long.
- Mesurer connexion, première piste vidéo et première parole dans les colonnes `streaming_avatar_*` de la session.
- Tester le repli avant la parole, puis une coupure après le début de la parole : le premier cas doit rejouer en TTS, le second ne doit pas répéter le fragment.
- Tester Chrome, Safari et mobile, puis réseau lent, déconnexion WebRTC, expiration de session et crédits épuisés.
- Vérifier que le fournisseur ne reçoit ni micro ni caméra et que les secrets sont absents des réponses et journaux.

# Plan — Lot B : rendre les états de parole audibles

Date : 24 octobre 2026. Statut : plan approuvé, code implémenté en preview ; auditions réelles et livraison finale non vérifiées.

## Résultat attendu

La voix suit l'état propre au personnage : une digue qui cède peut accélérer malgré des hésitations ; un blocage peut ralentir et laisser davantage de pauses. Les mots et les sous-titres restent inchangés. Les fournisseurs ne sont pas supposés produire des rendus équivalents.

Périmètre : Max et Emma aujourd'hui ; les autres personnages utiliseront leurs propres fiches quand elles seront disponibles. Sandbox uniquement, Lovable Cloud, aucune publication production, aucun changement de fournisseur actif ou de voix sauvegardée.

## Audit vérifié dans le code

| Élément | Comportement actuel | Conséquence |
|---|---|---|
| `prepareTextForTTS` | Normalise `…` en `...`, nettoie narration/markdown, espaces et sigles | « euh » et les répétitions restent ; les coupures ne sont pas réécrites en phrases complètes |
| `prepareTextForGradium` | Convertit les suspensions internes en virgules, finales en points ; tirets espacés en virgules | La rupture devient une ponctuation régulière ; réintroduire aveuglément les anciens signes risquerait les clics/hoquets corrigés en septembre |
| `PerformanceIntent` | Lexique, ancienne émotion GM, baseline Max/Emma ; `…` peut imposer fragile/mesuré | Aucun état de parole du lot A reçu ; le rythme peut contredire la fiche |
| Sortie batch | Intention dérivée du texte dans `IndexPRD4` | État privé non utilisé pour la synthèse |
| Sortie Gradium incrémentale | Paramètres figés à la préparation avec texte vide ; événement privé conservé dans le reçu | L'état arrive après préparation mais avant la parole ; il faut l'utiliser avant le premier envoi, pas attendre la fin de lecture |
| TTS Config | Phrase unique et émotions manuelles ; sélection personnage Gradium seulement | Aucun corpus 10 × 3 × 5 ni comparaison par état |

Important : l'état déclaré, validé sur la fiche, peut piloter la voix avant la synthèse ; il devient « joué » dans les traces uniquement après livraison confirmée. Ne jamais confondre ces deux instants.

## Proposition d'implémentation, après validation

### 1. Transporter l'état sans ralentir le tour

- Propager personnage, état privé validé, rugosité épinglée et mapping vocal aux sorties batch et incrémentales.
- Priorité : état connu + mapping du personnage ; sinon dérivation actuelle lexique/ponctuation/ancienne émotion GM. La ponctuation ne surcharge jamais un mapping explicite.
- Rugosité 0 ou fonctionnalité inactive : comportement existant. Niveaux 1–3 : modulation bornée de l'écart au réglage de base, pas changement des faits ni ajout automatique de « euh ».
- En Gradium incrémental, conserver la préparation anticipée du transport ; figer les paramètres depuis l'en-tête privé avant le premier texte envoyé. Vérifier la faisabilité du protocole setup ; ne pas ouvrir une seconde connexion ni attendre la réponse complète.
- Aucun appel LLM supplémentaire, aucune lecture distante par segment. Chargement du mapping avec la configuration d'environnement, figé pour le tour ; préserver l'épinglage du lot A et la comptabilité des interruptions.

### 2. Mapping éditable dans TTS Config

- Section « Rendu par état » : personnage, états réellement synchronisés, débit relatif, pauses courtes/normales/longues, delivery et instruction d'acting bornée.
- Mapping distinct par personnage et état, versionné dans les réglages d'environnement existants ; pas de catalogue commun de styles narratifs codé en dur.
- Propositions initiales visibles et à sauvegarder : Max « La digue cède » rapide/peu de pauses, « Bloqué » pauses longues si ces noms existent dans la fiche. Les autres valeurs se fondent sur les descriptions réelles et restent modifiables.
- Garder les réglages Gradium par personnage : température, padding, similarité, prononciation. La modulation part de ces bases, reste bornée et réversible ; ne pas monter la température pour simuler une hésitation.
- Tout nouveau réglage du lot B est inactif en production et inaccessible en écriture hors sandbox. Prévoir un arrêt global sandbox revenant au rendu actuel.

### 3. Préparation de texte adaptée, sans modifier les sous-titres

- Séparer texte affiché et texte de synthèse ; conserver les mots, reprises (« je… je »), « euh » et phrases inachevées.
- Conserver les suspensions/tirets chez les fournisseurs compatibles ; pour Gradium garder une représentation sûre tant que le banc d'écoute n'a pas démontré l'absence d'artefacts, et porter l'intention de pause via le mapping.
- Ne pas promettre une pause exacte en millisecondes si l'API ne la permet pas. Ne pas multiplier les petites requêtes ni ajouter des silences artificiels entre chaque mot.
- Tests de nettoyage, idempotence, frontières de segments et alignement du reçu audio ; narration/crochets privés toujours exclus.

### 4. Banc d'audition sandbox dans TTS Config

- 10 répliques éditables par personnage, chacune associée à un état de sa fiche, avec variantes préparées pour rugosité 1, 2 et 3 ; 0 sert de témoin hors matrice principale.
- Corpus de test clairement identifié comme proposition, non canon Notion. Aucun LLM requis pour le préparer ou le jouer.
- Comparaison Gradium, Hume, Inworld, ElevenLabs **v3**, Cartesia : 150 combinaisons par personnage, 300 pour Max + Emma. Pas de génération automatique de toute la matrice.
- Écoute à la demande, arrêter/rejouer ; parcours comparatif limité et annulable. Afficher texte source, texte synthèse, état, intention appliquée, modèle, voix, premier octet/premier son/durée, erreur et appréciation diction/artefacts/naturel.
- Réglage de voix propre à chaque couple personnage/fournisseur dans le banc. Ne jamais envoyer un Voice ID Gradium à ElevenLabs, ni inventer une voix manquante : signaler « voix à renseigner ». Les réglages du banc ne changent pas le fournisseur actif ou les profils de jeu.
- Forcer eleven_v3 uniquement pour l'audition, sans sauvegarder ce modèle comme modèle live. Les appels utilisent les fonctions Lovable Cloud existantes et leurs contrôles d'accès.
- Export des résultats et métadonnées ; cache local des auditions pour rejouer sans nouvelle facturation, annulé lors d'une modification pertinente. Afficher le nombre d'appels avant une série ; coût fournisseur non garanti si l'API ne retourne pas de coût.

### 5. Adaptateur de tags Gradium préparé, fermé par défaut

- Au 24 octobre, l'annonce citée pour novembre est future ; format, modèle et disponibilité des tags émotionnels ne sont pas établis pour cette date.
- Préparer l'interface, la validation et un flag sandbox **false** ; sans capacité officiellement documentée, l'adaptateur reste un no-op même si le flag est manipulé.
- Aucun tag spéculatif envoyé. Lors d'une activation future : liste autorisée issue de la documentation fournisseur, tags créés uniquement à la frontière TTS depuis l'état validé ; aucune modification du LLM ni de sa garde d'identité.
- Tester flag absent/false, état inconnu, fournisseur incompatible : zéro tag. Pas d'activation dans ce lot.

## Capacités et limites à rendre explicites

- Hume : description + débit ; éviter que la description générale tronque l'instruction d'état.
- Inworld : instruction + débit/delivery ; respecter les bornes existantes.
- ElevenLabs v3 : tags internes à l'adaptateur, jamais dans le texte affiché ; qualité et latence à auditionner.
- Gradium : modulation limitée température/padding ; ne pas présenter le padding comme des pauses intra-phrase exactes.
- Cartesia FR : vitesse/volume dans l'implémentation actuelle ; pas de garantie d'émotion nommée française.

## Fish Audio — évaluation documentaire uniquement

Sources officielles à revalider avant toute décision :
- https://fish.audio/text-to-speech-api/
- https://fish.audio/fr/text-to-speech-api/
- https://docs.fish.audio/developer-guide/models-pricing/models-overview

Les pages consultées annoncent 80+ langues, environ 100 ms jusqu'au premier audio et 15 USD par million d'octets UTF-8. Ce sont des annonces fournisseur, non des mesures Ava ; leur disponibilité historique au 24 octobre et la qualité française ne sont pas confirmées. Les accents français utilisent plusieurs octets : ne pas assimiler octets et caractères.

Évaluation proposée pour une décision ultérieure : compréhension française, noms Ava/Lausanne, hésitations sans tics, reprise et diction, p50/p95 jusqu'au son depuis la même région, facturation réelle par octets, voix/licences/confidentialité. Aucun SDK, proxy, secret, connexion ou audio Fish dans le lot B.

Gradium, sources de veille : https://docs.gradium.ai/guides/text-to-speech et https://docs.gradium.ai/guides/voice-settings ; elles ne valident pas ici une disponibilité des tags émotionnels en octobre.

## Validation et critères de livraison

1. Tests concrets : priorité état sur ellipsis/lexique, isolation Max/Emma et sandbox/prod, rugosité 0 inchangée, bornes providers, conservation mots/reprises, zéro tag Gradium désactivé, modèle v3 limité au banc, 10 × 3 × 5, voix par fournisseur, arrêt/cache sans appels superflus.
2. Suites streaming/queue/reçus existantes : annulation et barge-in, pas de replay après début audible, pas d'état joué sur texte non livré. Ne pas toucher aux décisions mains libres.
3. Vérification du banc connecté par navigateur ; tests simulés sans facturation d'abord. Auditions réelles déclenchées explicitement dans le banc, pas de sessions de jeu synthétiques.
4. Recette humaine : naturel et mots compréhensibles sans nouveaux clics/hoquets sur Max/Emma ; comparaison avant/après aux mêmes textes et réglages.
5. Latence : aucun buffer, timeout ou appel réseau de contrôle supplémentaire sur le chemin critique. Mesurer premier son TTS et voix-à-voix séparément ; cible existante médiane ≤2 s, p95 ≤4 s. Ne pas annoncer « aucune régression » sans mesures comparables. Régression → désactivation sandbox du lot B.
6. Rapport après implémentation : fichiers/comportements changés, parcours d'écoute, limites par fournisseur, tests et mesures réellement effectués, reste humain/documentaire, statut production.
7. La livraison GitHub main/CI/branches doit être vérifiée pour déclarer le lot terminé. Ici le checkout est géré par Lovable et les opérations Git d'écriture ne sont pas disponibles à l'agent ; ne pas revendiquer une fusion ou un nettoyage non vérifiés.

## Ordre proposé

Mapping et tests → propagation état aux deux sorties → adaptations de texte prudentes → banc d'audition → adaptateur Gradium fermé → vérification et rapport. Aucun code vocal, migration, secret ou déploiement avant validation de ce plan.

## Rapport d'implémentation — 24 octobre

### Technique

- `speechPerformanceSettings.ts` : clé d'environnement `ava_speech_performance`, version à la sauvegarde, mapping par personnage/état ; lecture/écriture lot B refusée en production côté service, droits Cloud existants conservés. Aucune migration ni nouvelle permission.
- `performanceIntent.ts` : état validé + mapping prioritaire, modulation rugosité 1–3, 0 et désactivation gardent le chemin historique. Débit relatif ElevenLabs/Inworld, Hume instruction prioritaire, Gradium température de base conservée et padding borné. Aucun délai artificiel ni LLM supplémentaire.
- `prd4Orchestrator.ts` transmet liste réelle/rugosité avant génération et état validé en résultat batch ; `IndexPRD4` relie ces informations à la synthèse. Mapping lu en cache d'environnement, chargement anticipé à l'ouverture ; aucun accès Cloud par segment.
- `gradiumStreamPlayer.ts` conserve token/socket anticipés et diffère le seul setup jusqu'à configuration depuis le premier segment et son en-tête. Pas de socket supplémentaire, buffers et timeouts inchangés. `streamedVoiceTurn` configure avant append, conserve les reçus et règles d'interruption.
- Le nettoyage texte historique est volontairement conservé : reprises et « euh » restent, Gradium traduit les signes risqués en ponctuation sûre. Le réglage de pauses est indicatif via acting/padding, pas un silence exact intra-phrase. Les sous-titres n'ont pas été modifiés.
- `gradiumEmotionalTags.ts` : interface no-op, capacité false ; aucun tag même si flag manipulé. Fish : documentation seulement.

### Expérience et mode d'emploi

Dans **sandbox → Technique avancée → TTS Config**, nouvelle section **Lot B — Rendu par état et auditions**.

1. Choisir Max ou Emma : les cinq états de leur fiche s'affichent. Ajuster débit, pauses, delivery, émotion et instruction. Les propositions ne deviennent mapping live qu'après adoption/édition et sauvegarde.
2. Pour un nouveau test de conversation : adopter les états souhaités, activer **Rendu par état en sandbox**, puis **Sauvegarder le rendu**. Rien n'a été activé ni sauvegardé par l'agent. Rugosité du personnage reste dans Expérience → Réglages personnages ; elle est toujours épinglée à la session par le lot A.
3. Dans le banc : choisir réplique 1–10, niveau 1–3, état et fournisseur. Les propositions sont utilisées localement pour l'audition, indépendamment de l'interrupteur live. Les voix absentes doivent être renseignées par fournisseur ; la voix configurée du profil n'est préremplie que pour son propre fournisseur.
4. **Écouter** lance un seul appel ; **Arrêter** annule ; réécouter les mêmes paramètres utilise le cache en mémoire. Export JSON et notes diction/artefacts/naturel. Corpus et voix d'audition sont temporaires, pas sauvegardés comme canon ou voix live. Aucune série massive automatique.
5. ElevenLabs force v3 dans cet appel seulement. Les métriques REST sont premier octet, premier démarrage logiciel du son et durée ; le rejeu est marqué cached dans l'export. Ces chiffres ne sont pas une latence voix-à-voix.

### Vérifications réellement effectuées

- 878 tests réussis, 136 fichiers ; nouveaux tests : priorité état sur suspensions, isolation personnage/prod, refus sauvegarde prod, rugosité 0 et modulation 1–3, température Gradium conservée, débit relatif, Hume, tags fermés, reprises intactes, matrice exacte, voix isolées et setup unique/configuration avant segment. Suites interruptions/streaming/queue existantes incluses.
- Compilation automatique Lovable verte après changements.
- Navigateur connecté au compte demandeur : cinq états Max chargés, matrice 150, adoption temporaire, sélection ElevenLabs v3 et niveau 3 ; Emma reçoit son texte distinct et aucune voix ElevenLabs venant de Max. Réplique modifiée relue à l'écran ; zéro pageerror. Pas de sauvegarde Cloud effectuée dans cette recette.
- Aucun audio fournisseur ou session de jeu synthétique généré ; aucun secret, provider actif, fiche Notion ou configuration production changé ; aucune fonction Cloud déployée ni publication.

### Ce qui reste non vérifié

- Appels réels des cinq fournisseurs, disponibilité des voix/modèles, facturation et sauvegarde/readback Cloud du mapping.
- Diction/naturel et latence avant/après : aucune promesse de non-régression mesurée. Le protocole Gradium setup différé est couvert localement mais demande une audition réelle sur le service.
- Tags Gradium : format/capacité future à confirmer, désactivés dans tous les cas. Fish : qualité FR et performances non mesurées.
- GitHub main SHA, CI exacte et suppression des branches ne sont pas accessibles dans cette chaîne agent ; lot non déclaré terminé au sens de la règle fin de lot. Production non publiée.
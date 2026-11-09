# Recette — questionnaire conversationnel de fin d'expérience

Recette humaine d'Ulrich, **après fusion et synchronisation Lovable**, sur l'URL de recette habituelle. Plan :
[plan_questionnaire_conversationnel.md](plan_questionnaire_conversationnel.md).

## Préparer (une fois par environnement)

Admin → **🧭 Expérience → Orchestration** : « Questionnaire en fin d'expérience » activé, « Questionnaire
conversationnel (à la voix) » activé, **Enregistrer**. Le réglage vaut pour l'environnement choisi ; recharger la
page de l'expérience ensuite.

Sortie rapide d'une expérience : pendant l'appel « Terminer » (retour à la grille), puis « Terminer l'expérience »
en bas à droite, puis « Continuer » sur l'écran de fin.

## Déjà vérifié

- 8 novembre 2026, iPhone, avatar vidéo, session `a3586dec` : cinq notes, verbatims et relances, synthèse, email et
  opt-ins dans « Questionnaire AVA » (colonnes « Conv ») et sur la page Données Questionnaire. Précision
  d'engagement arrêtée sur « J'étais un peu » : cause non établie (voir point 4).

## À vérifier, par appareil

Cocher sur iPhone (Safari), Android (Chrome), iPad (Safari) et desktop (Chrome).

1. **Mise en page.** Téléphone : « Répondre à la voix » et « Valider » en bas, au pouce, toujours visibles ; à la
   relance, le micro occupe sa ligne et « Passer » / « Valider ma précision » la suivante. Tablette : boutons faciles
   à toucher. Desktop : question à gauche, réponse à droite.
2. **Voix réelle.** Le texte s'affiche pendant qu'on parle ; « J'ai fini de parler » garde toute la phrase ; le texte
   reste corrigeable au clavier.
3. **Relance.** Au plus une par dimension, en lien avec la réponse, sans chiffre ni mesure ; « Passer » fonctionne.
4. **Fin de dictée.** Parler jusqu'au dernier mot puis toucher « J'ai fini de parler » : aucune fin de phrase ne doit
   manquer. Si une réponse est coupée, noter l'heure et l'appareil : l'évènement PostHog
   `conversational_dictation_finished` donne les longueurs (texte affiché à l'arrêt, texte final, texte gardé), sans
   contenu.
5. **Note.** Une note dite (« je dirais 4 ») est proposée puis confirmée ; « Je préfère ne pas noter » donne
   « non évalué ».
6. **Synthèse.** Radar lisible (non évalué listé à part) ; téléphone : cartes repliées, « Relire ou corriger »
   ouvre la carte ; une correction marque la synthèse comme corrigée ; « Valider et envoyer » seul déclencheur.
7. **Arrivée.** Une ligne « Conv … » dans « Questionnaire AVA », colonnes « Conv » remplies, appareil et mode d'appel
   corrects ; admin Questionnaires : radar des moyennes, filtre appareil, verbatims.

## Décision ensuite

Activer le questionnaire conversationnel par défaut à la place du formulaire PRD4 : décision d'Ulrich après cette
recette, pas de l'agent.

# Onboarding du bénévole — plan d'implémentation

## 1. Observations issues de l'audit

- Le parcours réellement actif est : accueil → teaser (film) → choix du personnage → sonnerie → conversation. Les écrans de « création de rôle » et de « posture » existent dans le code mais ne sont plus dans le parcours : il n'y a effectivement aucune étape qui explique qui l'on incarne.
- Le langage visuel est constant : plein écran sombre, titre en serif clair centré, texte secondaire discret, un seul bouton d'action, grille responsive déjà éprouvée sur tablette.
- Il existe déjà un canal générique « qui est la personne qui appelle » qui alimente, en un seul point, le personnage, la mémoire de session et le Game Master. Ce canal est aujourd'hui vide. C'est le bon endroit pour injecter le cadre bénévole, sans toucher au fonctionnement des conversations.
- Une session interrompue peut déjà être reprise (bouton « Reprendre l'appel ») ; le cadre du joueur est enregistré avec la session, donc restauré automatiquement à la reprise.
- Les personnages actifs (Max, Emma) sont chargés depuis un registre commun : tout ce qui passe par ce canal profite automatiquement aux personnages futurs.

## 2. Format recommandé

**Une séquence courte de trois cartes plein écran**, dans le style existant (fond sombre, titre serif, une idée par carte, indicateur de progression discret, bouton « Continuer », possibilité de revenir en arrière).

Pourquoi : trois respirations valent mieux qu'un mur de texte, chaque carte porte une seule idée (donc « compris en une lecture »), le rythme reste narratif et non administratif, et le format fonctionne à l'identique sur mobile et sur l'installation. Une seule page dense échouerait au critère de lecture unique ; une animation longue ferait doublon avec le teaser.

Contenu des trois cartes (sans nom d'association, sans jargon) :

1. **Qui tu es** — bénévole d'un dispositif de soutien aux personnes ayant vécu un événement traumatique ; les services officiels sont débordés, ce dispositif ajoute une présence humaine.
2. **Ce qu'on te demande** — écouter, soutenir, chercher à comprendre. Explicitement : tu n'es ni psychologue ni professionnel·le de santé, tu n'as pas de solution à apporter.
3. **Ce que tu sais déjà** — tu as lu le compte rendu transmis aux autorités, donc tu connais certains faits ; tu ne connais personne personnellement. Mention finale : tu pourras te présenter comme tu veux, ou pas, pendant l'appel.

## 3. Parcours proposé

```text
Accueil → Teaser (ou réponse « déjà vu ») → Onboarding bénévole (3 cartes) → Choix du personnage → Appel → Conversation
                                                        ▲                            │
                                                        └──── « Revoir le contexte » ─┘
```

- Premier passage : l'onboarding s'affiche automatiquement, juste avant le choix du personnage.
- Terminé une fois : il ne se rejoue plus, mais reste accessible depuis l'écran de choix du personnage par un lien discret « Revoir le contexte ». Revoir n'oblige pas à tout refaire : on peut fermer à tout moment et revenir au choix.
- Interrompu (rafraîchissement, retour) : la progression de carte est mémorisée localement ; on reprend à la carte en cours, jamais au tout début de l'expérience. Une session de conversation en cours continue de se reprendre par le bouton existant.

## 4. Plan d'exécution

1. **Cadre narratif partagé** — un seul fichier source de vérité pour le texte du cadre bénévole : version « écran » (les trois cartes) et version « personnage » (quelques lignes injectées dans l'appel). Générique, indépendant du personnage.
2. **Écran** — nouveau composant de briefing (trois cartes, progression, retour arrière), réutilisable aussi en mode « revoir » (ouverture depuis le choix du personnage).
3. **Parcours** — nouvelle étape insérée entre teaser/film et choix du personnage, dans les deux chemins d'entrée (film vu / film non vu). Aucun autre écran déplacé.
4. **Persistance** — mémoire locale du navigateur : cadre terminé oui/non, dernière carte vue, nombre de consultations. Même approche que les préférences de confidentialité déjà en place. Aucune donnée personnelle.
5. **Transmission aux personnages** — à la fin de l'onboarding, le cadre bénévole est déposé dans le canal « qui appelle » déjà existant, avec la mention explicite : le personnage sait qu'un contact bénévole était possible, ne connaît pas cette personne, n'invente ni rencontre passée, ni relation, ni confiance acquise. Disponible dès le premier tour pour le personnage, la mémoire et le Game Master, et enregistré avec la session (donc restauré à la reprise).
6. **Mesure** — évènements analytics : affichage, vue de chaque carte, complétion, abandon, durée, consultation ultérieure, puis enchaînement vers le choix du personnage et le premier tour. Aucun quiz, aucune confirmation artificielle.
7. **Tests** — tests du texte de cadre et de son injection ; test d'écran (navigation entre cartes, non-réaffichage après complétion, reprise à la carte en cours) ; mise à jour du parcours automatisé de bout en bout qui traverse désormais cette étape ; vérification manuelle mobile et tablette.
8. **Documentation** — plan enregistré dans `docs/plan_onboarding_benevole.md`, note de version et journal des modifications mis à jour au moment de l'implémentation.

## 5. Impacts et risques

- Le parcours automatisé de bout en bout échouera tant qu'il n'aura pas été mis à jour pour franchir la nouvelle étape : à traiter dans le même lot.
- Une étape en plus avant le choix du personnage ajoute un point d'abandon possible : d'où le format court et l'instrumentation d'abandon.
- Le cadre injecté allonge légèrement le contexte envoyé au personnage (quelques lignes) ; l'effet sur les temps de réponse est négligeable et sera vérifié sur les mesures de latence existantes.
- Risque que les personnages en fassent trop (« je t'attendais »). Traité par une consigne négative explicite dans le cadre injecté, puis vérifié en test conversationnel sur Max et Emma.
- Aucune migration de base, aucune modification des conversations, du teaser, du choix du personnage, ni des fonctionnalités hors périmètre.

## 6. Hypothèses et question

Hypothèses retenues :

- L'onboarding s'affiche aussi lorsque la personne déclare avoir déjà vu le film (elle passe le teaser, pas le cadre).
- Le dispositif reste sans nom ; on parle simplement d'« un dispositif de soutien ».
- Textes en français, tutoiement, cohérents avec le ton actuel.
- La mémoire de complétion est locale au navigateur/appareil : sur l'installation partagée, chaque nouvelle personne verra donc le cadre (comportement souhaitable ici).
- Les écrans de rôle et de posture déjà présents mais inactifs restent inchangés, ni supprimés ni réactivés.

Aucune question bloquante. Un seul point à confirmer si tu le souhaites : l'accès « Revoir le contexte » est prévu uniquement sur l'écran de choix du personnage ; dis-moi si tu veux aussi un accès pendant la conversation.

## 7. Vérification des critères d'acceptation

- Lecture unique, rôle non confondu avec un professionnel de santé, origine des informations, absence de nom fictif, absence de formulaire : relecture des trois cartes contre la liste des critères, capture d'écran mobile et tablette.
- Contexte disponible dès le premier tour : vérification sur une session tracée que le cadre est présent dans l'appel au personnage, dans la mémoire et côté Game Master.
- Emma et Max : test conversationnel dédié, on vérifie qu'ils reconnaissent la possibilité du contact sans inventer de relation préalable.
- Non-réaffichage, consultation ultérieure, rafraîchissement et reprise : tests d'écran + parcours manuel.
- Parcours existants : parcours automatisé complet et tests unitaires au vert.
- Extensibilité : le cadre passe par le canal commun à tous les personnages, donc aucun travail spécifique pour un personnage futur.

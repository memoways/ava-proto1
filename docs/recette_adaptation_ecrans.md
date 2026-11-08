# Recette — Adaptation aux écrans (lots 1, 2, 2 bis et 3)

Recette humaine d'Ulrich, **après fusion et synchronisation Lovable**, sur l'URL de recette habituelle
(pas la production sans autorisation). Une case par point ; noter la date, l'appareil exact (modèle,
version iOS/Android/navigateur) et, en cas d'écart, l'identifiant de session (8 premiers caractères) visible
dans l'admin, onglet Sessions.

Classe d'appareil attendue : iPhone et Android → **Smartphone** (appel vocal, sans avatar) ; iPad →
**Tablette** (avatar vidéo, cibles tactiles) ; ordinateur → **Desktop** (inchangé). Forçage possible pour
comparer : `?ecran=telephone`, `?ecran=tablette`, `?ecran=desktop` (gardé dans l'onglet).

Si Max reste muet sur un appareil : lire `error_detail` des tours de la session
(`voice_turn_events`, événement `voice_turn_completed`) avant toute autre piste.

## 1. iPhone — Safari (smartphone)

Date : ____ · Modèle / iOS : ____ · Session : ____

- [ ] Accueil : bouton « Commencer » en bas, pleine largeur, atteignable au pouce.
- [ ] Teaser lu avec le son, **image entière** (bandes noires en portrait, rien de coupé à gauche ni à droite) ;
      « Passer » atteignable (44 px), en bas à droite.
- [ ] « Plein écran ⤢ » (en bas à gauche) : lecteur iOS plein écran, la rotation en paysage montre le film en
      grand ; sortie du plein écran → le film continue ; fin du film → retour à l'expérience.
- [ ] Voix de Max = celle choisie dans Admin › Streaming Avatar › « Services par appareil » › Smartphone
      (session : `audio_latencies.metadata_json.provider` / `model`).
- [ ] Question du film : image entière en pleine largeur, deux réponses en bas.
- [ ] Grille : Max et Emma disponibles, Ava et Léo grisés ; « Revoir la vidéo d'introduction » touchable.
- [ ] Permission micro demandée une seule fois, acceptée ; refus puis nouvel essai : message clair.
- [ ] Appel Max : écran d'appel (vignette ronde, nom, état), **aucune vidéo d'avatar**,
      aucun « Connexion vidéo… ».
- [ ] Coins : « Terminer » en haut à droite, minutage juste dessous ; Emma (capsule de passage) en haut à gauche.
- [ ] **Max audible** en voix seule — appui micro (Démarrer / Arrêter).
- [ ] **Max audible** en mains libres (si activé), à chaque réplique et pas seulement à l'ouverture ;
      interruption possible pendant qu'il parle. (Sur iPhone, la réplique démarre un peu plus tard qu'ailleurs.)
- [ ] Sortie audio : haut-parleur de l'iPhone ✔ · écouteurs filaires / Lightning-USB-C ✔ · Bluetooth (AirPods) ✔.
- [ ] Cinématique : capsule « Une vidéo arrive / Ignorer », vidéo lue plein écran avec le son, retour à l'appel
      et micro rendu ; « Ignorer » touchable.
- [ ] Passage Max → Emma : capsule « Appeler Emma », appel d'Emma, Emma audible ; « Rester avec Max » possible.
- [ ] Raccrocher (« Terminer ») → retour à la grille ; « Terminer l'expérience » → questionnaire.
- [ ] Questionnaire lisible et remplissable au clavier tactile ; fin de l'expérience.
- [ ] Rotation paysage pendant l'appel : l'écran reste l'appel vocal (classe figée).

## 2. Android — Chrome (smartphone)

Date : ____ · Modèle / Android / Chrome : ____ · Session : ____

- [ ] Accueil, teaser (son), question du film, grille : comme l'iPhone.
- [ ] Permission micro (fenêtre Chrome) acceptée ; refus puis nouvel essai : message clair.
- [ ] Appel Max en voix seule, sans avatar ; Max audible (appui micro et mains libres).
- [ ] Sortie audio : haut-parleur ✔ · écouteurs filaires / USB-C ✔ · Bluetooth ✔.
- [ ] Cinématique lue et « Ignorer » touchable.
- [ ] Passage Max → Emma, Emma audible ; raccrocher → grille.
- [ ] Questionnaire et fin.

## 3. iPad — Safari (tablette)

Date : ____ · Modèle / iPadOS : ____ · Session : ____

À faire en **portrait et en paysage** (choisir l'orientation avant « Commencer » : la classe et la mise en
page ne changent pas en cours d'appel).

- [ ] Accueil, teaser (son, « Passer » 44 px), question du film, grille : rien ne déborde, tout est touchable.
- [ ] Navigateur : **Safari** (pas Brave ni Chrome iOS). Permission micro acceptée ; « Activer le micro » fonctionne.
      En cas d'échec, noter le titre du message (« Micro refusé », « Micro occupé »…) et la session.
- [ ] Appel Max : **avatar vidéo connecté** (badge « Connexion vidéo… » puis visage animé) ; visage non masqué
      par les capsules ni par « Terminer ».
- [ ] « Touche pour parler » ; bouton micro, « Terminer », « Ignorer », « Appeler Emma », « Rester avec Max »
      touchables du premier coup.
- [ ] Bouton micro visible en bas même avec la barre d'adresse Safari affichée (`100svh`).
- [ ] Max audible : appui micro et mains libres ; synchronisation lèvres / voix correcte.
- [ ] Sortie audio : haut-parleur ✔ · écouteurs ✔ · Bluetooth ✔.
- [ ] Cinématique lue (plein écran, son), retour à l'avatar.
- [ ] Passage Max → Emma (portrait d'Emma, sans flux de Max), Emma audible ; raccrocher → grille.
- [ ] Questionnaire et fin.

## 4. Desktop — Chrome (sans paramètre)

Date : ____ · OS / Chrome : ____ · Session : ____

- [ ] Parcours identique à avant les lots écrans : accueil, teaser, film, grille.
- [ ] Appel Max : **avatar Anam connecté comme avant**, « Clique pour parler », barre Espace fonctionnelle.
- [ ] Cinématique, passage Max ↔ Emma, raccrocher, questionnaire : inchangés.

## 5. Latences par appareil (admin)

Date : ____

- [ ] Admin → Sessions, filtre « Appareil » : les quatre sessions ci-dessus avec la bonne classe
      (iPhone et Android = Smartphone, iPad = Tablette, ordinateur = Desktop).
- [ ] Admin → Latences, dimension « Appareil » : comparaison smartphone / tablette / desktop
      (fin de parole → premier son). Écarts notables : ____
- [ ] PostHog : `device_class` présent sur `prd4_session_started` (et `output_mode_reason = device_smartphone`
      pour les smartphones).

## Signature

Recette complète : [ ] oui [ ] non — défauts restants : ____

Ulrich Fischer, le ____

# Plan — rappel sortant de Max à Soleure

Date : 12 novembre 2026. **Plan préparé ; étude complète, achats et prototype non lancés.**
[Tâche Notion Gamilab](https://app.notion.com/p/c86fb8274ff046908d28ae6ba4c1bdca) ·
[Plan multilingue Ava](plan_multilingue_ava.md) ·
[Prompt autonome de reprise](prompt_reprise_rappel_sortant_max_lot_1.md).

## Premier prompt à utiliser plus tard

**Modèle conseillé :** un modèle généraliste récent capable de raisonner sur une architecture,
de lire un dépôt et de comparer des documentations techniques, avec un niveau de raisonnement
élevé s'il est proposé. Ce prompt convient à Cursor, Codex ou Claude ; aucun modèle précis
n'est imposé.

> Reprendre l'étude du rappel sortant de Max pour Soleure. Lire d'abord
> `docs/plan_rappel_sortant_max.md`, `docs/etat_courant.md`, `docs/plan_multilingue_ava.md`, la
> tâche Notion liée dans le plan et les instructions `AGENTS.md`. Vérifier l'état courant du
> dépôt et la cible Gamilab pour Notion.
>
> Objectif : vérifier la faisabilité d'une file commune web et rappels, puis d'une conversation
> complète avec Max par WhatsApp ou téléphone classique, en français, allemand standard ou
> anglais. Respecter les décisions d'expérience, les contraintes de forfait, d'itinérance, de
> consentement, de confidentialité et la chaîne Lovable / Lovable Cloud documentées dans le plan.
> Le plan multilingue prévoit l'anglais pilote en sandbox avant ouverture publique : vérifier
> cette dépendance sans supposer qu'il est déjà disponible.
>
> Première action : vérifier les sources et l'état du projet, puis établir les inconnues
> techniques et commerciales encore ouvertes. Comparer Twilio et Telnyx avec leurs documentations
> et tarifs actuels ; vérifier la compatibilité du flux audio avec WhatsApp et Lovable Cloud,
> les numéros et destinations possibles et le coût complet. Distinguer faits vérifiés, hypothèses
> et éléments nécessitant une confirmation fournisseur.
>
> Résultat attendu : actualiser le plan avec une architecture argumentée, des scénarios de coût,
> les limites et une recommandation explicite sur l'intérêt d'un prototype et ses critères de
> réussite. Poser à Ulrich les questions qui changent réellement cette décision. Aucun achat,
> souscription, prototype, changement de la base Caractères ou déploiement n'est autorisé par
> ce prompt. Si un prochain lot est identifié à la clôture, préparer son prompt autonome et
> actualiser le plan conformément aux instructions du dépôt. Distinguer livraison technique
> et recette humaine.

## Expérience souhaitée

Après le film, une place libre permet de commencer sur le web. Si toutes les places sont
occupées, la personne choisit d'attendre sur le site, de revenir plus tard ou de demander
un rappel WhatsApp ou téléphonique. Une alternative sans numéro reste disponible.

Pour être rappelée, elle choisit sa langue, son canal et une durée de disponibilité limitée
à la journée ; elle peut annuler. À son tour, elle reçoit un appel et confirme vocalement
qu'elle est prête, puis converse directement avec Max dans la situation narrative d'Ava,
avec le contexte déjà choisi. L'appel reste possible si elle quitte Soleure ou ferme le site.
Un lien de retour permet de refaire une demande ou de rejoindre le web si possible.

Une file commune sert les demandes web et téléphone par ordre d'arrivée, avec réservation
temporaire. Dix conversations simultanées partagées sont une hypothèse réglable, à mesurer.
Un appel manqué donne lieu à un seul nouvel essai ; la durée de conversation est configurable,
annoncée et assortie d'une fin narrative douce. Les numéros internationaux sont acceptés
selon les destinations et tarifs contrôlés. Le numéro ne sert qu'au rappel et à son nouvel
essai, puis est supprimé après un délai technique court à définir.

Le parcours vise français, allemand standard et anglais. Le [plan multilingue](plan_multilingue_ava.md)
prévoit FR et DE publics à Soleure, l'anglais d'abord en sandbox puis ouvert après recette :
cette dépendance doit être prise en compte. Les accents suisses demandent une recette ;
la compréhension de tous les dialectes n'est pas promise. Langue fixe par session.

## Architecture candidate, pas encore validée

- **Ava / Lovable Cloud** : file et capacité partagées, réservation, expiration, annulation,
  données minimales, consentement et suppression ; opérations sensibles côté serveur.
- **Téléphonie** : comparer Twilio Programmable Voice / WhatsApp Business Calling à Telnyx.
  Twilio est un candidat de référence pour étudier les deux canaux, pas un fournisseur choisi.
- **Audio** : étudier un pont bidirectionnel entre l'appel et le moteur Ava en conservant Max,
  le contexte et les règles de parole. [Twilio documente ses flux bidirectionnels](https://www.twilio.com/docs/voice/media-streams) ;
  l'usage exact avec WhatsApp et l'hébergement compatible Lovable restent à confirmer.
- **Langues** : respecter le plan multilingue, transmettre la langue au STT, au modèle et au
  TTS, adapter l'accueil et l'interface, puis valider la qualité de jeu et de voix par écoute
  humaine. Des paramètres actuels sont français par défaut : ce n'est pas déjà opérationnel.
- **Numéro** : privilégier un numéro dédié reconnaissable, sous réserve de disponibilité, de
  justificatifs et de compatibilité. Pour WhatsApp, numéro professionnel activé et permission
  préalable d'appel dans WhatsApp sont nécessaires ; vérifier les conditions de messagerie et
  les restrictions au moment de la reprise. [Documentation Twilio](https://www.twilio.com/docs/voice/whatsapp-business-calling).

## Premiers repères de coût — à revalider

Tarifs consultés le 12 novembre 2026, en dollars américains, sans taxes ni garantie de prix :

| Canal, numéro suisse | Coût indicatif pour 10 minutes | Non compris |
| --- | --- | --- |
| Téléphone vers mobile suisse | 1,802 $ de communication + 0,044 $ de Media Streams, soit **1,846 $** | STT, modèle, TTS, numéro et autres frais ; le tarif varie notamment selon destination et origine. [Twilio Suisse](https://www.twilio.com/en-us/voice/pricing/ch) |
| WhatsApp sortant vers numéro suisse | 0,050 $ de canal Twilio + 0,103 $ de connexion Meta, soit **0,153 $** | Messages, flux audio éventuel, STT, modèle, TTS et autres frais. [Tarifs WhatsApp](https://www.twilio.com/en-us/whatsapp/pricing) |

Ces chiffres ne sont pas des coûts complets ni des devis. L'étude comparera plusieurs durées,
volumes et destinations, appels manqués, frais fixes et plafonds de dépense. Informer les
personnes que l'itinérance et les données mobiles peuvent être facturées selon leur forfait :
ne pas promettre la gratuité. [OFCOM : roaming](https://www.bakom.admin.ch/en/roaming-en).

## Étude et décision à réaliser plus tard

1. Confirmer auprès de Lovable la faisabilité et les limites du pont temps réel ; confirmer
   chez les fournisseurs la compatibilité WhatsApp, le numéro, les pays et les tarifs.
2. Comparer attente web, réessai manuel et rappel selon l'expérience, les temps d'attente,
   les forfaits et les coûts ; établir des scénarios réalistes de fréquentation à Soleure.
3. Préciser les réservations et expirations, les messageries vocales, la confirmation vocale,
   le retour web, la suppression des données et la prévention des appels abusifs. Une
   confirmation vocale ne garantit pas la détection d'une messagerie.
4. Définir une recette : charge à dix conversations, appels manqués et interruptions, numéros
   étrangers, absence de numéro, trois langues et écoute humaine de Max.
5. Sur ces éléments, recommander ou non un prototype et ses critères de réussite. Cette
   préparation n'autorise ni achat, ni développement, ni publication. La base Caractères
   Notion reste en lecture seule.

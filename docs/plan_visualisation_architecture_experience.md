# Plan — visualisation de l’architecture et d’un tour conversationnel

## Objectif

Ajouter dans l’admin, sous le groupe **Expérience**, un panneau pédagogique qui
explique fidèlement la construction du prototype PRD4 et la mécanique réelle
d’un tour de conversation.

## Périmètre

1. Ajouter l’entrée `Comment ça marche` au groupe de navigation `Expérience`.
2. Créer une vue `ExperienceArchitectureTab` avec deux schémas interactifs :
   - une architecture en couches (interface, runtime navigateur, Lovable Cloud,
     services externes), filtrable par flux et détaillable composant par
     composant ;
   - un pas-à-pas d’un tour PRD4 séparant le chemin critique de la réponse et
     les travaux asynchrones qui préparent le tour suivant.
3. Illustrer chaque étape avec ses entrées, son traitement, ses sorties, un
   exemple concret et ses points de résilience.
4. Brancher la vue dans `Admin.tsx`, sans modifier la chaîne Lovable / Lovable
   Cloud ni ajouter de dépendance.
5. Couvrir la navigation et les interactions principales par des tests unitaires,
   puis vérifier le build Lovable-compatible existant (`npm run build`).

## Sources de vérité techniques

- `src/pages/IndexPRD4.tsx` pour le cycle UI, STT, restitution et application
  des décisions.
- `src/services/prd4Orchestrator.ts` pour le RAG, Max, le directeur post-tour,
  la mémoire et les traces.
- `src/services/ragService.ts`, les façades `src/services/stt` et
  `src/services/tts`, ainsi que `src/services/streamingAvatar` pour les services.
- `supabase/functions` et `src/integrations/supabase/types.ts` pour Lovable
  Cloud, les Edge Functions et les données persistées.

## Critères de validation

- Le panneau est accessible par `/admin?tab=architecture` et sélectionne le
  groupe `Expérience`.
- Les deux schémas sont utilisables au clavier et sur tablette/mobile.
- Un clic sur un composant ou une étape met à jour une explication précise.
- Le schéma distingue explicitement ce qui bloque la réponse vocale de ce qui
  s’exécute en arrière-plan.
- Les tests ciblés et le build passent sans configuration de déploiement externe.

## Résultat

- Implémentation terminée dans `src/components/ExperienceArchitectureTab.tsx`.
- Navigation et interactions couvertes par 5 assertions de scénario ciblées.
- Suite unitaire complète : 59 fichiers, 235 tests passés.
- Build Vite de production passé, sans modification de la chaîne Lovable.

# Vérification lecture seule — publication et sync-notion (17 oct 2026)

Aucun changement à appliquer. Ce document consigne seulement les constats.

## Constats
- Site : publié, visibilité publique. Statut et heure UTC du déploiement c7cecce8-fcec-4ab2-8019-1cc42445c63e : je ne peux pas les lire avec mes outils de lecture.
- sync-notion en ligne : version, updated_at et code servi ne sont pas lisibles. Aucun journal d'exécution ni de requête trouvé. Un OPTIONS renvoie 200 : la fonction existe, mais ça ne dit rien de son contenu.
- Source locale : HEAD f0cfcac contient ac12d1a, sans diff sur supabase/functions depuis. chunkNotionPage est importé (l.14) et appelé (l.653), et editorial_oversized est rapporté (l.696).

## Conclusion
Le code en production n'est pas prouvé. Il faudrait les métadonnées de déploiement de la fonction, ou un appel réel de sync-notion, qui est exclu ici.

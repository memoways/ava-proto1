# Instructions de plateforme — Ava Proto 1

## Chaîne de développement et de publication (obligatoire)

**Lovable est la plateforme de référence et l'unique chaîne de livraison de ce projet.**

- Lovable compile le code et publie le site.
- Le backend, la base de données, les Edge Functions et les secrets sont gérés dans **Lovable Cloud**, avec **Supabase fourni par Lovable**.
- Ne pas configurer ni substituer une chaîne de build, un hébergeur, un projet Supabase ou un déploiement externe (Vercel, Netlify, Supabase hors Lovable, etc.).
- Toute modification réalisée depuis un autre environnement doit rester compatible avec Lovable et être ramenée dans le projet Lovable avant validation ou publication. Elle ne constitue pas un déploiement autonome.
- Avant toute action qui touche au build, aux variables d'environnement, aux migrations, aux Edge Functions ou à la publication, vérifier qu'elle cible bien Lovable / Lovable Cloud.

Ces règles s'appliquent à toute personne, agent et outil intervenant sur ce dépôt.

# MAILLE — Déploiement du prototype public

Ce prototype permet à n'importe quel visiteur de créer un compte ("factory retailer"),
et d'entrer/suivre/modifier/fermer des styles. Chaque compte est isolé des autres
(un visiteur ne voit jamais les données d'un autre).

## Étape 1 — Créer le projet Supabase (5 min)

1. Va sur https://supabase.com et crée un compte gratuit.
2. "New project" → choisis un nom (ex: maille-prototype), un mot de passe de base
   de données (à garder de côté, tu n'en auras pas besoin au quotidien), et une région
   proche de tes futurs utilisateurs (Europe si tes prospects sont en zone Europe/Afrique).
3. Attends 1-2 min que le projet soit prêt.

## Étape 2 — Exécuter le schéma de base de données

1. Dans le tableau de bord Supabase, ouvre **SQL Editor** (menu de gauche).
2. Clique sur **New query**.
3. Colle tout le contenu du fichier `supabase-schema.sql` fourni.
4. Clique sur **Run**. Tu dois voir "Success. No rows returned".

## Étape 3 — Récupérer tes clés API

1. Va dans **Project Settings** (icône engrenage) → **API**.
2. Copie :
   - **Project URL** (ressemble à `https://xxxxx.supabase.co`)
   - **anon public key** (une longue chaîne de caractères)
3. Ouvre le fichier `config.js` fourni et remplace les deux valeurs :

```js
window.MAILLE_CONFIG = {
  SUPABASE_URL: "https://xxxxx.supabase.co",
  SUPABASE_ANON_KEY: "colle-ta-cle-anon-ici"
};
```

⚠️ Ne mets jamais la clé "service_role" ici — seule la clé "anon public" est
faite pour être exposée côté client.

## Étape 4 — (Recommandé pour un test rapide) Désactiver la confirmation e-mail

Par défaut Supabase envoie un e-mail de confirmation avant de laisser un compte se connecter.
Pour que tes premiers testeurs puissent essayer l'outil sans friction :

1. **Authentication** → **Providers** → **Email**.
2. Désactive **"Confirm email"**.
3. Sauvegarde.

Tu pourras réactiver ça plus tard si tu ouvres l'inscription à plus large échelle.

## Étape 5 — Déployer sur Netlify

**Option la plus rapide (glisser-déposer, aucun compte GitHub requis) :**

1. Va sur https://app.netlify.com/drop
2. Glisse le dossier contenant `index.html`, `style.css`, `app.js`, `config.js`
   (avec tes clés déjà remplies) directement dans la zone de dépôt.
3. Netlify génère une URL publique en quelques secondes (ex: `random-name-123.netlify.app`).
4. Optionnel : dans **Site settings > Change site name**, choisis un nom plus lisible,
   ex: `maille-prototype.netlify.app`.

**Option recommandée à moyen terme (déploiement continu via GitHub) :**

1. Crée un dépôt GitHub et pousse ces fichiers dedans.
2. Sur Netlify : **Add new site > Import an existing project** → connecte le dépôt.
3. Pas de build command nécessaire (site 100% statique) — laisse "Build command" vide
   et "Publish directory" sur `.` (racine).
4. Chaque futur changement poussé sur GitHub redéploie automatiquement.

## Étape 6 — Tester

1. Ouvre ton URL Netlify.
2. Crée un compte test avec un nom d'usine fictif.
3. Ajoute un style, change son statut, ferme-le.
4. Ouvre un onglet de navigation privée et crée un deuxième compte avec un autre
   nom d'usine — vérifie que tu ne vois PAS les styles du premier compte.
   C'est la preuve que l'isolation multi-tenant fonctionne.

## Limites connues de ce prototype (à garder en tête)

- Inscription publique ouverte à tous — un bot pourrait créer des comptes en masse.
  Pas grave pour une phase de test, à surveiller si tu partages le lien largement.
- Pas encore d'espace "Super admin" pour toi (lister/gérer les organisations) —
  prochaine étape naturelle une fois le test validé.
- Pas encore d'alertes automatiques par e-mail sur les retards.
- Pas de calendrier TNA détaillé (étapes multiples par commande) — seulement le
  statut global du style, contrairement à la démo commerciale complète.

## Prochaine étape suggérée

Une fois que 2-3 personnes de confiance ont testé sans bug bloquant, on pourra
ajouter l'espace admin et la vue "acheteur" en lecture seule.

# MAILLE — Configuration des alertes e-mail sur retard

Cette fonctionnalité envoie un e-mail à tous les utilisateurs d'une organisation
dès qu'une étape TNA de l'une de leurs commandes passe en retard.

Contrairement au reste du prototype (front-end statique déployé sur Netlify),
ceci nécessite un petit composant serveur — la logique "vérifier si une date est
dépassée et prévenir quelqu'un" doit tourner même quand personne n'a le site
ouvert dans son navigateur. C'est le rôle d'une Edge Function Supabase.

## Étape 1 — Créer un compte Resend (service d'envoi d'e-mails)

1. Va sur https://resend.com et crée un compte gratuit (100 e-mails/jour offerts,
   largement suffisant pour un prototype).
2. Dans **API Keys**, crée une clé et copie-la (tu en auras besoin à l'étape 4).
3. Pour commencer sans configurer de domaine, tu peux envoyer depuis
   `onboarding@resend.dev` (adresse de test fournie par Resend) — pratique pour
   valider que tout fonctionne avant de configurer ton propre nom de domaine.

## Étape 2 — Installer la CLI Supabase (une seule fois)

Sur ta machine, dans un terminal :

```bash
npm install -g supabase
supabase login
```

Ça ouvre une page de connexion dans ton navigateur.

## Étape 3 — Lier ton projet et déployer la fonction

Depuis le dossier qui contient `supabase/functions/send-late-alert/` :

```bash
supabase link --project-ref TON-PROJECT-REF
```

(Le "project ref" est visible dans l'URL de ton projet Supabase, ou dans
Project Settings > General.)

```bash
supabase functions deploy send-late-alert
```

Ça te donne une URL du type :
`https://TON-PROJECT-REF.supabase.co/functions/v1/send-late-alert`
— garde-la, elle sert à l'étape 5.

## Étape 4 — Configurer les variables secrètes

Toujours en ligne de commande :

```bash
supabase secrets set RESEND_API_KEY=ta_cle_resend
supabase secrets set ALERT_FROM_EMAIL="MAILLE <onboarding@resend.dev>"
```

`SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont normalement déjà disponibles
automatiquement dans l'environnement des Edge Functions Supabase — pas besoin de
les définir toi-même, sauf si `supabase functions deploy` te signale le contraire.

## Étape 5 — Créer le Database Webhook

C'est le déclencheur : dès qu'une ligne de `tna_steps` est modifiée, Supabase
appelle automatiquement ta fonction.

1. Dans le tableau de bord Supabase : **Database** > **Webhooks** > **Create a new hook**.
2. Nom : `alerte-retard-tna`
3. Table : `tna_steps`
4. Events : coche uniquement **Update**
5. Type : **HTTP Request**
6. Method : **POST**
7. URL : colle l'URL de ta fonction obtenue à l'étape 3
8. Headers : ajoute
   - `Authorization: Bearer TA_CLE_SERVICE_ROLE` (Project Settings > API > service_role — à garder secrète, jamais dans le front-end)
   - `Content-Type: application/json`
9. Sauvegarde.

## Étape 6 — Tester

1. Ouvre ton site MAILLE, va dans le calendrier TNA d'une commande.
2. Mets une date prévue dans le passé sur une étape (sans date réelle) pour
   déclencher le passage automatique en "En retard".
3. Vérifie ta boîte mail (celle du compte utilisé pour créer la commande) —
   l'alerte doit arriver en quelques secondes.
4. Si rien n'arrive : Supabase > **Edge Functions** > `send-late-alert` > **Logs**
   te montre les erreurs exactes (clé API invalide, destinataire manquant, etc.)

## Limites actuelles à connaître

- Un e-mail est envoyé à **tous** les utilisateurs de l'organisation concernée,
  pas seulement à un responsable désigné — à affiner plus tard si besoin
  (ex: un champ "recevoir les alertes" par utilisateur).
- Pas de regroupement — si 3 étapes basculent en retard le même jour, ça fait
  3 e-mails séparés plutôt qu'un résumé quotidien. Acceptable pour un prototype,
  à revoir si le volume de commandes grandit.
- Nécessite que le domaine d'envoi soit vérifié sur Resend pour sortir du mode
  test (`onboarding@resend.dev` fonctionne mais ressemble moins pro dans la
  boîte mail du destinataire).

// MAILLE — Edge Function : envoi d'alerte e-mail sur retard TNA
// Déclenchée par un Database Webhook Supabase sur la table tna_steps (UPDATE)
//
// Logique : n'envoie un e-mail QUE lorsque le statut PASSE à "late"
// (transition), jamais à chaque sauvegarde — pour éviter le spam.

import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FROM_EMAIL = Deno.env.get("ALERT_FROM_EMAIL") || "MAILLE <onboarding@resend.dev>";

serve(async (req) => {
  try {
    const payload = await req.json();
    const record = payload.record;
    const oldRecord = payload.old_record;

    // On n'alerte que sur la transition vers "late", pas à chaque update
    if (!record || record.status !== "late" || (oldRecord && oldRecord.status === "late")) {
      return new Response(JSON.stringify({ skipped: true }), { status: 200 });
    }

    const headers = {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json"
    };

    // Récupérer la commande + le client lié
    const styleRes = await fetch(
      `${SUPABASE_URL}/rest/v1/styles?id=eq.${record.style_id}&select=style_ref,style_name,org_id,clients(name)`,
      { headers }
    );
    const styles = await styleRes.json();
    const style = styles[0];
    if (!style) return new Response(JSON.stringify({ error: "style introuvable" }), { status: 200 });

    // Récupérer les profils (utilisateurs) de l'organisation concernée
    const profilesRes = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?org_id=eq.${style.org_id}&select=id`,
      { headers }
    );
    const profiles = await profilesRes.json();

    // Récupérer les e-mails via l'API admin auth (le service role peut lire auth.users)
    const emails: string[] = [];
    for (const p of profiles) {
      const userRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${p.id}`, { headers });
      if (!userRes.ok) continue;
      const user = await userRes.json();
      if (user?.email) emails.push(user.email);
    }

    if (emails.length === 0) {
      return new Response(JSON.stringify({ skipped: "no recipients" }), { status: 200 });
    }

    const clientName = style.clients?.name || "—";
    const subject = `MAILLE — Retard détecté : ${style.style_ref}`;
    const html = `
      <p>Une étape est passée en retard sur la commande <b>${style.style_ref} — ${style.style_name}</b> (client : ${clientName}).</p>
      <p><b>Étape concernée :</b> ${record.step_name}<br/>
      <b>Date prévue :</b> ${record.planned_date}</p>
      <p>Connecte-toi à MAILLE pour mettre à jour le statut de cette commande.</p>
    `;

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: emails,
        subject,
        html
      })
    });

    const emailResult = await emailRes.json();
    return new Response(JSON.stringify({ sent: true, to: emails, resend: emailResult }), { status: 200 });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});

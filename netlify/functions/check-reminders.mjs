/* ============================================
   NETLIFY SCHEDULED FUNCTION — check-reminders
   Roda a cada minuto via cron do Netlify.
   Verifica lembretes vencidos e envia push notifications.
   ============================================ */

import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL = process.env.VAPID_EMAIL || 'mailto:giovannemarinho305@gmail.com';

webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

export default async (req) => {
    try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

        // Busca notas com reminder_at <= agora
        const now = new Date().toISOString();
        const { data: dueNotes, error: notesErr } = await supabase
            .from('notes')
            .select('id, user_id, title, reminder_at')
            .lte('reminder_at', now)
            .not('reminder_at', 'is', null);

        if (notesErr) throw notesErr;
        if (!dueNotes || dueNotes.length === 0) {
            return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
        }

        let totalSent = 0;
        const expiredEndpoints = [];

        // Agrupa por user_id
        const userNotes = {};
        for (const note of dueNotes) {
            if (!userNotes[note.user_id]) userNotes[note.user_id] = [];
            userNotes[note.user_id].push(note);
        }

        for (const [userId, notes] of Object.entries(userNotes)) {
            // Busca subscriptions do usuário
            const { data: subs } = await supabase
                .from('push_subscriptions')
                .select('endpoint, p256dh, auth')
                .eq('user_id', userId);

            if (!subs || subs.length === 0) continue;

            for (const note of notes) {
                const payload = JSON.stringify({
                    title: '🔔 Lembrete',
                    body: note.title,
                    tag: `reminder-${note.id}`,
                    noteId: note.id,
                    url: '/'
                });

                for (const sub of subs) {
                    try {
                        await webpush.sendNotification(
                            {
                                endpoint: sub.endpoint,
                                keys: { p256dh: sub.p256dh, auth: sub.auth }
                            },
                            payload
                        );
                        totalSent++;
                    } catch (pushErr) {
                        console.error(`Push falhou para ${sub.endpoint}:`, pushErr.message);
                        if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
                            expiredEndpoints.push(sub.endpoint);
                        }
                    }
                }

                // Limpa o reminder_at da nota
                await supabase
                    .from('notes')
                    .update({ reminder_at: null })
                    .eq('id', note.id);
            }
        }

        // Remove subscriptions expiradas
        if (expiredEndpoints.length > 0) {
            await supabase
                .from('push_subscriptions')
                .delete()
                .in('endpoint', expiredEndpoints);
        }

        return new Response(
            JSON.stringify({ sent: totalSent, expired: expiredEndpoints.length }),
            { status: 200 }
        );
    } catch (err) {
        console.error('Erro check-reminders:', err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
};

// Schedule: roda a cada hora (minuto 0)
export const config = {
    schedule: "0 * * * *"
};

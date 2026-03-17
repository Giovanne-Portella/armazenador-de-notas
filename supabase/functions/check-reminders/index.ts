/* ============================================
   SUPABASE EDGE FUNCTION — check-reminders
   Verifica lembretes vencidos e envia push notifications
   
   Deploy: supabase functions deploy check-reminders
   Schedule: pg_cron a cada 1 minuto
   ============================================ */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const VAPID_SUBJECT = 'mailto:giovannemarinho305@gmail.com';
const VAPID_PUBLIC_KEY = 'BJQ4EfqeDCPJz9w_4PswZbx4UgyfbprT6zzbQ5MtjreXsbKoraMCtLVbjU33uqMmPG5w84D4_py7zqa7vVBxcIE';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');

// ---- Web Push helpers (JWT + ECDSA P-256) ----

function base64UrlEncode(data) {
    const base64 = btoa(String.fromCharCode(...new Uint8Array(data)));
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    const pad = str.length % 4;
    if (pad) str += '='.repeat(4 - pad);
    const binary = atob(str);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

async function importVapidKey(privateKeyBase64) {
    const rawKey = base64UrlDecode(privateKeyBase64);
    return crypto.subtle.importKey(
        'pkcs8',
        await buildPkcs8FromRaw(rawKey),
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign']
    );
}

async function buildPkcs8FromRaw(rawKey) {
    // Raw VAPID private key is 32 bytes (the `d` parameter of EC P-256)
    // We need to wrap it in PKCS#8 ASN.1 structure
    const pkcs8Header = new Uint8Array([
        0x30, 0x81, 0x87, 0x02, 0x01, 0x00, 0x30, 0x13,
        0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02,
        0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d,
        0x03, 0x01, 0x07, 0x04, 0x6d, 0x30, 0x6b, 0x02,
        0x01, 0x01, 0x04, 0x20
    ]);
    const pkcs8Footer = new Uint8Array([
        0xa1, 0x44, 0x03, 0x42, 0x00
    ]);
    // We need the public key for the footer. Generate from private.
    // For now, we'll use JWK import instead.
    // Let's use JWK approach which is simpler.
    throw new Error('use JWK approach');
}

async function importVapidKeyJwk(privateKeyBase64, publicKeyBase64) {
    const d = privateKeyBase64;
    // Convert uncompressed public key (65 bytes: 04 || x || y) to x, y
    const pubBytes = base64UrlDecode(publicKeyBase64);
    const x = base64UrlEncode(pubBytes.slice(1, 33));
    const y = base64UrlEncode(pubBytes.slice(33, 65));

    return crypto.subtle.importKey(
        'jwk',
        { kty: 'EC', crv: 'P-256', d, x, y },
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign']
    );
}

async function createVapidJwt(endpoint, privateKey) {
    const origin = new URL(endpoint).origin;
    const now = Math.floor(Date.now() / 1000);
    const header = { typ: 'JWT', alg: 'ES256' };
    const payload = { aud: origin, exp: now + 43200, sub: VAPID_SUBJECT };

    const headerB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
    const payloadB64 = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
    const unsigned = `${headerB64}.${payloadB64}`;

    const signature = await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        privateKey,
        new TextEncoder().encode(unsigned)
    );

    // Convert DER signature to raw r||s (64 bytes)
    const sigBytes = new Uint8Array(signature);
    let r, s;
    if (sigBytes[0] === 0x30) {
        // DER encoded
        const rLen = sigBytes[3];
        const rStart = 4;
        r = sigBytes.slice(rStart, rStart + rLen);
        const sLen = sigBytes[rStart + rLen + 1];
        const sStart = rStart + rLen + 2;
        s = sigBytes.slice(sStart, sStart + sLen);
        // Remove leading zero padding
        if (r.length > 32) r = r.slice(r.length - 32);
        if (s.length > 32) s = s.slice(s.length - 32);
        // Pad to 32 bytes
        if (r.length < 32) { const p = new Uint8Array(32); p.set(r, 32 - r.length); r = p; }
        if (s.length < 32) { const p = new Uint8Array(32); p.set(s, 32 - s.length); s = p; }
        const rawSig = new Uint8Array(64);
        rawSig.set(r, 0);
        rawSig.set(s, 32);
        return `${unsigned}.${base64UrlEncode(rawSig)}`;
    } else {
        // Already raw
        return `${unsigned}.${base64UrlEncode(signature)}`;
    }
}

async function sendWebPush(subscription, payload, privateKey) {
    const jwt = await createVapidJwt(subscription.endpoint, privateKey);
    const vapidPublicKeyBase64Url = VAPID_PUBLIC_KEY;

    const response = await fetch(subscription.endpoint, {
        method: 'POST',
        headers: {
            'Authorization': `vapid t=${jwt}, k=${vapidPublicKeyBase64Url}`,
            'Content-Type': 'application/json',
            'Content-Encoding': 'identity',
            'TTL': '86400'
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const text = await response.text();
        console.error(`Push falhou (${response.status}):`, text);
        // 410 Gone = subscription expirou, pode deletar
        if (response.status === 410 || response.status === 404) {
            return { expired: true };
        }
    }
    return { expired: false };
}

// ---- Main handler ----

Deno.serve(async (req) => {
    try {
        if (!VAPID_PRIVATE_KEY) {
            return new Response(JSON.stringify({ error: 'VAPID_PRIVATE_KEY not set' }), { status: 500 });
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

        // Importa chave VAPID
        const privateKey = await importVapidKeyJwk(VAPID_PRIVATE_KEY, VAPID_PUBLIC_KEY);

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
                const payload = {
                    title: '🔔 Lembrete',
                    body: note.title,
                    tag: `reminder-${note.id}`,
                    noteId: note.id,
                    url: '/'
                };

                for (const sub of subs) {
                    const result = await sendWebPush(
                        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                        payload,
                        privateKey
                    );
                    if (result.expired) {
                        expiredEndpoints.push(sub.endpoint);
                    } else {
                        totalSent++;
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
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );

    } catch (err) {
        console.error('Erro:', err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
});

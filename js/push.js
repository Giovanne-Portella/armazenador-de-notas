/* ============================================
   PUSH — Gerenciamento de Push Notifications
   Web Push API + salva subscription no Supabase
   ============================================ */

import { supabase } from './supabase.js';

const VAPID_PUBLIC_KEY = 'BJQ4EfqeDCPJz9w_4PswZbx4UgyfbprT6zzbQ5MtjreXsbKoraMCtLVbjU33uqMmPG5w84D4_py7zqa7vVBxcIE';

/**
 * Converte base64url para Uint8Array (necessário para applicationServerKey)
 */
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

/**
 * Registra Service Worker e inscreve para Push Notifications.
 * Salva a subscription no Supabase para envio server-side.
 */
export async function initPushNotifications() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.log('[Push] Push notifications não suportadas neste browser');
        return;
    }

    try {
        // Registra o Service Worker
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('[Push] Service Worker registrado');

        // Pede permissão
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            console.log('[Push] Permissão de notificação negada');
            return;
        }

        // Verifica se já tem subscription
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
            // Cria nova subscription
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
            });
            console.log('[Push] Nova subscription criada');
        }

        // Salva no Supabase
        await saveSubscription(subscription);
        console.log('[Push] Subscription salva no Supabase');

    } catch (err) {
        console.error('[Push] Erro ao configurar push:', err);
    }
}

/**
 * Salva ou atualiza a subscription no Supabase
 */
async function saveSubscription(subscription) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const sub = subscription.toJSON();
    const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
            user_id: user.id,
            endpoint: sub.endpoint,
            p256dh: sub.keys.p256dh,
            auth: sub.keys.auth,
            updated_at: new Date().toISOString()
        }, { onConflict: 'endpoint' });

    if (error) console.error('[Push] Erro ao salvar subscription:', error);
}

/* ============================================
   PUSH — Gerenciamento de Push Notifications
   Web Push API + Median.co native push
   ============================================ */

import { supabase } from './supabase.js';
import { showToast } from './utils.js';

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
 * Detecta em que ambiente estamos e registra push da forma correta
 */
export async function initPushNotifications() {
    const isMedian = !!(window.median || window.gonative);

    // Tenta registrar via Median native push (OneSignal/FCM)
    if (isMedian) {
        try {
            await initMedianPush();
            return;
        } catch (e) {
            console.warn('[Push] Median push falhou, tentando Web Push:', e.message);
        }
    }

    // Tenta Web Push API (browsers normais)
    await initWebPush();
}

/**
 * Push via Median.co native bridge (usa OneSignal/Firebase do Median)
 */
async function initMedianPush() {
    const bridge = window.median || window.gonative;

    // Median.co registra push automaticamente se o plugin estiver ativado.
    // O que precisamos é obter o push token (registration ID / OneSignal player ID).
    // Median usa: median.onesignal.getPlayerId ou gonative.onesignal.getPlayerId

    if (bridge?.onesignal?.getPlayerId) {
        return new Promise((resolve, reject) => {
            window._pushTokenCallback = async function(data) {
                delete window._pushTokenCallback;
                if (data?.playerId) {
                    await savePushToken('onesignal', data.playerId);
                    resolve();
                } else {
                    reject(new Error('Sem playerId'));
                }
            };
            bridge.onesignal.getPlayerId({ callback: '_pushTokenCallback' });
            // Timeout
            setTimeout(() => { delete window._pushTokenCallback; reject(new Error('timeout')); }, 5000);
        });
    }

    // Tenta obter registration info genérico
    if (bridge?.registration?.getInfo) {
        return new Promise((resolve, reject) => {
            window._pushRegCallback = async function(data) {
                delete window._pushRegCallback;
                const token = data?.oneSignalUserId || data?.oneSignalPushToken || data?.fcmToken;
                if (token) {
                    await savePushToken('fcm', token);
                    resolve();
                } else {
                    reject(new Error('Sem token: ' + JSON.stringify(data)));
                }
            };
            bridge.registration.getInfo({ callback: '_pushRegCallback' });
            setTimeout(() => { delete window._pushRegCallback; reject(new Error('timeout')); }, 5000);
        });
    }

    throw new Error('Nenhuma API de push nativa no bridge');
}

/**
 * Push via Web Push API (browsers com suporte a ServiceWorker + PushManager)
 */
async function initWebPush() {
    if (!('serviceWorker' in navigator)) {
        showToast('Service Worker não suportado', 'warning');
        return;
    }
    if (!('PushManager' in window)) {
        showToast('Push não suportado neste navegador', 'warning');
        return;
    }

    try {
        const registration = await navigator.serviceWorker.register('/sw.js');

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            showToast('Permissão de notificação negada', 'warning');
            return;
        }

        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
            });
        }

        await saveWebPushSubscription(subscription);

    } catch (err) {
        console.error('[Push] Erro Web Push:', err);
        showToast('Erro push: ' + err.message, 'error');
    }
}

/**
 * Salva subscription Web Push no Supabase
 */
async function saveWebPushSubscription(subscription) {
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

    if (error) {
        console.error('[Push] Erro ao salvar subscription:', error);
        showToast('Erro ao registrar push: ' + error.message, 'error');
    }
}

/**
 * Salva token nativo (OneSignal/FCM) no Supabase
 */
async function savePushToken(type, token) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const endpoint = `${type}://${token}`;
    const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
            user_id: user.id,
            endpoint: endpoint,
            p256dh: type,
            auth: token,
            updated_at: new Date().toISOString()
        }, { onConflict: 'endpoint' });

    if (error) {
        console.error('[Push] Erro ao salvar token nativo:', error);
    }
}

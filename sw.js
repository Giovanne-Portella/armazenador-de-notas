/* ============================================
   SERVICE WORKER — Push Notifications + Cache
   ============================================ */

const CACHE_NAME = 'notas-v1';

// Recebe push do servidor e exibe notificação nativa
self.addEventListener('push', (event) => {
    let data = { title: '🔔 Lembrete', body: 'Você tem um lembrete!' };

    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data.body = event.data.text();
        }
    }

    event.waitUntil(
        self.registration.showNotification(data.title || '🔔 Lembrete', {
            body: data.body || '',
            icon: '/favicon.png',
            badge: '/favicon.png',
            tag: data.tag || 'reminder-' + Date.now(),
            data: { url: data.url || '/', noteId: data.noteId },
            vibrate: [200, 100, 200],
            requireInteraction: true
        })
    );
});

// Clique na notificação → abre o app
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            for (const client of windowClients) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    return client.focus();
                }
            }
            return clients.openWindow(url);
        })
    );
});

// Instalação — ativa imediatamente
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

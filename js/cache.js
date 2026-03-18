/* ============================================
   CACHE — Stale-While-Revalidate com sessionStorage
   TTL padrão: 2 minutos. Invalida imediatamente em mutações.
   ============================================ */

const CACHE_TTL = 2 * 60 * 1000; // 2 minutos

function cacheKey(key, userId) {
    return `swr:${userId}:${key}`;
}

export function cacheGet(key, userId) {
    try {
        const raw = sessionStorage.getItem(cacheKey(key, userId));
        if (!raw) return null;
        const entry = JSON.parse(raw);
        return { data: entry.data, stale: Date.now() - entry.ts > CACHE_TTL };
    } catch {
        return null;
    }
}

export function cacheSet(key, userId, data) {
    try {
        sessionStorage.setItem(cacheKey(key, userId), JSON.stringify({ data, ts: Date.now() }));
    } catch {
        // sessionStorage cheio, ignora silenciosamente
    }
}

export function cacheInvalidate(key, userId) {
    try {
        sessionStorage.removeItem(cacheKey(key, userId));
    } catch {}
}

export function cacheInvalidateAll(userId) {
    try {
        const prefix = `swr:${userId}:`;
        Object.keys(sessionStorage)
            .filter(k => k.startsWith(prefix))
            .forEach(k => sessionStorage.removeItem(k));
    } catch {}
}

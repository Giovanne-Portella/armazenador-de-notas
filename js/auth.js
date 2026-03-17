/* ============================================
   AUTH — Autenticação via Supabase (Google OAuth)
   Suporta Median.co WebView (login nativo) e browser (redirect)
   ============================================ */

import { supabase } from './supabase.js';
import { showToast } from './utils.js';

/**
 * Detecta se está rodando dentro do app Median.co
 */
function isMedianApp() {
    return !!(window.median || window.gonative);
}

/**
 * Login nativo Google via Median.co JavaScript Bridge
 * Tenta vários formatos de API (median / gonative)
 */
function medianGoogleLogin() {
    return new Promise((resolve, reject) => {
        const bridge = window.median || window.gonative;
        if (!bridge) return reject(new Error('Bridge não disponível'));

        const handleResult = function(result) {
            console.log('[Median] Google login result:', JSON.stringify(result));

            if (!result) return reject(new Error('Resultado vazio'));

            // Aceita idToken OU accessToken — Median pode retornar ambos
            const token = result.idToken || result.id_token;
            const accessToken = result.accessToken || result.access_token;

            if (token) {
                resolve({ idToken: token, accessToken, result });
            } else if (accessToken) {
                resolve({ idToken: null, accessToken, result });
            } else if (result.error) {
                reject(new Error(result.error));
            } else {
                reject(new Error('Sem token na resposta: ' + JSON.stringify(result)));
            }
        };

        // Tenta API nova (median.socialLogin.google)
        if (bridge.socialLogin?.google?.login) {
            bridge.socialLogin.google.login({ callback: handleResult });
        }
        // Tenta API alternativa (median.auth.google)
        else if (bridge.auth?.google) {
            bridge.auth.google({ callback: handleResult });
        }
        else {
            reject(new Error('Nenhuma API de social login encontrada no bridge'));
        }
    });
}

/**
 * Login com Google — detecta ambiente e escolhe o fluxo:
 *   • Median app → login nativo + signInWithIdToken (sem redirect)
 *   • Browser normal → OAuth redirect padrão
 */
export async function signInWithGoogle() {
    // Fluxo nativo para app Median.co — SEM FALLBACK para OAuth
    if (isMedianApp()) {
        try {
            showToast('Autenticando com Google...', 'info');
            const loginResult = await medianGoogleLogin();

            if (loginResult.idToken) {
                // Fluxo preferencial: idToken → signInWithIdToken
                const { error } = await supabase.auth.signInWithIdToken({
                    provider: 'google',
                    token: loginResult.idToken,
                });
                if (error) throw error;
            } else if (loginResult.accessToken) {
                // Fallback: accessToken → signInWithIdToken com access_token
                const { error } = await supabase.auth.signInWithIdToken({
                    provider: 'google',
                    access_token: loginResult.accessToken,
                });
                if (error) throw error;
            } else {
                throw new Error('Nenhum token obtido do login nativo');
            }

            window.location.href = '/';
        } catch (e) {
            console.error('[Median] Login falhou:', e);
            showToast('Erro no login: ' + e.message, 'error');
            // NÃO faz fallback para OAuth redirect — isso abriria o browser externo
        }
        return;
    }

    // Fluxo padrão para browser (não é Median)
    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin
        }
    });

    if (error) {
        showToast('Erro ao fazer login: ' + error.message, 'error');
    }
}

/**
 * Logout — limpa sessão e redireciona para login
 */
export async function signOut() {
    await supabase.auth.signOut();
    window.location.href = '/login.html';
}

/**
 * Retorna a sessão atual (ou null se não autenticado)
 */
export async function getSession() {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
}

/**
 * Verifica autenticação — redireciona para login se não autenticado
 * Retorna a sessão se autenticado
 */
export async function requireAuth() {
    const session = await getSession();
    if (!session) {
        window.location.href = '/login.html';
        return null;
    }
    return session;
}

/**
 * Listener para mudanças de estado de autenticação
 */
export function onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback);
}

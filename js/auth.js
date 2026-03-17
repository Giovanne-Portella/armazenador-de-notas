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
 * Retorna idToken sem abrir browser externo
 */
function medianGoogleLogin() {
    return new Promise((resolve, reject) => {
        if (!window.median?.socialLogin?.google) {
            return reject(new Error('Median social login não disponível'));
        }

        // Median bridge: callback-based API
        median.socialLogin.google.login({
            callback: function (result) {
                if (result && result.idToken) {
                    resolve(result);
                } else {
                    reject(new Error('Login cancelado ou sem idToken'));
                }
            }
        });
    });
}

/**
 * Login com Google — detecta ambiente e escolhe o fluxo:
 *   • Median app → login nativo + signInWithIdToken (sem redirect)
 *   • Browser normal → OAuth redirect padrão
 */
export async function signInWithGoogle() {
    // Fluxo nativo para app Median.co
    if (isMedianApp()) {
        try {
            const result = await medianGoogleLogin();

            const { error } = await supabase.auth.signInWithIdToken({
                provider: 'google',
                token: result.idToken,
            });

            if (error) throw error;
            window.location.href = '/';
            return;
        } catch (e) {
            console.warn('Login nativo Median falhou, tentando redirect:', e);
            // Fallback: tenta o redirect normal
        }
    }

    // Fluxo padrão para browser
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

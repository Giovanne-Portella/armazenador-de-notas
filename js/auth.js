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
 * O Median espera callback como STRING (nome de função global),
 * não como função anônima — o bridge nativo serializa os params.
 */
function medianGoogleLogin() {
    return new Promise((resolve, reject) => {
        const bridge = window.median || window.gonative;
        if (!bridge) return reject(new Error('Bridge não disponível'));

        // Timeout de segurança — se em 60s não retornar, rejeita
        const timeout = setTimeout(() => {
            delete window._medianGoogleCallback;
            reject(new Error('Timeout: login nativo não respondeu em 60s'));
        }, 60000);

        // Registra callback GLOBAL com nome fixo (Median exige string)
        window._medianGoogleCallback = function(result) {
            clearTimeout(timeout);
            delete window._medianGoogleCallback;

            console.log('[Median] Callback recebido:', JSON.stringify(result));

            if (!result) return reject(new Error('Resultado vazio'));

            const token = result.idToken || result.id_token;
            const accessToken = result.accessToken || result.access_token;

            if (token) {
                resolve({ idToken: token, accessToken, result });
            } else if (accessToken) {
                resolve({ idToken: null, accessToken, result });
            } else if (result.error) {
                reject(new Error(result.error));
            } else {
                reject(new Error('Sem token: ' + JSON.stringify(result)));
            }
        };

        console.log('[Median] Bridge detectado. APIs disponíveis:',
            'socialLogin:', !!bridge.socialLogin,
            'socialLogin.google:', !!bridge.socialLogin?.google,
            'auth:', !!bridge.auth
        );

        // Chama o bridge passando callback como STRING
        if (bridge.socialLogin?.google?.login) {
            console.log('[Median] Chamando socialLogin.google.login...');
            bridge.socialLogin.google.login({ callback: '_medianGoogleCallback' });
        } else if (bridge.auth?.google) {
            console.log('[Median] Chamando auth.google...');
            bridge.auth.google({ callback: '_medianGoogleCallback' });
        } else {
            clearTimeout(timeout);
            delete window._medianGoogleCallback;
            reject(new Error('Nenhuma API de social login no bridge'));
        }
    });
}

/**
 * Login com Google — detecta ambiente e escolhe o fluxo:
 *   • Median app → login nativo + signInWithIdToken (sem redirect)
 *   • Browser normal → OAuth redirect padrão
 */
export async function signInWithGoogle() {
    console.log('[Auth] isMedianApp:', isMedianApp(),
        'window.median:', !!window.median,
        'window.gonative:', !!window.gonative
    );

    // Fluxo nativo para app Median.co
    if (isMedianApp()) {
        try {
            showToast('Autenticando com Google...', 'info');
            const loginResult = await medianGoogleLogin();

            console.log('[Auth] Token obtido, autenticando no Supabase...');

            if (loginResult.idToken) {
                const { error } = await supabase.auth.signInWithIdToken({
                    provider: 'google',
                    token: loginResult.idToken,
                });
                if (error) throw error;
            } else if (loginResult.accessToken) {
                const { error } = await supabase.auth.signInWithIdToken({
                    provider: 'google',
                    access_token: loginResult.accessToken,
                });
                if (error) throw error;
            } else {
                throw new Error('Nenhum token obtido do login nativo');
            }

            showToast('Login realizado!', 'success');
            window.location.href = '/';
        } catch (e) {
            console.error('[Auth] Login Median falhou:', e);
            showToast('Erro no login: ' + e.message, 'error');
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

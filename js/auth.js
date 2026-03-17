/* ============================================
   AUTH — Autenticação via Supabase (Google OAuth)
   ============================================ */

import { supabase } from './supabase.js';

/**
 * Login com Google OAuth
 */
export async function signInWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: window.location.origin
        }
    });
    if (error) {
        alert('Erro ao fazer login: ' + error.message);
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

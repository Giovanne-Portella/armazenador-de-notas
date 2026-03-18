/* ============================================
   FRIENDS — Amizades e compartilhamento de notas
   ============================================ */

import { supabase } from './supabase.js';
import { showToast } from './utils.js';
import state from './state.js';

/* =========================================
   Buscar perfil por email
   ========================================= */

export async function searchUserByEmail(email) {
    const { data, error } = await supabase
        .from('profiles')
        .select('id, email, display_name, avatar_url')
        .ilike('email', email.trim())
        .neq('id', state.user.id)
        .limit(10);

    if (error) {
        console.error('Erro ao buscar usuário:', error);
        return [];
    }
    return data || [];
}

/* =========================================
   Enviar pedido de amizade
   ========================================= */

export async function sendFriendRequest(addresseeId) {
    // Verifica se já existe amizade em qualquer direção
    const { data: existing } = await supabase
        .from('friendships')
        .select('id, status')
        .or(`and(requester_id.eq.${state.user.id},addressee_id.eq.${addresseeId}),and(requester_id.eq.${addresseeId},addressee_id.eq.${state.user.id})`);

    if (existing && existing.length > 0) {
        const f = existing[0];
        if (f.status === 'accepted') {
            showToast('Vocês já são amigos!', 'info');
        } else {
            showToast('Solicitação já enviada.', 'info');
        }
        return false;
    }

    const { error } = await supabase.from('friendships').insert({
        requester_id: state.user.id,
        addressee_id: addresseeId
    });

    if (error) {
        console.error('Erro ao enviar solicitação:', error);
        showToast('Erro ao enviar solicitação.', 'error');
        return false;
    }

    showToast('Solicitação enviada!', 'success');
    return true;
}

/* =========================================
   Aceitar / Rejeitar amizade
   ========================================= */

export async function acceptFriendRequest(friendshipId) {
    const { error } = await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', friendshipId);

    if (error) {
        showToast('Erro ao aceitar solicitação.', 'error');
        return false;
    }
    showToast('Amizade aceita!', 'success');
    return true;
}

export async function rejectFriendRequest(friendshipId) {
    const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', friendshipId);

    if (error) {
        showToast('Erro ao recusar solicitação.', 'error');
        return false;
    }
    showToast('Solicitação recusada.', 'info');
    return true;
}

/* =========================================
   Remover amizade
   ========================================= */

export async function removeFriend(friendshipId) {
    const { error } = await supabase
        .from('friendships')
        .delete()
        .eq('id', friendshipId);

    if (error) {
        showToast('Erro ao remover amigo.', 'error');
        return false;
    }
    showToast('Amigo removido.', 'info');
    return true;
}

/* =========================================
   Listar amigos aceitos
   ========================================= */

export async function loadFriends() {
    const userId = state.user.id;

    const { data, error } = await supabase
        .from('friendships')
        .select('id, requester_id, addressee_id')
        .eq('status', 'accepted')
        .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);

    if (error) {
        console.error('Erro ao carregar amigos:', error);
        return [];
    }
    if (!data || data.length === 0) return [];

    // Pega os IDs dos amigos (o outro lado da amizade)
    const friendIds = data.map(f => f.requester_id === userId ? f.addressee_id : f.requester_id);
    const friendshipMap = {};
    data.forEach(f => {
        const fId = f.requester_id === userId ? f.addressee_id : f.requester_id;
        friendshipMap[fId] = f.id;
    });

    // Busca perfis
    const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, display_name, avatar_url')
        .in('id', friendIds);

    return (profiles || []).map(p => ({
        friendshipId: friendshipMap[p.id],
        id: p.id,
        email: p.email,
        displayName: p.display_name,
        avatarUrl: p.avatar_url
    }));
}

/* =========================================
   Listar pedidos pendentes (recebidos)
   ========================================= */

export async function loadPendingRequests() {
    const { data, error } = await supabase
        .from('friendships')
        .select('id, requester_id, created_at')
        .eq('addressee_id', state.user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Erro ao carregar solicitações:', error);
        return [];
    }
    if (!data || data.length === 0) return [];

    // Busca perfis dos remetentes
    const requesterIds = data.map(r => r.requester_id);
    const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, display_name, avatar_url')
        .in('id', requesterIds);

    const profileMap = {};
    (profiles || []).forEach(p => { profileMap[p.id] = p; });

    return data.map(r => {
        const p = profileMap[r.requester_id] || {};
        return {
            friendshipId: r.id,
            createdAt: r.created_at,
            id: r.requester_id,
            email: p.email || '',
            displayName: p.display_name || p.email || '',
            avatarUrl: p.avatar_url || ''
        };
    });
}

/* =========================================
   Compartilhar nota com amigo
   ========================================= */

export async function shareNoteWithFriend(noteId, friendUserId) {
    const { error } = await supabase.from('note_shares').insert({
        note_id: noteId,
        user_id: friendUserId,
        shared_by: state.user.id
    });

    if (error) {
        if (error.code === '23505') {
            showToast('Nota já compartilhada com este amigo.', 'info');
        } else {
            console.error('Erro ao compartilhar:', error);
            showToast('Erro ao compartilhar nota.', 'error');
        }
        return false;
    }

    showToast('Nota compartilhada!', 'success');
    return true;
}

/* =========================================
   Remover compartilhamento
   ========================================= */

export async function unshareNote(noteId, friendUserId) {
    const { error } = await supabase
        .from('note_shares')
        .delete()
        .eq('note_id', noteId)
        .eq('user_id', friendUserId);

    if (error) {
        showToast('Erro ao remover compartilhamento.', 'error');
        return false;
    }
    showToast('Compartilhamento removido.', 'info');
    return true;
}

/* =========================================
   Carregar notas compartilhadas comigo
   ========================================= */

export async function loadSharedNotes() {
    const { data, error } = await supabase
        .from('note_shares')
        .select(`
            note_id,
            shared_by,
            sharer:profiles!note_shares_shared_by_fkey(display_name, email),
            note:notes!note_shares_note_id_fkey(*)
        `)
        .eq('user_id', state.user.id);

    if (error) {
        console.error('Erro ao carregar notas compartilhadas:', error);
        return [];
    }

    return (data || []).map(s => ({
        id: s.note.id,
        title: s.note.title,
        content: s.note.content || '',
        group: s.note.group_name || '',
        color: s.note.color || 'gray',
        status: s.note.status || 'to-do',
        reminderAt: s.note.reminder_at || null,
        createdAt: s.note.created_at,
        sharedBy: s.sharer?.display_name || s.sharer?.email || 'Amigo',
        isShared: true
    }));
}

/* =========================================
   UI: Renderizar modal de amigos
   ========================================= */

export async function openFriendsModal() {
    document.getElementById('friendsModal').classList.add('show');
    document.getElementById('friendSearchInput').value = '';
    document.getElementById('friendSearchResults').innerHTML = '';
    await refreshFriendsUI();
}

export function closeFriendsModal() {
    document.getElementById('friendsModal').classList.remove('show');
}

async function refreshFriendsUI() {
    // Pending requests
    const pending = await loadPendingRequests();
    const pendingContainer = document.getElementById('pendingRequestsList');

    if (pending.length === 0) {
        pendingContainer.innerHTML = '<p class="friends-empty">Nenhuma solicitação pendente.</p>';
    } else {
        pendingContainer.innerHTML = pending.map(r => `
            <div class="friend-item">
                <img class="friend-avatar" src="${r.avatarUrl || ''}" alt="" onerror="this.style.display='none'" />
                <div class="friend-info">
                    <span class="friend-name">${escapeHtml(r.displayName || r.email)}</span>
                    <span class="friend-email">${escapeHtml(r.email)}</span>
                </div>
                <div class="friend-actions">
                    <button class="success btn-sm" onclick="acceptRequest('${r.friendshipId}')">Aceitar</button>
                    <button class="danger btn-sm" onclick="rejectRequest('${r.friendshipId}')">Recusar</button>
                </div>
            </div>
        `).join('');
    }

    // Friends list
    const friends = await loadFriends();
    const friendsContainer = document.getElementById('friendsList');

    if (friends.length === 0) {
        friendsContainer.innerHTML = '<p class="friends-empty">Nenhum amigo ainda. Envie uma solicitação!</p>';
    } else {
        friendsContainer.innerHTML = friends.map(f => `
            <div class="friend-item">
                <img class="friend-avatar" src="${f.avatarUrl || ''}" alt="" onerror="this.style.display='none'" />
                <div class="friend-info">
                    <span class="friend-name">${escapeHtml(f.displayName || f.email)}</span>
                    <span class="friend-email">${escapeHtml(f.email)}</span>
                </div>
                <button class="danger btn-sm" onclick="removeFriendUI('${f.friendshipId}')">Remover</button>
            </div>
        `).join('');
    }
}

/* =========================================
   UI: Busca de amigos
   ========================================= */

export async function searchFriend() {
    const input = document.getElementById('friendSearchInput').value.trim();
    if (input.length < 3) {
        showToast('Digite pelo menos 3 caracteres para buscar.', 'warning');
        return;
    }

    const results = await searchUserByEmail(input);
    const container = document.getElementById('friendSearchResults');

    if (results.length === 0) {
        container.innerHTML = '<p class="friends-empty">Nenhum usuário encontrado.</p>';
        return;
    }

    container.innerHTML = results.map(u => `
        <div class="friend-item">
            <img class="friend-avatar" src="${u.avatar_url || ''}" alt="" onerror="this.style.display='none'" />
            <div class="friend-info">
                <span class="friend-name">${escapeHtml(u.display_name || u.email)}</span>
                <span class="friend-email">${escapeHtml(u.email)}</span>
            </div>
            <button class="success btn-sm" onclick="sendRequest('${u.id}')">Enviar</button>
        </div>
    `).join('');
}

/* =========================================
   UI: Compartilhar nota com amigo
   ========================================= */

export async function openShareModal(noteId) {
    const id = noteId || state.selectedNoteForView?.id;
    if (!id) return;
    state._shareNoteId = id;

    document.getElementById('shareModal').classList.add('show');
    const list = document.getElementById('shareFriendsList');
    list.innerHTML = '<p class="friends-empty">Carregando...</p>';

    const friends = await loadFriends();

    if (friends.length === 0) {
        list.innerHTML = '<p class="friends-empty">Adicione amigos primeiro para compartilhar notas.</p>';
        return;
    }

    list.innerHTML = friends.map(f => `
        <div class="friend-item">
            <img class="friend-avatar" src="${f.avatarUrl || ''}" alt="" onerror="this.style.display='none'" />
            <div class="friend-info">
                <span class="friend-name">${escapeHtml(f.displayName || f.email)}</span>
                <span class="friend-email">${escapeHtml(f.email)}</span>
            </div>
            <button class="success btn-sm" onclick="confirmShare('${f.id}')">Compartilhar</button>
        </div>
    `).join('');
}

export function closeShareModal() {
    document.getElementById('shareModal').classList.remove('show');
    state._shareNoteId = null;
}

export async function confirmShare(friendUserId) {
    if (!state._shareNoteId) return;
    const ok = await shareNoteWithFriend(state._shareNoteId, friendUserId);
    if (ok) closeShareModal();
}

/* =========================================
   UI: Handlers globais (window)
   ========================================= */

export function registerFriendsGlobals() {
    window.openFriendsModal = openFriendsModal;
    window.closeFriendsModal = closeFriendsModal;
    window.searchFriend = searchFriend;
    window.openShareModal = openShareModal;
    window.closeShareModal = closeShareModal;
    window.confirmShare = confirmShare;

    window.sendRequest = async (userId) => {
        const ok = await sendFriendRequest(userId);
        if (ok) {
            document.getElementById('friendSearchInput').value = '';
            document.getElementById('friendSearchResults').innerHTML = '';
        }
    };

    window.acceptRequest = async (friendshipId) => {
        const ok = await acceptFriendRequest(friendshipId);
        if (ok) await refreshFriendsUI();
    };

    window.rejectRequest = async (friendshipId) => {
        const ok = await rejectFriendRequest(friendshipId);
        if (ok) await refreshFriendsUI();
    };

    window.removeFriendUI = async (friendshipId) => {
        if (!confirm('Remover este amigo?')) return;
        const ok = await removeFriend(friendshipId);
        if (ok) await refreshFriendsUI();
    };
}

/* =========================================
   Utility
   ========================================= */

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
}

/* =========================================
   Garantir perfil existe (chama no login)
   ========================================= */

export async function ensureProfile() {
    if (!state.user) return;
    const { error } = await supabase.from('profiles').upsert({
        id: state.user.id,
        email: state.user.email,
        display_name: state.user.user_metadata?.full_name || state.user.user_metadata?.name || state.user.email.split('@')[0],
        avatar_url: state.user.user_metadata?.avatar_url || state.user.user_metadata?.picture || null
    });
    if (error) console.error('Erro ao garantir perfil:', error);
}

/* ============================================
   DOCS — Módulo de documentação colaborativa
   Página standalone: docs.html
   ============================================ */

import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase.js';
import { cacheGet, cacheSet, cacheInvalidate } from './cache.js';

/* =========================================
   Estado local
   ========================================= */

let currentUser = null;
let currentDocId = null;
let hasPendingChanges = false;
let friends = [];
let cachedAccessToken = '';

const AUTOSAVE_INTERVAL = 5 * 60 * 1000; // 5 minutos

/* =========================================
   Constantes
   ========================================= */

const TEXT_COLORS = [
    'initial', '#000000', '#e60000', '#ff9900', '#ffff00',
    '#008a00', '#0066cc', '#9933ff', '#ffffff', '#facccc',
    '#ffebcc', '#ffffcc', '#cce8cc', '#cce0f5', '#ebd6ff'
];

/* =========================================
   Init
   ========================================= */

document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return;
    }

    currentUser = session.user;
    cachedAccessToken = session.access_token || '';

    // Avatar e perfil
    const avatar = document.getElementById('userAvatar');
    if (avatar && currentUser.user_metadata?.avatar_url) {
        avatar.src = currentUser.user_metadata.avatar_url;
    }

    // Tema
    initTheme();

    // Paleta de cores
    initColorPalette();

    // Carregar documentos
    await loadDocuments();

    // Carregar amigos (para compartilhamento)
    await loadFriends();

    // Setup editor listeners
    setupEditor();

    // Setup auto-save e beforeunload
    setupAutoSave();

    // Keyboard shortcuts
    setupKeyboard();

    // Mostrar conteúdo
    document.getElementById('appLoading').style.display = 'none';
    document.getElementById('appContent').style.display = 'flex';
});

/* =========================================
   Tema (replicado para standalone)
   ========================================= */

function initTheme() {
    const darkModeToggle = document.getElementById('darkModeToggle');
    const themeSelector = document.getElementById('themeSelector');

    darkModeToggle.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
            openThemeMobileModal();
        } else {
            document.body.classList.toggle('dark-mode');
            localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
        }
    });

    themeSelector.addEventListener('change', (e) => {
        document.body.className = document.body.className.replace(/theme-\w+/g, '').trim();
        if (e.target.value) document.body.classList.add(e.target.value);
        localStorage.setItem('selectedTheme', e.target.value);
    });

    const savedTheme = localStorage.getItem('selectedTheme');
    if (savedTheme) themeSelector.value = savedTheme;
}

function openThemeMobileModal() {
    const modal = document.getElementById('themeMobileModal');
    if (!modal) return;
    updateMobileThemeState();
    modal.classList.add('show');
}

function closeThemeMobileModal() {
    const modal = document.getElementById('themeMobileModal');
    if (modal) modal.classList.remove('show');
}

function setDarkMode(enabled) {
    if (enabled) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }
    localStorage.setItem('darkMode', enabled);
    updateMobileThemeState();
}

function selectThemeMobile(theme) {
    document.body.className = document.body.className.replace(/theme-\w+/g, '').trim();
    if (theme) document.body.classList.add(theme);
    localStorage.setItem('selectedTheme', theme);
    const sel = document.getElementById('themeSelector');
    if (sel) sel.value = theme;
    updateMobileThemeState();
}

function updateMobileThemeState() {
    const isDark = document.body.classList.contains('dark-mode');
    document.getElementById('lightModeBtn')?.classList.toggle('active', !isDark);
    document.getElementById('darkModeBtn')?.classList.toggle('active', isDark);
    const current = localStorage.getItem('selectedTheme') || '';
    document.querySelectorAll('.theme-option').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === current);
    });
}

/* =========================================
   Paleta de Cores
   ========================================= */

function initColorPalette() {
    const container = document.getElementById('docTextColorPalette');
    if (!container) return;

    let html = '<div class="text-color-wrapper">🎨<div class="text-color-palette">';
    TEXT_COLORS.forEach(color => {
        if (color === 'initial') {
            html += `<div class="text-color-option" style="background:linear-gradient(to bottom right, #000 49%, #FFF 51%);" title="Cor Padrão" onmousedown="event.preventDefault(); applyColor('${color}')"></div>`;
        } else {
            html += `<div class="text-color-option" style="background-color:${color};" onmousedown="event.preventDefault(); applyColor('${color}')"></div>`;
        }
    });
    html += '</div></div>';
    container.innerHTML = html;
}

/* =========================================
   Sidebar — Documentos
   ========================================= */

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

async function loadDocuments() {
    const cached = cacheGet('documents', currentUser.id);
    if (cached) {
        renderDocList(cached.data.mine, cached.data.shared);
        if (cached.stale) fetchAndCacheDocs();
        return;
    }
    await fetchAndCacheDocs();
}

async function fetchAndCacheDocs() {
    // Meus documentos
    const { data: mine, error: e1 } = await supabase
        .from('documents')
        .select('id, title, updated_at')
        .eq('user_id', currentUser.id)
        .order('updated_at', { ascending: false });

    if (e1) { console.error('Erro ao carregar documentos:', e1); return; }

    // Compartilhados comigo
    const { data: shares, error: e2 } = await supabase
        .from('document_shares')
        .select('document_id, can_edit, documents(id, title, updated_at)')
        .eq('shared_with_id', currentUser.id);

    if (e2) { console.error('Erro ao carregar documentos compartilhados:', e2); return; }

    const shared = (shares || []).map(s => ({
        ...s.documents,
        can_edit: s.can_edit
    }));

    cacheSet('documents', currentUser.id, { mine: mine || [], shared });
    renderDocList(mine || [], shared);
}

function renderDocList(mine, shared) {
    const myList = document.getElementById('myDocsList');
    const sharedList = document.getElementById('sharedDocsList');

    if (mine.length === 0) {
        myList.innerHTML = '<div class="doc-empty">Nenhum documento. Crie um!</div>';
    } else {
        myList.innerHTML = mine.map(d => `
            <div class="doc-item ${d.id === currentDocId ? 'active' : ''}" data-id="${d.id}">
                <div class="doc-item-info" onclick="loadDoc('${d.id}')">
                    <span class="doc-item-name">${escapeHtml(d.title)}</span>
                    <span class="doc-item-meta">${formatDate(d.updated_at)}</span>
                </div>
                <div class="doc-item-actions">
                    <button class="doc-item-action danger" onclick="deleteDoc('${d.id}')" title="Excluir">🗑️</button>
                </div>
            </div>
        `).join('');
    }

    if (shared.length === 0) {
        sharedList.innerHTML = '<div class="doc-empty">Nenhum documento compartilhado.</div>';
    } else {
        sharedList.innerHTML = shared.map(d => `
            <div class="doc-item ${d.id === currentDocId ? 'active' : ''}" data-id="${d.id}">
                <div class="doc-item-info" onclick="loadDoc('${d.id}')">
                    <span class="doc-item-name">${escapeHtml(d.title)}</span>
                    <span class="doc-item-meta">${formatDate(d.updated_at)}</span>
                    <span class="doc-item-badge">${d.can_edit ? '✏️ Edição' : '👁️ Leitura'}</span>
                </div>
            </div>
        `).join('');
    }
}

/* =========================================
   CRUD — Documentos
   ========================================= */

async function createNewDoc() {
    const { data, error } = await supabase
        .from('documents')
        .insert({ user_id: currentUser.id, title: 'Sem título', content: '' })
        .select('id, title, content')
        .single();

    if (error) {
        console.error('Erro ao criar documento:', error);
        showToast('Erro ao criar documento.', 'error');
        return;
    }

    cacheInvalidate('documents', currentUser.id);
    currentDocId = data.id;
    document.getElementById('currentDocTitle').value = data.title;
    document.getElementById('docEditor').innerHTML = '';
    hasPendingChanges = false;
    updateSaveStatus('Salvo');
    updateTOC();
    await fetchAndCacheDocs();
    toggleSidebar();
    showToast('Documento criado!', 'success');
}

async function loadDoc(docId) {
    // Salvar pendente antes de trocar
    if (hasPendingChanges && currentDocId) {
        await saveDoc();
    }

    const { data, error } = await supabase
        .from('documents')
        .select('id, title, content, user_id')
        .eq('id', docId)
        .single();

    if (error) {
        console.error('Erro ao carregar documento:', error);
        showToast('Erro ao carregar documento.', 'error');
        return;
    }

    currentDocId = data.id;
    document.getElementById('currentDocTitle').value = data.title;
    document.getElementById('docEditor').innerHTML = data.content || '';
    hasPendingChanges = false;
    updateSaveStatus('Salvo');
    updateTOC();

    // Se é compartilhado e não pode editar, desabilitar editor
    const isOwner = data.user_id === currentUser.id;
    const editor = document.getElementById('docEditor');
    const titleInput = document.getElementById('currentDocTitle');

    if (!isOwner) {
        // Verificar permissão
        const { data: share } = await supabase
            .from('document_shares')
            .select('can_edit')
            .eq('document_id', docId)
            .eq('shared_with_id', currentUser.id)
            .single();

        const canEdit = share?.can_edit || false;
        editor.contentEditable = canEdit ? 'true' : 'false';
        titleInput.readOnly = !canEdit;
        if (!canEdit) {
            editor.style.opacity = '0.85';
            document.getElementById('docToolbar').style.display = 'none';
        } else {
            editor.style.opacity = '';
            document.getElementById('docToolbar').style.display = '';
        }
    } else {
        editor.contentEditable = 'true';
        titleInput.readOnly = false;
        editor.style.opacity = '';
        document.getElementById('docToolbar').style.display = '';
    }

    // Atualizar lista e fechar sidebar
    await fetchAndCacheDocs();
    if (window.innerWidth <= 768) toggleSidebar();
}

async function saveDoc() {
    if (!currentDocId || !hasPendingChanges) return;

    updateSaveStatus('Salvando...');

    const title = document.getElementById('currentDocTitle').value.trim() || 'Sem título';
    const content = document.getElementById('docEditor').innerHTML;

    const { error } = await supabase
        .from('documents')
        .update({ title, content })
        .eq('id', currentDocId);

    if (error) {
        console.error('Erro ao salvar:', error);
        updateSaveStatus('Erro ao salvar', true);
        return;
    }

    hasPendingChanges = false;
    updateSaveStatus('Salvo');
    cacheInvalidate('documents', currentUser.id);
}

async function deleteDoc(docId) {
    if (!confirm('Tem certeza que deseja excluir este documento?')) return;

    const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', docId);

    if (error) {
        console.error('Erro ao excluir:', error);
        showToast('Erro ao excluir documento.', 'error');
        return;
    }

    cacheInvalidate('documents', currentUser.id);

    if (currentDocId === docId) {
        currentDocId = null;
        document.getElementById('currentDocTitle').value = 'Sem título';
        document.getElementById('docEditor').innerHTML = '';
        hasPendingChanges = false;
        updateSaveStatus('Salvo');
        updateTOC();
    }

    await fetchAndCacheDocs();
    showToast('Documento excluído.', 'success');
}

function manualSave() {
    if (!currentDocId) {
        showToast('Nenhum documento aberto.', 'info');
        return;
    }
    hasPendingChanges = true;
    saveDoc();
}

/* =========================================
   Save Status
   ========================================= */

function updateSaveStatus(text, isError = false) {
    const el = document.getElementById('saveStatus');
    el.textContent = text;
    el.className = 'doc-save-status';
    if (text.includes('Salvando')) el.classList.add('saving');
    if (isError) el.classList.add('error');
}

/* =========================================
   Editor Setup
   ========================================= */

function setupEditor() {
    const editor = document.getElementById('docEditor');
    const titleInput = document.getElementById('currentDocTitle');

    // Marcar mudanças
    editor.addEventListener('input', () => {
        if (currentDocId) {
            hasPendingChanges = true;
            updateSaveStatus('Não salvo');
        }
        updateTOC();
    });

    titleInput.addEventListener('input', () => {
        if (currentDocId) {
            hasPendingChanges = true;
            updateSaveStatus('Não salvo');
        }
    });

    // Image paste (Ctrl+V)
    editor.addEventListener('paste', (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        for (const item of items) {
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                const blob = item.getAsFile();
                const reader = new FileReader();
                reader.onload = (ev) => {
                    editor.focus();
                    document.execCommand('insertHTML', false, `<img src="${ev.target.result}" style="max-width:100%;" />`);
                };
                reader.readAsDataURL(blob);
                return;
            }
        }
    });

    // Image drag resize
    setupImageResize();
}

/* =========================================
   Image Resize (drag)
   ========================================= */

let resizingImage = null;
let resizeStartX = 0;
let resizeStartWidth = 0;

function setupImageResize() {
    document.body.addEventListener('mousedown', onImageDown);
    document.body.addEventListener('touchstart', onImageDown, { passive: false });
}

function onImageDown(e) {
    const target = e.target;
    if (target.tagName !== 'IMG') return;
    if (!target.closest('.doc-editor')) return;

    e.preventDefault();
    resizingImage = target;
    resizeStartX = e.clientX || (e.touches && e.touches[0].clientX);
    resizeStartWidth = resizingImage.offsetWidth;
    resizingImage.classList.add('img-resizing');
    document.addEventListener('mousemove', onImageMove);
    document.addEventListener('mouseup', onImageUp);
    document.addEventListener('touchmove', onImageMove, { passive: false });
    document.addEventListener('touchend', onImageUp);
}

function onImageMove(e) {
    if (!resizingImage) return;
    e.preventDefault();
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const delta = clientX - resizeStartX;
    const newWidth = Math.max(50, resizeStartWidth + delta);
    const ratio = resizingImage.naturalHeight / resizingImage.naturalWidth;
    resizingImage.style.width = newWidth + 'px';
    resizingImage.style.height = Math.round(newWidth * ratio) + 'px';
}

function onImageUp() {
    if (resizingImage) {
        resizingImage.classList.remove('img-resizing');
        resizingImage = null;
    }
    document.removeEventListener('mousemove', onImageMove);
    document.removeEventListener('mouseup', onImageUp);
    document.removeEventListener('touchmove', onImageMove);
    document.removeEventListener('touchend', onImageUp);
}

/* =========================================
   Formatting Commands
   ========================================= */

function fmt(command, value) {
    document.getElementById('docEditor').focus();
    document.execCommand(command, false, value);
}

function applyHeading(tag) {
    if (!tag) return;
    document.getElementById('docEditor').focus();
    document.execCommand('formatBlock', false, tag);
    updateTOC();
}

function changeFontSize(size) {
    if (!size) return;
    fmt('fontSize', '7');
    const editor = document.getElementById('docEditor');
    editor.querySelectorAll('font[size="7"]').forEach(el => {
        el.removeAttribute('size');
        el.style.fontSize = size;
    });
}

function applyColor(color) {
    const editor = document.getElementById('docEditor');
    editor.focus();
    if (color === 'initial') {
        const isDark = document.body.classList.contains('dark-mode');
        document.execCommand('foreColor', false, isDark ? '#ffffff' : '#000000');
    } else {
        document.execCommand('foreColor', false, color);
    }
}

function insertLink() {
    const url = prompt('URL do link:');
    if (url) fmt('createLink', url);
}

function insertImage(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('docEditor').focus();
            document.execCommand('insertHTML', false, `<img src="${e.target.result}" style="max-width:100%;" />`);
        };
        reader.readAsDataURL(input.files[0]);
        input.value = '';
    }
}

function insertHR() {
    fmt('insertHTML', '<hr/>');
}

function insertCodeBlock() {
    fmt('insertHTML', '<pre><code>// código aqui</code></pre><p><br/></p>');
}

/* =========================================
   Table of Contents (TOC)
   ========================================= */

function toggleTOC() {
    document.getElementById('tocPanel').classList.toggle('open');
}

function updateTOC() {
    const editor = document.getElementById('docEditor');
    const tocList = document.getElementById('tocList');
    if (!editor || !tocList) return;

    const headings = editor.querySelectorAll('h1, h2, h3');

    if (headings.length === 0) {
        tocList.innerHTML = '<div class="doc-toc-empty">Adicione títulos (H1, H2, H3) para gerar o sumário.</div>';
        return;
    }

    let html = '';
    headings.forEach((heading, idx) => {
        // Garantir ID para scroll
        if (!heading.id) heading.id = `doc-heading-${idx}`;
        const level = heading.tagName.charAt(1);
        const text = heading.textContent.trim() || 'Sem título';
        html += `<a class="doc-toc-item" data-level="${level}" onclick="scrollToHeading('${heading.id}')">${escapeHtml(text)}</a>`;
    });

    tocList.innerHTML = html;
}

function scrollToHeading(headingId) {
    const el = document.getElementById(headingId);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });

    // Flash highlight
    el.style.background = 'var(--primary-soft)';
    el.style.transition = 'background 0.3s';
    setTimeout(() => {
        el.style.background = '';
    }, 1500);
}

/* =========================================
   Auto-save, beforeunload, keyboard
   ========================================= */

function setupAutoSave() {
    // Intervalo de 5 minutos
    setInterval(() => {
        if (hasPendingChanges && currentDocId) saveDoc();
    }, AUTOSAVE_INTERVAL);

    // beforeunload — salvar ao fechar aba
    window.addEventListener('beforeunload', (e) => {
        if (hasPendingChanges && currentDocId) {
            const title = document.getElementById('currentDocTitle').value.trim() || 'Sem título';
            const content = document.getElementById('docEditor').innerHTML;

            // fetch keepalive para garantir que salva
            const url = `${SUPABASE_URL}/rest/v1/documents?id=eq.${encodeURIComponent(currentDocId)}`;
            fetch(url, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${cachedAccessToken}`,
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({ title, content }),
                keepalive: true
            }).catch(() => {});
        }
    });

    // visibilitychange — salvar ao ocultar aba
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden' && hasPendingChanges && currentDocId) {
            saveDoc();
        }
    });
}

function setupKeyboard() {
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            manualSave();
        }
    });
}

/* =========================================
   Compartilhamento
   ========================================= */

async function loadFriends() {
    const { data, error } = await supabase
        .from('friendships')
        .select('requester_id, addressee_id, profiles!friendships_requester_id_fkey(id, display_name, avatar_url), addressee:profiles!friendships_addressee_id_fkey(id, display_name, avatar_url)')
        .eq('status', 'accepted')
        .or(`requester_id.eq.${currentUser.id},addressee_id.eq.${currentUser.id}`);

    if (error) { console.error('Erro ao carregar amigos:', error); return; }

    friends = (data || []).map(f => {
        return f.requester_id === currentUser.id
            ? f.addressee
            : f.profiles;
    });
}

async function openShareModal() {
    if (!currentDocId) {
        showToast('Abra um documento primeiro.', 'info');
        return;
    }

    const modal = document.getElementById('shareModal');
    modal.classList.add('show');

    // Carregar shares atuais
    const { data: currentShares } = await supabase
        .from('document_shares')
        .select('id, shared_with_id, can_edit, profiles:shared_with_id(id, display_name, avatar_url)')
        .eq('document_id', currentDocId);

    const sharedIds = new Set((currentShares || []).map(s => s.shared_with_id));

    // Amigos disponíveis
    const friendsHtml = friends.length === 0
        ? '<div class="doc-share-empty">Você ainda não tem amigos adicionados.</div>'
        : friends.filter(f => !sharedIds.has(f.id)).map(f => `
            <div class="doc-share-friend">
                <div class="doc-share-friend-info">
                    <img class="doc-share-avatar" src="${f.avatar_url || ''}" alt="" />
                    <span class="doc-share-name">${escapeHtml(f.display_name || 'Usuário')}</span>
                </div>
                <div class="doc-share-actions">
                    <button class="doc-share-btn view" onclick="shareTo('${f.id}', false)">👁️ Leitura</button>
                    <button class="doc-share-btn edit" onclick="shareTo('${f.id}', true)">✏️ Edição</button>
                </div>
            </div>
        `).join('') || '<div class="doc-share-empty">Todos os amigos já têm acesso.</div>';

    document.getElementById('shareFriendsList').innerHTML = friendsHtml;

    // Quem já tem acesso
    const sharesHtml = (currentShares || []).length === 0
        ? '<div class="doc-share-empty">Ninguém tem acesso ainda.</div>'
        : (currentShares || []).map(s => {
            const profile = s.profiles;
            return `
                <div class="doc-share-friend">
                    <div class="doc-share-friend-info">
                        <img class="doc-share-avatar" src="${profile?.avatar_url || ''}" alt="" />
                        <span class="doc-share-name">${escapeHtml(profile?.display_name || 'Usuário')}</span>
                    </div>
                    <div class="doc-share-actions">
                        <button class="doc-share-btn ${s.can_edit ? 'edit active' : 'view active'}">${s.can_edit ? '✏️ Edição' : '👁️ Leitura'}</button>
                        <button class="doc-share-btn remove" onclick="removeShare('${s.id}')">✕</button>
                    </div>
                </div>
            `;
        }).join('');

    document.getElementById('currentSharesList').innerHTML = sharesHtml;
}

function closeShareModal() {
    document.getElementById('shareModal').classList.remove('show');
}

async function shareTo(friendId, canEdit) {
    const { error } = await supabase.from('document_shares').insert({
        document_id: currentDocId,
        owner_id: currentUser.id,
        shared_with_id: friendId,
        can_edit: canEdit
    });

    if (error) {
        console.error('Erro ao compartilhar:', error);
        showToast('Erro ao compartilhar.', 'error');
        return;
    }

    showToast('Documento compartilhado!', 'success');
    await openShareModal(); // Refresh modal
}

async function removeShare(shareId) {
    const { error } = await supabase
        .from('document_shares')
        .delete()
        .eq('id', shareId);

    if (error) {
        console.error('Erro ao remover compartilhamento:', error);
        showToast('Erro ao remover acesso.', 'error');
        return;
    }

    showToast('Acesso removido.', 'success');
    await openShareModal(); // Refresh modal
}

/* =========================================
   Utility
   ========================================= */

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) +
        ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/* =========================================
   Expose Global (onclick handlers)
   ========================================= */

window.toggleSidebar = toggleSidebar;
window.toggleTOC = toggleTOC;
window.createNewDoc = createNewDoc;
window.loadDoc = loadDoc;
window.deleteDoc = deleteDoc;
window.manualSave = manualSave;
window.fmt = fmt;
window.applyHeading = applyHeading;
window.changeFontSize = changeFontSize;
window.applyColor = applyColor;
window.insertLink = insertLink;
window.insertImage = insertImage;
window.insertHR = insertHR;
window.insertCodeBlock = insertCodeBlock;
window.scrollToHeading = scrollToHeading;
window.openShareModal = openShareModal;
window.closeShareModal = closeShareModal;
window.shareTo = shareTo;
window.removeShare = removeShare;
window.openThemeMobileModal = openThemeMobileModal;
window.closeThemeMobileModal = closeThemeMobileModal;
window.setDarkMode = setDarkMode;
window.selectThemeMobile = selectThemeMobile;

/* ============================================
   APP — Ponto de entrada, inicialização, bindings globais
   ============================================ */

import state, { loadState, upsertColumn, removeColumn, clearNoteReminder, setNoteReminder } from './state.js';
import { initTheme } from './theme.js';
import { requireAuth, signOut, onAuthStateChange } from './auth.js';
import { toggleCollapsible, generateColorPaletteHTML, showToast, generateColumnId } from './utils.js';
import {
    formatText, applyTextColor, formatAnalysisBlock,
    changeTextSize, selectNoteColor, insertImage, insertAnalysisImage,
    setupImageToggling
} from './editor.js';
import {
    setupDesktopUI, setupMobileUI, setupFilters,
    setupColumns, renderColumns, updateStats
} from './render.js';
import {
    openCreateModal, closeModal, saveNote,
    viewNote, closeViewModal, editNote,
    toggleComplete, deleteNote, shareNote, toggleReminderInput
} from './notes.js';
import {
    openAnalysisPanel, closeAnalysisModal,
    renderAnalysisBlocks, viewAnalysis, closeAnalysisViewModal,
    copyAnalysisContent, openAnalysisCreateModal, closeAnalysisEditModal,
    addAnalysisBlock, removeAnalysisBlock,
    saveAnalysis, deleteAnalysis,
    openSideNoteModal, closeSideNoteModal, saveSideNote, deleteSideNote
} from './analysis.js';
import {
    showPDFExportModal, closePDFExportModal, exportNotesToPdf,
    openAnalysisExportModal, closeAnalysisExportModal,
    toggleAllAnalysesForExport, exportAnalyses
} from './export.js';
import { initPushNotifications } from './push.js';
import { registerFriendsGlobals, ensureProfile } from './friends.js';

/* =========================================
   Registrar funções globais para HTML onclick
   ========================================= */

// Notas
window.openCreateModal = openCreateModal;
window.closeModal = closeModal;
window.saveNote = saveNote;
window.viewNote = viewNote;
window.closeViewModal = closeViewModal;
window.editNote = editNote;
window.toggleComplete = toggleComplete;
window.deleteNote = deleteNote;
window.shareNote = shareNote;
window.toggleReminderInput = toggleReminderInput;

// Editor
window.formatText = formatText;
window.applyTextColor = applyTextColor;
window.formatAnalysisBlock = formatAnalysisBlock;
window.changeTextSize = changeTextSize;
window.selectNoteColor = selectNoteColor;
window.insertImage = insertImage;
window.insertAnalysisImage = insertAnalysisImage;

// Análises
window.openAnalysisPanel = openAnalysisPanel;
window.closeAnalysisModal = closeAnalysisModal;
window.viewAnalysis = viewAnalysis;
window.closeAnalysisViewModal = closeAnalysisViewModal;
window.copyAnalysisContent = copyAnalysisContent;
window.openAnalysisCreateModal = openAnalysisCreateModal;
window.closeAnalysisEditModal = closeAnalysisEditModal;
window.addAnalysisBlock = addAnalysisBlock;
window.removeAnalysisBlock = removeAnalysisBlock;
window.saveAnalysis = saveAnalysis;
window.deleteAnalysis = deleteAnalysis;
window.openSideNoteModal = openSideNoteModal;
window.closeSideNoteModal = closeSideNoteModal;
window.saveSideNote = saveSideNote;
window.deleteSideNote = deleteSideNote;

// Export
window.showPDFExportModal = showPDFExportModal;
window.closePDFExportModal = closePDFExportModal;
window.exportNotesToPdf = exportNotesToPdf;
window.openAnalysisExportModal = openAnalysisExportModal;
window.closeAnalysisExportModal = closeAnalysisExportModal;
window.toggleAllAnalysesForExport = toggleAllAnalysesForExport;

// Colunas
window.openColumnModal = openColumnModal;
window.closeColumnModal = closeColumnModal;
window.saveColumn = saveColumn;
window.deleteCurrentColumn = deleteCurrentColumn;

// Lembrete
window.dismissReminder = dismissReminder;
window.showSnoozeOptions = showSnoozeOptions;
window.cancelSnooze = cancelSnooze;
window.snoozeReminder = snoozeReminder;

// Utils
window.toggleCollapsible = toggleCollapsible;

// Auth
window.signOut = signOut;

// Amigos
registerFriendsGlobals();

/* =========================================
   Gestão de Colunas
   ========================================= */

function openColumnModal(columnId = null) {
    state.editingColumnId = columnId;
    const modal = document.getElementById('columnModal');
    const title = document.getElementById('columnModalTitle');
    const input = document.getElementById('columnTitleInput');
    const isDoneCheckbox = document.getElementById('columnIsDone');
    const deleteBtn = document.getElementById('deleteColumnBtn');

    if (columnId) {
        const col = state.columns.find(c => c.id === columnId);
        if (!col) return;
        title.textContent = 'Editar Coluna';
        input.value = col.title;
        isDoneCheckbox.checked = col.isDone;
        deleteBtn.style.display = '';
    } else {
        title.textContent = 'Nova Coluna';
        input.value = '';
        isDoneCheckbox.checked = false;
        deleteBtn.style.display = 'none';
    }

    modal.classList.add('show');
    input.focus();
}

function closeColumnModal() {
    document.getElementById('columnModal').classList.remove('show');
    state.editingColumnId = null;
}

async function saveColumn() {
    const titleVal = document.getElementById('columnTitleInput').value.trim();
    const isDone = document.getElementById('columnIsDone').checked;
    if (!titleVal) { showToast('Nome da coluna é obrigatório.', 'warning'); return; }

    if (state.editingColumnId) {
        const col = state.columns.find(c => c.id === state.editingColumnId);
        if (col) {
            col.title = titleVal;
            col.isDone = isDone;
            await upsertColumn({ id: col.id, title: titleVal, position: col.position, is_done: isDone });
        }
    } else {
        const id = generateColumnId(titleVal);
        const position = state.columns.length;
        const newCol = { id, title: titleVal, position, isDone: isDone };
        state.columns.push(newCol);
        await upsertColumn({ id, title: titleVal, position, is_done: isDone });
    }

    closeColumnModal();
    setupColumns();
    renderColumns();
    updateStats();
    showToast('Coluna salva com sucesso!', 'success');
}

async function deleteCurrentColumn() {
    if (!state.editingColumnId) return;
    const col = state.columns.find(c => c.id === state.editingColumnId);
    if (!col) return;

    const notesInColumn = state.notes.filter(n => n.status === col.id);
    if (notesInColumn.length > 0) {
        showToast(`Não pode excluir: existem ${notesInColumn.length} nota(s) nesta coluna. Mova-as primeiro.`, 'error');
        return;
    }

    state.columns = state.columns.filter(c => c.id !== col.id);
    await removeColumn(col.id);
    closeColumnModal();
    setupColumns();
    renderColumns();
    updateStats();
    showToast('Coluna excluída.', 'success');
}

/* =========================================
   Lembretes — Verificador periódico
   ========================================= */

let currentReminderId = null;
const shownReminders = new Set();

function checkReminders() {
    const now = new Date();
    for (const note of state.notes) {
        if (!note.reminderAt) continue;
        if (shownReminders.has(note.id)) continue;
        const reminderDate = new Date(note.reminderAt);
        if (reminderDate <= now) {
            shownReminders.add(note.id);
            showReminderNotification(note);
            break; // show one at a time
        }
    }
}

function showReminderNotification(note) {
    currentReminderId = note.id;
    const content = document.getElementById('reminderContent');
    content.innerHTML = `
        <p class="reminder-note-title"><strong>${note.title}</strong></p>
        <p class="reminder-note-group">${note.group || ''}</p>
    `;
    // Mostra estado inicial (botões principais)
    document.getElementById('reminderMainActions').style.display = '';
    document.getElementById('reminderSnoozeActions').style.display = 'none';
    document.getElementById('reminderModal').classList.add('show');

    // Browser notification (if permission granted)
    if ('Notification' in window && Notification.permission === 'granted') {
        try {
            new Notification('🔔 Lembrete', { body: note.title, icon: '/favicon.png' });
        } catch (_) { /* Notification API indisponível */ }
    }
}

async function dismissReminder() {
    document.getElementById('reminderModal').classList.remove('show');
    if (currentReminderId) {
        await clearNoteReminder(currentReminderId);
        const note = state.notes.find(n => n.id === currentReminderId);
        if (note) note.reminderAt = null;
    }
    currentReminderId = null;
}

function showSnoozeOptions() {
    document.getElementById('reminderMainActions').style.display = 'none';
    document.getElementById('reminderSnoozeActions').style.display = '';
}

function cancelSnooze() {
    document.getElementById('reminderSnoozeActions').style.display = 'none';
    document.getElementById('reminderMainActions').style.display = '';
}

async function snoozeReminder(minutes) {
    if (!currentReminderId) return;
    const noteId = currentReminderId;
    const newTime = new Date(Date.now() + minutes * 60000).toISOString();
    await setNoteReminder(noteId, newTime);
    shownReminders.delete(noteId);
    showToast(`Lembrete adiado para ${minutes} minutos`, 'success');
    // Close modal without clearing reminder from DB
    document.getElementById('reminderModal').classList.remove('show');
    currentReminderId = null;
}

/* =========================================
   Pull-to-Refresh (mobile)
   ========================================= */

function setupPullToRefresh() {
    let startY = 0;
    let pulling = false;
    let refreshing = false;
    const threshold = 80;
    const indicator = document.getElementById('pullRefreshIndicator');

    document.addEventListener('touchstart', (e) => {
        if (refreshing) return;
        if (window.scrollY === 0 && !document.querySelector('.modal.show')) {
            startY = e.touches[0].clientY;
            pulling = true;
        }
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
        if (!pulling || refreshing) return;
        const dy = e.touches[0].clientY - startY;
        if (dy > threshold && window.scrollY === 0) {
            indicator.classList.add('visible');
        }
    }, { passive: true });

    document.addEventListener('touchend', async () => {
        if (!pulling || refreshing) return;
        pulling = false;

        if (indicator.classList.contains('visible')) {
            refreshing = true;
            try {
                await loadState();
                renderColumns();
                updateStats();
                shownReminders.clear();
                showToast('Notas atualizadas!', 'success');
            } catch (err) {
                console.error('Erro ao atualizar:', err);
            }
            indicator.classList.remove('visible');
            refreshing = false;
        }
    });
}

/* =========================================
   Inicialização
   ========================================= */

document.addEventListener('DOMContentLoaded', async () => {
    const session = await requireAuth();
    if (!session) return;

    await loadState();
    await ensureProfile();

    initTheme();
    setupDesktopUI();
    setupMobileUI();
    setupColumns();
    renderColumns();
    updateStats();
    setupFilters();
    setupImageToggling();

    setupUserProfile(session);

    document.getElementById('noteTextColorPalette').innerHTML =
        generateColorPaletteHTML('applyTextColor');

    const loading = document.getElementById('appLoading');
    const appContent = document.getElementById('appContent');
    if (loading) loading.style.display = 'none';
    if (appContent) appContent.style.display = '';

    // Re-renderizar quando cache stale for revalidado em background
    window.addEventListener('stateRevalidated', () => {
        renderColumns();
        updateStats();
        setupFilters();
    });

    onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT') {
            window.location.href = '/login.html';
        }
    });

    // Registrar Service Worker + Push Notifications
    initPushNotifications();

    // Verificar lembretes a cada 30s (notificação in-app)
    checkReminders();
    setInterval(checkReminders, 30000);

    // Pull-to-refresh no mobile
    setupPullToRefresh();
});

/**
 * Configura avatar e dados do usuário no header
 */
function setupUserProfile(session) {
    const user = session.user;
    const avatar = document.getElementById('userAvatar');
    const userName = document.getElementById('userName');

    if (avatar && user.user_metadata?.avatar_url) {
        avatar.src = user.user_metadata.avatar_url;
        avatar.alt = user.user_metadata.full_name || 'Avatar';
    }
    if (userName) {
        userName.textContent = user.user_metadata?.full_name || user.email || '';
    }
}

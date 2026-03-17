/* ============================================
   APP — Ponto de entrada, inicialização, bindings globais
   ============================================ */

import state, { loadState, upsertColumn, removeColumn, clearNoteReminder } from './state.js';
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

// Utils
window.toggleCollapsible = toggleCollapsible;

// Auth
window.signOut = signOut;

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

function checkReminders() {
    const now = new Date();
    for (const note of state.notes) {
        if (!note.reminderAt) continue;
        const reminderDate = new Date(note.reminderAt);
        if (reminderDate <= now) {
            showReminderNotification(note);
            clearNoteReminder(note.id);
            note.reminderAt = null;
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
    document.getElementById('reminderModal').classList.add('show');

    // Browser notification (if permission granted)
    if (Notification.permission === 'granted') {
        new Notification('🔔 Lembrete', { body: note.title, icon: '/favicon.ico' });
    }
}

function dismissReminder() {
    document.getElementById('reminderModal').classList.remove('show');
    currentReminderId = null;
}

/* =========================================
   Inicialização
   ========================================= */

document.addEventListener('DOMContentLoaded', async () => {
    const session = await requireAuth();
    if (!session) return;

    await loadState();

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

    onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT') {
            window.location.href = '/login.html';
        }
    });

    // Solicitar permissão de notificação
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }

    // Verificar lembretes a cada 30s
    checkReminders();
    setInterval(checkReminders, 30000);
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

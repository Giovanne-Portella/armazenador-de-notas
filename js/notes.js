/* ============================================
   NOTES — CRUD de notas, visualização, compartilhamento
   ============================================ */

import state, { saveNotes, upsertNote, removeNote } from './state.js';
import { renderColumns, updateStats } from './render.js';
import { selectNoteColor } from './editor.js';
import { showToast } from './utils.js';

/**
 * Abre modal de criação de nova nota
 */
export function openCreateModal() {
    state.selectedNoteId = null;
    document.getElementById('modalTitle').textContent = 'Criar Nova Nota';
    document.getElementById('modalTitleInput').value = '';
    document.getElementById('modalContentEditor').innerHTML = '';
    document.getElementById('modalGroupInput').value = '';
    document.getElementById('reminderToggle').checked = false;
    document.getElementById('reminderDatetime').style.display = 'none';
    document.getElementById('reminderDatetime').value = '';
    // Populate status select with current columns
    populateStatusSelect('');
    selectNoteColor('blue');
    document.getElementById('noteModal').classList.add('show');
}

/**
 * Popula o select de status com as colunas dinâmicas
 */
function populateStatusSelect(currentStatus) {
    const select = document.getElementById('modalStatusSelect');
    if (!select) return;
    select.innerHTML = '';
    const sorted = [...state.columns].sort((a, b) => a.position - b.position);
    sorted.forEach(col => {
        const opt = document.createElement('option');
        opt.value = col.id;
        opt.textContent = col.title;
        if (col.id === currentStatus) opt.selected = true;
        select.appendChild(opt);
    });
    if (!currentStatus && sorted.length > 0) {
        select.value = sorted[0].id;
    }
}

/**
 * Fecha modal de criação/edição
 */
export function closeModal() {
    document.getElementById('noteModal').classList.remove('show');
}

/**
 * Salva nota (cria ou atualiza)
 */
export async function saveNote() {
    const title = document.getElementById('modalTitleInput').value;
    const content = document.getElementById('modalContentEditor').innerHTML;
    const group = document.getElementById('modalGroupInput').value;
    const color = document.querySelector('.color-option.active')?.dataset.color || 'gray';
    const statusSelect = document.getElementById('modalStatusSelect');
    const status = statusSelect ? statusSelect.value : (state.columns[0]?.id || 'to-do');
    const reminderOn = document.getElementById('reminderToggle').checked;
    const reminderVal = document.getElementById('reminderDatetime').value;
    const reminderAt = reminderOn && reminderVal ? new Date(reminderVal).toISOString() : null;

    if (!title.trim()) {
        showToast('O título da nota é obrigatório.', 'warning');
        return;
    }

    if (state.selectedNoteId) {
        const note = state.notes.find(n => n.id === state.selectedNoteId);
        if (note) {
            note.title = title;
            note.content = content;
            note.group = group;
            note.color = color;
            note.status = status;
            note.reminderAt = reminderAt;
            await upsertNote(note);
        }
    } else {
        const newNote = {
            id: crypto.randomUUID(),
            title,
            content,
            group,
            color,
            status,
            reminderAt,
            createdAt: new Date().toISOString()
        };
        state.notes.push(newNote);
        await upsertNote(newNote);
    }

    saveNotes();
    closeModal();
    renderColumns();
    showToast('Nota salva com sucesso!', 'success');
}

/**
 * Visualiza uma nota no modal de leitura
 */
export function viewNote(id) {
    state.selectedNoteForView = state.notes.find(n => n.id === id);
    if (state.selectedNoteForView) {
        document.getElementById('viewModalTitle').textContent = state.selectedNoteForView.title;
        document.getElementById('viewModalContent').innerHTML = state.selectedNoteForView.content;
        document.getElementById('viewModalGroup').textContent = state.selectedNoteForView.group || 'N/A';
        document.getElementById('viewModalDate').textContent = new Date(state.selectedNoteForView.createdAt).toLocaleDateString();
        document.getElementById('viewModal').classList.add('show');
    }
}

/**
 * Fecha modal de visualização
 */
export function closeViewModal() {
    document.getElementById('viewModal').classList.remove('show');
    state.selectedNoteForView = null;
}

/**
 * Abre nota no modo edição
 */
export function editNote() {
    if (!state.selectedNoteForView) return;
    state.selectedNoteId = state.selectedNoteForView.id;
    document.getElementById('modalTitle').textContent = 'Editar Nota';
    document.getElementById('modalTitleInput').value = state.selectedNoteForView.title;
    document.getElementById('modalContentEditor').innerHTML = state.selectedNoteForView.content;
    document.getElementById('modalGroupInput').value = state.selectedNoteForView.group;
    selectNoteColor(state.selectedNoteForView.color);
    populateStatusSelect(state.selectedNoteForView.status);
    // Reminder
    const hasReminder = !!state.selectedNoteForView.reminderAt;
    document.getElementById('reminderToggle').checked = hasReminder;
    document.getElementById('reminderDatetime').style.display = hasReminder ? '' : 'none';
    if (hasReminder) {
        const dt = new Date(state.selectedNoteForView.reminderAt);
        document.getElementById('reminderDatetime').value = dt.toISOString().slice(0, 16);
    } else {
        document.getElementById('reminderDatetime').value = '';
    }
    closeViewModal();
    document.getElementById('noteModal').classList.add('show');
}

/**
 * Alterna status concluído/não concluído
 */
export function toggleComplete(id) {
    const note = state.notes.find(n => n.id === id);
    if (!note) return;

    const doneColumns = state.columns.filter(c => c.isDone);
    const notDoneColumns = state.columns.filter(c => !c.isDone);
    const isDone = doneColumns.some(c => c.id === note.status);

    if (isDone && notDoneColumns.length > 0) {
        note.status = notDoneColumns[0].id;
    } else if (!isDone && doneColumns.length > 0) {
        note.status = doneColumns[0].id;
    }
    saveNotes();
    upsertNote(note);
    renderColumns();
}

/**
 * Exclui uma nota
 */
export function deleteNote(id) {
    if (confirm('Tem certeza que deseja excluir esta nota? A ação não poderá ser desfeita.')) {
        state.notes = state.notes.filter(n => n.id !== id);
        saveNotes();
        removeNote(id);
        renderColumns();
        showToast('Nota excluída.', 'info');
    }
}

/**
 * Compartilha nota via WhatsApp ou Discord
 */
export function shareNote(platform) {
    if (!state.selectedNoteForView) return;
    const note = state.selectedNoteForView;
    const text = `*${note.title}*\n\n${note.content.replace(/<[^>]*>/g, '')}\n\nGrupo: ${note.group || 'N/A'}\nCriado em: ${new Date(note.createdAt).toLocaleDateString()}`;

    if (platform === 'whatsapp') {
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    } else if (platform === 'discord') {
        navigator.clipboard.writeText(text).then(() => {
            showToast('Conteúdo copiado! Cole no Discord.', 'success');
        }).catch(() => {
            showToast('Não foi possível copiar o conteúdo.', 'error');
        });
    }
}

/**
 * Toggle do input de lembrete
 */
export function toggleReminderInput(checked) {
    document.getElementById('reminderDatetime').style.display = checked ? '' : 'none';
}

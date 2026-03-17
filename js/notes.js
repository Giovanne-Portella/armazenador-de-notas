/* ============================================
   NOTES — CRUD de notas, visualização, compartilhamento
   ============================================ */

import state, { saveNotes, upsertNote, removeNote } from './state.js';
import { renderColumns, updateStats } from './render.js';
import { selectNoteColor } from './editor.js';

/**
 * Abre modal de criação de nova nota
 */
export function openCreateModal() {
    state.selectedNoteId = null;
    document.getElementById('modalTitle').textContent = 'Criar Nova Nota';
    document.getElementById('modalTitleInput').value = '';
    document.getElementById('modalContentEditor').innerHTML = '';
    document.getElementById('modalGroupInput').value = '';
    selectNoteColor('blue');
    document.getElementById('noteModal').classList.add('show');
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
export function saveNote() {
    const title = document.getElementById('modalTitleInput').value;
    const content = document.getElementById('modalContentEditor').innerHTML;
    const group = document.getElementById('modalGroupInput').value;
    const color = document.querySelector('.color-option.active')?.dataset.color || 'gray';

    if (!title.trim()) {
        alert('O título da nota é obrigatório.');
        return;
    }

    if (state.selectedNoteId) {
        const note = state.notes.find(n => n.id === state.selectedNoteId);
        if (note) {
            note.title = title;
            note.content = content;
            note.group = group;
            note.color = color;
            upsertNote(note);
        }
    } else {
        const newNote = {
            id: crypto.randomUUID(),
            title,
            content,
            group,
            color,
            status: 'to-do',
            createdAt: new Date().toISOString()
        };
        state.notes.push(newNote);
        upsertNote(newNote);
    }

    saveNotes();
    closeModal();
    renderColumns();
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
    closeViewModal();
    document.getElementById('noteModal').classList.add('show');
}

/**
 * Alterna status concluído/não concluído
 */
export function toggleComplete(id) {
    const note = state.notes.find(n => n.id === id);
    if (note) {
        note.status = note.status === 'completed' ? 'to-do' : 'completed';
        saveNotes();
        upsertNote(note);
        renderColumns();
    }
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
            alert('Conteúdo copiado para a área de transferência. Cole no Discord.');
        }).catch(() => {
            alert('Para compartilhar no Discord, copie o texto abaixo:\n\n' + text);
        });
    }
}

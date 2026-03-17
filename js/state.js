/* ============================================
   STATE — Gerenciamento centralizado de estado (Supabase)
   ============================================ */

import { supabase } from './supabase.js';
import { DEFAULT_COLUMNS } from './utils.js';

const state = {
    notes: [],
    analyses: [],
    columns: [],
    user: null,
    selectedNoteId: null,
    selectedNoteForView: null,
    currentAnalysisId: null,
    selectedAnalysisForViewId: null,
    imageToResize: null,
    editingColumnId: null
};

export default state;

/* =========================================
   Mapeamento DB → State
   ========================================= */

function mapNoteFromDb(n) {
    return {
        id: n.id,
        title: n.title,
        content: n.content || '',
        group: n.group_name || '',
        color: n.color || 'gray',
        status: n.status || 'to-do',
        reminderAt: n.reminder_at || null,
        createdAt: n.created_at
    };
}

function mapAnalysisFromDb(a) {
    return {
        id: a.id,
        title: a.title,
        blocks: a.blocks || [],
        createdAt: a.created_at
    };
}

function mapColumnFromDb(c) {
    return {
        id: c.id,
        title: c.title,
        position: c.position,
        isDone: c.is_done || false
    };
}

/* =========================================
   Carregar estado do Supabase
   ========================================= */

export async function loadState() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    state.user = user;

    const { data: notes, error: notesErr } = await supabase
        .from('notes')
        .select('*')
        .order('created_at', { ascending: true });

    if (notesErr) {
        console.error('Erro ao carregar notas:', notesErr);
    } else {
        state.notes = (notes || []).map(mapNoteFromDb);
    }

    const { data: analyses, error: analysesErr } = await supabase
        .from('analyses')
        .select('*')
        .order('created_at', { ascending: true });

    if (analysesErr) {
        console.error('Erro ao carregar análises:', analysesErr);
    } else {
        state.analyses = (analyses || []).map(mapAnalysisFromDb);
    }

    // Carregar colunas customizáveis
    const { data: columns, error: columnsErr } = await supabase
        .from('columns')
        .select('*')
        .order('position', { ascending: true });

    if (columnsErr) {
        console.error('Erro ao carregar colunas:', columnsErr);
    }

    if (!columns || columns.length === 0) {
        // Seed com colunas padrão
        await seedDefaultColumns(user.id);
    } else {
        state.columns = columns.map(mapColumnFromDb);
    }

    await migrateLocalStorage(user.id);
}

/* =========================================
   Seed de colunas padrão
   ========================================= */

async function seedDefaultColumns(userId) {
    const rows = DEFAULT_COLUMNS.map(c => ({
        id: c.id,
        user_id: userId,
        title: c.title,
        position: c.position,
        is_done: c.is_done
    }));
    const { error } = await supabase.from('columns').insert(rows);
    if (error) {
        console.error('Erro ao criar colunas padrão:', error);
        state.columns = DEFAULT_COLUMNS.map(c => ({
            id: c.id, title: c.title, position: c.position, isDone: c.is_done
        }));
    } else {
        state.columns = DEFAULT_COLUMNS.map(c => ({
            id: c.id, title: c.title, position: c.position, isDone: c.is_done
        }));
    }
}

/* =========================================
   Migração de localStorage → Supabase
   (executada apenas uma vez, se houver dados locais e DB vazio)
   ========================================= */

async function migrateLocalStorage(userId) {
    try {
        const localNotes = JSON.parse(localStorage.getItem('notes') || 'null');
        const localAnalyses = JSON.parse(localStorage.getItem('analyses') || 'null');

        if (localNotes && localNotes.length > 0 && state.notes.length === 0) {
            const rows = localNotes.map(n => ({
                id: crypto.randomUUID(),
                user_id: userId,
                title: n.title || 'Sem título',
                content: n.content || '',
                group_name: n.group || '',
                color: n.color || 'gray',
                status: n.status || 'to-do',
                created_at: n.createdAt || new Date().toISOString()
            }));
            const { error } = await supabase.from('notes').insert(rows);
            if (!error) {
                const { data } = await supabase
                    .from('notes')
                    .select('*')
                    .order('created_at', { ascending: true });
                state.notes = (data || []).map(mapNoteFromDb);
            }
        }

        if (localAnalyses && localAnalyses.length > 0 && state.analyses.length === 0) {
            const rows = localAnalyses.map(a => ({
                id: crypto.randomUUID(),
                user_id: userId,
                title: a.title || 'Análise Importada',
                blocks: a.blocks || [],
                created_at: a.createdAt || new Date().toISOString()
            }));
            const { error } = await supabase.from('analyses').insert(rows);
            if (!error) {
                const { data } = await supabase
                    .from('analyses')
                    .select('*')
                    .order('created_at', { ascending: true });
                state.analyses = (data || []).map(mapAnalysisFromDb);
            }
        }

        // Limpar localStorage após migração
        localStorage.removeItem('notes');
        localStorage.removeItem('analyses');
    } catch {
        // localStorage vazio ou parse falhou, ignora
    }
}

/* =========================================
   Funções de compatibilidade (chamadas pelo código existente)
   As operações reais de DB são feitas por funções específicas abaixo
   ========================================= */

export function saveNotes() {}
export function saveAnalyses() {}

/* =========================================
   CRUD — Operações específicas no Supabase
   ========================================= */

export async function upsertNote(note) {
    const { error } = await supabase.from('notes').upsert({
        id: note.id,
        user_id: state.user.id,
        title: note.title,
        content: note.content,
        group_name: note.group,
        color: note.color,
        status: note.status,
        reminder_at: note.reminderAt || null,
        created_at: note.createdAt
    });
    if (error) {
        console.error('Erro ao salvar nota:', error);
        const { showToast } = await import('./utils.js');
        showToast('Erro ao salvar nota: ' + error.message, 'error');
    }
}

export async function removeNote(noteId) {
    const { error } = await supabase.from('notes').delete().eq('id', noteId);
    if (error) console.error('Erro ao deletar nota:', error);
}

export async function upsertAnalysis(analysis) {
    const { error } = await supabase.from('analyses').upsert({
        id: analysis.id,
        user_id: state.user.id,
        title: analysis.title,
        blocks: analysis.blocks,
        created_at: analysis.createdAt
    });
    if (error) console.error('Erro ao salvar análise:', error);
}

export async function removeAnalysis(analysisId) {
    const { error } = await supabase.from('analyses').delete().eq('id', analysisId);
    if (error) console.error('Erro ao deletar análise:', error);
}

export async function bulkInsertNotes(notes) {
    const rows = notes.map(n => ({
        id: n.id,
        user_id: state.user.id,
        title: n.title,
        content: n.content,
        group_name: n.group,
        color: n.color,
        status: n.status,
        reminder_at: n.reminderAt || null,
        created_at: n.createdAt
    }));
    const { error } = await supabase.from('notes').insert(rows);
    if (error) console.error('Erro ao importar notas:', error);
}

export async function bulkInsertAnalyses(analyses) {
    const rows = analyses.map(a => ({
        id: a.id,
        user_id: state.user.id,
        title: a.title,
        blocks: a.blocks,
        created_at: a.createdAt
    }));
    const { error } = await supabase.from('analyses').insert(rows);
    if (error) console.error('Erro ao importar análises:', error);
}

/* =========================================
   CRUD — Colunas customizáveis
   ========================================= */

export async function upsertColumn(column) {
    const { error } = await supabase.from('columns').upsert({
        id: column.id,
        user_id: state.user.id,
        title: column.title,
        position: column.position,
        is_done: column.isDone
    });
    if (error) console.error('Erro ao salvar coluna:', error);
}

export async function removeColumn(columnId) {
    const { error } = await supabase.from('columns').delete().eq('id', columnId);
    if (error) console.error('Erro ao deletar coluna:', error);
}

export async function clearNoteReminder(noteId) {
    const { error } = await supabase.from('notes').update({ reminder_at: null }).eq('id', noteId);
    if (error) console.error('Erro ao limpar lembrete:', error);
}

export async function setNoteReminder(noteId, reminderAt) {
    const { error } = await supabase.from('notes').update({ reminder_at: reminderAt }).eq('id', noteId);
    if (error) console.error('Erro ao definir lembrete:', error);
    // Atualiza no estado local
    const note = state.notes.find(n => n.id === noteId);
    if (note) note.reminderAt = reminderAt;
}

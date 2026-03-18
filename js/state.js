/* ============================================
   STATE — Gerenciamento centralizado de estado (Supabase)
   ============================================ */

import { supabase } from './supabase.js';
import { DEFAULT_COLUMNS } from './utils.js';
import { cacheGet, cacheSet, cacheInvalidate } from './cache.js';

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
   Carregar estado do Supabase (com cache stale-while-revalidate)
   ========================================= */

export async function loadState() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    state.user = user;

    // Verifica cache das três entidades principais
    const cachedNotes    = cacheGet('notes', user.id);
    const cachedAnalyses = cacheGet('analyses', user.id);
    const cachedColumns  = cacheGet('columns', user.id);

    const hasCachedData = cachedNotes && cachedAnalyses && cachedColumns;

    if (hasCachedData) {
        // Serve do cache imediatamente
        _applyLoadedData(user, cachedNotes.data, cachedAnalyses.data, cachedColumns.data);

        // Se algum cache está stale, revalida silenciosamente em background
        if (cachedNotes.stale || cachedAnalyses.stale || cachedColumns.stale) {
            _fetchAndCache(user).then(({ notes, analyses, columns }) => {
                if (notes || analyses || columns) {
                    _applyLoadedData(user, notes, analyses, columns);
                    // Dispara evento para que a UI possa re-renderizar
                    window.dispatchEvent(new CustomEvent('stateRevalidated'));
                }
            }).catch(() => {});
        }
    } else {
        // Sem cache — carrega da rede e aguarda
        const fresh = await _fetchAndCache(user);
        _applyLoadedData(user, fresh.notes, fresh.analyses, fresh.columns);
    }

    await migrateLocalStorage(user.id);
}

async function _fetchAndCache(user) {
    const [notesRes, sharesRes, analysesRes, columnsRes] = await Promise.all([
        supabase.from('notes').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
        supabase.from('note_shares').select('note_id, shared_by').eq('user_id', user.id),
        supabase.from('analyses').select('*').order('created_at', { ascending: true }),
        supabase.from('columns').select('*').order('position', { ascending: true })
    ]);

    // Notas compartilhadas
    let allNotes = (notesRes.data || []).map(mapNoteFromDb);
    const shares = sharesRes.data || [];
    if (shares.length > 0) {
        const sharedIds = shares.map(s => s.note_id);
        const { data: sharedNotes } = await supabase
            .from('notes').select('*').in('id', sharedIds).order('created_at', { ascending: true });
        if (sharedNotes) {
            const existingIds = new Set(allNotes.map(n => n.id));
            for (const sn of sharedNotes) {
                if (!existingIds.has(sn.id)) allNotes.push({ ...mapNoteFromDb(sn), isShared: true });
            }
        }
    }

    const analyses = (analysesRes.data || []).map(mapAnalysisFromDb);
    const columns  = (columnsRes.data || []).map(mapColumnFromDb);

    // Salva no cache
    cacheSet('notes',    user.id, allNotes);
    cacheSet('analyses', user.id, analyses);
    cacheSet('columns',  user.id, columns);

    return { notes: allNotes, analyses, columns };
}

function _applyLoadedData(user, notes, analyses, columns) {
    state.notes    = notes    || state.notes;
    state.analyses = analyses || state.analyses;

    if (!columns || columns.length === 0) {
        if (state.columns.length === 0) seedDefaultColumns(user.id);
    } else {
        state.columns = columns;
    }

    // Garantir coluna "Compartilhadas" se necessário
    if (state.notes.some(n => n.isShared) && !state.columns.some(c => c.id === 'compartilhadas')) {
        ensureSharedColumn(user.id);
    }

    // Marcar notas compartilhadas
    const doneColIds = new Set(state.columns.filter(c => c.isDone).map(c => c.id));
    for (const note of state.notes) {
        if (note.isShared) {
            note.isSharedCompleted = doneColIds.has(note.status);
            note.status = 'compartilhadas';
        }
    }
}

/* =========================================
   Seed de colunas padrão
   ========================================= */

async function ensureSharedColumn(userId) {
    const exists = state.columns.some(c => c.id === 'compartilhadas');
    if (exists) return;

    // Shift existing columns positions by 1
    for (const col of state.columns) {
        col.position += 1;
    }
    const updates = state.columns.map(c =>
        supabase.from('columns').update({ position: c.position }).eq('id', c.id).eq('user_id', userId)
    );
    await Promise.all(updates);

    // Create "Compartilhadas" at position 0
    const newCol = { id: 'compartilhadas', title: 'Compartilhadas', position: 0, isDone: false };
    state.columns.unshift(newCol);
    await supabase.from('columns').upsert({
        id: 'compartilhadas',
        user_id: userId,
        title: 'Compartilhadas',
        position: 0,
        is_done: false
    });
}

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
    } else {
        cacheInvalidate('notes', state.user.id);
    }
}

export async function removeNote(noteId) {
    const { error } = await supabase.from('notes').delete().eq('id', noteId);
    if (error) console.error('Erro ao deletar nota:', error);
    else cacheInvalidate('notes', state.user.id);
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
    else cacheInvalidate('analyses', state.user.id);
}

export async function removeAnalysis(analysisId) {
    const { error } = await supabase.from('analyses').delete().eq('id', analysisId);
    if (error) console.error('Erro ao deletar análise:', error);
    else cacheInvalidate('analyses', state.user.id);
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
    else cacheInvalidate('notes', state.user.id);
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
    else cacheInvalidate('analyses', state.user.id);
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
    else cacheInvalidate('columns', state.user.id);
}

export async function removeColumn(columnId) {
    const { error } = await supabase.from('columns').delete().eq('id', columnId);
    if (error) console.error('Erro ao deletar coluna:', error);
    else cacheInvalidate('columns', state.user.id);
}

export async function clearNoteReminder(noteId) {
    const { error } = await supabase.from('notes').update({ reminder_at: null }).eq('id', noteId);
    if (error) console.error('Erro ao limpar lembrete:', error);
    else cacheInvalidate('notes', state.user.id);
}

export async function setNoteReminder(noteId, reminderAt) {
    const { error } = await supabase.from('notes').update({ reminder_at: reminderAt }).eq('id', noteId);
    if (error) console.error('Erro ao definir lembrete:', error);
    else {
        cacheInvalidate('notes', state.user.id);
        const note = state.notes.find(n => n.id === noteId);
        if (note) note.reminderAt = reminderAt;
    }
}

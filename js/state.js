/* ============================================
   STATE — Gerenciamento centralizado de estado (Supabase)
   ============================================ */

import { supabase } from './supabase.js';

const state = {
    notes: [],
    analyses: [],
    user: null,
    selectedNoteId: null,
    selectedNoteForView: null,
    currentAnalysisId: null,
    selectedAnalysisForViewId: null,
    imageToResize: null
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

    await migrateLocalStorage(user.id);
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
        created_at: note.createdAt
    });
    if (error) console.error('Erro ao salvar nota:', error);
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

/* ============================================
   STATE — Gerenciamento centralizado de estado
   ============================================ */

const state = {
    notes: [],
    analyses: [],
    selectedNoteId: null,
    selectedNoteForView: null,
    currentAnalysisId: null,
    selectedAnalysisForViewId: null,
    imageToResize: null
};

export default state;

export function loadState() {
    try {
        state.notes = JSON.parse(localStorage.getItem('notes')) || [];
        state.analyses = JSON.parse(localStorage.getItem('analyses')) || [];
    } catch {
        state.notes = [];
        state.analyses = [];
    }
}

export function saveNotes() {
    localStorage.setItem('notes', JSON.stringify(state.notes));
}

export function saveAnalyses() {
    localStorage.setItem('analyses', JSON.stringify(state.analyses));
}

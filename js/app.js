/* ============================================
   APP — Ponto de entrada, inicialização, bindings globais
   ============================================ */

import { loadState } from './state.js';
import { initTheme } from './theme.js';
import { toggleCollapsible, generateColorPaletteHTML } from './utils.js';
import {
    formatText, applyTextColor, formatAnalysisBlock,
    changeTextSize, selectNoteColor, insertImage, insertAnalysisImage,
    setupImageToggling, openImageResizeModal, closeImageResizeModal, applyImageResize
} from './editor.js';
import {
    setupDesktopUI, setupMobileUI, setupFilters,
    setupColumns, renderColumns, updateStats
} from './render.js';
import {
    openCreateModal, closeModal, saveNote,
    viewNote, closeViewModal, editNote,
    toggleComplete, deleteNote, shareNote
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
    showJSONExportModal, closeJSONExportModal, exportNotesToJson, importJSON,
    openAnalysisExportModal, closeAnalysisExportModal,
    toggleAllAnalysesForExport, exportAnalyses, importAnalysesJSON
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

// Editor
window.formatText = formatText;
window.applyTextColor = applyTextColor;
window.formatAnalysisBlock = formatAnalysisBlock;
window.changeTextSize = changeTextSize;
window.selectNoteColor = selectNoteColor;
window.insertImage = insertImage;
window.insertAnalysisImage = insertAnalysisImage;
window.closeImageResizeModal = closeImageResizeModal;
window.applyImageResize = applyImageResize;

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

// Export/Import
window.showPDFExportModal = showPDFExportModal;
window.closePDFExportModal = closePDFExportModal;
window.exportNotesToPdf = exportNotesToPdf;
window.showJSONExportModal = showJSONExportModal;
window.closeJSONExportModal = closeJSONExportModal;
window.exportNotesToJson = exportNotesToJson;
window.importJSON = importJSON;
window.openAnalysisExportModal = openAnalysisExportModal;
window.closeAnalysisExportModal = closeAnalysisExportModal;
window.toggleAllAnalysesForExport = toggleAllAnalysesForExport;
window.importAnalysesJSON = importAnalysesJSON;

// Utils
window.toggleCollapsible = toggleCollapsible;

/* =========================================
   Inicialização
   ========================================= */

document.addEventListener('DOMContentLoaded', () => {
    loadState();
    initTheme();
    setupDesktopUI();
    setupMobileUI();
    setupColumns();
    renderColumns();
    updateStats();
    setupFilters();
    setupImageToggling();

    // Paleta de cores do editor de notas
    document.getElementById('noteTextColorPalette').innerHTML =
        generateColorPaletteHTML('applyTextColor');
});

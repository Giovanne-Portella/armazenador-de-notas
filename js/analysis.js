/* ============================================
   ANALYSIS — Painel de análises, CRUD, blocos, side notes
   ============================================ */

import state, { saveAnalyses } from './state.js';
import { generateColorPaletteHTML } from './utils.js';

/**
 * Abre o painel de análises
 */
export function openAnalysisPanel() {
    document.getElementById('analysisModal').classList.add('show');
    renderAnalysisBlocks();
}

/**
 * Fecha o painel de análises
 */
export function closeAnalysisModal() {
    document.getElementById('analysisModal').classList.remove('show');
}

/**
 * Renderiza a lista de análises no painel
 */
export function renderAnalysisBlocks() {
    const list = document.getElementById('analysisList');
    list.innerHTML = '';

    state.analyses.forEach(analysis => {
        const card = document.createElement('div');
        card.className = 'analysis-card';
        const previewContent = analysis.blocks
            .map(b => b.content)
            .join('<hr class="modal-divider">');

        card.innerHTML = `
            <div class="analysis-header">
                <h3 class="analysis-title">${analysis.title}</h3>
                <div class="analysis-actions">
                    <button class="btn-icon" onclick="window.viewAnalysis(${analysis.id})" title="Visualizar">👁️</button>
                    <button class="btn-icon" onclick="window.openAnalysisCreateModal(${analysis.id})" title="Editar">✏️</button>
                    <button class="btn-icon danger" onclick="window.deleteAnalysis(${analysis.id})" title="Deletar">🗑️</button>
                </div>
            </div>
            <div class="analysis-content">${previewContent}</div>
            <div class="note-meta">
                <span>Criado: ${new Date(analysis.createdAt).toLocaleDateString()}</span>
            </div>
        `;
        list.appendChild(card);
    });
}

/**
 * Visualiza uma análise completa
 */
export function viewAnalysis(id) {
    const analysis = state.analyses.find(a => a.id === id);
    if (analysis) {
        state.selectedAnalysisForViewId = id;
        document.getElementById('analysisViewModalTitle').textContent = analysis.title;
        const contentHTML = analysis.blocks.map(b => `<div class="view-analysis-block">${b.content}</div>`).join('');
        document.getElementById('analysisViewModalContent').innerHTML = contentHTML;
        document.getElementById('analysisViewModalDate').textContent = new Date(analysis.createdAt).toLocaleDateString();
        document.getElementById('analysisViewModal').classList.add('show');
    }
}

/**
 * Fecha modal de visualização de análise
 */
export function closeAnalysisViewModal() {
    document.getElementById('analysisViewModal').classList.remove('show');
    state.selectedAnalysisForViewId = null;
}

/**
 * Copia conteúdo da análise para clipboard
 */
export async function copyAnalysisContent() {
    if (!state.selectedAnalysisForViewId) return;

    const title = document.getElementById('analysisViewModalTitle')?.textContent.trim() || 'Sem título';
    const createdAt = document.getElementById('analysisViewModalDate')?.textContent.trim() || 'Desconhecida';

    const contentDiv = document.getElementById('analysisViewModalContent');
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = contentDiv.innerHTML;
    tempDiv.querySelectorAll('br').forEach(br => br.replaceWith('\n'));
    tempDiv.querySelectorAll('div').forEach(div => div.insertAdjacentText('beforeend', '\n'));
    const cleanText = tempDiv.textContent.trim();

    const finalText = `*${title}*\n\n${cleanText}\n\nCriado em: ${createdAt}`;

    try {
        await navigator.clipboard.writeText(finalText);
        alert('Análise copiada com sucesso!');
    } catch {
        alert('Não foi possível copiar a análise. Verifique as permissões do navegador.');
    }
}

/**
 * Abre modal de criação/edição de análise
 */
export function openAnalysisCreateModal(id = null) {
    state.currentAnalysisId = id;
    const container = document.getElementById('analysisBlocksContainer');
    container.innerHTML = '';

    if (id) {
        const analysis = state.analyses.find(a => a.id === id);
        if (analysis) {
            document.getElementById('analysisModalTitle').textContent = 'Editar Análise';
            document.getElementById('analysisTitleInput').value = analysis.title;
            analysis.blocks.forEach(block => addAnalysisBlock(block.content, block.id, block.sideNote));
        }
    } else {
        document.getElementById('analysisModalTitle').textContent = 'Adicionar Nova Análise';
        document.getElementById('analysisTitleInput').value = '';
        addAnalysisBlock();
    }

    setupAnalysisBlockDragAndDrop();
    document.getElementById('analysisEditModal').classList.add('show');
}

/**
 * Fecha modal de edição de análise
 */
export function closeAnalysisEditModal() {
    document.getElementById('analysisEditModal').classList.remove('show');
}

/**
 * Adiciona um bloco de conteúdo na análise
 */
export function addAnalysisBlock(content = '', id = Date.now(), sideNote = '') {
    const container = document.getElementById('analysisBlocksContainer');
    const blockWrapper = document.createElement('div');
    blockWrapper.className = 'block-wrapper';
    blockWrapper.dataset.blockId = id;
    blockWrapper.dataset.sidenote = sideNote;

    const paletteHTML = generateColorPaletteHTML('formatAnalysisBlock');
    const sideNoteClass = sideNote ? 'has-note' : '';

    blockWrapper.innerHTML = `
        <div class="block-toolbar">
            <span class="drag-handle" draggable="true">☰</span>
            <button class="toolbar-btn" onmousedown="event.preventDefault(); window.formatAnalysisBlock(this, 'bold')" title="Negrito"><strong>B</strong></button>
            <button class="toolbar-btn" onmousedown="event.preventDefault(); window.formatAnalysisBlock(this, 'italic')" title="Itálico"><em>I</em></button>
            <button class="toolbar-btn" onmousedown="event.preventDefault(); window.formatAnalysisBlock(this, 'underline')" title="Sublinhado"><u>U</u></button>
            <button class="toolbar-btn" onmousedown="event.preventDefault(); window.formatAnalysisBlock(this, 'strikeThrough')" title="Riscado"><s>S</s></button>
            ${paletteHTML}
            <button class="toolbar-btn" onmousedown="event.preventDefault(); document.getElementById('analysisImageUpload-${id}').click()" title="Inserir Imagem">🖼️</button>
            <input accept="image/*" type="file" onchange="window.insertAnalysisImage(this, ${id})" class="image-upload" id="analysisImageUpload-${id}">
            <button class="toolbar-btn" onmousedown="event.preventDefault(); window.formatAnalysisBlock(this, 'createLink', prompt('URL do link:'))" title="Criar Link">🔗</button>
            <button class="toolbar-btn danger" onclick="window.removeAnalysisBlock(this)" title="Remover Bloco">🗑️</button>
            <button class="toolbar-btn side-note-btn ${sideNoteClass}" onclick="window.openSideNoteModal(this)" title="Anotação do Bloco">💬</button>
        </div>
        <div class="block-content-editor" contenteditable="true" data-id="${id}">${content}</div>
    `;
    container.appendChild(blockWrapper);
}

/**
 * Remove um bloco de análise
 */
export function removeAnalysisBlock(buttonElement) {
    if (document.querySelectorAll('.block-wrapper').length > 1) {
        buttonElement.closest('.block-wrapper').remove();
    } else {
        alert('A análise precisa ter pelo menos um bloco.');
    }
}

/**
 * Configura drag & drop para reordenação de blocos
 */
export function setupAnalysisBlockDragAndDrop() {
    const container = document.getElementById('analysisBlocksContainer');
    let draggedBlock = null;

    container.addEventListener('dragstart', (e) => {
        if (e.target.classList.contains('drag-handle')) {
            draggedBlock = e.target.closest('.block-wrapper');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', draggedBlock.dataset.blockId);
            setTimeout(() => draggedBlock.classList.add('dragging'), 0);
        }
    });

    container.addEventListener('dragend', () => {
        if (draggedBlock) {
            draggedBlock.classList.remove('dragging');
            draggedBlock = null;
        }
    });

    container.addEventListener('dragover', (e) => {
        e.preventDefault();
        const targetBlock = e.target.closest('.block-wrapper');
        if (targetBlock && draggedBlock && targetBlock !== draggedBlock) {
            const rect = targetBlock.getBoundingClientRect();
            const next = (e.clientY - rect.top) / (rect.bottom - rect.top) > 0.5;
            container.insertBefore(draggedBlock, next ? targetBlock.nextSibling : targetBlock);
        }
    });
}

/**
 * Salva análise (cria ou atualiza)
 */
export function saveAnalysis() {
    const title = document.getElementById('analysisTitleInput').value.trim();
    const blockElements = document.querySelectorAll('#analysisBlocksContainer .block-wrapper');
    const blocks = Array.from(blockElements).map(wrapper => ({
        id: parseInt(wrapper.querySelector('.block-content-editor').dataset.id),
        content: wrapper.querySelector('.block-content-editor').innerHTML,
        sideNote: wrapper.dataset.sidenote || ''
    }));

    if (!title || (blocks.length > 0 && blocks.every(b => !b.content.trim()))) {
        alert('O título é obrigatório e pelo menos um bloco deve ter conteúdo.');
        return;
    }

    if (state.currentAnalysisId) {
        const idx = state.analyses.findIndex(a => a.id === state.currentAnalysisId);
        if (idx !== -1) {
            state.analyses[idx].title = title;
            state.analyses[idx].blocks = blocks;
        }
    } else {
        state.analyses.push({
            id: Date.now(),
            title,
            blocks,
            createdAt: new Date().toISOString()
        });
    }

    saveAnalyses();
    renderAnalysisBlocks();
    closeAnalysisEditModal();
}

/**
 * Deleta uma análise
 */
export function deleteAnalysis(id) {
    if (confirm('Tem certeza que deseja deletar esta análise?')) {
        state.analyses = state.analyses.filter(a => a.id !== id);
        saveAnalyses();
        renderAnalysisBlocks();
    }
}

/**
 * Abre modal de side note para um bloco
 */
export function openSideNoteModal(buttonElement) {
    const blockWrapper = buttonElement.closest('.block-wrapper');
    const blockId = blockWrapper.dataset.blockId;
    const currentNote = blockWrapper.dataset.sidenote || '';

    document.getElementById('sideNoteBlockId').value = blockId;
    document.getElementById('sideNoteTextarea').value = currentNote;
    document.getElementById('sideNoteModal').classList.add('show');
    document.getElementById('sideNoteTextarea').focus();
}

/**
 * Fecha modal de side note
 */
export function closeSideNoteModal() {
    document.getElementById('sideNoteModal').classList.remove('show');
}

/**
 * Salva side note de um bloco
 */
export function saveSideNote() {
    const blockId = document.getElementById('sideNoteBlockId').value;
    const noteText = document.getElementById('sideNoteTextarea').value;

    const blockWrapper = document.querySelector(`.block-wrapper[data-block-id="${blockId}"]`);
    if (blockWrapper) {
        blockWrapper.dataset.sidenote = noteText;
        const noteButton = blockWrapper.querySelector('.side-note-btn');
        if (noteText.trim()) {
            noteButton.classList.add('has-note');
        } else {
            noteButton.classList.remove('has-note');
        }
    }

    closeSideNoteModal();
}

/**
 * Deleta side note de um bloco
 */
export function deleteSideNote() {
    if (confirm('Tem certeza que deseja excluir esta anotação?')) {
        document.getElementById('sideNoteTextarea').value = '';
        saveSideNote();
    }
}

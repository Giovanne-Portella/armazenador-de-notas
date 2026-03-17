/* ============================================
   EDITOR — Rich text, formatação, cores, imagens
   ============================================ */

import state from './state.js';

/**
 * Aplica comando de formatação no editor de notas
 */
export function formatText(command, value) {
    document.getElementById('modalContentEditor').focus();
    document.execCommand(command, false, value);
}

/**
 * Aplica cor ao texto selecionado no editor de notas
 * BUG FIX: "initial" agora aplica a cor padrão do tema em vez de usar removeFormat
 * que removia TODA a formatação (negrito, itálico, etc.)
 */
export function applyTextColor(command, color) {
    const editor = document.getElementById('modalContentEditor');
    editor.focus();

    if (color === 'initial') {
        const isDark = document.body.classList.contains('dark-mode');
        document.execCommand('foreColor', false, isDark ? '#ffffff' : '#000000');
    } else {
        document.execCommand(command, false, color);
    }
}

/**
 * Aplica formatação no bloco de análise
 * BUG FIX: mesma correção do applyTextColor
 */
export function formatAnalysisBlock(buttonElement, command, value = null) {
    const editor = buttonElement.closest('.block-wrapper').querySelector('.block-content-editor');
    editor.focus();

    if (command === 'foreColor' && value === 'initial') {
        const isDark = document.body.classList.contains('dark-mode');
        document.execCommand('foreColor', false, isDark ? '#ffffff' : '#000000');
    } else {
        document.execCommand(command, false, value);
    }
}

/**
 * Altera o tamanho do texto selecionado
 */
export function changeTextSize(size) {
    formatText('fontSize', '7');
    const fontElements = document.getElementById('modalContentEditor').querySelectorAll('font[size="7"]');
    fontElements.forEach(fontEl => {
        fontEl.removeAttribute('size');
        fontEl.style.fontSize = size;
    });
}

/**
 * Seleciona a cor do cartão de nota na paleta
 */
export function selectNoteColor(color) {
    document.querySelectorAll('.color-palette .color-option').forEach(o => o.classList.remove('active'));
    const selected = document.querySelector(`.color-palette .color-option[data-color="${color}"]`);
    if (selected) selected.classList.add('active');
}

/**
 * Insere imagem no editor de notas
 */
export function insertImage(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            formatText('insertImage', e.target.result);
        };
        reader.readAsDataURL(input.files[0]);
    }
}

/**
 * Insere imagem em bloco de análise
 */
export function insertAnalysisImage(input, blockId) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = document.createElement('img');
            img.src = e.target.result;
            const targetEditor = document.querySelector(`.block-content-editor[data-id="${blockId}"]`);
            if (targetEditor) {
                targetEditor.focus();
                document.execCommand('insertHTML', false, img.outerHTML);
            }
        };
        reader.readAsDataURL(input.files[0]);
    }
}

/**
 * Abre o modal de redimensionamento de imagem
 */
export function openImageResizeModal(imgElement) {
    if (!imgElement) return;
    state.imageToResize = imgElement;
    document.getElementById('imageWidthInput').value = imgElement.clientWidth;
    document.getElementById('imageResizeModal').classList.add('show');
}

/**
 * Fecha o modal de redimensionamento de imagem
 */
export function closeImageResizeModal() {
    document.getElementById('imageResizeModal').classList.remove('show');
    state.imageToResize = null;
}

/**
 * Aplica o redimensionamento da imagem
 */
export function applyImageResize() {
    if (!state.imageToResize) return;

    const newWidth = parseInt(document.getElementById('imageWidthInput').value, 10);
    if (isNaN(newWidth) || newWidth <= 0) {
        alert('Por favor, insira um valor de largura válido.');
        return;
    }

    const maintainAspectRatio = document.getElementById('aspectRatioToggle').checked;
    if (maintainAspectRatio) {
        const ratio = state.imageToResize.naturalHeight / state.imageToResize.naturalWidth;
        state.imageToResize.style.width = newWidth + 'px';
        state.imageToResize.style.height = (newWidth * ratio) + 'px';
    } else {
        state.imageToResize.style.width = newWidth + 'px';
        state.imageToResize.style.height = 'auto';
    }

    closeImageResizeModal();
}

/**
 * Configura listener para clique em imagens (abre redimensionamento)
 */
export function setupImageToggling() {
    document.body.addEventListener('click', (event) => {
        if (event.target.tagName === 'IMG' && event.target.closest('.rich-editor, .block-content-editor')) {
            event.preventDefault();
            openImageResizeModal(event.target);
        }
    });
}

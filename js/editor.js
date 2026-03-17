/* ============================================
   EDITOR — Rich text, formatação, cores, imagens (drag resize + Ctrl+V)
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

/* =========================================
   IMAGE DRAG RESIZE — Clicar e arrastar para redimensionar
   ========================================= */

let resizingImage = null;
let resizeStartX = 0;
let resizeStartWidth = 0;

function onImageMouseDown(e) {
    if (e.target.tagName !== 'IMG') return;
    if (!e.target.closest('.rich-editor, .block-content-editor')) return;

    e.preventDefault();
    resizingImage = e.target;
    resizeStartX = e.clientX || (e.touches && e.touches[0].clientX);
    resizeStartWidth = resizingImage.offsetWidth;
    resizingImage.classList.add('img-resizing');
    document.addEventListener('mousemove', onImageMouseMove);
    document.addEventListener('mouseup', onImageMouseUp);
    document.addEventListener('touchmove', onImageMouseMove, { passive: false });
    document.addEventListener('touchend', onImageMouseUp);
}

function onImageMouseMove(e) {
    if (!resizingImage) return;
    e.preventDefault();
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const delta = clientX - resizeStartX;
    const newWidth = Math.max(50, resizeStartWidth + delta);
    const ratio = resizingImage.naturalHeight / resizingImage.naturalWidth;
    resizingImage.style.width = newWidth + 'px';
    resizingImage.style.height = Math.round(newWidth * ratio) + 'px';
}

function onImageMouseUp() {
    if (resizingImage) {
        resizingImage.classList.remove('img-resizing');
        resizingImage = null;
    }
    document.removeEventListener('mousemove', onImageMouseMove);
    document.removeEventListener('mouseup', onImageMouseUp);
    document.removeEventListener('touchmove', onImageMouseMove);
    document.removeEventListener('touchend', onImageMouseUp);
}

/* =========================================
   CTRL+V — Colar imagens da área de transferência
   ========================================= */

function onEditorPaste(e) {
    const editor = e.target.closest('.rich-editor, .block-content-editor');
    if (!editor) return;

    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
        if (item.type.startsWith('image/')) {
            e.preventDefault();
            const blob = item.getAsFile();
            const reader = new FileReader();
            reader.onload = function(ev) {
                editor.focus();
                document.execCommand('insertHTML', false, `<img src="${ev.target.result}" style="max-width:100%;" />`);
            };
            reader.readAsDataURL(blob);
            return;
        }
    }
}

/**
 * Configura listeners para imagens (drag resize + paste)
 */
export function setupImageToggling() {
    // Drag resize: mousedown on images
    document.body.addEventListener('mousedown', onImageMouseDown);
    document.body.addEventListener('touchstart', onImageMouseDown, { passive: false });

    // Ctrl+V paste images
    document.body.addEventListener('paste', onEditorPaste);
}

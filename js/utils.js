/* ============================================
   UTILS — Funções utilitárias reutilizáveis
   ============================================ */

export const TEXT_COLORS = [
    'initial', '#000000', '#e60000', '#ff9900', '#ffff00',
    '#008a00', '#0066cc', '#9933ff', '#ffffff', '#facccc',
    '#ffebcc', '#ffffcc', '#cce8cc', '#cce0f5', '#ebd6ff'
];

/**
 * Colunas padrão para novos usuários
 */
export const DEFAULT_COLUMNS = [
    { id: 'notes', title: 'Anotações', position: 0, is_done: false },
    { id: 'to-do', title: 'A fazer', position: 1, is_done: false },
    { id: 'in-progress', title: 'Em progresso', position: 2, is_done: false },
    { id: 'impediment', title: 'Aguardando', position: 3, is_done: false },
    { id: 'agenda', title: 'Agendas', position: 4, is_done: false },
    { id: 'completed', title: 'Concluídas', position: 5, is_done: true }
];

/**
 * Gera HTML da paleta de cores de texto.
 * @param {string} actionFunctionName - Nome da função global a chamar ao clicar
 */
export function generateColorPaletteHTML(actionFunctionName) {
    let html = '<div class="text-color-wrapper">🎨<div class="text-color-palette">';

    TEXT_COLORS.forEach(color => {
        const isAnalysis = actionFunctionName.includes('Analysis');
        const action = isAnalysis
            ? `onmousedown="event.preventDefault(); ${actionFunctionName}(this, 'foreColor', '${color}')"`
            : `onmousedown="event.preventDefault(); ${actionFunctionName}('foreColor', '${color}')"`;

        if (color === 'initial') {
            html += `<div class="text-color-option" style="background:linear-gradient(to bottom right, #000 49%, #FFF 51%);" title="Cor Padrão" ${action}></div>`;
        } else {
            html += `<div class="text-color-option" style="background-color:${color};" ${action}></div>`;
        }
    });

    html += '</div></div>';
    return html;
}

/**
 * Alterna seções colapsáveis
 */
export function toggleCollapsible(contentId) {
    const content = document.getElementById(contentId);
    if (!content) return;
    const header = content.previousElementSibling;
    content.classList.toggle('show');
    header.classList.toggle('open');
}

/**
 * Exibe uma notificação toast
 */
export function showToast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span class="toast-msg">${escapeHtml(message)}</span>`;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    }, duration);
}

/**
 * Escape HTML para prevenir XSS em toasts
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Gera um ID de coluna a partir do título
 */
export function generateColumnId(title) {
    return title.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || crypto.randomUUID();
}

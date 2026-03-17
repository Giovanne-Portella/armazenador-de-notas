/* ============================================
   UTILS — Funções utilitárias reutilizáveis
   ============================================ */

export const TEXT_COLORS = [
    'initial', '#000000', '#e60000', '#ff9900', '#ffff00',
    '#008a00', '#0066cc', '#9933ff', '#ffffff', '#facccc',
    '#ffebcc', '#ffffcc', '#cce8cc', '#cce0f5', '#ebd6ff'
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
 * Mapeamento de colunas: título -> id do status
 */
export const COLUMN_STATUS_MAP = {
    'Anotações': 'notes',
    'A fazer': 'to-do',
    'Em progresso': 'in-progress',
    'Aguardando': 'impediment',
    'Agendas': 'agenda',
    'Concluídas': 'completed'
};

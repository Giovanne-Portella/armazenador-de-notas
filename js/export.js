/* ============================================
   EXPORT — Exportação de notas e análises (PDF)
   ============================================ */

import state, { saveNotes, saveAnalyses, bulkInsertAnalyses } from './state.js';
import { renderColumns } from './render.js';
import { renderAnalysisBlocks } from './analysis.js';
import { showToast } from './utils.js';

/* =========================================
   NOTAS — PDF Export (melhorado e customizável)
   ========================================= */

export function showPDFExportModal() {
    const modal = document.getElementById('pdfExportModal');
    const body = modal.querySelector('.modal-body');

    const groups = new Set(state.notes.map(n => n.group).filter(Boolean));
    let groupOptionsHTML = '';
    groups.forEach(g => { groupOptionsHTML += `<option value="${g}">${g}</option>`; });

    // Colunas dinâmicas para filtro
    let columnOptionsHTML = '';
    state.columns.forEach(c => { columnOptionsHTML += `<option value="${c.id}">${c.title}</option>`; });

    body.innerHTML = `
        <h3 class="section-label">Quais notas exportar?</h3>
        <div class="export-options-container">
            <label><span>Todas as notas</span><input type="radio" name="pdfExportType" value="all" checked></label>
            <label><span>Por grupo específico</span><input type="radio" name="pdfExportType" value="group"></label>
            <label><span>Por coluna específica</span><input type="radio" name="pdfExportType" value="column"></label>
        </div>
        <div id="pdfGroupSelectDiv" class="form-field" hidden>
            <select id="pdfGroupSelect">${groupOptionsHTML}</select>
        </div>
        <div id="pdfColumnSelectDiv" class="form-field" hidden>
            <select id="pdfColumnSelect">${columnOptionsHTML}</select>
        </div>

        <h3 class="section-label">Aparência do PDF</h3>
        <div class="export-options-container">
            <label><span>Incluir metadados (grupo, data, coluna)</span><input type="checkbox" id="includeMetadata" checked></label>
            <label><span>Incluir cores das notas</span><input type="checkbox" id="includeColors" checked></label>
            <label><span>Incluir índice das notas</span><input type="checkbox" id="includeIndex"></label>
            <label><span>Uma nota por página</span><input type="checkbox" id="onePerPage"></label>
        </div>
        <div class="modal-actions">
            <button class="secondary" onclick="window.closePDFExportModal()">Cancelar</button>
            <button class="success" onclick="window.exportNotesToPdf()">Exportar PDF</button>
        </div>
    `;

    modal.querySelectorAll('input[name="pdfExportType"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            document.getElementById('pdfGroupSelectDiv').hidden = e.target.value !== 'group';
            document.getElementById('pdfColumnSelectDiv').hidden = e.target.value !== 'column';
        });
    });

    modal.classList.add('show');
}

export function closePDFExportModal() {
    document.getElementById('pdfExportModal').classList.remove('show');
}

const NOTE_COLOR_MAP = {
    red: [254, 242, 242], blue: [239, 246, 255], green: [240, 253, 244],
    yellow: [255, 251, 235], orange: [255, 247, 237], purple: [250, 245, 255],
    pink: [253, 242, 248], cyan: [236, 254, 255], lime: [247, 254, 231],
    indigo: [238, 242, 255], gray: [248, 250, 252]
};

export async function exportNotesToPdf() {
    const exportType = document.querySelector('#pdfExportModal input[name="pdfExportType"]:checked').value;
    const includeMetadata = document.querySelector('#pdfExportModal #includeMetadata').checked;
    const includeColors = document.querySelector('#pdfExportModal #includeColors').checked;
    const includeIndex = document.querySelector('#pdfExportModal #includeIndex').checked;
    const onePerPage = document.querySelector('#pdfExportModal #onePerPage').checked;
    const groupSelect = document.querySelector('#pdfExportModal #pdfGroupSelect');
    const columnSelect = document.querySelector('#pdfExportModal #pdfColumnSelect');

    let notesToExport = [];
    if (exportType === 'all') notesToExport = state.notes;
    else if (exportType === 'group' && groupSelect) notesToExport = state.notes.filter(n => n.group === groupSelect.value);
    else if (exportType === 'column' && columnSelect) notesToExport = state.notes.filter(n => n.status === columnSelect.value);

    if (notesToExport.length === 0) {
        showToast('Nenhuma nota para exportar com os filtros selecionados.', 'warning');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const margin = 15;
    const usableWidth = doc.internal.pageSize.width - margin * 2;
    const pageHeight = doc.internal.pageSize.height;
    let y = margin;

    // Helper: cor de fundo
    const applyNoteColor = (note) => {
        if (includeColors && NOTE_COLOR_MAP[note.color]) {
            const [r, g, b] = NOTE_COLOR_MAP[note.color];
            doc.setFillColor(r, g, b);
            return true;
        }
        return false;
    };

    // Capa
    doc.setFontSize(22);
    doc.setTextColor(59, 130, 246);
    doc.text('Relatório de Notas', margin, 40);
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR')}`, margin, 50);
    doc.text(`Total de notas: ${notesToExport.length}`, margin, 57);
    const colName = state.columns.find(c => c.id === notesToExport[0]?.status)?.title;
    if (exportType !== 'all' && colName) {
        doc.text(`Filtro: ${colName}`, margin, 64);
    }
    y = 80;

    // Índice (opcional)
    if (includeIndex) {
        doc.setFontSize(14);
        doc.setTextColor(30);
        doc.text('Índice', margin, y);
        y += 8;
        doc.setFontSize(10);
        doc.setTextColor(80);
        notesToExport.forEach((note, i) => {
            if (y > pageHeight - 20) { doc.addPage(); y = margin; }
            doc.text(`${i + 1}. ${note.title}`, margin + 4, y);
            y += 6;
        });
        doc.addPage();
        y = margin;
    }

    // Notas
    for (let i = 0; i < notesToExport.length; i++) {
        const note = notesToExport[i];
        if (onePerPage && i > 0) { doc.addPage(); y = margin; }

        // Separador entre notas
        if (!onePerPage && i > 0) {
            if (y > pageHeight - 60) { doc.addPage(); y = margin; }
            doc.setDrawColor(220);
            doc.line(margin, y, margin + usableWidth, y);
            y += 8;
        }

        // Fundo colorido
        if (applyNoteColor(note)) {
            const blockHeight = Math.min(40, pageHeight - y - margin);
            doc.roundedRect(margin - 2, y - 5, usableWidth + 4, blockHeight, 3, 3, 'F');
        }

        // Título
        doc.setFontSize(14);
        doc.setTextColor(30);
        const titleLines = doc.splitTextToSize(note.title, usableWidth);
        doc.text(titleLines, margin, y);
        y += titleLines.length * 7;

        // Metadados
        if (includeMetadata) {
            doc.setFontSize(9);
            doc.setTextColor(120);
            const col = state.columns.find(c => c.id === note.status);
            const meta = [];
            if (note.group) meta.push(`Grupo: ${note.group}`);
            if (col) meta.push(`Coluna: ${col.title}`);
            meta.push(`Criado: ${new Date(note.createdAt).toLocaleDateString('pt-BR')}`);
            if (note.reminderAt) meta.push(`Lembrete: ${new Date(note.reminderAt).toLocaleString('pt-BR')}`);
            doc.text(meta.join('  |  '), margin, y);
            y += 7;
        }

        // Conteúdo renderizado via html2canvas
        doc.setTextColor(0);
        const tempDiv = document.createElement('div');
        tempDiv.className = 'pdf-export-content';
        tempDiv.style.width = '180mm';
        tempDiv.innerHTML = note.content;
        document.body.appendChild(tempDiv);

        try {
            const canvas = await html2canvas(tempDiv, { scale: 2, logging: false });
            const imgHeight = (canvas.height * usableWidth) / canvas.width;

            if (y + imgHeight > pageHeight - margin) { doc.addPage(); y = margin; }
            const imgData = canvas.toDataURL('image/png');
            doc.addImage(imgData, 'PNG', margin, y, usableWidth, imgHeight);
            y += imgHeight + 8;
        } catch (err) {
            console.error('Erro ao renderizar nota:', err);
            y += 5;
        } finally {
            document.body.removeChild(tempDiv);
        }

        if (y > pageHeight - margin) { doc.addPage(); y = margin; }
    }

    // Rodapé com numeração de páginas
    const totalPages = doc.internal.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Página ${p} de ${totalPages}`, doc.internal.pageSize.width - margin - 25, pageHeight - 8);
    }

    doc.save('notas.pdf');
    closePDFExportModal();
    showToast('PDF exportado com sucesso!', 'success');
}

/* =========================================
   ANÁLISES — Export/Import
   ========================================= */

export function openAnalysisExportModal(format) {
    const modal = document.getElementById('analysisExportModal');
    const title = document.getElementById('analysisExportModalTitle');
    const list = document.getElementById('analysisExportOptionsList');
    const btn = document.getElementById('confirmAnalysisExportBtn');
    const selectAllContainer = document.getElementById('selectAllContainer');

    title.textContent = `Exportar Análises para ${format.toUpperCase()}`;

    selectAllContainer.innerHTML = `
        <label>
            <span><strong>Selecionar Todas</strong></span>
            <input type="checkbox" onchange="window.toggleAllAnalysesForExport(this.checked)">
        </label>
    `;

    list.innerHTML = '';
    if (state.analyses.length === 0) {
        list.innerHTML = '<p>Nenhuma análise para exportar.</p>';
    } else {
        state.analyses.forEach(analysis => {
            list.innerHTML += `
                <label>
                    <span>${analysis.title}</span>
                    <input type="checkbox" class="analysis-export-item" value="${analysis.id}">
                </label>
            `;
        });
    }

    btn.onclick = () => exportAnalyses(format);
    modal.classList.add('show');
}

export function closeAnalysisExportModal() {
    document.getElementById('analysisExportModal').classList.remove('show');
}

export function toggleAllAnalysesForExport(checked) {
    document.querySelectorAll('.analysis-export-item').forEach(cb => {
        cb.checked = checked;
    });
}

/* === Helpers de PDF === */

async function resizeImageSrc(originalSrc, maxWidth) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
            let width = image.width;
            let height = image.height;
            if (width > maxWidth) {
                height = (maxWidth / width) * height;
                width = maxWidth;
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            canvas.getContext('2d').drawImage(image, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.75));
        };
        image.onerror = reject;
        image.src = originalSrc;
    });
}

function addCanvasSlicesToPdf(doc, canvas, currentY, margin, usableWidth) {
    const pageHeight = doc.internal.pageSize.height;
    let y = currentY;
    let canvasHeightLeft = canvas.height;
    let canvasY = 0;

    while (canvasHeightLeft > 0) {
        let spaceLeftOnPage = pageHeight - y - margin;
        if (spaceLeftOnPage <= 1) {
            doc.addPage();
            y = margin;
            spaceLeftOnPage = pageHeight - y - margin;
        }

        const pdfToCanvasRatio = canvas.width / usableWidth;
        const heightToDrawInPixels = Math.min(canvasHeightLeft, spaceLeftOnPage * pdfToCanvasRatio);
        if (heightToDrawInPixels <= 0) break;

        const heightToDrawInMm = heightToDrawInPixels / pdfToCanvasRatio;
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = heightToDrawInPixels;
        const sliceCtx = sliceCanvas.getContext('2d');
        sliceCtx.drawImage(canvas, 0, canvasY, canvas.width, heightToDrawInPixels, 0, 0, canvas.width, heightToDrawInPixels);

        const sliceImgData = sliceCanvas.toDataURL('image/jpeg', 0.9);
        doc.addImage(sliceImgData, 'JPEG', margin, y, usableWidth, heightToDrawInMm);

        y += heightToDrawInMm;
        canvasY += heightToDrawInPixels;
        canvasHeightLeft -= heightToDrawInPixels;
    }
    return y;
}

export async function exportAnalyses(format) {
    const selectedIds = Array.from(document.querySelectorAll('.analysis-export-item:checked'))
        .map(cb => cb.value);
    const analysesToExport = state.analyses.filter(a => selectedIds.includes(a.id));

    if (analysesToExport.length === 0) {
        showToast('Nenhuma análise selecionada para exportar.', 'warning');
        return;
    }

    if (format === 'pdf') {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

        const margin = 15;
        const usableWidth = doc.internal.pageSize.width - margin * 2;
        const pageHeight = doc.internal.pageSize.height;
        let y = margin;

        const renderHtmlBuffer = async (htmlBuffer) => {
            if (htmlBuffer.trim() === '') return y;
            const tempDiv = document.createElement('div');
            tempDiv.className = 'pdf-export-content';
            tempDiv.style.width = `${usableWidth}mm`;
            tempDiv.innerHTML = htmlBuffer;
            document.body.appendChild(tempDiv);

            try {
                const canvas = await html2canvas(tempDiv, { scale: 2, useCORS: true, logging: false });
                y = addCanvasSlicesToPdf(doc, canvas, y, margin, usableWidth);
            } catch (error) {
                console.error('html2canvas falhou:', error);
                if ((pageHeight - y - margin) < 10) { doc.addPage(); y = margin; }
                doc.setTextColor(255, 0, 0).text('[Erro ao renderizar bloco]', margin, y).setTextColor(0);
                y += 10;
            } finally {
                document.body.removeChild(tempDiv);
            }
            return y;
        };

        for (let i = 0; i < analysesToExport.length; i++) {
            const analysis = analysesToExport[i];
            if (i > 0 && y > pageHeight - 40) { doc.addPage(); y = margin; }

            doc.setFontSize(16);
            const titleLines = doc.splitTextToSize(analysis.title, usableWidth);
            doc.text(titleLines, margin, y);
            y += (titleLines.length * 7);

            doc.setFontSize(10).setTextColor(100);
            doc.text(`Criado em: ${new Date(analysis.createdAt).toLocaleDateString()}`, margin, y);
            y += 10;
            doc.setTextColor(0);

            for (const block of analysis.blocks) {
                if ((pageHeight - y - margin) < 25 && y > margin) { doc.addPage(); y = margin; }
                doc.setDrawColor(220).line(margin, y, margin + usableWidth, y);
                y += 5;

                const tempParser = document.createElement('div');
                tempParser.innerHTML = block.content;
                const nodes = Array.from(tempParser.childNodes);
                let htmlBuffer = '';

                for (const node of nodes) {
                    if (node.nodeName === 'IMG' && node.src && node.src.startsWith('data:image')) {
                        y = await renderHtmlBuffer(htmlBuffer);
                        htmlBuffer = '';
                        try {
                            const resizedSrc = await resizeImageSrc(node.src, 800);
                            const imageElement = new Image();
                            imageElement.src = resizedSrc;
                            await new Promise(resolve => { imageElement.onload = resolve; });

                            const imgCanvas = document.createElement('canvas');
                            imgCanvas.width = imageElement.width;
                            imgCanvas.height = imageElement.height;
                            imgCanvas.getContext('2d').drawImage(imageElement, 0, 0);
                            y = addCanvasSlicesToPdf(doc, imgCanvas, y, margin, usableWidth);
                        } catch (e) {
                            console.error('Falha ao processar imagem:', e);
                            if ((pageHeight - y - margin) < 10) { doc.addPage(); y = margin; }
                            doc.setTextColor(255, 0, 0).text('[Erro ao renderizar imagem]', margin, y).setTextColor(0);
                            y += 10;
                        }
                    } else {
                        htmlBuffer += node.outerHTML || node.textContent;
                    }
                }
                y = await renderHtmlBuffer(htmlBuffer);
                y += 5;
            }
            y += 10;
        }
        doc.save('analises.pdf');

    } else if (format === 'json') {
        const blob = new Blob([JSON.stringify(analysesToExport, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'analises.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    closeAnalysisExportModal();
}

export function importAnalysesJSON() {
    const file = document.getElementById('importAnalysesFile').files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            if (!Array.isArray(importedData)) throw new Error('O arquivo JSON não é um array válido.');

            const newAnalyses = importedData.map(analysis => ({
                id: crypto.randomUUID(),
                title: analysis.title || 'Análise Importada',
                blocks: analysis.blocks && analysis.blocks.length > 0 ? analysis.blocks : [{ id: Date.now(), content: '' }],
                createdAt: analysis.createdAt || new Date().toISOString()
            }));

            state.analyses.push(...newAnalyses);
            saveAnalyses();
            bulkInsertAnalyses(newAnalyses);
            renderAnalysisBlocks();
            showToast(`${newAnalyses.length} análise(s) importada(s) com sucesso!`, 'success');
        } catch (error) {
            showToast('Erro ao importar arquivo: ' + error.message, 'error');
        }
    };
    reader.readAsText(file);
    document.getElementById('importAnalysesFile').value = '';
}

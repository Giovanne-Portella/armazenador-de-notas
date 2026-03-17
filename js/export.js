/* ============================================
   EXPORT — Exportação/Importação de notas e análises (PDF, JSON)
   ============================================ */

import state, { saveNotes, saveAnalyses, bulkInsertNotes, bulkInsertAnalyses } from './state.js';
import { renderColumns } from './render.js';
import { renderAnalysisBlocks } from './analysis.js';

/* =========================================
   NOTAS — PDF Export
   ========================================= */

export function showPDFExportModal() {
    const modal = document.getElementById('pdfExportModal');
    const body = modal.querySelector('.modal-body');

    const groups = new Set(state.notes.map(n => n.group).filter(Boolean));
    let groupOptionsHTML = '';
    groups.forEach(g => { groupOptionsHTML += `<option value="${g}">${g}</option>`; });

    body.innerHTML = `
        <h3 class="section-label">Quais notas exportar?</h3>
        <div class="export-options-container">
            <label><span>Todas as notas</span><input type="radio" name="pdfExportType" value="all" checked></label>
            <label><span>Apenas notas ativas</span><input type="radio" name="pdfExportType" value="active"></label>
            <label><span>Apenas notas concluídas</span><input type="radio" name="pdfExportType" value="completed"></label>
            <label><span>Por grupo específico</span><input type="radio" name="pdfExportType" value="group"></label>
        </div>
        <div id="pdfGroupSelectDiv" class="form-field" hidden>
            <select id="pdfGroupSelect">${groupOptionsHTML}</select>
        </div>
        <div class="export-options-container">
            <label><span>Incluir metadados (grupo, data)</span><input type="checkbox" id="includeMetadata" checked></label>
        </div>
        <div class="modal-actions">
            <button class="secondary" onclick="window.closePDFExportModal()">Cancelar</button>
            <button class="success" onclick="window.exportNotesToPdf()">Exportar</button>
        </div>
    `;

    modal.querySelectorAll('input[name="pdfExportType"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            document.getElementById('pdfGroupSelectDiv').hidden = e.target.value !== 'group';
        });
    });

    modal.classList.add('show');
}

export function closePDFExportModal() {
    document.getElementById('pdfExportModal').classList.remove('show');
}

export async function exportNotesToPdf() {
    const exportType = document.querySelector('#pdfExportModal input[name="pdfExportType"]:checked').value;
    const includeMetadata = document.querySelector('#pdfExportModal #includeMetadata').checked;
    const groupSelect = document.querySelector('#pdfExportModal #pdfGroupSelect');
    const group = groupSelect ? groupSelect.value : '';

    let notesToExport = [];
    if (exportType === 'all') notesToExport = state.notes;
    else if (exportType === 'active') notesToExport = state.notes.filter(n => n.status !== 'completed');
    else if (exportType === 'completed') notesToExport = state.notes.filter(n => n.status === 'completed');
    else if (exportType === 'group' && group) notesToExport = state.notes.filter(n => n.group === group);

    if (notesToExport.length === 0) {
        alert('Nenhuma nota para exportar com os filtros selecionados.');
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let y = 10;
    const margin = 10;
    const pageHeight = doc.internal.pageSize.height;

    for (const note of notesToExport) {
        doc.setFontSize(16);
        doc.text(note.title, margin, y);
        y += 10;

        if (includeMetadata) {
            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text(`Grupo: ${note.group || 'N/A'}`, margin, y); y += 6;
            doc.text(`Criado em: ${new Date(note.createdAt).toLocaleDateString()}`, margin, y); y += 6;
            doc.setTextColor(0);
        }

        const tempDiv = document.createElement('div');
        tempDiv.className = 'pdf-export-content';
        tempDiv.innerHTML = note.content;
        document.body.appendChild(tempDiv);

        const canvas = await html2canvas(tempDiv, { scale: 2 });
        const imgData = canvas.toDataURL('image/png');
        const imgHeight = (canvas.height * 180) / canvas.width;

        if (y + imgHeight > pageHeight - margin) { doc.addPage(); y = margin; }
        doc.addImage(imgData, 'PNG', margin, y, 180, imgHeight);
        y += imgHeight + 10;
        document.body.removeChild(tempDiv);
        if (y > pageHeight - margin) { doc.addPage(); y = margin; }
    }

    doc.save('notas.pdf');
    closePDFExportModal();
}

/* =========================================
   NOTAS — JSON Export/Import
   ========================================= */

export function showJSONExportModal() {
    const modal = document.getElementById('jsonExportModal');
    const container = document.getElementById('jsonExportOptionsContainer');
    const groups = new Set(state.notes.map(n => n.group).filter(Boolean));
    let groupOptionsHTML = '';
    groups.forEach(g => { groupOptionsHTML += `<option value="${g}">${g}</option>`; });

    container.innerHTML = `
        <div class="export-options-container">
            <label><span>Todas as notas</span><input type="radio" name="jsonExportType" value="all" checked></label>
            <label><span>Apenas notas ativas</span><input type="radio" name="jsonExportType" value="active"></label>
            <label><span>Apenas notas concluídas</span><input type="radio" name="jsonExportType" value="completed"></label>
            <label><span>Por grupo específico</span><input type="radio" name="jsonExportType" value="group"></label>
        </div>
        <div id="jsonGroupSelectDiv" class="form-field" hidden>
            <select id="jsonGroupSelect">${groupOptionsHTML}</select>
        </div>
    `;

    modal.querySelectorAll('input[name="jsonExportType"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            document.getElementById('jsonGroupSelectDiv').hidden = e.target.value !== 'group';
        });
    });

    modal.classList.add('show');
}

export function closeJSONExportModal() {
    document.getElementById('jsonExportModal').classList.remove('show');
}

export function exportNotesToJson() {
    const exportType = document.querySelector('#jsonExportModal input[name="jsonExportType"]:checked').value;
    const groupSelect = document.querySelector('#jsonExportModal #jsonGroupSelect');
    const group = groupSelect ? groupSelect.value : '';

    let notesToExport = [];
    if (exportType === 'all') notesToExport = state.notes;
    else if (exportType === 'active') notesToExport = state.notes.filter(n => n.status !== 'completed');
    else if (exportType === 'completed') notesToExport = state.notes.filter(n => n.status === 'completed');
    else if (exportType === 'group' && group) notesToExport = state.notes.filter(n => n.group === group);

    if (notesToExport.length === 0) {
        alert('Nenhuma nota para exportar com os filtros selecionados.');
        return;
    }

    const blob = new Blob([JSON.stringify(notesToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'notas.json';
    a.click();
    URL.revokeObjectURL(url);
}

/**
 * Importa notas de arquivo JSON
 * BUG FIX: Input agora está fora de container desktop-only para funcionar no mobile
 */
export function importJSON(inputElement) {
    const file = inputElement.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            if (!Array.isArray(importedData)) throw new Error('O arquivo JSON não é um array válido.');

            const newNotes = importedData.map(note => ({
                id: crypto.randomUUID(),
                title: note.title || 'Sem Título',
                content: note.content || '',
                group: note.group || '',
                color: note.color || 'gray',
                status: note.status || 'to-do',
                createdAt: note.createdAt || new Date().toISOString()
            }));

            state.notes.push(...newNotes);
            saveNotes();
            bulkInsertNotes(newNotes);
            renderColumns();
            alert(`${newNotes.length} nota(s) importada(s) com sucesso!`);
        } catch (error) {
            alert('Erro ao importar arquivo: ' + error.message);
        }
    };
    reader.readAsText(file);
    inputElement.value = '';
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
        alert('Nenhuma análise selecionada para exportar.');
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
            alert(`${newAnalyses.length} análise(s) importada(s) com sucesso!`);
        } catch (error) {
            alert('Erro ao importar arquivo: ' + error.message);
        }
    };
    reader.readAsText(file);
    document.getElementById('importAnalysesFile').value = '';
}

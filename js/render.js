/* ============================================
   RENDER — Renderização de colunas, estatísticas, filtros
   ============================================ */

import state, { saveNotes, upsertNote } from './state.js';

/**
 * Gera o HTML das estatísticas usando data-stat para evitar IDs duplicados
 */
function generateStatsHTML() {
    return `
        <div class="stat-card">
            <div class="stat-icon">📋</div>
            <div class="stat-number" data-stat="active">0</div>
            <div class="stat-label">Ativas</div>
        </div>
        <div class="stat-card">
            <div class="stat-icon">📁</div>
            <div class="stat-number" data-stat="groups">0</div>
            <div class="stat-label">Grupos</div>
        </div>
        <div class="stat-card">
            <div class="stat-icon">✅</div>
            <div class="stat-number" data-stat="completed">0</div>
            <div class="stat-label">Concluídas</div>
        </div>
        <div class="stat-card">
            <div class="stat-icon">📄</div>
            <div class="stat-number" data-stat="total">0</div>
            <div class="stat-label">Total de Notas</div>
        </div>
    `;
}

/**
 * Gera o HTML dos filtros
 */
function generateFiltersHTML() {
    return `
        <input class="keyword-filter" placeholder="🔍 Buscar notas..." type="text"/>
        <select class="group-filter">
            <option value="">Todos os grupos</option>
        </select>
    `;
}

/**
 * Setup da UI Desktop
 */
export function setupDesktopUI() {
    const filtersContainer = document.getElementById('filtersGroup');
    filtersContainer.innerHTML = generateFiltersHTML();

    const statsContainer = document.querySelector('.stats-container-desktop .stats-container');
    statsContainer.innerHTML = generateStatsHTML();
}

/**
 * Setup da UI Mobile — gera HTML próprio em vez de copiar do desktop
 * BUG FIX: Não clona mais IDs duplicados do desktop
 */
export function setupMobileUI() {
    const filtersContainer = document.getElementById('filtersGroupMobile');
    filtersContainer.innerHTML = generateFiltersHTML();

    const statsContainer = document.querySelector('#statsContent .stats-container');
    statsContainer.innerHTML = generateStatsHTML();
}

/**
 * Configura listeners de filtros (keyword + grupo)
 */
export function setupFilters() {
    document.querySelectorAll('.keyword-filter').forEach(input => {
        input.addEventListener('input', renderColumns);
    });
    document.querySelectorAll('.group-filter').forEach(select => {
        select.addEventListener('change', renderColumns);
    });
}

/**
 * Cria o DOM de um card de nota
 */
export function createNoteCard(note) {
    const doneColumnIds = new Set(state.columns.filter(c => c.isDone).map(c => c.id));
    const isDone = doneColumnIds.has(note.status);
    const card = document.createElement('div');
    card.className = `note-card ${isDone ? 'completed' : ''}`;
    card.dataset.id = note.id;
    card.dataset.color = note.color;
    card.draggable = true;

    card.ondragstart = (event) => {
        event.dataTransfer.setData('text', event.target.dataset.id);
        setTimeout(() => event.target.classList.add('dragging'), 0);
    };
    card.ondragend = (event) => {
        event.target.classList.remove('dragging');
        document.querySelectorAll('.column').forEach(col => col.classList.remove('drop-zone'));
    };
    card.onclick = (event) => {
        if (event.target.closest('button') || event.target.tagName === 'IMG') return;
        window.viewNote(note.id);
    };

    // Header
    const noteHeader = document.createElement('div');
    noteHeader.className = 'note-header';

    const noteTitle = document.createElement('h3');
    noteTitle.className = 'note-title';
    noteTitle.textContent = note.title;

    const noteActions = document.createElement('div');
    noteActions.className = 'note-actions';

    const completeBtn = document.createElement('button');
    completeBtn.className = `note-action-btn ${isDone ? 'completed' : ''}`;
    completeBtn.innerHTML = isDone ? '✅' : '✔️';
    completeBtn.title = isDone ? 'Marcar como não concluída' : 'Marcar como concluída';
    completeBtn.onclick = (e) => { e.stopPropagation(); window.toggleComplete(note.id); };

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'note-action-btn danger';
    deleteBtn.innerHTML = '🗑️';
    deleteBtn.title = 'Excluir nota';
    deleteBtn.onclick = (e) => { e.stopPropagation(); window.deleteNote(note.id); };

    noteActions.appendChild(completeBtn);
    noteActions.appendChild(deleteBtn);
    noteHeader.appendChild(noteTitle);
    noteHeader.appendChild(noteActions);
    card.appendChild(noteHeader);

    // Content
    const noteContent = document.createElement('div');
    noteContent.className = 'note-content';
    noteContent.innerHTML = note.content;
    card.appendChild(noteContent);

    // Meta
    const noteMeta = document.createElement('div');
    noteMeta.className = 'note-meta';
    const groupSpan = note.group ? `<span class="note-group">${note.group}</span>` : '';
    const reminderSpan = note.reminderAt ? `<span class="note-reminder-badge" title="Lembrete: ${new Date(note.reminderAt).toLocaleString()}">🔔</span>` : '';
    noteMeta.innerHTML = `${groupSpan}${reminderSpan}<span>${new Date(note.createdAt).toLocaleDateString()}</span>`;
    card.appendChild(noteMeta);

    return card;
}

/**
 * Renderiza todas as colunas com notas filtradas
 */
export function renderColumns() {
    const columnIds = state.columns.map(c => c.id);

    // Limpar conteúdo das colunas (preservando header)
    columnIds.forEach(columnId => {
        const columnEl = document.getElementById(`column-${columnId}`);
        if (columnEl) {
            while (columnEl.children.length > 1) {
                columnEl.removeChild(columnEl.lastChild);
            }
        }
    });

    // Determinar qual container de filtros está visível
    const desktopFilters = document.getElementById('filtersGroup');
    const mobileFilters = document.getElementById('filtersGroupMobile');
    const visibleContainer = desktopFilters.offsetParent ? desktopFilters : mobileFilters;

    const filterInput = visibleContainer.querySelector('.keyword-filter');
    const groupFilter = visibleContainer.querySelector('.group-filter');

    const filterText = filterInput ? filterInput.value.toLowerCase() : '';
    const filterGroup = groupFilter ? groupFilter.value : '';

    // Contar por coluna
    const counts = {};
    columnIds.forEach(id => counts[id] = 0);

    // Filtrar e renderizar
    const filteredNotes = state.notes.filter(note => {
        const noteContentText = new DOMParser()
            .parseFromString(note.content, 'text/html')
            .documentElement.textContent.toLowerCase();
        const textMatch = !filterText || note.title.toLowerCase().includes(filterText) || noteContentText.includes(filterText);
        const groupMatch = !filterGroup || note.group === filterGroup;
        return textMatch && groupMatch;
    });

    filteredNotes.forEach(note => {
        const column = document.getElementById(`column-${note.status}`);
        if (column) {
            column.appendChild(createNoteCard(note));
            counts[note.status] = (counts[note.status] || 0) + 1;
        }
    });

    // Atualizar contadores
    columnIds.forEach(id => {
        const countEl = document.getElementById(`count-${id}`);
        if (countEl) countEl.textContent = counts[id] || 0;
    });

    // Atualizar filtros de grupo
    const groups = new Set(state.notes.map(n => n.group).filter(Boolean));
    document.querySelectorAll('.group-filter').forEach(selectEl => {
        const currentValue = selectEl.value;
        selectEl.innerHTML = '<option value="">Todos os grupos</option>';
        Array.from(groups).sort().forEach(group => {
            const option = document.createElement('option');
            option.value = group;
            option.textContent = group;
            selectEl.appendChild(option);
        });
        selectEl.value = currentValue;
    });

    updateStats();
}

/**
 * Atualiza todas as estatísticas (usa data-stat para queries sem IDs duplicados)
 */
export function updateStats() {
    const doneColumnIds = new Set(state.columns.filter(c => c.isDone).map(c => c.id));
    const totalCompleted = state.notes.filter(n => doneColumnIds.has(n.status)).length;
    const totalActive = state.notes.length - totalCompleted;
    const groups = new Set(state.notes.map(n => n.group).filter(Boolean));

    document.querySelectorAll('[data-stat="active"]').forEach(el => el.textContent = totalActive);
    document.querySelectorAll('[data-stat="groups"]').forEach(el => el.textContent = groups.size);
    document.querySelectorAll('[data-stat="completed"]').forEach(el => el.textContent = totalCompleted);
    document.querySelectorAll('[data-stat="total"]').forEach(el => el.textContent = state.notes.length);
}

/**
 * Configura as colunas Kanban e seus event handlers de drag & drop
 */
export function setupColumns() {
    const container = document.getElementById('columnsContainer');
    container.innerHTML = '';

    const sortedColumns = [...state.columns].sort((a, b) => a.position - b.position);

    sortedColumns.forEach(col => {
        const columnEl = document.createElement('div');
        columnEl.className = 'column';
        columnEl.id = `column-${col.id}`;
        columnEl.ondragover = (e) => {
            e.preventDefault();
            const target = e.target.closest('.column');
            if (target) target.classList.add('drop-zone');
        };
        columnEl.ondrop = (e) => {
            e.preventDefault();
            const id = e.dataTransfer.getData('text');
            const noteEl = document.querySelector(`[data-id="${CSS.escape(id)}"]`);
            if (noteEl) noteEl.classList.remove('dragging');
            const noteIndex = state.notes.findIndex(n => n.id == id);
            if (noteIndex !== -1) {
                state.notes[noteIndex].status = col.id;
                saveNotes();
                upsertNote(state.notes[noteIndex]);
                renderColumns();
            }
            document.querySelectorAll('.column').forEach(c => c.classList.remove('drop-zone'));
        };
        columnEl.ondragleave = (e) => {
            const target = e.target.closest('.column');
            if (target) target.classList.remove('drop-zone');
        };

        columnEl.innerHTML = `
            <div class="column-header">
                <span class="column-title">${col.title}</span>
                <div class="column-header-actions">
                    <button class="column-edit-btn" onclick="openColumnModal('${col.id}')" title="Editar coluna">⚙️</button>
                    <span class="column-count" id="count-${col.id}">0</span>
                </div>
            </div>
        `;
        container.appendChild(columnEl);
    });

    // Botão de adicionar coluna
    const addColBtn = document.createElement('div');
    addColBtn.className = 'column add-column-btn';
    addColBtn.innerHTML = '<span class="add-column-label">＋ Nova Coluna</span>';
    addColBtn.onclick = () => window.openColumnModal();
    container.appendChild(addColBtn);
}

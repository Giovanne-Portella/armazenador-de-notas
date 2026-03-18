/* ============================================
   MINDMAP — Motor do canvas de mapa mental
   Canvas SVG infinito com pan, zoom, nós e conexões
   ============================================ */

import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase.js';
import { initTheme } from './theme.js';
import { requireAuth, signOut, onAuthStateChange } from './auth.js';
import { showToast } from './utils.js';
import { cacheGet, cacheSet, cacheInvalidate } from './cache.js';

/* =========================================
   Constantes
   ========================================= */

const NODE_COLORS = [
    { id: 'blue',   value: '#3b82f6', label: 'Azul' },
    { id: 'green',  value: '#10b981', label: 'Verde' },
    { id: 'yellow', value: '#f59e0b', label: 'Amarelo' },
    { id: 'red',    value: '#ef4444', label: 'Vermelho' },
    { id: 'purple', value: '#8b5cf6', label: 'Roxo' },
    { id: 'pink',   value: '#ec4899', label: 'Rosa' },
    { id: 'orange', value: '#f97316', label: 'Laranja' },
    { id: 'gray',   value: '#6b7280', label: 'Cinza' }
];

const DEFAULT_NODE_WIDTH = 160;
const DEFAULT_NODE_HEIGHT = 60;
const MIN_ZOOM = 0.15;
const MAX_ZOOM = 3;
const AUTOSAVE_INTERVAL = 5 * 60 * 1000; // 5 minutos
let hasPendingChanges = false;
let linkOptionsCache = null;

/* =========================================
   Estado
   ========================================= */

let currentUser = null;
let mindmaps = [];
let currentMap = null;

let selectedNodeId = null;
let selectedConnectionId = null;
let currentTool = 'select';
let connectFromNodeId = null;
let editingNodeId = null;

// Canvas viewport
let viewX = 0, viewY = 0, zoomLevel = 1;
let isPanning = false, isDragging = false;
let panStartX = 0, panStartY = 0;
let dragStartX = 0, dragStartY = 0;
let dragNodeStartX = 0, dragNodeStartY = 0;

// Auto-save
let saveTimer = null;
let isSaving = false;

// Touch
let lastTouchDist = 0;
let lastTouchCenter = { x: 0, y: 0 };
let touchStartTime = 0;
let touchMoved = false;

/* =========================================
   Referências DOM (atribuídas em DOMContentLoaded)
   ========================================= */

let svg, canvasGroup, connectionsLayer, nodesLayer, tempLayer, gridRect;
let textEditor, sidebar, sidebarOverlay, propertiesPanel, mapList;
let saveStatus, zoomLabel, currentMapTitle;

/* =========================================
   Inicialização
   ========================================= */

document.addEventListener('DOMContentLoaded', async () => {
    // Cache DOM
    svg = document.getElementById('mmCanvas');
    canvasGroup = document.getElementById('canvasGroup');
    connectionsLayer = document.getElementById('connectionsLayer');
    nodesLayer = document.getElementById('nodesLayer');
    tempLayer = document.getElementById('tempLayer');
    gridRect = document.getElementById('gridRect');
    textEditor = document.getElementById('nodeTextEditor');
    sidebar = document.getElementById('sidebar');
    sidebarOverlay = document.getElementById('sidebarOverlay');
    propertiesPanel = document.getElementById('propertiesPanel');
    mapList = document.getElementById('mapList');
    saveStatus = document.getElementById('saveStatus');
    zoomLabel = document.getElementById('zoomLabel');
    currentMapTitle = document.getElementById('currentMapTitle');

    // Auth
    const session = await requireAuth();
    if (!session) return;
    currentUser = session.user;

    initTheme();
    setupUserProfile(session);
    setupCanvas();
    setupToolbar();
    setupKeyboard();
    setupBeforeUnload();

    await loadMindmaps();
    loadLinkOptionsCache();

    if (mindmaps.length > 0) {
        await loadMap(mindmaps[0].id);
    } else {
        await createNewMap();
    }

    renderMapList();

    // Show app
    document.getElementById('appLoading').style.display = 'none';
    document.getElementById('appContent').style.display = '';

    onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT') window.location.href = '/login.html';
    });
});

/* =========================================
   Supabase — CRUD de Mapas Mentais
   ========================================= */

async function loadMindmaps() {
    const cached = cacheGet('mindmaps', currentUser.id);
    if (cached) {
        mindmaps = cached.data;
        if (cached.stale) {
            // Revalida em background
            _fetchMindmapsList().catch(() => {});
        }
        return;
    }
    await _fetchMindmapsList();
}

async function _fetchMindmapsList() {
    const { data, error } = await supabase
        .from('mindmaps')
        .select('id, title, created_at, updated_at')
        .eq('user_id', currentUser.id)
        .order('updated_at', { ascending: false });

    if (error) {
        console.error('Erro ao carregar mapas:', error);
        showToast('Erro ao carregar mapas mentais', 'error');
        return;
    }
    mindmaps = data || [];
    cacheSet('mindmaps', currentUser.id, mindmaps);
}

async function loadMap(mapId) {
    const { data, error } = await supabase
        .from('mindmaps')
        .select('*')
        .eq('id', mapId)
        .single();

    if (error) {
        console.error('Erro ao carregar mapa:', error);
        showToast('Erro ao carregar mapa', 'error');
        return;
    }

    currentMap = {
        id: data.id,
        title: data.title,
        nodes: data.nodes || [],
        connections: data.connections || [],
        viewport: data.viewport || { x: 0, y: 0, zoom: 1 }
    };

    viewX = currentMap.viewport.x;
    viewY = currentMap.viewport.y;
    zoomLevel = currentMap.viewport.zoom;

    updateCanvasTransform();
    renderAll();
    updateTitle();
    deselectAll();
}

async function createNewMap() {
    const { data, error } = await supabase
        .from('mindmaps')
        .insert({
            user_id: currentUser.id,
            title: 'Novo Mapa Mental',
            nodes: [],
            connections: [],
            viewport: { x: 0, y: 0, zoom: 1 }
        })
        .select()
        .single();

    if (error) {
        console.error('Erro ao criar mapa:', error);
        showToast('Erro ao criar mapa mental', 'error');
        return;
    }

    mindmaps.unshift({
        id: data.id,
        title: data.title,
        created_at: data.created_at,
        updated_at: data.updated_at
    });
    cacheInvalidate('mindmaps', currentUser.id);

    currentMap = {
        id: data.id,
        title: data.title,
        nodes: [],
        connections: [],
        viewport: { x: 0, y: 0, zoom: 1 }
    };

    viewX = 0; viewY = 0; zoomLevel = 1;
    updateCanvasTransform();
    renderAll();
    renderMapList();
    updateTitle();
    deselectAll();
    showToast('Novo mapa criado!', 'success');
}

async function saveMap() {
    if (!currentMap || isSaving) return;

    isSaving = true;
    saveStatus.textContent = 'Salvando...';
    saveStatus.classList.add('saving');
    saveStatus.classList.remove('error');

    currentMap.viewport = { x: viewX, y: viewY, zoom: zoomLevel };

    const { error } = await supabase
        .from('mindmaps')
        .update({
            title: currentMap.title,
            nodes: currentMap.nodes,
            connections: currentMap.connections,
            viewport: currentMap.viewport
        })
        .eq('id', currentMap.id);

    isSaving = false;

    if (error) {
        console.error('Erro ao salvar:', error);
        saveStatus.textContent = 'Erro ao salvar';
        saveStatus.classList.remove('saving');
        saveStatus.classList.add('error');
        return;
    }

    saveStatus.textContent = '✓ Salvo';
    saveStatus.classList.remove('saving');
    hasPendingChanges = false;
    cacheInvalidate('mindmaps', currentUser.id);

    const mapInfo = mindmaps.find(m => m.id === currentMap.id);
    if (mapInfo) {
        mapInfo.title = currentMap.title;
        mapInfo.updated_at = new Date().toISOString();
    }
}

async function deleteMap(mapId) {
    const { error } = await supabase
        .from('mindmaps')
        .delete()
        .eq('id', mapId);

    if (error) {
        console.error('Erro ao deletar mapa:', error);
        showToast('Erro ao deletar mapa', 'error');
        return;
    }

    mindmaps = mindmaps.filter(m => m.id !== mapId);
    cacheInvalidate('mindmaps', currentUser.id);

    if (currentMap && currentMap.id === mapId) {
        if (mindmaps.length > 0) {
            await loadMap(mindmaps[0].id);
        } else {
            await createNewMap();
        }
    }

    renderMapList();
    showToast('Mapa deletado', 'success');
}

function scheduleAutoSave() {
    hasPendingChanges = true;
    saveStatus.textContent = 'Alterações não salvas';
    saveStatus.classList.remove('saving');
}

/* =========================================
   Canvas — Setup, Pan, Zoom
   ========================================= */

function setupCanvas() {
    svg.addEventListener('mousedown', onCanvasMouseDown);
    svg.addEventListener('mousemove', onCanvasMouseMove);
    svg.addEventListener('mouseup', onCanvasMouseUp);
    svg.addEventListener('mouseleave', onCanvasMouseUp);
    svg.addEventListener('wheel', onCanvasWheel, { passive: false });
    svg.addEventListener('dblclick', onCanvasDoubleClick);
    svg.addEventListener('contextmenu', e => e.preventDefault());

    svg.addEventListener('touchstart', onTouchStart, { passive: false });
    svg.addEventListener('touchmove', onTouchMove, { passive: false });
    svg.addEventListener('touchend', onTouchEnd);

    textEditor.addEventListener('blur', stopEditing);
    textEditor.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); stopEditing(); }
        if (e.key === 'Escape') { editingNodeId = null; textEditor.style.display = 'none'; }
    });
}

function updateCanvasTransform() {
    canvasGroup.setAttribute('transform', `translate(${viewX}, ${viewY}) scale(${zoomLevel})`);
    zoomLabel.textContent = Math.round(zoomLevel * 100) + '%';
}

function screenToCanvas(screenX, screenY) {
    const rect = svg.getBoundingClientRect();
    return {
        x: (screenX - rect.left - viewX) / zoomLevel,
        y: (screenY - rect.top - viewY) / zoomLevel
    };
}

/* ---- Mouse events ---- */

function onCanvasMouseDown(e) {
    // Middle button → pan
    if (e.button === 1) { e.preventDefault(); startPan(e.clientX, e.clientY); return; }
    if (e.button !== 0) return;

    stopEditing();

    const target = e.target.closest('.mm-node');
    const connHit = e.target.closest('.mm-connection-hit');
    const connTarget = connHit || e.target.closest('.mm-connection');

    if (currentTool === 'connect' && target) {
        handleConnectClick(target.dataset.id);
        return;
    }

    if (currentTool === 'add') {
        const pos = screenToCanvas(e.clientX, e.clientY);
        addNode(pos.x - DEFAULT_NODE_WIDTH / 2, pos.y - DEFAULT_NODE_HEIGHT / 2);
        return;
    }

    // Select mode
    if (target) {
        selectNode(target.dataset.id);
        startDrag(e.clientX, e.clientY, target.dataset.id);
    } else if (connTarget) {
        const connId = connTarget.dataset.id;
        selectConnection(connId);
    } else {
        deselectAll();
        startPan(e.clientX, e.clientY);
    }
}

function onCanvasMouseMove(e) {
    if (isPanning) doPan(e.clientX, e.clientY);
    else if (isDragging && selectedNodeId) doDrag(e.clientX, e.clientY);

    if (currentTool === 'connect' && connectFromNodeId) drawTempConnection(e.clientX, e.clientY);
}

function onCanvasMouseUp() {
    if (isPanning) stopPan();
    if (isDragging) stopDrag();
}

function onCanvasWheel(e) {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    const newZoom = clampZoom(zoomLevel + delta * zoomLevel);

    const rect = svg.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const ratio = newZoom / zoomLevel;
    viewX = mx - (mx - viewX) * ratio;
    viewY = my - (my - viewY) * ratio;
    zoomLevel = newZoom;

    updateCanvasTransform();
    if (editingNodeId) repositionEditor();
}

function onCanvasDoubleClick(e) {
    const target = e.target.closest('.mm-node');
    if (target) {
        startEditing(target.dataset.id);
    } else if (currentTool === 'select') {
        const pos = screenToCanvas(e.clientX, e.clientY);
        addNode(pos.x - DEFAULT_NODE_WIDTH / 2, pos.y - DEFAULT_NODE_HEIGHT / 2);
    }
}

/* ---- Touch events ---- */

function onTouchStart(e) {
    if (e.touches.length === 2) {
        e.preventDefault();
        isPanning = false; isDragging = false;
        lastTouchDist = getTouchDist(e.touches);
        lastTouchCenter = getTouchCenter(e.touches);
        return;
    }
    if (e.touches.length === 1) {
        touchStartTime = Date.now();
        touchMoved = false;
        const t = e.touches[0];
        const el = document.elementFromPoint(t.clientX, t.clientY);
        const target = el?.closest('.mm-node');

        if (currentTool === 'connect' && target) {
            e.preventDefault();
            handleConnectClick(target.dataset.id);
            return;
        }
        if (currentTool === 'add') {
            e.preventDefault();
            const pos = screenToCanvas(t.clientX, t.clientY);
            addNode(pos.x - DEFAULT_NODE_WIDTH / 2, pos.y - DEFAULT_NODE_HEIGHT / 2);
            return;
        }
        if (target) {
            e.preventDefault();
            selectNode(target.dataset.id);
            startDrag(t.clientX, t.clientY, target.dataset.id);
        } else {
            startPan(t.clientX, t.clientY);
        }
    }
}

function onTouchMove(e) {
    touchMoved = true;
    if (e.touches.length === 2) {
        e.preventDefault();
        const dist = getTouchDist(e.touches);
        const center = getTouchCenter(e.touches);

        const scale = dist / lastTouchDist;
        const newZoom = clampZoom(zoomLevel * scale);

        const rect = svg.getBoundingClientRect();
        const mx = center.x - rect.left;
        const my = center.y - rect.top;
        const ratio = newZoom / zoomLevel;
        viewX = mx - (mx - viewX) * ratio;
        viewY = my - (my - viewY) * ratio;
        viewX += center.x - lastTouchCenter.x;
        viewY += center.y - lastTouchCenter.y;

        zoomLevel = newZoom;
        lastTouchDist = dist;
        lastTouchCenter = center;
        updateCanvasTransform();
        return;
    }
    if (e.touches.length === 1) {
        const t = e.touches[0];
        if (isPanning) doPan(t.clientX, t.clientY);
        else if (isDragging && selectedNodeId) { e.preventDefault(); doDrag(t.clientX, t.clientY); }
    }
}

function onTouchEnd(e) {
    if (isPanning) stopPan();
    if (isDragging) stopDrag();
    lastTouchDist = 0;

    // Double-tap detection (simple: tap without move within 300ms)
    if (!touchMoved && e.changedTouches.length === 1 && (Date.now() - touchStartTime < 300)) {
        const t = e.changedTouches[0];
        const el = document.elementFromPoint(t.clientX, t.clientY);
        const target = el?.closest('.mm-node');
        if (target && selectedNodeId === target.dataset.id) {
            startEditing(target.dataset.id);
        }
    }
}

function getTouchDist(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

function getTouchCenter(touches) {
    return {
        x: (touches[0].clientX + touches[1].clientX) / 2,
        y: (touches[0].clientY + touches[1].clientY) / 2
    };
}

/* ---- Pan ---- */

function startPan(x, y) {
    isPanning = true;
    panStartX = x - viewX;
    panStartY = y - viewY;
    svg.style.cursor = 'grabbing';
}

function doPan(x, y) {
    viewX = x - panStartX;
    viewY = y - panStartY;
    updateCanvasTransform();
}

function stopPan() {
    isPanning = false;
    svg.style.cursor = '';
    if (currentMap) {
        hasPendingChanges = true;
    }
}

/* ---- Drag node ---- */

function startDrag(x, y, nodeId) {
    isDragging = true;
    dragStartX = x;
    dragStartY = y;
    const node = currentMap.nodes.find(n => n.id === nodeId);
    if (node) { dragNodeStartX = node.x; dragNodeStartY = node.y; }
}

function doDrag(x, y) {
    const node = currentMap.nodes.find(n => n.id === selectedNodeId);
    if (!node) return;
    node.x = dragNodeStartX + (x - dragStartX) / zoomLevel;
    node.y = dragNodeStartY + (y - dragStartY) / zoomLevel;
    renderNode(node);
    renderConnectionsForNode(node.id);
}

function stopDrag() {
    if (isDragging) {
        isDragging = false;
        scheduleAutoSave();
    }
}

/* ---- Zoom helpers ---- */

function clampZoom(z) { return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z)); }

function zoomIn() { applyZoomCenter(zoomLevel * 1.2); }
function zoomOut() { applyZoomCenter(zoomLevel / 1.2); }

function applyZoomCenter(newZoom) {
    newZoom = clampZoom(newZoom);
    const rect = svg.getBoundingClientRect();
    const cx = rect.width / 2, cy = rect.height / 2;
    const ratio = newZoom / zoomLevel;
    viewX = cx - (cx - viewX) * ratio;
    viewY = cy - (cy - viewY) * ratio;
    zoomLevel = newZoom;
    updateCanvasTransform();
    hasPendingChanges = true;
}

function fitView() {
    if (!currentMap || currentMap.nodes.length === 0) {
        viewX = svg.getBoundingClientRect().width / 2;
        viewY = svg.getBoundingClientRect().height / 2;
        zoomLevel = 1;
        updateCanvasTransform();
        return;
    }
    const padding = 80;
    const rect = svg.getBoundingClientRect();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of currentMap.nodes) {
        minX = Math.min(minX, n.x);
        minY = Math.min(minY, n.y);
        maxX = Math.max(maxX, n.x + n.width);
        maxY = Math.max(maxY, n.y + n.height);
    }
    const cw = maxX - minX + padding * 2;
    const ch = maxY - minY + padding * 2;
    zoomLevel = Math.min(rect.width / cw, rect.height / ch, 1.5);
    viewX = (rect.width - cw * zoomLevel) / 2 - minX * zoomLevel + padding * zoomLevel;
    viewY = (rect.height - ch * zoomLevel) / 2 - minY * zoomLevel + padding * zoomLevel;
    updateCanvasTransform();
    hasPendingChanges = true;
}

/* =========================================
   Nós — CRUD
   ========================================= */

function addNode(x, y, text = 'Novo nó') {
    if (!currentMap) return;
    const node = {
        id: crypto.randomUUID(),
        text,
        x: Math.round(x),
        y: Math.round(y),
        width: DEFAULT_NODE_WIDTH,
        height: DEFAULT_NODE_HEIGHT,
        color: '#3b82f6',
        shape: 'rounded',
        linkedNoteId: null,
        linkedAnalysisId: null
    };
    currentMap.nodes.push(node);
    renderNode(node);
    selectNode(node.id);
    scheduleAutoSave();
    setTimeout(() => startEditing(node.id), 100);
}

function deleteNode(nodeId) {
    if (!currentMap) return;
    currentMap.nodes = currentMap.nodes.filter(n => n.id !== nodeId);
    currentMap.connections = currentMap.connections.filter(c => c.from !== nodeId && c.to !== nodeId);
    const el = nodesLayer.querySelector(`[data-id="${CSS.escape(nodeId)}"]`);
    if (el) el.remove();
    connectionsLayer.querySelectorAll(`[data-from="${CSS.escape(nodeId)}"], [data-to="${CSS.escape(nodeId)}"]`)
        .forEach(e => e.remove());
    if (selectedNodeId === nodeId) deselectAll();
    scheduleAutoSave();
}

function updateNodeProperty(nodeId, prop, value) {
    const node = currentMap.nodes.find(n => n.id === nodeId);
    if (!node) return;
    node[prop] = value;
    renderNode(node);
    if (prop === 'x' || prop === 'y' || prop === 'width' || prop === 'height' || prop === 'shape') {
        renderConnectionsForNode(nodeId);
    }
    scheduleAutoSave();
}

/* =========================================
   Conexões — CRUD
   ========================================= */

function handleConnectClick(nodeId) {
    if (!connectFromNodeId) {
        connectFromNodeId = nodeId;
        const el = nodesLayer.querySelector(`[data-id="${CSS.escape(nodeId)}"]`);
        if (el) el.classList.add('connect-source');
        showToast('Agora clique no nó de destino', 'info');
    } else if (connectFromNodeId !== nodeId) {
        addConnection(connectFromNodeId, nodeId);
        const el = nodesLayer.querySelector('.connect-source');
        if (el) el.classList.remove('connect-source');
        connectFromNodeId = null;
        clearTempLayer();
    }
}

function addConnection(fromId, toId) {
    if (!currentMap) return;
    if (currentMap.connections.some(c => c.from === fromId && c.to === toId)) {
        showToast('Conexão já existe', 'warning');
        return;
    }
    const conn = {
        id: crypto.randomUUID(),
        from: fromId,
        to: toId,
        label: '',
        style: 'solid'
    };
    currentMap.connections.push(conn);
    renderConnection(conn);
    scheduleAutoSave();
    showToast('Conexão criada!', 'success');
}

function deleteConnection(connId) {
    if (!currentMap) return;
    currentMap.connections = currentMap.connections.filter(c => c.id !== connId);
    connectionsLayer.querySelectorAll(`[data-id="${CSS.escape(connId)}"]`).forEach(e => e.remove());
    if (selectedConnectionId === connId) deselectAll();
    scheduleAutoSave();
}

/* =========================================
   Seleção
   ========================================= */

function selectNode(nodeId) {
    deselectAll();
    selectedNodeId = nodeId;
    const el = nodesLayer.querySelector(`[data-id="${CSS.escape(nodeId)}"]`);
    if (el) el.classList.add('selected');
    showPropertiesPanel(nodeId);
}

function selectConnection(connId) {
    deselectAll();
    selectedConnectionId = connId;
    connectionsLayer.querySelectorAll(`[data-id="${CSS.escape(connId)}"]`)
        .forEach(el => el.classList.add('selected'));
}

function deselectAll() {
    selectedNodeId = null;
    selectedConnectionId = null;
    connectFromNodeId = null;
    nodesLayer.querySelectorAll('.selected, .connect-source')
        .forEach(el => el.classList.remove('selected', 'connect-source'));
    connectionsLayer.querySelectorAll('.selected')
        .forEach(el => el.classList.remove('selected'));
    hidePropertiesPanel();
    clearTempLayer();
}

function deleteSelected() {
    if (selectedNodeId) deleteNode(selectedNodeId);
    else if (selectedConnectionId) deleteConnection(selectedConnectionId);
}

/* =========================================
   Renderização SVG
   ========================================= */

function renderAll() {
    nodesLayer.innerHTML = '';
    connectionsLayer.innerHTML = '';
    tempLayer.innerHTML = '';
    if (!currentMap) return;
    for (const conn of currentMap.connections) renderConnection(conn);
    for (const node of currentMap.nodes) renderNode(node);
}

function renderNode(node) {
    const ns = 'http://www.w3.org/2000/svg';
    let group = nodesLayer.querySelector(`[data-id="${CSS.escape(node.id)}"]`);
    const isNew = !group;

    if (isNew) {
        group = document.createElementNS(ns, 'g');
        group.classList.add('mm-node');
        group.dataset.id = node.id;
        nodesLayer.appendChild(group);
    }

    group.setAttribute('transform', `translate(${node.x}, ${node.y})`);

    const w = node.width, h = node.height;
    const fill = node.color + '20';
    const stroke = node.color;
    let shapeHtml = '';

    switch (node.shape) {
        case 'rectangle':
            shapeHtml = `<rect class="mm-node-shape" width="${w}" height="${h}" rx="2" ry="2" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
            break;
        case 'diamond': {
            const pts = `${w/2},0 ${w},${h/2} ${w/2},${h} 0,${h/2}`;
            shapeHtml = `<polygon class="mm-node-shape" points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
            break;
        }
        case 'circle':
            shapeHtml = `<ellipse class="mm-node-shape" cx="${w/2}" cy="${h/2}" rx="${w/2}" ry="${h/2}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
            break;
        default: // rounded
            shapeHtml = `<rect class="mm-node-shape" width="${w}" height="${h}" rx="12" ry="12" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
    }

    // Link icon
    let linkIcon = '';
    if (node.linkedNoteId) {
        linkIcon = `<text class="mm-link-icon" x="${w - 18}" y="15" font-size="11">📝</text>`;
    } else if (node.linkedAnalysisId) {
        linkIcon = `<text class="mm-link-icon" x="${w - 18}" y="15" font-size="11">📊</text>`;
    }

    // Text wrapping
    const lines = wrapText(node.text, w - 24, 14);
    const startY = (h - lines.length * 18) / 2 + 14;
    const textHtml = lines.map((line, i) =>
        `<text class="mm-node-text" x="${w/2}" y="${startY + i * 18}" text-anchor="middle" font-size="14">${escapeHtml(line)}</text>`
    ).join('');

    group.innerHTML = shapeHtml + textHtml + linkIcon;
}

function renderConnection(conn) {
    const fromNode = currentMap.nodes.find(n => n.id === conn.from);
    const toNode = currentMap.nodes.find(n => n.id === conn.to);
    if (!fromNode || !toNode) return;

    const ns = 'http://www.w3.org/2000/svg';
    const escapedId = CSS.escape(conn.id);

    // Remove existing
    connectionsLayer.querySelectorAll(`[data-id="${escapedId}"]`).forEach(el => el.remove());

    const fromCenter = getNodeCenter(fromNode);
    const toCenter = getNodeCenter(toNode);
    const fromEdge = getEdgePoint(fromNode, toCenter.x, toCenter.y);
    const toEdge = getEdgePoint(toNode, fromCenter.x, fromCenter.y);
    const d = getBezierPath(fromEdge, toEdge);

    // Hit area (invisible wider path for easy clicking)
    const hitPath = document.createElementNS(ns, 'path');
    hitPath.classList.add('mm-connection-hit');
    hitPath.dataset.id = conn.id;
    hitPath.dataset.from = conn.from;
    hitPath.dataset.to = conn.to;
    hitPath.setAttribute('d', d);
    connectionsLayer.appendChild(hitPath);

    // Visible path
    const pathEl = document.createElementNS(ns, 'path');
    pathEl.classList.add('mm-connection');
    pathEl.dataset.id = conn.id;
    pathEl.dataset.from = conn.from;
    pathEl.dataset.to = conn.to;
    pathEl.setAttribute('d', d);
    pathEl.setAttribute('marker-end', 'url(#arrowhead)');
    if (conn.style === 'dashed') {
        pathEl.setAttribute('stroke-dasharray', '6,4');
    }
    connectionsLayer.appendChild(pathEl);
}

function renderConnectionsForNode(nodeId) {
    if (!currentMap) return;
    for (const conn of currentMap.connections) {
        if (conn.from === nodeId || conn.to === nodeId) renderConnection(conn);
    }
}

/* =========================================
   Geometria
   ========================================= */

function getNodeCenter(node) {
    return { x: node.x + node.width / 2, y: node.y + node.height / 2 };
}

function getEdgePoint(node, targetX, targetY) {
    const cx = node.x + node.width / 2;
    const cy = node.y + node.height / 2;
    const dx = targetX - cx;
    const dy = targetY - cy;
    if (dx === 0 && dy === 0) return { x: cx, y: cy };

    if (node.shape === 'circle') {
        const angle = Math.atan2(dy, dx);
        return {
            x: cx + (node.width / 2) * Math.cos(angle),
            y: cy + (node.height / 2) * Math.sin(angle)
        };
    }

    if (node.shape === 'diamond') {
        const hw = node.width / 2, hh = node.height / 2;
        const t = 1 / (Math.abs(dx) / hw + Math.abs(dy) / hh);
        return { x: cx + dx * t, y: cy + dy * t };
    }

    // Rectangle / rounded
    const hw = node.width / 2, hh = node.height / 2;
    const scale = (Math.abs(dx) * hh > Math.abs(dy) * hw)
        ? hw / Math.abs(dx)
        : hh / Math.abs(dy);
    return { x: cx + dx * scale, y: cy + dy * scale };
}

function getBezierPath(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const curv = Math.min(dist * 0.25, 60);

    // Horizontal bias for control points
    const cx1 = from.x + curv * Math.sign(dx || 1);
    const cy1 = from.y;
    const cx2 = to.x - curv * Math.sign(dx || 1);
    const cy2 = to.y;

    return `M ${from.x} ${from.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${to.x} ${to.y}`;
}

/* =========================================
   Texto
   ========================================= */

function wrapText(text, maxWidth, fontSize) {
    const charWidth = fontSize * 0.55;
    const maxChars = Math.max(4, Math.floor(maxWidth / charWidth));
    const lines = [];
    let remaining = text || '';

    while (remaining.length > 0) {
        if (remaining.length <= maxChars) { lines.push(remaining); break; }
        let breakAt = remaining.lastIndexOf(' ', maxChars);
        if (breakAt < maxChars * 0.3) breakAt = maxChars;
        lines.push(remaining.substring(0, breakAt));
        remaining = remaining.substring(breakAt).trim();
        if (lines.length >= 3) {
            lines[2] = lines[2].substring(0, Math.max(1, maxChars - 3)) + '…';
            break;
        }
    }
    return lines.length > 0 ? lines : [''];
}

function escapeHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* =========================================
   Temp layer (desenho temporário de conexão)
   ========================================= */

function drawTempConnection(clientX, clientY) {
    const fromNode = currentMap?.nodes.find(n => n.id === connectFromNodeId);
    if (!fromNode) return;
    const mousePos = screenToCanvas(clientX, clientY);
    const fromEdge = getEdgePoint(fromNode, mousePos.x, mousePos.y);
    tempLayer.innerHTML = `<line x1="${fromEdge.x}" y1="${fromEdge.y}" x2="${mousePos.x}" y2="${mousePos.y}" stroke="var(--primary)" stroke-width="2" stroke-dasharray="6,4" opacity="0.6"/>`;
}

function clearTempLayer() { tempLayer.innerHTML = ''; }

/* =========================================
   Editor de texto overlay
   ========================================= */

function startEditing(nodeId) {
    const node = currentMap?.nodes.find(n => n.id === nodeId);
    if (!node) return;
    editingNodeId = nodeId;
    repositionEditor();
    textEditor.value = node.text;
    textEditor.style.display = 'block';
    textEditor.focus();
    textEditor.select();
}

function repositionEditor() {
    const node = currentMap?.nodes.find(n => n.id === editingNodeId);
    if (!node) return;
    const sx = node.x * zoomLevel + viewX;
    const sy = node.y * zoomLevel + viewY;
    const sw = node.width * zoomLevel;
    const sh = node.height * zoomLevel;
    textEditor.style.left = sx + 'px';
    textEditor.style.top = sy + 'px';
    textEditor.style.width = sw + 'px';
    textEditor.style.height = sh + 'px';
    textEditor.style.fontSize = Math.max(10, 14 * zoomLevel) + 'px';
    textEditor.style.borderRadius = node.shape === 'circle' ? '50%' : '12px';
    textEditor.style.borderColor = node.color;
}

function stopEditing() {
    if (!editingNodeId) return;
    const node = currentMap?.nodes.find(n => n.id === editingNodeId);
    if (node && textEditor.value.trim()) {
        node.text = textEditor.value.trim();
        renderNode(node);
        scheduleAutoSave();
    }
    textEditor.style.display = 'none';
    editingNodeId = null;
}

/* =========================================
   Toolbar
   ========================================= */

function setupToolbar() {
    document.querySelectorAll('.mm-tool[data-tool]').forEach(btn => {
        btn.addEventListener('click', () => setTool(btn.dataset.tool));
    });
}

function setTool(tool) {
    currentTool = tool;
    connectFromNodeId = null;
    clearTempLayer();
    nodesLayer.querySelectorAll('.connect-source').forEach(el => el.classList.remove('connect-source'));
    document.querySelectorAll('.mm-tool[data-tool]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tool === tool);
    });
    svg.style.cursor = tool === 'add' ? 'crosshair' : tool === 'connect' ? 'pointer' : '';
}

/* =========================================
   Painel de Propriedades
   ========================================= */

function showPropertiesPanel(nodeId) {
    const node = currentMap.nodes.find(n => n.id === nodeId);
    if (!node) return;
    propertiesPanel.style.display = '';

    // Texto
    const propText = document.getElementById('propText');
    propText.value = node.text;
    propText.oninput = () => updateNodeProperty(nodeId, 'text', propText.value);

    // Cores
    const colorsDiv = document.getElementById('propColors');
    colorsDiv.innerHTML = NODE_COLORS.map(c =>
        `<button class="mm-color-btn ${node.color === c.value ? 'active' : ''}" style="background:${c.value}" data-color="${c.value}" title="${c.label}"></button>`
    ).join('');
    colorsDiv.onclick = (e) => {
        const btn = e.target.closest('.mm-color-btn');
        if (!btn) return;
        updateNodeProperty(nodeId, 'color', btn.dataset.color);
        colorsDiv.querySelectorAll('.mm-color-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    };

    // Formas
    document.querySelectorAll('#propShapes .mm-shape-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.shape === node.shape);
        btn.onclick = () => {
            updateNodeProperty(nodeId, 'shape', btn.dataset.shape);
            document.querySelectorAll('#propShapes .mm-shape-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        };
    });

    // Vínculo com notas/análises
    populateLinkOptions(node);
}

async function loadLinkOptionsCache() {
    const [notesRes, analysesRes] = await Promise.all([
        supabase.from('notes').select('id, title').eq('user_id', currentUser.id).order('created_at', { ascending: false }),
        supabase.from('analyses').select('id, title').eq('user_id', currentUser.id).order('created_at', { ascending: false })
    ]);
    linkOptionsCache = { notes: notesRes.data || [], analyses: analysesRes.data || [] };
}

async function populateLinkOptions(node) {
    const notesGroup = document.getElementById('propLinkNotes');
    const analysesGroup = document.getElementById('propLinkAnalyses');
    const linkSelect = document.getElementById('propLink');

    if (!linkOptionsCache) await loadLinkOptionsCache();
    const { notes, analyses } = linkOptionsCache;

    notesGroup.innerHTML = notes
        .map(n => `<option value="note:${n.id}">${escapeHtml(n.title)}</option>`).join('');
    analysesGroup.innerHTML = analyses
        .map(a => `<option value="analysis:${a.id}">${escapeHtml(a.title)}</option>`).join('');

    if (node.linkedNoteId) linkSelect.value = `note:${node.linkedNoteId}`;
    else if (node.linkedAnalysisId) linkSelect.value = `analysis:${node.linkedAnalysisId}`;
    else linkSelect.value = '';

    linkSelect.onchange = () => {
        const val = linkSelect.value;
        if (val.startsWith('note:')) {
            updateNodeProperty(node.id, 'linkedNoteId', val.substring(5));
            updateNodeProperty(node.id, 'linkedAnalysisId', null);
        } else if (val.startsWith('analysis:')) {
            updateNodeProperty(node.id, 'linkedAnalysisId', val.substring(9));
            updateNodeProperty(node.id, 'linkedNoteId', null);
        } else {
            updateNodeProperty(node.id, 'linkedNoteId', null);
            updateNodeProperty(node.id, 'linkedAnalysisId', null);
        }
    };
}

function hidePropertiesPanel() {
    propertiesPanel.style.display = 'none';
}

function closeProperties() { deselectAll(); }

/* =========================================
   Sidebar — Lista de mapas
   ========================================= */

function renderMapList() {
    mapList.innerHTML = '';
    if (mindmaps.length === 0) {
        mapList.innerHTML = '<p class="mm-empty">Nenhum mapa criado</p>';
        return;
    }
    mindmaps.forEach(map => {
        const item = document.createElement('div');
        item.className = `mm-map-item ${currentMap?.id === map.id ? 'active' : ''}`;
        item.innerHTML = `
            <div class="mm-map-info">
                <span class="mm-map-name">🗺️ ${escapeHtml(map.title)}</span>
                <span class="mm-map-date">${new Date(map.updated_at || map.created_at).toLocaleDateString()}</span>
            </div>
            <div class="mm-map-actions">
                <button class="mm-map-action" title="Renomear">✏️</button>
                <button class="mm-map-action danger" title="Deletar">🗑️</button>
            </div>
        `;
        // Click to load
        item.querySelector('.mm-map-info').addEventListener('click', async () => {
            if (currentMap && currentMap.id !== map.id) await saveMap();
            await loadMap(map.id);
            renderMapList();
            closeSidebar();
        });
        // Rename
        item.querySelector('.mm-map-action:not(.danger)').addEventListener('click', (e) => {
            e.stopPropagation();
            const newTitle = prompt('Novo nome:', map.title);
            if (newTitle && newTitle.trim()) {
                map.title = newTitle.trim();
                if (currentMap?.id === map.id) { currentMap.title = newTitle.trim(); updateTitle(); }
                supabase.from('mindmaps').update({ title: newTitle.trim() }).eq('id', map.id);
                renderMapList();
                showToast('Mapa renomeado', 'success');
            }
        });
        // Delete
        item.querySelector('.mm-map-action.danger').addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('Deletar este mapa mental?')) deleteMap(map.id);
        });
        mapList.appendChild(item);
    });
}

function updateTitle() {
    if (currentMap) currentMapTitle.textContent = currentMap.title;
}

function closeSidebar() {
    sidebar.classList.remove('open');
}

/* =========================================
   Teclado
   ========================================= */

function setupKeyboard() {
    document.addEventListener('keydown', (e) => {
        const tag = e.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

        switch (e.key) {
            case 'v': case 'V': setTool('select'); break;
            case 'n': case 'N': setTool('add'); break;
            case 'c': case 'C': if (!e.ctrlKey && !e.metaKey) setTool('connect'); break;
            case 'Delete': case 'Backspace': deleteSelected(); break;
            case 'Escape': deselectAll(); setTool('select'); break;
            case 's': case 'S': if (e.ctrlKey || e.metaKey) { e.preventDefault(); saveMap(); } break;
            case '+': case '=': if (e.ctrlKey || e.metaKey) { e.preventDefault(); zoomIn(); } break;
            case '-': if (e.ctrlKey || e.metaKey) { e.preventDefault(); zoomOut(); } break;
            case '0': if (e.ctrlKey || e.metaKey) { e.preventDefault(); fitView(); } break;
        }
    });
}

/* =========================================
   User Profile
   ========================================= */

function setupBeforeUnload() {
    window.addEventListener('beforeunload', (e) => {
        if (hasPendingChanges && currentMap) {
            currentMap.viewport = { x: viewX, y: viewY, zoom: zoomLevel };
            const payload = JSON.stringify({
                title: currentMap.title,
                nodes: currentMap.nodes,
                connections: currentMap.connections,
                viewport: currentMap.viewport
            });
            // Usa session token armazenado no localStorage pelo Supabase
            const storageKey = `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
            let accessToken = SUPABASE_ANON_KEY;
            try {
                const stored = JSON.parse(localStorage.getItem(storageKey));
                if (stored?.access_token) accessToken = stored.access_token;
            } catch { /* fallback to anon key */ }

            const url = `${SUPABASE_URL}/rest/v1/mindmaps?id=eq.${currentMap.id}`;
            fetch(url, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${accessToken}`,
                    'Prefer': 'return=minimal'
                },
                body: payload,
                keepalive: true
            }).catch(() => {});
            e.returnValue = '';
        }
    });

    // Salvar quando a tab fica oculta (alt-tab, minimizar, trocar de aba)
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden' && hasPendingChanges) {
            saveMap();
        }
    });

    // Auto-save a cada 5 minutos se houver alterações pendentes
    setInterval(() => {
        if (hasPendingChanges && currentMap) {
            saveMap();
        }
    }, AUTOSAVE_INTERVAL);
}

function setupUserProfile(session) {
    const user = session.user;
    const avatar = document.getElementById('userAvatar');
    if (avatar && user.user_metadata?.avatar_url) {
        avatar.src = user.user_metadata.avatar_url;
        avatar.alt = user.user_metadata.full_name || 'Avatar';
    }
}

/* =========================================
   Exportar PDF — Full HD Paisagem (1920×1080)
   ========================================= */

async function exportPDF() {
    if (!currentMap || currentMap.nodes.length === 0) {
        showToast('Nenhum nó para exportar', 'warning');
        return;
    }

    showToast('Gerando PDF...', 'info');

    const isDark = document.body.classList.contains('dark-mode');
    const textColor = isDark ? '#e2e8f0' : '#1e293b';
    const connColor = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#3b82f6';

    // 1. Calcular bounding box de todos os nós
    const padding = 60;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of currentMap.nodes) {
        minX = Math.min(minX, n.x);
        minY = Math.min(minY, n.y);
        maxX = Math.max(maxX, n.x + n.width);
        maxY = Math.max(maxY, n.y + n.height);
    }

    const contentW = maxX - minX + padding * 2;
    const contentH = maxY - minY + padding * 2;
    const originX = minX - padding;
    const originY = minY - padding;

    // 2. Construir SVG standalone com todos os estilos inline
    const ns = 'http://www.w3.org/2000/svg';

    // Escalar para Full HD mantendo aspect ratio
    const PDF_W = 1920;
    const PDF_H = 1080;
    const scale = Math.min(PDF_W / contentW, PDF_H / contentH);
    const svgW = contentW * scale;
    const svgH = contentH * scale;

    // Background da página
    const bgColor = getCanvasBgColor();

    let svgParts = [];
    svgParts.push(`<svg xmlns="${ns}" width="${svgW}" height="${svgH}" viewBox="${originX} ${originY} ${contentW} ${contentH}" style="background:${bgColor}">`);

    // Defs — arrow marker
    svgParts.push(`<defs>
        <marker id="ah" markerWidth="12" markerHeight="8" refX="11" refY="4" orient="auto" markerUnits="strokeWidth">
            <path d="M 0 0 L 12 4 L 0 8 Z" fill="${connColor}" />
        </marker>
    </defs>`);

    // Grid dots (sutil)
    svgParts.push(`<defs><pattern id="dg" width="24" height="24" patternUnits="userSpaceOnUse">
        <circle cx="12" cy="12" r="1" fill="${isDark ? '#334155' : '#e2e8f0'}" opacity="${isDark ? '0.4' : '0.6'}" />
    </pattern></defs>`);
    svgParts.push(`<rect x="${originX}" y="${originY}" width="${contentW}" height="${contentH}" fill="url(#dg)" />`);

    // Connections
    for (const conn of currentMap.connections) {
        const fromNode = currentMap.nodes.find(n => n.id === conn.from);
        const toNode = currentMap.nodes.find(n => n.id === conn.to);
        if (!fromNode || !toNode) continue;

        const fromCenter = getNodeCenter(fromNode);
        const toCenter = getNodeCenter(toNode);
        const fromEdge = getEdgePoint(fromNode, toCenter.x, toCenter.y);
        const toEdge = getEdgePoint(toNode, fromCenter.x, fromCenter.y);
        const d = getBezierPath(fromEdge, toEdge);

        let dash = '';
        if (conn.style === 'dashed') dash = ' stroke-dasharray="6,4"';
        svgParts.push(`<path d="${d}" fill="none" stroke="${connColor}" stroke-width="2"${dash} marker-end="url(#ah)" />`);
    }

    // Nodes
    for (const node of currentMap.nodes) {
        const w = node.width, h = node.height;
        const fill = node.color + '20';
        const stroke = node.color;

        svgParts.push(`<g transform="translate(${node.x}, ${node.y})">`);

        switch (node.shape) {
            case 'rectangle':
                svgParts.push(`<rect width="${w}" height="${h}" rx="2" ry="2" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`);
                break;
            case 'diamond': {
                const pts = `${w/2},0 ${w},${h/2} ${w/2},${h} 0,${h/2}`;
                svgParts.push(`<polygon points="${pts}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`);
                break;
            }
            case 'circle':
                svgParts.push(`<ellipse cx="${w/2}" cy="${h/2}" rx="${w/2}" ry="${h/2}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`);
                break;
            default:
                svgParts.push(`<rect width="${w}" height="${h}" rx="12" ry="12" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`);
        }

        // Texto do nó
        const lines = wrapText(node.text, w - 24, 14);
        const startY = (h - lines.length * 18) / 2 + 14;
        for (let i = 0; i < lines.length; i++) {
            svgParts.push(`<text x="${w/2}" y="${startY + i * 18}" text-anchor="middle" font-size="14" font-family="Segoe UI, system-ui, sans-serif" fill="${textColor}">${escapeHtml(lines[i])}</text>`);
        }

        // Link icon
        if (node.linkedNoteId) {
            svgParts.push(`<text x="${w - 18}" y="15" font-size="11">📝</text>`);
        } else if (node.linkedAnalysisId) {
            svgParts.push(`<text x="${w - 18}" y="15" font-size="11">📊</text>`);
        }

        svgParts.push('</g>');
    }

    // Título no rodapé
    const titleText = escapeHtml(currentMap.title || 'Mapa Mental');
    const titleY = originY + contentH - 12;
    svgParts.push(`<text x="${originX + contentW / 2}" y="${titleY}" text-anchor="middle" font-size="16" font-weight="bold" font-family="Segoe UI, system-ui, sans-serif" fill="${textColor}" opacity="0.6">${titleText}</text>`);

    svgParts.push('</svg>');

    // 3. SVG → Canvas em alta resolução → PDF
    const svgString = svgParts.join('');
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const img = new Image();
    img.onload = () => {
        // Canvas com resolução 2x para nitidez
        const canvasScale = 2;
        const canvas = document.createElement('canvas');
        canvas.width = PDF_W * canvasScale;
        canvas.height = PDF_H * canvasScale;
        const ctx = canvas.getContext('2d');

        // Background
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Centralizar o SVG na página Full HD
        const drawW = svgW * canvasScale;
        const drawH = svgH * canvasScale;
        const offsetX = (canvas.width - drawW) / 2;
        const offsetY = (canvas.height - drawH) / 2;
        ctx.drawImage(img, offsetX, offsetY, drawW, drawH);

        URL.revokeObjectURL(url);

        // Gerar PDF
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
            orientation: 'landscape',
            unit: 'px',
            format: [PDF_W, PDF_H],
            hotfixes: ['px_scaling']
        });

        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, PDF_W, PDF_H);
        const filename = (currentMap.title || 'mapa-mental').replace(/[^a-zA-Z0-9À-ÿ\s-]/g, '').replace(/\s+/g, '-').toLowerCase();
        pdf.save(`${filename}.pdf`);

        showToast('PDF exportado!', 'success');
    };

    img.onerror = () => {
        URL.revokeObjectURL(url);
        showToast('Erro ao gerar PDF', 'error');
    };

    img.src = url;
}

function getCanvasBgColor() {
    const el = document.querySelector('.mm-canvas-wrapper');
    if (el) {
        const bg = getComputedStyle(el).backgroundColor;
        if (bg && bg !== 'rgba(0, 0, 0, 0)') return bg;
    }
    return document.body.classList.contains('dark-mode') ? '#1a1a2e' : '#f5f7fa';
}

/* =========================================
   Funções globais (para onclick no HTML)
   ========================================= */

window.createNewMap = createNewMap;
window.deleteSelected = deleteSelected;
window.zoomIn = zoomIn;
window.zoomOut = zoomOut;
window.fitView = fitView;
window.closeProperties = closeProperties;
window.signOut = signOut;
window.saveMap = saveMap;
window.manualSave = async function () {
    await saveMap();
};
window.exportPDF = exportPDF;

window.toggleSidebar = function () {
    sidebar.classList.toggle('open');
};

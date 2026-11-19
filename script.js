// ===== STATE =====
const state = {
  tool: 'pen',
  color: '#6c5ce7',
  color2: '#00cec9',
  size: 4,
  opacity: 1,
  brushStyle: 'solid',
  fill: false,
  drawing: false,
  startX: 0, startY: 0,
  lastX: 0, lastY: 0,
  zoom: 1,
  panX: 0, panY: 0,
  isPanning: false,
  panStartX: 0, panStartY: 0,
  symmetryH: false,
  symmetryV: false,
  grid: false,
  layer: 0,
  layers: [{ name: 'Layer 1', visible: true, locked: false, canvas: null }],
  history: [],
  historyIndex: -1,
  maxHistory: 50,
  recentColors: [],
  rainbowHue: 0,
};

// ===== DOM =====
const container = document.getElementById('canvasContainer');
const drawCanvas = document.getElementById('drawCanvas');
const gridCanvas = document.getElementById('gridCanvas');
const overlayCanvas = document.getElementById('overlayCanvas');
const cursor = document.getElementById('customCursor');
const dCtx = drawCanvas.getContext('2d');
const gCtx = gridCanvas.getContext('2d');
const oCtx = overlayCanvas.getContext('2d');

// ===== INIT =====
function init() {
  resizeCanvases();
  createLayerCanvas(0);
  buildColorPresets();
  bindEvents();
  loadFromStorage();
  showToast('✨ Welcome to Studio Pro!');
}

function resizeCanvases() {
  const r = container.getBoundingClientRect();
  [drawCanvas, gridCanvas, overlayCanvas].forEach(c => {
    c.width = r.width;
    c.height = r.height;
  });
  drawGrid();
}

function createLayerCanvas(index) {
  const c = document.createElement('canvas');
  c.width = drawCanvas.width;
  c.height = drawCanvas.height;
  state.layers[index].canvas = c;
}

// ===== COLOR PRESETS =====
const presets = [
  '#6c5ce7','#00cec9','#fd79a8','#fdcb6e','#e17055','#00b894',
  '#0984e3','#d63031','#e84393','#2d3436','#636e72','#ffffff',
  '#2d3436','#f39c12','#1abc9c','#3498db','#9b59b6','#e74c3c',
];
function buildColorPresets() {
  const el = document.getElementById('colorPresets');
  presets.forEach(c => {
    const d = document.createElement('div');
    d.className = 'color-preset';
    d.style.background = c;
    d.onclick = () => {
      document.getElementById('colorPicker').value = c;
      state.color = c;
      addRecentColor(c);
      spawnParticles(d, c);
    };
    el.appendChild(d);
  });
}

function addRecentColor(c) {
  state.recentColors = state.recentColors.filter(x => x !== c);
  state.recentColors.unshift(c);
  if (state.recentColors.length > 10) state.recentColors.pop();
  renderRecentColors();
}

function renderRecentColors() {
  const el = document.getElementById('recentColors');
  el.innerHTML = '';
  state.recentColors.forEach(c => {
    const d = document.createElement('div');
    d.className = 'recent-color';
    d.style.background = c;
    d.onclick = () => { state.color = c; document.getElementById('colorPicker').value = c; };
    el.appendChild(d);
  });
}

// ===== GRID =====
function drawGrid() {
  gCtx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);
  if (!state.grid) return;
  gCtx.strokeStyle = 'rgba(108,92,231,0.1)';
  gCtx.lineWidth = 0.5;
  const step = 40 * state.zoom;
  for (let x = state.panX % step; x < gridCanvas.width; x += step) {
    gCtx.beginPath(); gCtx.moveTo(x, 0); gCtx.lineTo(x, gridCanvas.height); gCtx.stroke();
  }
  for (let y = state.panY % step; y < gridCanvas.height; y += step) {
    gCtx.beginPath(); gCtx.moveTo(0, y); gCtx.lineTo(gridCanvas.width, y); gCtx.stroke();
  }
}

// ===== TOOL SELECTION =====
function setTool(t) {
  state.tool = t;
  document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
  const btn = document.querySelector(`.tool-btn[data-tool="${t}"]`);
  if (btn) btn.classList.add('active');
  document.getElementById('statusTool').textContent = `Tool: ${t.charAt(0).toUpperCase() + t.slice(1)}`;
  drawCanvas.style.cursor = t === 'text' ? 'none' : 'none';
}

// ===== COORDINATES =====
function getPos(e) {
  const r = drawCanvas.getBoundingClientRect();
  const src = e.touches ? e.touches[0] : e;
  return {
    x: (src.clientX - r.left - state.panX) / state.zoom,
    y: (src.clientY - r.top - state.panY) / state.zoom
  };
}

// ===== DRAWING =====
function startDraw(e) {
  if (e.button === 1 || (e.ctrlKey && e.button === 0)) {
    state.isPanning = true;
    state.panStartX = e.clientX - state.panX;
    state.panStartY = e.clientY - state.panY;
    return;
  }
  const pos = getPos(e);

  if (state.tool === 'text') {
    const text = prompt('Enter text:');
    if (text) {
      saveHistory();
      const ctx = getLayerCtx();
      ctx.font = `${Math.max(state.size * 3, 14)}px system-ui`;
      ctx.fillStyle = state.color;
      ctx.globalAlpha = state.opacity;
      ctx.fillText(text, pos.x, pos.y);
      if (state.symmetryH) {
        ctx.fillText(text, drawCanvas.width - pos.x - ctx.measureText(text).width, pos.y);
      }
      if (state.symmetryV) {
        ctx.fillText(text, pos.x, drawCanvas.height - pos.y);
      }
    }
    return;
  }

  if (state.tool === 'fill') {
    saveHistory();
    floodFill(Math.round(pos.x), Math.round(pos.y), state.color);
    return;
  }

  state.drawing = true;
  state.startX = pos.x;
  state.startY = pos.y;
  state.lastX = pos.x;
  state.lastY = pos.y;
}

function draw(e) {
  // Update cursor
  const r = drawCanvas.getBoundingClientRect();
  const src = e.touches ? e.touches[0] : e;
  const cx = src.clientX - r.left;
  const cy = src.clientY - r.top;
  cursor.style.left = cx + 'px';
  cursor.style.top = cy + 'px';
  const cs = state.size * state.zoom;
  cursor.style.width = cs + 'px';
  cursor.style.height = cs + 'px';

  // Update coords
  const pos = getPos(e);
  document.getElementById('coords').textContent = `X: ${Math.round(pos.x)}, Y: ${Math.round(pos.y)}`;

  if (state.isPanning) {
    state.panX = e.clientX - state.panStartX;
    state.panY = e.clientY - state.panStartY;
    renderAll();
    return;
  }

  if (!state.drawing) return;
  e.preventDefault();

  const ctx = getLayerCtx();
  ctx.globalAlpha = state.opacity;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (state.tool === 'pen' || state.tool === 'spray') {
    ctx.strokeStyle = getStrokeColor();
    ctx.lineWidth = state.size;
    ctx.beginPath();
    ctx.moveTo(state.lastX, state.lastY);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();

    if (state.tool === 'spray') {
      for (let i = 0; i < 8; i++) {
        const sx = pos.x + (Math.random() - 0.5) * state.size * 4;
        const sy = pos.y + (Math.random() - 0.5) * state.size * 4;
        ctx.fillStyle = getStrokeColor();
        ctx.fillRect(sx, sy, 1.5, 1.5);
      }
    }

    // Symmetry
    if (state.symmetryH) {
      ctx.beginPath();
      ctx.moveTo(drawCanvas.width - state.lastX, state.lastY);
      ctx.lineTo(drawCanvas.width - pos.x, pos.y);
      ctx.stroke();
    }
    if (state.symmetryV) {
      ctx.beginPath();
      ctx.moveTo(state.lastX, drawCanvas.height - state.lastY);
      ctx.lineTo(pos.x, drawCanvas.height - pos.y);
      ctx.stroke();
    }

    state.lastX = pos.x;
    state.lastY = pos.y;
  } else {
    // Shape preview on overlay
    oCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    oCtx.save();
    oCtx.translate(state.panX, state.panY);
    oCtx.scale(state.zoom, state.zoom);
    oCtx.strokeStyle = getStrokeColor();
    oCtx.lineWidth = state.size;
    oCtx.globalAlpha = state.opacity;

    const x = state.startX, y = state.startY;
    const w = pos.x - x, h = pos.y - y;

    if (state.tool === 'line') {
      oCtx.beginPath(); oCtx.moveTo(x, y); oCtx.lineTo(pos.x, pos.y); oCtx.stroke();
    } else if (state.tool === 'rect') {
      if (state.fill) { oCtx.fillStyle = getStrokeColor(); oCtx.fillRect(x, y, w, h); }
      else oCtx.strokeRect(x, y, w, h);
    } else if (state.tool === 'circle') {
      const rx = w / 2, ry = h / 2;
      oCtx.beginPath();
      oCtx.ellipse(x + rx, y + ry, Math.abs(rx), Math.abs(ry), 0, 0, Math.PI * 2);
      if (state.fill) { oCtx.fillStyle = getStrokeColor(); oCtx.fill(); }
      else oCtx.stroke();
    } else if (state.tool === 'arrow') {
      oCtx.beginPath(); oCtx.moveTo(x, y); oCtx.lineTo(pos.x, pos.y); oCtx.stroke();
      // Arrowhead
      const angle = Math.atan2(pos.y - y, pos.x - x);
      const headLen = 15;
      oCtx.beginPath();
      oCtx.moveTo(pos.x, pos.y);
      oCtx.lineTo(pos.x - headLen * Math.cos(angle - 0.4), pos.y - headLen * Math.sin(angle - 0.4));
      oCtx.moveTo(pos.x, pos.y);
      oCtx.lineTo(pos.x - headLen * Math.cos(angle + 0.4), pos.y - headLen * Math.sin(angle + 0.4));
      oCtx.stroke();
    }
    oCtx.restore();
  }
}

function endDraw(e) {
  if (state.isPanning) { state.isPanning = false; return; }
  if (!state.drawing) return;
  state.drawing = false;
  oCtx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

  const pos = getPos(e);

  if (['line', 'rect', 'circle', 'arrow'].includes(state.tool)) {
    saveHistory();
    const ctx = getLayerCtx();
    ctx.globalAlpha = state.opacity;
    ctx.strokeStyle = getStrokeColor();
    ctx.lineWidth = state.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const x = state.startX, y = state.startY;
    const w = pos.x - x, h = pos.y - y;

    if (state.tool === 'line') {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(pos.x, pos.y); ctx.stroke();
    } else if (state.tool === 'rect') {
      if (state.fill) { ctx.fillStyle = getStrokeColor(); ctx.fillRect(x, y, w, h); }
      else ctx.strokeRect(x, y, w, h);
    } else if (state.tool === 'circle') {
      ctx.beginPath();
      ctx.ellipse(x + w/2, y + h/2, Math.abs(w/2), Math.abs(h/2), 0, 0, Math.PI*2);
      if (state.fill) { ctx.fillStyle = getStrokeColor(); ctx.fill(); }
      else ctx.stroke();
    } else if (state.tool === 'arrow') {
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(pos.x, pos.y); ctx.stroke();
      const angle = Math.atan2(pos.y - y, pos.x - x);
      const hl = 15;
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.lineTo(pos.x - hl*Math.cos(angle-0.4), pos.y - hl*Math.sin(angle-0.4));
      ctx.moveTo(pos.x, pos.y);
      ctx.lineTo(pos.x - hl*Math.cos(angle+0.4), pos.y - hl*Math.sin(angle+0.4));
      ctx.stroke();
    }

    // Symmetry for shapes
    if (state.symmetryH) {
      ctx.save();
      ctx.translate(drawCanvas.width, 0);
      ctx.scale(-1, 1);
      drawShape(ctx, x, y, pos.x, pos.y);
      ctx.restore();
    }
  }

  // Spawn particles on stroke end
  const r = drawCanvas.getBoundingClientRect();
  spawnParticlesAt(pos.x * state.zoom + state.panX + r.left, pos.y * state.zoom + state.panY + r.top, state.color);
}

function drawShape(ctx, x, y, ex, ey) {
  const w = ex - x, h = ey - y;
  if (state.tool === 'line') { ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(ex,ey); ctx.stroke(); }
  else if (state.tool === 'rect') { ctx.strokeRect(x, y, w, h); }
  else if (state.tool === 'circle') { ctx.beginPath(); ctx.ellipse(x+w/2,y+h/2,Math.abs(w/2),Math.abs(h/2),0,0,Math.PI*2); ctx.stroke(); }
}

function getStrokeColor() {
  if (state.brushStyle === 'rainbow') {
    state.rainbowHue = (state.rainbowHue + 2) % 360;
    return `hsl(${state.rainbowHue}, 100%, 55%)`;
  }
  if (state.brushStyle === 'neon') {
    return state.color; // glow handled via shadow
  }
  return state.color;
}

function getLayerCtx() {
  const layer = state.layers[state.layer];
  const ctx = layer.canvas.getContext('2d');
  // Apply brush style
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
  if (state.brushStyle === 'glow' || state.brushStyle === 'neon') {
    ctx.shadowBlur = state.size * 2;
    ctx.shadowColor = state.color;
  } else if (state.brushStyle === 'shadow') {
    ctx.shadowBlur = 4;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
  }
  return ctx;
}

// ===== FLOOD FILL =====
function floodFill(x, y, fillColor) {
  const imgData = state.layers[state.layer].canvas.getContext('2d').getImageData(0, 0, drawCanvas.width, drawCanvas.height);
  const data = imgData.data;
  const w = drawCanvas.width, h = drawCanvas.height;
  const idx = (x + y * w) * 4;
  const target = [data[idx], data[idx+1], data[idx+2], data[idx+3]];
  const fc = hexToRgb(fillColor);
  if (target[0] === fc.r && target[1] === fc.g && target[2] === fc.b) return;

  const stack = [[x, y]];
  while (stack.length) {
    const [cx, cy] = stack.pop();
    if (cx < 0 || cx >= w || cy < 0 || cy >= h) continue;
    const i = (cx + cy * w) * 4;
    if (data[i] === fc.r && data[i+1] === fc.g && data[i+2] === fc.b) continue;
    if (Math.abs(data[i]-target[0]) < 30 && Math.abs(data[i+1]-target[1]) < 30 && Math.abs(data[i+2]-target[2]) < 30) {
      data[i] = fc.r; data[i+1] = fc.g; data[i+2] = fc.b; data[i+3] = 255;
      stack.push([cx+1,cy],[cx-1,cy],[cx,cy+1],[cx,cy-1]);
    }
  }
  state.layers[state.layer].canvas.getContext('2d').putImageData(imgData, 0, 0);
  renderAll();
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return {r,g,b};
}

// ===== RENDER =====
function renderAll() {
  dCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
  dCtx.save();
  dCtx.translate(state.panX, state.panY);
  dCtx.scale(state.zoom, state.zoom);
  // Composite all visible layers
  state.layers.forEach((l, i) => {
    if (l.visible && l.canvas) {
      dCtx.drawImage(l.canvas, 0, 0);
    }
  });
  dCtx.restore();
}

// ===== UNDO / REDO =====
function saveHistory() {
  const snapshot = state.layers.map(l => l.canvas ? l.canvas.toDataURL() : null);
  state.history = state.history.slice(0, state.historyIndex + 1);
  state.history.push(snapshot);
  if (state.history.length > state.maxHistory) state.history.shift();
  state.historyIndex = state.history.length - 1;
}

function undo() {
  if (state.historyIndex < 0) return;
  state.historyIndex--;
  if (state.historyIndex < 0) { state.historyIndex = 0; renderAll(); return; }
  restoreHistory(state.history[state.historyIndex]);
  showToast('↩️ Undo');
}

function redo() {
  if (state.historyIndex >= state.history.length - 1) return;
  state.historyIndex++;
  restoreHistory(state.history[state.historyIndex]);
  showToast('↪️ Redo');
}

function restoreHistory(snapshot) {
  snapshot.forEach((data, i) => {
    if (data && state.layers[i].canvas) {
      const img = new Image();
      img.onload = () => {
        state.layers[i].canvas.getContext('2d').clearRect(0,0,drawCanvas.width,drawCanvas.height);
        state.layers[i].canvas.getContext('2d').drawImage(img, 0, 0);
        renderAll();
      };
      img.src = data;
    }
  });
}

// ===== LAYERS =====
function addLayer() {
  const idx = state.layers.length;
  createLayerCanvas(idx);
  state.layers.push({ name: `Layer ${idx+1}`, visible: true, locked: false, canvas: state.layers[idx-1]?.canvas ? document.createElement('canvas') : null });
  // Fix: create properly
  const c = document.createElement('canvas');
  c.width = drawCanvas.width; c.height = drawCanvas.height;
  state.layers[idx] = { name: `Layer ${idx+1}`, visible: true, locked: false, canvas: c };
  state.layer = idx;
  renderLayers();
  showToast(`📑 Layer ${idx+1} added`);
}

function renderLayers() {
  const el = document.getElementById('layersList');
  el.innerHTML
}
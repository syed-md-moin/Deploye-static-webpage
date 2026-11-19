const drawCanvas = document.getElementById('drawCanvas');
const textCanvas = document.getElementById('textCanvas');
const wrap = document.getElementById('canvasWrap');
const dCtx = drawCanvas.getContext('2d');
const tCtx = textCanvas.getContext('2d');

let tool = 'pen';
let drawing = false;
let color = '#1e1e2e';
let size = 3;
let notes = [];

function resize() {
  const r = wrap.getBoundingClientRect();
  [drawCanvas, textCanvas].forEach(c => {
    const tmp = document.createElement('canvas');
    tmp.width = c.width; tmp.height = c.height;
    tmp.getContext('2d').drawImage(c, 0, 0);
    c.width = r.width; c.height = r.height;
    c.getContext('2d').drawImage(tmp, 0, 0);
  });
  renderTexts();
}
window.addEventListener('resize', resize);
resize();

// Toolbar
function setTool(t) {
  tool = t;
  document.querySelectorAll('.toolbar button').forEach(b => b.classList.remove('active'));
  if (t === 'pen') document.getElementById('penBtn').classList.add('active');
  if (t === 'eraser') document.getElementById('eraserBtn').classList.add('active');
  if (t === 'text') document.getElementById('textBtn').classList.add('active');
  drawCanvas.style.cursor = t === 'text' ? 'text' : 'crosshair';
}
document.getElementById('penBtn').onclick = () => setTool('pen');
document.getElementById('eraserBtn').onclick = () => setTool('eraser');
document.getElementById('textBtn').onclick = () => setTool('text');
document.getElementById('colorPicker').oninput = e => color = e.target.value;
document.getElementById('sizeSlider').oninput = e => size = +e.target.value;
document.getElementById('clearBtn').onclick = () => {
  dCtx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
  notes = [];
  renderTexts();
};

// Drawing
function getPos(e) {
  const r = drawCanvas.getBoundingClientRect();
  const src = e.touches ? e.touches[0] : e;
  return { x: src.clientX - r.left, y: src.clientY - r.top };
}

function startDraw(e) {
  if (tool === 'text') {
    const pos = getPos(e);
    const text = prompt('Enter note text:');
    if (text) {
      notes.push({ x: pos.x, y: pos.y, text, color });
      renderTexts();
    }
    return;
  }
  drawing = true;
  const pos = getPos(e);
  dCtx.beginPath();
  dCtx.moveTo(pos.x, pos.y);
}

function draw(e) {
  if (!drawing) return;
  e.preventDefault();
  const pos = getPos(e);
  dCtx.lineTo(pos.x, pos.y);
  dCtx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
  dCtx.lineWidth = tool === 'eraser' ? size * 3 : size;
  dCtx.lineCap = 'round';
  dCtx.lineJoin = 'round';
  dCtx.stroke();
}

function endDraw() { drawing = false; }

drawCanvas.addEventListener('mousedown', startDraw);
drawCanvas.addEventListener('mousemove', draw);
drawCanvas.addEventListener('mouseup', endDraw);
drawCanvas.addEventListener('mouseleave', endDraw);
drawCanvas.addEventListener('touchstart', startDraw, { passive: false });
drawCanvas.addEventListener('touchmove', draw, { passive: false });
drawCanvas.addEventListener('touchend', endDraw);

function renderTexts() {
  tCtx.clearRect(0, 0, textCanvas.width, textCanvas.height);
  tCtx.font = `${Math.max(size, 12)}px system-ui`;
  notes.forEach(n => {
    tCtx.fillStyle = n.color;
    tCtx.fillText(n.text, n.x, n.y);
  });
}   
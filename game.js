'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#90caf9', // J - blue (pale)
  '#ffb74d', // L - orange
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const GRID_COLORS = { dark: '#22222e', light: '#dfe1ea' };
const THEME_KEY = 'tetris-theme';
const HIGHSCORES_KEY = 'tetris-highscores'; // ==== RECORDS ====
const MAX_HIGHSCORES = 5;

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggleBtn = document.getElementById('theme-toggle');
// ==== RECORDS ====
const startScreen = document.getElementById('start-screen');
const startRecordsEl = document.getElementById('start-records');
const startBestComboEl = document.getElementById('start-best-combo');
const startMaxLinesEl = document.getElementById('start-max-lines');
const playBtn = document.getElementById('play-btn');
const resetRecordsBtn = document.getElementById('reset-records-btn');
const recordsForm = document.getElementById('records-form');
const playerNameInput = document.getElementById('player-name-input');
const saveRecordBtn = document.getElementById('save-record-btn');
const gameoverRecordsEl = document.getElementById('gameover-records');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let theme = 'dark';
let combo, maxCombo; // ==== RECORDS ==== combo de clears consecutivos

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    combo++; // ==== RECORDS ====
    if (combo > maxCombo) maxCombo = combo;
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  } else {
    combo = 0; // ==== RECORDS ==== pieza sin líneas: se corta el combo
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  clearLines();
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
    return;
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  if (theme === 'light') {
    // los colores claros de algunas piezas pierden contraste sobre fondo blanco
    context.strokeStyle = 'rgba(0,0,0,0.35)';
    context.lineWidth = 1;
    context.strokeRect(x * size + 1.5, y * size + 1.5, size - 3, size - 3);
  }
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = GRID_COLORS[theme];
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  if (gameOver || !current) return; // ==== RECORDS ==== sin partida en curso (pantalla de inicio)

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  draw();
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
  showGameOverRecords(); // ==== RECORDS ====
}

function togglePause() {
  if (gameOver || !current) return; // ==== RECORDS ==== sin partida en curso
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  if (gameOver || paused) return;
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  combo = 0; // ==== RECORDS ====
  maxCombo = 0;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  recordsForm.classList.add('hidden'); // ==== RECORDS ==== limpia restos de una partida anterior
  gameoverRecordsEl.innerHTML = '';
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

function applyTheme(t) {
  theme = t;
  document.body.classList.toggle('light-theme', t === 'light');
  themeToggleBtn.setAttribute('aria-pressed', t === 'light' ? 'true' : 'false');
  themeToggleBtn.textContent = t === 'light' ? '🌙' : '☀️';
  themeToggleBtn.setAttribute('aria-label', t === 'light' ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro');
  localStorage.setItem(THEME_KEY, t);
  if (current) {
    draw();
    drawNext();
  }
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  applyTheme(saved === 'light' ? 'light' : 'dark');
}

themeToggleBtn.addEventListener('click', () => {
  applyTheme(theme === 'light' ? 'dark' : 'light');
});

// ==== RECORDS ====
// Persistencia de las mejores puntuaciones en localStorage y pantalla de inicio.

function loadHighscores() {
  try {
    const raw = localStorage.getItem(HIGHSCORES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Lectura defensiva: descarta cualquier entrada que no tenga la forma esperada.
    return parsed
      .filter(e => e && typeof e.name === 'string' &&
        typeof e.score === 'number' && typeof e.lines === 'number' &&
        typeof e.maxCombo === 'number' && typeof e.date === 'string')
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_HIGHSCORES);
  } catch (err) {
    return [];
  }
}

function saveHighscores(list) {
  try {
    localStorage.setItem(HIGHSCORES_KEY, JSON.stringify(list));
  } catch (err) {
    // localStorage no disponible o lleno: se ignora silenciosamente.
  }
}

function qualifiesForHighscore(list, s) {
  if (list.length < MAX_HIGHSCORES) return true;
  return s > list[list.length - 1].score;
}

function computeGlobalStats(list) {
  let bestCombo = 0;
  let maxLines = 0;
  for (const e of list) {
    if (e.maxCombo > bestCombo) bestCombo = e.maxCombo;
    if (e.lines > maxLines) maxLines = e.lines;
  }
  return { bestCombo, maxLines };
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderRecordsTable(container, list, highlightIndex) {
  if (!list.length) {
    container.innerHTML = '<p class="records-empty">Todavía no hay records</p>';
    return;
  }
  let html = '<table class="records-table-el"><thead><tr>' +
    '<th>#</th><th>Nombre</th><th>Puntos</th><th>Líneas</th><th>Combo</th><th>Fecha</th>' +
    '</tr></thead><tbody>';
  list.forEach((entry, i) => {
    const cls = i === highlightIndex ? ' class="record-highlight"' : '';
    html += `<tr${cls}><td>${i + 1}</td><td>${escapeHtml(entry.name)}</td>` +
      `<td>${entry.score.toLocaleString()}</td><td>${entry.lines}</td>` +
      `<td>${entry.maxCombo}</td><td>${escapeHtml(entry.date)}</td></tr>`;
  });
  html += '</tbody></table>';
  container.innerHTML = html;
}

function renderStartScreen() {
  const list = loadHighscores();
  renderRecordsTable(startRecordsEl, list, -1);
  const stats = computeGlobalStats(list);
  startBestComboEl.textContent = stats.bestCombo;
  startMaxLinesEl.textContent = stats.maxLines;
}

function showStartScreen() {
  if (!board) {
    // Estado inicial coherente: tablero vacío dibujado detrás del overlay.
    board = createBoard();
    draw();
  }
  renderStartScreen();
  startScreen.classList.remove('hidden');
}

function hideStartScreen() {
  startScreen.classList.add('hidden');
  init();
}

function showGameOverRecords() {
  const list = loadHighscores();
  renderRecordsTable(gameoverRecordsEl, list, -1);
  if (qualifiesForHighscore(list, score)) {
    playerNameInput.value = 'Jugador';
    recordsForm.classList.remove('hidden');
  } else {
    recordsForm.classList.add('hidden');
  }
}

function saveRecordEntry() {
  const list = loadHighscores();
  const name = (playerNameInput.value || '').trim().slice(0, 12) || 'Jugador';
  const entry = { name, score, lines, maxCombo, date: new Date().toLocaleDateString() };
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  const trimmed = list.slice(0, MAX_HIGHSCORES);
  saveHighscores(trimmed);
  renderRecordsTable(gameoverRecordsEl, trimmed, trimmed.indexOf(entry));
  recordsForm.classList.add('hidden');
}

let resetConfirmTimeout = null;

function handleResetRecordsClick() {
  if (resetRecordsBtn.dataset.confirm === '1') {
    saveHighscores([]);
    renderStartScreen();
    resetRecordsBtn.textContent = 'Resetear records';
    resetRecordsBtn.dataset.confirm = '0';
    clearTimeout(resetConfirmTimeout);
  } else {
    resetRecordsBtn.textContent = '¿Seguro?';
    resetRecordsBtn.dataset.confirm = '1';
    clearTimeout(resetConfirmTimeout);
    resetConfirmTimeout = setTimeout(() => {
      resetRecordsBtn.textContent = 'Resetear records';
      resetRecordsBtn.dataset.confirm = '0';
    }, 3000);
  }
}

// Si se hace click fuera del botón mientras pide confirmación, se cancela.
document.addEventListener('click', e => {
  if (resetRecordsBtn.dataset.confirm === '1' && e.target !== resetRecordsBtn) {
    resetRecordsBtn.textContent = 'Resetear records';
    resetRecordsBtn.dataset.confirm = '0';
    clearTimeout(resetConfirmTimeout);
  }
});

playBtn.addEventListener('click', hideStartScreen);
resetRecordsBtn.addEventListener('click', handleResetRecordsClick);
saveRecordBtn.addEventListener('click', saveRecordEntry);

document.addEventListener('keydown', e => {
  if (e.target instanceof HTMLButtonElement) return;
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver || !current) return; // ==== RECORDS ==== sin partida en curso
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

initTheme();
showStartScreen(); // ==== RECORDS ==== el juego ya no arranca automáticamente

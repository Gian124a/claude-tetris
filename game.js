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
  '#b0bec5', // Tuerca - gris metálico
  '#ffd700', // Comodín (Tinte) - dorado
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
  [[8,8,8],[8,0,8],[8,8,8]],                  // Tuerca (3x3 con agujero central)
];

const NUT = 8;
const NUT_CHANCE = 1 / 12;

const WILD = 9;   // comodín dorado: vive en el tablero
const POWER = 10; // celda de una pieza power-up: nunca llega al tablero

const POWERUPS = [
  { id: 'bomb',    icon: '💣', color: '#ff7043', label: 'BOMBA' },
  { id: 'bolt',    icon: '⚡', color: '#fff176', label: 'RAYO' },
  { id: 'dye',     icon: '🎨', color: '#ce93d8', label: 'TINTE' },
  { id: 'gravity', icon: '⬇️', color: '#4db6ac', label: 'GRAVEDAD' },
  { id: 'freeze',  icon: '❄️', color: '#81d4fa', label: 'CONGELAR' },
];
const POWERUP_CHANCE = 1 / 5;
const FREEZE_MS = 5000;
const POWER_CELL_SCORE = 10; // puntos por celda destruida por un poder, × level
const FLASH_MS = 900; // duración del aviso flotante al detonar un poder

const LINE_SCORES = [0, 100, 300, 500, 800];

const GRID_COLORS = { dark: '#22222e', light: '#dfe1ea' };
const THEME_KEY = 'tetris-theme';

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const freezeTimerEl = document.getElementById('freeze-timer');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggleBtn = document.getElementById('theme-toggle');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let theme = 'dark';
let freezeLeft = 0; // ms restantes de congelación (power-up "freeze")
let flash = null;   // aviso flotante al detonar un poder: { power, left }

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  if (Math.random() < POWERUP_CHANCE) {
    const power = POWERUPS[Math.floor(Math.random() * POWERUPS.length)];
    return { type: POWER, power, shape: [[POWER]], x: Math.floor(COLS / 2), y: 0 };
  }
  const type = Math.random() < NUT_CHANCE ? NUT : Math.floor(Math.random() * 7) + 1;
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

function removeFullRows() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  return cleared;
}

function applyGravity() {
  for (let c = 0; c < COLS; c++) {
    const stack = [];
    for (let r = ROWS - 1; r >= 0; r--) if (board[r][c]) stack.push(board[r][c]);
    for (let r = ROWS - 1, i = 0; r >= 0; r--, i++) board[r][c] = stack[i] ?? 0;
  }
}

function clearLines() {
  let cleared = removeFullRows();
  if (cleared && board.some(row => row.includes(WILD))) {
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (board[r][c] === WILD) board[r][c] = 0;
    applyGravity();
    cleared += removeFullRows(); // cascada: la compactación puede completar más filas
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
}

function applyPower(power, px, py) {
  let destroyed = 0;
  switch (power.id) {
    case 'bomb':
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const r = py + dr, c = px + dc;
          if (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[r][c]) {
            board[r][c] = 0;
            destroyed++;
          }
        }
      }
      break;
    case 'bolt':
      if (py >= 0 && py < ROWS) {
        for (let c = 0; c < COLS; c++) {
          if (board[py][c]) destroyed++;
          board[py][c] = 0;
        }
      }
      for (let r = 0; r < ROWS; r++) {
        if (r === py) continue; // ya contada arriba
        if (px >= 0 && px < COLS && board[r][px]) destroyed++;
        if (px >= 0 && px < COLS) board[r][px] = 0;
      }
      break;
    case 'dye': {
      const counts = new Array(COLORS.length).fill(0);
      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++)
          if (board[r][c] >= 1 && board[r][c] <= NUT) counts[board[r][c]]++;
      let bestColor = 0, bestCount = 0;
      for (let i = 1; i <= NUT; i++) if (counts[i] > bestCount) { bestCount = counts[i]; bestColor = i; }
      if (bestColor) {
        for (let r = 0; r < ROWS; r++)
          for (let c = 0; c < COLS; c++)
            if (board[r][c] === bestColor) board[r][c] = WILD;
      }
      break;
    }
    case 'gravity':
      applyGravity();
      break;
    case 'freeze':
      freezeLeft = FREEZE_MS;
      break;
  }
  if (destroyed) score += destroyed * POWER_CELL_SCORE * level;
  flash = { power, left: FLASH_MS };
  updateHUD();
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
  if (current.power) applyPower(current.power, current.x, current.y);
  else merge();
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
  if (freezeLeft > 0) {
    freezeTimerEl.textContent = `❄️ ${(freezeLeft / 1000).toFixed(1)}s`;
    freezeTimerEl.classList.remove('hidden');
  } else {
    freezeTimerEl.classList.add('hidden');
  }
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

const BOARD_BG = { dark: '#1a1a25', light: '#ffffff' }; // deben coincidir con --board-bg de style.css

function drawNutHole(context, x, y, size, alpha) {
  const cx = (x + 0.5) * size, cy = (y + 0.5) * size, r = size * 0.72;
  context.globalAlpha = alpha ?? 1;
  context.beginPath();
  context.arc(cx, cy, r, 0, Math.PI * 2);
  context.fillStyle = BOARD_BG[theme];
  context.fill();
  context.strokeStyle = 'rgba(0,0,0,0.45)';
  context.lineWidth = 1;
  context.stroke();
  context.globalAlpha = 1;
}

function drawPowerBlock(context, x, y, size, power, alpha) {
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = power.color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  context.font = `${Math.floor(size * 0.6)}px serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(power.icon, (x + 0.5) * size, (y + 0.5) * size + 1);
  context.globalAlpha = 1;
}

// Dibuja cualquier pieza (normal, tuerca o power-up) con offset (ox, oy) en celdas.
function drawPiece(context, piece, ox, oy, size, alpha) {
  for (let r = 0; r < piece.shape.length; r++) {
    for (let c = 0; c < piece.shape[r].length; c++) {
      const v = piece.shape[r][c];
      if (!v) continue;
      if (piece.power) drawPowerBlock(context, ox + c, oy + r, size, piece.power, alpha);
      else drawBlock(context, ox + c, oy + r, v, size, alpha);
    }
  }
  if (piece.type === NUT) drawNutHole(context, ox + 1, oy + 1, size, alpha);
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

  // agujeros de tuercas ya asentadas: hueco vacío rodeado de sus 8 vecinas
  for (let r = 1; r < ROWS - 1; r++)
    for (let c = 1; c < COLS - 1; c++)
      if (!board[r][c] && isNutHole(board, r, c))
        drawNutHole(ctx, c, r, BLOCK);

  if (gameOver) return;

  // ghost
  const gy = ghostY();
  drawPiece(ctx, current, current.x, gy, BLOCK, 0.2);

  // current piece
  drawPiece(ctx, current, current.x, current.y, BLOCK);

  // aviso flotante al detonar un poder
  if (flash) {
    ctx.globalAlpha = Math.max(0, Math.min(1, flash.left / FLASH_MS));
    ctx.fillStyle = flash.power.color;
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${flash.power.icon} ${flash.power.label}`, canvas.width / 2, canvas.height / 2);
    ctx.globalAlpha = 1;
  }
}

function isNutHole(b, r, c) {
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++)
      if ((dr || dc) && b[r + dr][c + dc] !== NUT) return false;
  return true;
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  if (next.power) {
    // celda única: se dibuja ocupando casi todo el canvas 120x120, centrada
    drawPowerBlock(nextCtx, 0, 0, nextCanvas.width, next.power);
  } else {
    drawPiece(nextCtx, next, offX, offY, NB);
  }
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  draw();
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
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
  if (freezeLeft > 0) {
    freezeLeft = Math.max(0, freezeLeft - dt);
  } else {
    dropAccum += dt;
    if (dropAccum >= dropInterval) {
      dropAccum = 0;
      if (!collide(current.shape, current.x, current.y + 1)) {
        current.y++;
      } else {
        lockPiece();
      }
    }
  }
  if (flash) {
    flash.left -= dt;
    if (flash.left <= 0) flash = null;
  }
  updateHUD();
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
  dropInterval = 1000;
  dropAccum = 0;
  freezeLeft = 0;
  flash = null;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
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

document.addEventListener('keydown', e => {
  if (e.target instanceof HTMLButtonElement) return;
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
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
init();

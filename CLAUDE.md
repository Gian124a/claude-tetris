# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Qué es

Tetris clásico en JavaScript vanilla (HTML5 Canvas + CSS), sin dependencias, sin build, sin tests. Tres archivos: `index.html`, `style.css`, `game.js`.

## Ejecutar

No hay build ni instalación. Basta abrir `index.html` en el navegador, o servir el directorio con cualquier servidor estático:

```bash
npx serve .
# o
python3 -m http.server 8000
```

No hay `package.json`, linter ni framework de tests configurado en el repo.

## Arquitectura (`game.js`)

Todo el estado y lógica vive en variables globales de módulo (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, etc.) — no hay clases ni módulos separados.

- **Tablero**: matriz `ROWS × COLS` (20×10); cada celda es `0` (vacía) o un índice 1–7 que indexa `COLORS`/`PIECES`.
- **Piezas**: matrices cuadradas en `PIECES`. La rotación (`rotateCW`) transpone + invierte filas; no usa los sistemas SRS estándar.
- **Wall kicks** (`tryRotate`): tras rotar, prueba desplazamientos `[0, -1, 1, -2, 2]` en X hasta encontrar una posición sin colisión.
- **Colisión** (`collide`): única función de comprobación de límites/solapamiento; la usan movimiento, rotación, ghost piece y game-loop.
- **Ghost piece** (`ghostY`): proyecta `current` hacia abajo hasta colisionar; se dibuja con `globalAlpha = 0.2` antes de la pieza real.
- **Loop de juego** (`loop`): impulsado por `requestAnimationFrame`; acumula `dt` en `dropAccum` y baja la pieza una fila al superar `dropInterval`.
- **Líneas y nivel** (`clearLines`): recorre el tablero de abajo hacia arriba, elimina filas completas e inserta vacías arriba; `level` sube cada 10 líneas y `dropInterval = max(100, 1000 - (level-1)*90)`.
- **Puntuación**: tabla `LINE_SCORES = [0,100,300,500,800]` multiplicada por `level`; hard drop suma 2 pts/celda, soft drop 1 pt/fila.
- **Render**: `draw()` dibuja grid + tablero fijo + ghost + pieza actual sobre `#board`; `drawNext()` dibuja la vista previa sobre `#next-canvas`.

Todo el estado se reinicia en `init()` (llamado al cargar y al pulsar "Reiniciar"); no hay guardado de partida entre sesiones.

Parámetros ajustables están documentados en el README (`COLS`, `ROWS`, `BLOCK`, `COLORS`, `LINE_SCORES`, `dropInterval`) — si se cambian `COLS`/`ROWS`/`BLOCK`, hay que actualizar también `width`/`height` de `<canvas id="board">` en `index.html`.

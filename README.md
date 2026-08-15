# Tetris

Implementación del clásico **Tetris** en JavaScript vanilla, usando HTML5 Canvas y CSS. Sin dependencias externas, sin frameworks, sin proceso de build: solo abrir y jugar.

![Tech](https://img.shields.io/badge/HTML5-Canvas-orange)
![Tech](https://img.shields.io/badge/CSS3-blueviolet)
![Tech](https://img.shields.io/badge/JavaScript-Vanilla-yellow)

---

## Tabla de contenidos

- [Tetris](#tetris)
  - [Tabla de contenidos](#tabla-de-contenidos)
  - [Qué hace el proyecto](#qué-hace-el-proyecto)
  - [Cómo ejecutar el juego](#cómo-ejecutar-el-juego)
    - [Opción 1: abrir el archivo directamente](#opción-1-abrir-el-archivo-directamente)
    - [Opción 2: servidor local (recomendado)](#opción-2-servidor-local-recomendado)
  - [Controles](#controles)
  - [Cómo funciona](#cómo-funciona)
    - [1. `index.html`](#1-indexhtml)
    - [2. `style.css`](#2-stylecss)
    - [3. `game.js`](#3-gamejs)
    - [Flujo del juego](#flujo-del-juego)
  - [Tecnologías](#tecnologías)
  - [Estructura del proyecto](#estructura-del-proyecto)
  - [Personalización](#personalización)
  - [Licencia](#licencia)

---

## Qué hace el proyecto

Es una versión jugable del Tetris clásico con todas las mecánicas que esperarías:

- Tablero de **10 × 20** celdas.
- Las **7 piezas estándar** (I, O, T, S, Z, J, L) con colores diferenciados.
- **Rotación** con _wall kicks_ básicos (pequeños desplazamientos para que la pieza pueda rotar pegada a la pared).
- **Soft drop** (bajada acelerada) y **hard drop** (caída instantánea).
- **Pieza fantasma** (_ghost piece_): muestra dónde aterrizará la pieza actual.
- **Vista previa** de la siguiente pieza.
- **Sistema de puntuación** clásico de Tetris (100 / 300 / 500 / 800 multiplicado por nivel).
- **Niveles** que aumentan cada 10 líneas y aceleran la caída.
- **Pausa** y **Game Over** con opción de reinicio.
- **Skins visuales**: 4 estilos de dibujado (Retro, Neón, Pastel, Pixel art) seleccionables sin reiniciar la partida, persistidos en `localStorage`.

---

## Cómo ejecutar el juego

No hay nada que instalar ni compilar. Tienes dos opciones:

### Opción 1: abrir el archivo directamente

```bash
open index.html        # macOS
xdg-open index.html    # Linux
start index.html       # Windows
```

### Opción 2: servidor local (recomendado)

Cualquier servidor estático funciona. Algunos ejemplos:

```bash
# Con Python 3
python3 -m http.server 8000

# Con Node.js (npx)
npx serve .

# Con PHP
php -S localhost:8000
```

Después abre `http://localhost:8000` en el navegador.

---

## Controles

| Tecla     | Acción                            |
| --------- | --------------------------------- |
| `←` / `→` | Mover la pieza horizontalmente    |
| `↑` o `X` | Rotar la pieza en sentido horario |
| `↓`       | Soft drop (bajar más rápido)      |
| `Espacio` | Hard drop (caída instantánea)     |
| `P` / `Esc` | Pausar / reanudar                |

Al pausar se abre un **menú de pausa** con opciones para reanudar, reiniciar la partida, ver la lista de controles y elegir el nivel inicial (1–15, se recuerda entre partidas).

---

## Cómo funciona

El juego se compone de tres archivos que cooperan:

### 1. `index.html`

Define la estructura visual:

- Un `<canvas id="board">` de **300 × 600** píxeles donde se renderiza el tablero.
- Un panel lateral con `SCORE`, `LINES`, `LEVEL`, vista de la siguiente pieza, el selector de `SKIN` y la lista de controles.
- Un overlay para el estado **GAME OVER** y un menú de pausa (`#pause-menu`) independiente con sus opciones.

### 2. `style.css`

Aporta el aspecto visual con estética _dark / retro arcade_: fondo oscuro, tipografía monoespaciada para los marcadores y _backdrop blur_ en los overlays.

### 3. `game.js`

Contiene toda la lógica del juego. A grandes rasgos:

- **Modelo del tablero**: una matriz `ROWS × COLS` donde cada celda guarda `0` (vacía), un índice de color (1–8) que identifica la pieza, o `9` (comodín dorado, ver Power-ups).
- **Piezas**: definidas como matrices cuadradas. Para rotar se calcula la transposición + reverso de filas (`rotateCW`). Además de las 7 piezas clásicas hay una **tuerca** (`NUT`, 3×3 con el centro vacío): un reto ocasional (`NUT_CHANCE`, 1/12 por defecto) cuyo agujero central es una celda vacía real e inaccesible — bloquea la fila hasta que se limpian las filas por encima.
- **Power-ups**: piezas especiales de 1×1 (`POWERUP_CHANCE`, 1/5 por defecto) que, al asentarse, ejecutan un efecto (`applyPower`) en vez de fusionarse con el tablero:
  - 💣 **Bomba**: destruye el área 3×3 centrada en su posición.
  - ⚡ **Rayo**: limpia la fila y la columna donde cae (no cuenta como línea completada).
  - 🎨 **Tinte**: convierte todos los bloques del color más abundante del tablero en **comodines** dorados (`WILD`); al completarse cualquier línea, todos los comodines estallan y el tablero se compacta con gravedad (posible cascada de líneas).
  - ⬇️ **Gravedad** (`applyGravity`): compacta cada columna hacia abajo, eliminando huecos.
  - ❄️ **Congelar**: detiene la caída durante `FREEZE_MS` (5 s) sin bloquear el movimiento ni la rotación.
- **Detección de colisiones** (`collide`): comprueba que ninguna celda de la pieza salga del tablero ni se solape con bloques ya fijados.
- **Wall kicks** (`tryRotate`): si la rotación choca, intenta desplazar la pieza ±1 y ±2 columnas antes de descartar el giro.
- **Game loop** (`loop`): basado en `requestAnimationFrame`, acumula el tiempo transcurrido y baja la pieza una fila cuando se supera `dropInterval`.
- **Limpieza de líneas** (`clearLines`): recorre el tablero de abajo hacia arriba; cada fila completa se elimina y se inserta una vacía en la cima.
- **Puntuación**: usa la tabla clásica `[0, 100, 300, 500, 800]` multiplicada por el nivel actual; el hard drop suma 2 puntos por celda recorrida y el soft drop 1 punto por fila.
- **Nivel y velocidad**: el nivel sube cada 10 líneas; la velocidad de caída se calcula como `max(100, 1000 − (level − 1) × 90)` milisegundos.
- **Ghost piece** (`ghostY`): proyecta la posición final de la pieza actual hacia abajo y la dibuja con `globalAlpha = 0.2`.
- **Skins visuales** (constante `SKINS`, sección `// ==== SKINS ====`): cada skin define `{ id, label, colors, boardBg, gridColor, drawBlock }` y el render se despacha a través de la skin activa (`activeSkin`) en vez de leer constantes globales fijas. `drawBlock`, `drawGrid` y `drawNutHole` delegan en la skin activa manteniendo su firma original, así `drawPiece()`, `draw()` y `drawNext()` no necesitan saber nada sobre skins.
  - 🕹️ **Retro**: el render clásico del juego (idéntico al original), skin por defecto.
  - 💡 **Neón**: fondo de tablero negro y efecto *glow* (`shadowBlur`/`shadowColor`) en cada bloque; usa `context.save()/restore()` para que el resplandor nunca contamine la rejilla, el ghost, el flash de power-up ni la vista NEXT.
  - 🎀 **Pastel**: paleta de colores suaves con esquinas redondeadas (`context.roundRect()`, con *fallback* manual si el navegador no lo soporta).
  - 🟪 **Pixel art**: textura de dithering (píxeles alternos más claros/oscuros) dibujada sobre cada bloque, respetando el tamaño de celda variable.
  - **Convivencia con el tema claro/oscuro**: la skin manda sobre los colores del canvas (bloques, rejilla, fondo del tablero); el tema sigue mandando sobre el CSS de la página (fondo general, textos, panel). Excepción: Retro conserva el borde oscuro en los bloques cuando el tema es claro, igual que antes de existir las skins.
  - Selector `<select id="skin-select">` en el panel lateral; al cambiar de skin se re-dibuja con `draw()` + `drawNext()` sin reiniciar la partida, y se persiste en `localStorage` bajo `SKIN_KEY = 'tetris-skin'`.

### Flujo del juego

```
init()
  ├─ createBoard()                  → matriz vacía
  ├─ next = randomPiece()
  ├─ spawn()                        → mueve next a current y genera nueva next
  └─ requestAnimationFrame(loop)
        ↓
   loop(timestamp)
     ├─ acumula dt
     ├─ si dt ≥ dropInterval → baja la pieza o llama a lockPiece()
     ├─ draw()  (grid + tablero + ghost + pieza actual)
     └─ requestAnimationFrame(loop)

   keydown → mover / rotar / soft-drop / hard-drop / pausa
```

Cuando una pieza recién generada ya colisiona al aparecer (`spawn`), se dispara `endGame()` y se muestra el overlay de **Game Over**.

---

## Tecnologías

- **HTML5** — marcado y dos elementos `<canvas>` (tablero y vista previa).
- **CSS3** — _flexbox_, variables de color, `backdrop-filter` y `box-shadow`.
- **JavaScript (ES6+) vanilla** — `const`/`let`, _arrow functions_, _spread operator_, `Array.from`, _template literals_…
- **Canvas 2D API** — para todo el renderizado del juego.
- **`requestAnimationFrame`** — para el bucle de juego sincronizado con el navegador.

**Sin dependencias.** No hay `package.json`, ni bundler, ni transpilador.

---

## Estructura del proyecto

```
03-tetris/
├── index.html      # Estructura del DOM y canvas
├── style.css       # Estilos del juego (dark theme)
├── game.js         # Toda la lógica del Tetris (~300 líneas)
└── README.md
```

---

## Personalización

Algunos parámetros fáciles de tunear en `game.js`:

| Constante      | Significado                              | Por defecto           |
| -------------- | ---------------------------------------- | --------------------- |
| `COLS`         | Columnas del tablero                     | `10`                  |
| `ROWS`         | Filas del tablero                        | `20`                  |
| `BLOCK`        | Tamaño en píxeles de cada celda          | `30`                  |
| `COLORS`       | Paleta de colores por tipo de pieza      | 9 colores             |
| `LINE_SCORES`  | Puntos por 1, 2, 3 o 4 líneas eliminadas | `[0,100,300,500,800]` |
| `dropInterval` | Velocidad inicial de caída en ms         | `1000`                |
| `NUT_CHANCE`   | Probabilidad de que salga la tuerca      | `1/12`                |
| `POWERUP_CHANCE` | Probabilidad de que salga un power-up  | `1/5`                 |
| `FREEZE_MS`    | Duración del power-up Congelar en ms     | `5000`                |
| `POWER_CELL_SCORE` | Puntos por celda destruida por un poder (× nivel) | `10`      |
| `SKINS`        | Skins visuales disponibles (colores, fondo, rejilla y render por bloque) | `retro`, `neon`, `pastel`, `pixel` |
| `SKIN_KEY`     | Clave de `localStorage` para la skin elegida | `'tetris-skin'` |

> Si cambias `COLS`, `ROWS` o `BLOCK`, recuerda ajustar también `width` y `height` del `<canvas id="board">` en `index.html` para que coincida (`COLS × BLOCK` × `ROWS × BLOCK`).

---

## Licencia

Proyecto de uso libre con fines educativos y de práctica.

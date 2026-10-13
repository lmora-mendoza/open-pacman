# AGENTS.md — open-pacman

Vanilla JS + HTML + CSS. Sin `package.json`, sin build, sin tests, sin linter.

## Run

Abrir `src/index.html` directo en el navegador, o servir estático:
`python3 -m http.server -d src` (o `npx serve src`).

## Estructura (`src/`)

- `index.html` — entrypoint. Canvas 560x620 + overlay + 4 `<script>` en orden fijo.
- `js/maze.js` — laberinto 28x31 como strings → matriz `MAZE`. Exporta globals `MAZE`, `TUNNEL_ROW`, `PACMAN_START`, `GHOST_STARTS`.
- `js/game.js` — estado y reglas (`createGame`, `update`). Copia `MAZE` a `game.grid` por partida.
- `js/render.js` — dibujo canvas (`draw`). Lee `game.grid`, nunca `MAZE` directo.
- `js/main.js` — loop `requestAnimationFrame`, teclado, overlay start/win/lose.
- `css/style.css` — layout y overlay.

## Gotchas que rompen el juego

- Orden de scripts obligatorio: `maze.js → game.js → render.js → main.js`. Sin módulos; todo por globals y `window.*`.
- Grid: `0` vacío, `1` muro, `2` dot, `3` puerta pen. `maze.js` es la única fuente prístina; no mutar `MAZE`, solo `game.grid`.
- Colisiones asimétricas: pacman bloqueado por muro (1) + puerta (3); fantasma solo por muro (1). Ver `isWall` en `game.js:56`.
- Movimiento en coords flotantes con snap `aligned()` (`game.js:49`). Giros y decisiones de fantasma solo en celda alineada. Speeds: pacman 0.125, fantasma 0.1 celda/frame.
- Túnel solo en fila `TUNNEL_ROW = 14` con wrap (`wrapTunnel`, `game.js:76`). Fuera de esa fila, salir del borde = muro.
- Canvas 560x620 = 28x31 celdas × `TILE 20`. Si cambia el maze o `TILE`, actualizar los tres.
- `main.js` recrea `overlay.innerHTML` en win/lose y re-engancha `#action-btn`; no asumir que el botón inicial sigue vivo.

## Convenciones

- Nombres de código en inglés, comentarios en español (seguir igual).
- Sin dependencias: no añadir bundler/framework sin pedirlo.

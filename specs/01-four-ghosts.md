# SPEC 01 — Cuatro fantasmas con personalidades clásico

> **Status:** Implemented
> **Depends on:** —
> **Date:** 2026-10-13
> **Objective:** Tener 4 fantasmas con IA distinta estilo arcade donde uno persigue agresivamente a Pac-Man.

## Scope

**In:**

- Ampliar `GHOST_STARTS` en `src/js/maze.js` de 2 a 4 spawns dentro de la pen.
- Reescribir `decideGhost` en `src/js/game.js` con 4 roles: `blinky` (persigue), `pinky` (embosca), `inky` (flanquea), `clyde` (aleatorio/cauteloso).
- Mapear cada rol a un color de `GHOST_COLORS` en `src/js/render.js` (ya hay 4, solo fijar el orden).

**Out of scope (for future specs):**

- Power-pellets y modo frightened/comible.
- Alternancia chase/scatter por oleadas temporizadas.
- Velocidades distintas por fantasma o por nivel.
- Salida escalonada de la pen o IA de salida.

## Data model

```js
// game.js — fantasma (kind pasa de 2 valores a 4)
const ghost = {
  x: 12, y: 14,       // celda float, origen arriba-izquierda
  dir: 'up',
  speed: 0.1,          // GHOST_SPEED único para los 4
  kind: 'blinky',      // 'blinky' | 'pinky' | 'inky' | 'clyde'
};
```

```js
// maze.js — 4 spawns en fila del túnel, dentro de la pen (fila 14, cols 12-15)
const GHOST_STARTS = [
  { x: 13, y: 14, kind: 'blinky' },
  { x: 12, y: 14, kind: 'pinky' },
  { x: 14, y: 14, kind: 'inky' },
  { x: 15, y: 14, kind: 'clyde' },
];
```

Convenciones:

- Targeting por distancia Manhattan sobre candidatos sin reversa (regla `OPPOSITE` actual se mantiene).
- `pinky`: target = pacman + 4 celdas en `pacman.dir`.
- `inky`: target = reflejo de `blinky` sobre el punto (pacman + 2 celdas en `pacman.dir`).
- `clyde`: si dist > 8 celdas persigue como `blinky`, si no elige aleatorio entre candidatos.
- Empates de distancia → primer candidato en orden `left, right, up, down`.

## Implementation plan

1. Ampliar `GHOST_STARTS` a 4 entradas en `src/js/maze.js` con kinds nuevos. Verificación: `createGame()` devuelve 4 fantasmas.
2. Extraer `pickChase(game, g, tx, ty)` en `src/js/game.js` (elige candidato con menor Manhattan a target). Verificación: `blinky` se acerca a Pac-Man en pasillo recto.
3. Implementar `pinky` (target adelantado 4) + `inky` (target flanqueo vía posición de `blinky`). Verificación: con Pac-Man quieto mirando derecha, cada uno gira a su target.
4. Implementar `clyde` (umbral 8 celdas: chase o random). Verificación: lejos persigue, cerca vaga.
5. Fijar orden rol→color (`GHOST_COLORS`: rojo blinky, rosa pinky, cyan inky, naranja clyde). Verificación visual en canvas.

## Acceptance criteria

- [ ] `createGame()` crea exactamente 4 fantasmas con kinds `blinky, pinky, inky, clyde`.
- [ ] Los 4 arrancan dentro de la pen (celdas transitables, no muro/puerta).
- [ ] `blinky` reduce distancia Manhattan a Pac-Man en pasillo sin bifurcación.
- [ ] `pinky` apunta a pacman + 4 en su dirección (verificable con Pac-Man quieto).
- [ ] `clyde` a >8 celdas persigue y a ≤8 se mueve aleatorio.
- [ ] Los 4 comparten `GHOST_SPEED` (0.1) y respetan no-reversa salvo callejón.
- [ ] El juego carga sin errores en consola y cada fantasma tiene color distinto.

## Decisions

- **Sí:** roles clásico arcade sin scatter. Simple y da variedad inmediata sin temporizadores.
- **No:** scatter por oleadas. Se difiere a otro spec si se quiere fidelidad arcade total.
- **Sí:** misma velocidad para los 4. El agresivo destaca por puntería, no por stats.
- **No:** power-pellets en este spec. Es otro feature (pastillas + modo comible + render azul).
- **Sí:** spawns (12–15, 14) todos en pen. Reutiliza la salida actual sin nueva lógica de puerta.
- **No:** salida escalonada. Todos activos desde el inicio.

## What is **not** in this spec

- Power-pellets ni fantasmas comibles.
- Modo scatter/dispersión temporizado.
- Velocidades o dificultades por nivel.

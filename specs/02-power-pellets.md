# SPEC 02 — Power pellets en esquinas con modo frightened

> **Status:** Implemented
> **Depends on:** SPEC 01
> **Date:** 2026-10-13
> **Objective:** Agregar 4 power pellets (una por esquina) que activan 6s de modo frightened con fantasmas azules comibles y combo de puntos.

## Scope

**In:**

- Marcar 4 celdas pellet en `src/js/maze.js`: `(1,1),(26,1),(1,29),(26,29)` con nuevo valor `4` (char `'o'` en `MAZE_STR`, `parseTile` lo mapea).
- Comer pellet en `src/js/game.js`: +50 pts, `dotsRemaining--`, `frightenedTimer=360`, combo reiniciado.
- Colisión en frightened: comer fantasma suma 200/400/800/1600 según combo y el fantasma reingresa a la pen con `state='leaving'`.
- Movimiento frightened: dirección al azar entre candidatas + velocidad 0.05.
- Render en `src/js/render.js`: pellet grande con parpadeo por `frame`; fantasma azul en frightened y flash blanco cuando `frightenedTimer<60`.

**Out of scope (for future specs):**

- Ojos que viajan solos de vuelta a la pen.
- Scatter/chase por oleadas (sigue fuera, como en SPEC 01).
- Niveles con duración o velocidad de frightened distinta.
- Sonido o música.

## Data model

```js
// maze.js — const nueva + parse
const POWER_PELLETS = [ { x: 1, y: 1 }, { x: 26, y: 1 }, { x: 1, y: 29 }, { x: 26, y: 29 } ];
// grid: 4 = pellet (parseTile: 'o' → 4)

// game.js — campos nuevos en game + fantasma comido
game.frightenedTimer = 360; // frames restantes, 0 = inactivo
game.ghostCombo = 0;        // 0..3 dentro del mismo frightened
// fantasma comido: x,y = su spawn, state = 'leaving', combo aplicado antes
```

Convenciones:

- Pellet reemplaza al dot: esas 4 celdas valen `4`, no `2`; el conteo total de `dotsRemaining` no cambia.
- `frightenedTimer` se decrementa en `update()` y al llegar a 0 los fantasmas vuelven a `decideGhost` normal.
- Coordenadas origen arriba-izquierda, como en SPEC 01.

## Implementation plan

1. Cambiar 4 chars `'.'`→`'o'` en `MAZE_STR` (filas 1 y 29) y mapear `'o'→4` en `parseTile` (`maze.js`). Verificación: `MAZE[1][1]===4` y simétricos.
2. Comer pellet en `movePacman` (`game.js`): si celda es `4` → `0`, +50 pts, `dotsRemaining--`, `frightenedTimer=360`, `ghostCombo=0`. Verificación: Pac-Man quieto sobre esquina suma 50.
3. Rama de colisión en `update` (`game.js`): si `frightenedTimer>0` comer fantasma (puntos `200<<ghostCombo`, respawn en pen `state='leaving'`); si no, vida menos como hoy. Verificación: cazar 2 seguidos da 200+400.
4. Movimiento frightened (`game.js`): si activo, fantasma `outside` elige al azar y va a 0.05. Verificación: con timer fijo se mueven errático y lento.
5. Render (`render.js`): dibujar `4` con radio mayor + parpadeo; fantasma azul (`#2121de`) y blanco si `frightenedTimer<60`. Verificación visual en canvas.

## Acceptance criteria

- [ ] Hay exactamente 4 celdas `4` en `(1,1),(26,1),(1,29),(26,29)` y el resto del maze no cambia.
- [ ] Comer pellet suma 50, baja `dotsRemaining` en 1 y activa `frightenedTimer=360`.
- [ ] En frightened, chocar fantasma suma 200/400/800/1600 en orden y el fantasma vuelve a la pen.
- [ ] Fuera de frightened, chocar fantasma quita vida como antes.
- [ ] En frightened los fantasmas se mueven al azar a mitad de velocidad.
- [ ] La pellet parpadea, el fantasma se ve azul y parpadea blanco al final del modo.
- [ ] El juego carga sin errores en consola y se puede ganar comiendo todo (pellets incluidas).

## Decisions

- **Sí:** modo frightened completo estilo arcade. Es lo que el jugador espera de una power pellet.
- **No:** solo-puntos sin frightened. Quedaría como dot grande sin gracia.
- **Sí:** 6s fijos para todos. Simple, sin tabla por nivel.
- **No:** ojos viajeros. El respawn directo en pen reutiliza la salida escalonada ya implementada.
- **Sí:** pellet cuenta como dot. No cambia el total ni la condición de victoria.
- **No:** huida inteligente (maximizar distancia). Azar + lento ya da ventaja suficiente y es menos código.
- **Sí:** depende de SPEC 01. Reutiliza kinds, `decideGhost` y la máquina de estados `house/leaving/outside`.

## What is **not** in this spec

- Ojos que regresan solos a la pen.
- Scatter/chase temporizado.
- Duraciones o velocidades por nivel.
- Audio.

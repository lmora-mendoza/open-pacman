// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS, GHOST_EXIT.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

const PACMAN_SPEED = 0.125; // 1/8 celda/frame -> alinea cada 8 frames
const GHOST_SPEED = 0.1;    // 1/10 celda/frame
const FRIGHTENED_SPEED = 0.05; // mitad de velocidad en frightened
const FRIGHTENED_DURATION = 360; // 6s a 60fps
const FRIGHTENED_FLASH = 60;    // ultimos frames: parpadeo blanco

// Salida escalonada del pen (en frames a 60fps).
const GHOST_EXIT_TIMERS = { blinky: 0, pinky: 30, inky: 180, clyde: 360 };
const HOUSE_TOP = 13.5;
const HOUSE_BOTTOM = 14.5;

function makeGhost( g ) {
  const timer = GHOST_EXIT_TIMERS[ g.kind ] || 0;
  return {
    x: g.x,
    y: g.y,
    homeX: g.x,
    dir: 'up',
    speed: GHOST_SPEED,
    kind: g.kind,
    state: timer <= 0 ? 'leaving' : 'house',
    exitTimer: timer,
  };
}

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  for ( const row of grid ) for ( const v of row ) if ( v === 2 ) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    frightenedTimer: 0,
    ghostCombo: 0,
    grid,
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( makeGhost ),
  };
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Una celda es muro para el actor dado?
//   pacman: bloqueado por pared (1) y puerta (3)
//   ghost:  bloqueado solo por pared (1)
function isWall( grid, x, y, actor ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 && actor === 'pacman' ) return true;
  return false;
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
function canMove( grid, x, y, dir, actor ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  return !isWall( grid, tx, ty, actor );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot o power pellet (la pellet reemplaza al dot: tambien cuenta).
    if ( grid[ p.y ][ p.x ] === 2 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 10;
      game.dotsRemaining--;
    } else if ( grid[ p.y ][ p.x ] === 4 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 50;
      game.dotsRemaining--;
      game.frightenedTimer = FRIGHTENED_DURATION;
      game.ghostCombo = 0;
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

// Elige el candidato que minimiza la distancia Manhattan al target.
// Empates: primer candidato en orden left, right, up, down.
function pickChase( g, choices, tx, ty ) {
  let best = choices[ 0 ];
  let bestDist = Infinity;
  for ( const dir of choices ) {
    const d = DIRS[ dir ];
    const dist = Math.abs( g.x + d.x - tx ) + Math.abs( g.y + d.y - ty );
    if ( dist < bestDist ) {
      bestDist = dist;
      best = dir;
    }
  }
  return best;
}

function decideGhost( game, g ) {
  const grid = game.grid;
  const p = game.pacman;

  const options = Object.keys( DIRS ).filter(
    ( dir ) => dir !== OPPOSITE[ g.dir ] && canMove( grid, g.x, g.y, dir, 'ghost' )
  );
  // Sin salida (callejon): permitir el giro de 180.
  const choices = options.length ? options : [ '' + OPPOSITE[ g.dir ] ];

  // Asustado: vagar al azar (comible, sin punteria).
  if ( game.frightenedTimer > 0 ) {
    g.dir = choices[ Math.floor( Math.random() * choices.length ) ];
    return;
  }

  if ( g.kind === 'blinky' ) {
    g.dir = pickChase( g, choices, Math.round( p.x ), Math.round( p.y ) );
  } else if ( g.kind === 'pinky' ) {
    // Embosca 4 celdas por delante de Pac-Man.
    const d = DIRS[ p.dir ] || { x: 0, y: 0 };
    g.dir = pickChase( g, choices, Math.round( p.x ) + 4 * d.x, Math.round( p.y ) + 4 * d.y );
  } else if ( g.kind === 'inky' ) {
    // Flanquea: refleja a blinky sobre el punto 2 celdas delante de Pac-Man.
    const d = DIRS[ p.dir ] || { x: 0, y: 0 };
    const pivotX = Math.round( p.x ) + 2 * d.x;
    const pivotY = Math.round( p.y ) + 2 * d.y;
    const blinky = game.ghosts.find( ( h ) => h.kind === 'blinky' );
    const bx = blinky ? Math.round( blinky.x ) : g.x;
    const by = blinky ? Math.round( blinky.y ) : g.y;
    g.dir = pickChase( g, choices, 2 * pivotX - bx, 2 * pivotY - by );
  } else if ( g.kind === 'clyde' ) {
    // Cauteloso: persigue lejos, vaga cerca (umbral 8 celdas Manhattan).
    const dist = Math.abs( Math.round( g.x ) - Math.round( p.x ) ) +
      Math.abs( Math.round( g.y ) - Math.round( p.y ) );
    if ( dist > 8 ) {
      g.dir = pickChase( g, choices, Math.round( p.x ), Math.round( p.y ) );
    } else {
      g.dir = choices[ Math.floor( Math.random() * choices.length ) ];
    }
  } else {
    g.dir = choices[ Math.floor( Math.random() * choices.length ) ];
  }
}

// Rebote vertical dentro del pen + salida guionada por la puerta.
// Ignora decideGhost: el chase tira hacia abajo y nunca elegiria subir.
function moveHouseGhost( g ) {
  if ( g.state === 'house' ) {
    if ( g.exitTimer > 0 ) g.exitTimer--;
    if ( g.exitTimer <= 0 ) {
      g.state = 'leaving';
      return;
    }
    g.x = g.homeX;
    if ( g.dir !== 'up' && g.dir !== 'down' ) g.dir = 'up';
    const d = DIRS[ g.dir ];
    g.y += d.y * g.speed;
    if ( g.y <= HOUSE_TOP ) {
      g.y = HOUSE_TOP;
      g.dir = 'down';
    } else if ( g.y >= HOUSE_BOTTOM ) {
      g.y = HOUSE_BOTTOM;
      g.dir = 'up';
    }
    return;
  }

  // leaving: centra en x de salida y sube hasta GHOST_EXIT.
  const targetX = GHOST_EXIT.x;
  if ( Math.abs( g.x - targetX ) > g.speed / 2 ) {
    g.dir = g.x < targetX ? 'right' : 'left';
    g.x += ( g.x < targetX ? 1 : -1 ) * g.speed;
    return;
  }
  g.x = targetX;
  g.dir = 'up';
  g.y -= g.speed;
  if ( g.y <= GHOST_EXIT.y ) {
    g.x = GHOST_EXIT.x;
    g.y = GHOST_EXIT.y;
    g.state = 'outside';
    g.dir = 'left';
  }
}

function moveGhost( game, g ) {
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    decideGhost( game, g );
    if ( !canMove( grid, g.x, g.y, g.dir, 'ghost' ) ) return;
  }

  const d = DIRS[ g.dir ];
  const step = game.frightenedTimer > 0 ? FRIGHTENED_SPEED : g.speed;
  g.x += d.x * step;
  g.y += d.y * step;
  wrapTunnel( g, width );
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  // Morir corta el frightened.
  game.frightenedTimer = 0;
  game.ghostCombo = 0;
  game.ghosts.forEach( ( g, i ) => {
    const fresh = makeGhost( GHOST_STARTS[ i ] );
    g.x = fresh.x;
    g.y = fresh.y;
    g.homeX = fresh.homeX;
    g.dir = fresh.dir;
    g.state = fresh.state;
    g.exitTimer = fresh.exitTimer;
  } );
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

// Come un fantasma asustado: combo 200/400/800/1600 y reingresa a la pen.
function eatGhost( game, g ) {
  game.score += 200 * Math.pow( 2, Math.min( game.ghostCombo, 3 ) );
  game.ghostCombo++;
  const spawn = GHOST_STARTS.find( ( s ) => s.kind === g.kind ) || GHOST_STARTS[ 0 ];
  g.x = spawn.x;
  g.y = spawn.y;
  g.homeX = spawn.x;
  g.dir = 'up';
  g.state = 'leaving';
  g.exitTimer = 0;
}

// Re-alinea al grid de 0.1 para que los pasos de GHOST_SPEED vuelvan
// a caer en enteros y aligned() dispare las decisiones de giro.
function snapGhost( g ) {
  if ( g.state !== 'outside' ) return;
  g.x = Math.round( g.x * 10 ) / 10;
  g.y = Math.round( g.y * 10 ) / 10;
}

function update( game ) {
  movePacman( game );
  if ( game.frightenedTimer > 0 ) {
    game.frightenedTimer--;
    // Al expirar, la velocidad vuelve de 0.05 a 0.1: sin snap, un offset
    // de 0.05 hace que aligned() no dispare jamas y el fantasma camine
    // recto a traves de muros. Snap maximo de 1px, seguro en pasillo.
    if ( game.frightenedTimer === 0 ) game.ghosts.forEach( snapGhost );
  }
  game.ghosts.forEach( ( g ) => {
    if ( g.state === 'outside' ) moveGhost( game, g );
    else moveHouseGhost( g );
  } );

  for ( const g of game.ghosts ) {
    if ( collides( game.pacman, g ) ) {
      if ( game.frightenedTimer > 0 ) {
        eatGhost( game, g );
        continue;
      }
      game.lives--;
      if ( game.lives <= 0 ) {
        game.state = 'lost';
        return;
      }
      resetPositions( game );
      break;
    }
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
window.FRIGHTENED_FLASH = FRIGHTENED_FLASH;

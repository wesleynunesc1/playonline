/** Regras do jogo da cobra, sem dependência de tela. */
export const GRID = 17;
export const FOOD_POINTS = 10;
export const BONUS_POINTS = 50;
export const BONUS_STEPS = 45;
const BONUS_EVERY = 5;

export interface Cell { x: number; y: number }
export type Direction = 'up' | 'down' | 'left' | 'right';
export type StepResult = 'move' | 'eat' | 'bonus' | 'dead' | 'win';

export interface SnakeGame {
  body: Cell[];
  /** Posição anterior da cauda, usada na animação */
  lastTail: Cell;
  dir: Direction;
  queue: Direction[];
  food: Cell;
  bonus: (Cell & { steps: number }) | null;
  eaten: number;
  score: number;
  walls: boolean;
}

export const VECTORS: Record<Direction, Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const same = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y;

function freeCell(taken: Cell[]): Cell | null {
  const free: Cell[] = [];
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (!taken.some((c) => c.x === x && c.y === y)) free.push({ x, y });
    }
  }
  return free.length ? free[Math.floor(Math.random() * free.length)] : null;
}

export function createSnake(walls: boolean): SnakeGame {
  const mid = Math.floor(GRID / 2);
  const body = [0, 1, 2, 3].map((i) => ({ x: mid - 2 - i, y: mid }));
  return {
    body,
    lastTail: body[body.length - 1],
    dir: 'right',
    queue: [],
    food: { x: mid + 3, y: mid },
    bonus: null,
    eaten: 0,
    score: 0,
    walls,
  };
}

/** Enfileira até duas curvas, para não perder comandos rápidos; ignora meia-volta */
export function turn(game: SnakeGame, dir: Direction) {
  const last = VECTORS[game.queue[game.queue.length - 1] ?? game.dir];
  const next = VECTORS[dir];
  if (game.queue.length < 2 && last.x * next.x + last.y * next.y === 0) game.queue.push(dir);
}

export const stepMs = (game: SnakeGame) => Math.max(72, 150 - game.eaten * 2.5);

export function step(game: SnakeGame): StepResult {
  game.dir = game.queue.shift() ?? game.dir;
  const v = VECTORS[game.dir];
  const head = { x: game.body[0].x + v.x, y: game.body[0].y + v.y };

  if (game.walls && (head.x < 0 || head.y < 0 || head.x >= GRID || head.y >= GRID)) return 'dead';
  head.x = (head.x + GRID) % GRID;
  head.y = (head.y + GRID) % GRID;

  const ate = same(head, game.food);
  // A cauda libera sua célula neste passo, exceto quando a cobra cresce
  const obstacles = ate ? game.body : game.body.slice(0, -1);
  if (obstacles.some((c) => same(c, head))) return 'dead';

  game.lastTail = game.body[game.body.length - 1];
  game.body.unshift(head);
  if (!ate) game.body.pop();

  let result: StepResult = ate ? 'eat' : 'move';
  if (game.bonus) {
    if (same(head, game.bonus)) {
      game.score += BONUS_POINTS;
      game.bonus = null;
      result = 'bonus';
    } else if (--game.bonus.steps <= 0) game.bonus = null;
  }

  if (ate) {
    game.eaten++;
    game.score += FOOD_POINTS;
    if (game.body.length === GRID * GRID) return 'win';
    const food = freeCell(game.bonus ? [...game.body, game.bonus] : game.body);
    if (food) game.food = food;
    else if (game.bonus) {
      game.food = { x: game.bonus.x, y: game.bonus.y };
      game.bonus = null;
    }
    if (game.eaten % BONUS_EVERY === 0 && !game.bonus) {
      const cell = freeCell([...game.body, game.food]);
      if (cell) game.bonus = { ...cell, steps: BONUS_STEPS };
    }
  }
  return result;
}

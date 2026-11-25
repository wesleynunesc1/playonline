import { BUILDS, BuildId, GRID, RAID_SECONDS, SPELLS, SpellId, TROOPS, TroopId, dpsAt, hpAt } from './content';
import { mod } from './mods';
import type { Base, Squad } from './village';

/** Simulação do ataque, sem tela: passos fixos de 0,1 s. */
export const STEP = 0.1;
export interface SimBuild { id: number; b: BuildId; level: number; cx: number; cy: number; half: number; hp: number; max: number; cool: number; aim: number }
export interface SimTroop { id: number; t: TroopId; x: number; y: number; hp: number; max: number; cool: number; target: number; dir: number; hit: number }
export interface Shot { x1: number; y1: number; x2: number; y2: number; kind: 'bala' | 'flecha' | 'coco' | 'fogo' | 'cura' | 'bomba' | 'golpe'; air: boolean }
export interface Raid {
  base: Base; builds: SimBuild[]; troops: SimTroop[]; left: Squad; time: number; shots: Shot[]; fallen: SimBuild[]; died: SimTroop[];
  total: number; destroyed: number; stars: number; percent: number; over: boolean; seq: number; moedas: number; farinha: number; started: boolean;
  spells: Record<SpellId, number>; zones: { s: SpellId; x: number; y: number; left: number }[]; pendingFall: SimBuild[];
}
const LOOT: BuildId[] = ['feira', 'casafarinha', 'cofre', 'celeiro', 'prefeitura'];

export function startRaid(base: Base, army: Squad, spells: Record<SpellId, number> = { reza: 0, trovao: 0, forro: 0 }): Raid {
  const builds = base.builds.map((p) => {
    const half = BUILDS[p.b].size / 2;
    const hp = hpAt(p.b, p.level);
    return { id: p.id, b: p.b, level: p.level, cx: p.x + half, cy: p.y + half, half, hp, max: hp, cool: 0, aim: 0 };
  });
  return {
    base, builds, troops: [], left: { ...army }, time: RAID_SECONDS, shots: [], fallen: [], died: [], total: builds.filter((b) => b.b !== 'muro').length,
    destroyed: 0, stars: 0, percent: 0, over: false, seq: 0, moedas: 0, farinha: 0, started: false, spells: { ...spells }, zones: [], pendingFall: [],
  };
}
/** Distância de um ponto à borda de uma construção */
const gap = (x: number, y: number, b: SimBuild) => Math.hypot(Math.max(0, Math.abs(x - b.cx) - b.half), Math.max(0, Math.abs(y - b.cy) - b.half));
/** Só se desembarca fora do alcance das construções */
export const canDeploy = (r: Raid, x: number, y: number) =>
  mod.anywhere || x >= -2 && y >= -2 && x <= GRID + 2 && y <= GRID + 2 && r.builds.every((b) => b.hp <= 0 || gap(x, y, b) > (b.b === 'muro' ? 0.6 : 1.3));

export function deploy(r: Raid, t: TroopId, x: number, y: number): boolean {
  if (r.over || r.left[t] < 1 || !canDeploy(r, x, y)) return false;
  if (!mod.endless) r.left[t]--;
  r.started = true;
  const d = TROOPS[t];
  r.troops.push({ id: ++r.seq, t, x, y, hp: d.hp, max: d.hp, cool: 0.3, target: 0, dir: 0, hit: 0 });
  return true;
}

/** Feitiço: pode cair em qualquer lugar, depois que a luta começou */
export function cast(r: Raid, s: SpellId, x: number, y: number): boolean {
  if (r.over || !r.started || r.spells[s] < 1) return false;
  if (!mod.spells) r.spells[s]--;
  r.zones.push({ s, x, y, left: SPELLS[s].seconds });
  const seen = new Set(r.fallen.map((b) => b.id));
  if (s === 'trovao') for (const b of r.builds) if (b.hp > 0 && gap(x, y, b) <= SPELLS.trovao.radius) hurtBuild(r, b, 260 + r.base.level * 70);
  if (s === 'trovao') r.pendingFall.push(...r.fallen.filter((b) => b.hp <= 0 && !seen.has(b.id)));
  return true;
}
const boosted = (r: Raid, u: SimTroop) => r.zones.some((z) => z.s === 'forro' && Math.hypot(z.x - u.x, z.y - u.y) <= SPELLS.forro.radius);

function pickTarget(r: Raid, u: SimTroop): SimBuild | null {
  const d = TROOPS[u.t];
  const alive = r.builds.filter((b) => b.hp > 0);
  const wanted = d.prefers === 'defesa' ? alive.filter((b) => BUILDS[b.b].defense)
    : d.prefers === 'muro' ? alive.filter((b) => b.b === 'muro')
      : d.prefers === 'recurso' ? alive.filter((b) => LOOT.includes(b.b) && b.b !== 'prefeitura') : [];
  const list = wanted.length ? wanted : alive.filter((b) => b.b !== 'muro');
  let best: SimBuild | null = null;
  let k = 1e9;
  for (const b of list) {
    const g = gap(u.x, u.y, b);
    if (g < k) {
      k = g;
      best = b;
    }
  }
  return best;
}
function hurtBuild(r: Raid, b: SimBuild, n: number) {
  if (b.hp <= 0) return;
  const before = Math.max(0, b.hp);
  b.hp -= mod.oneHit ? b.max : n;
  if (LOOT.includes(b.b)) {
    // O saque sai aos poucos, conforme a construção apanha
    const share = ((before - Math.max(0, b.hp)) * (mod.loot && !r.base.player ? 10 : 1)) / b.max / r.builds.filter((x) => LOOT.includes(x.b)).length;
    r.moedas += r.base.moedas * share;
    r.farinha += r.base.farinha * share;
  }
  if (b.hp > 0) return;
  r.fallen.push(b);
  if (b.b === 'muro') return;
  r.destroyed++;
  r.percent = Math.floor((r.destroyed / r.total) * 100);
  const hallDown = r.builds.every((x) => x.b !== 'prefeitura' || x.hp <= 0);
  r.stars = (r.percent >= 50 ? 1 : 0) + (hallDown ? 1 : 0) + (r.percent >= 100 ? 1 : 0);
}
function hurtTroop(r: Raid, u: SimTroop, n: number) {
  if (u.hp <= 0 || (mod.god && n < 1e8)) return;
  u.hp -= n;
  u.hit = 0.15;
  if (u.hp <= 0) r.died.push(u);
}

export function stepRaid(r: Raid) {
  r.shots = [];
  r.fallen = r.pendingFall;
  r.pendingFall = [];
  r.died = [];
  if (r.over) return;
  if (r.started && !mod.clock) r.time -= STEP;
  for (const z of r.zones) {
    z.left -= STEP;
    if (z.s === 'reza') for (const u of r.troops) if (Math.hypot(z.x - u.x, z.y - u.y) <= SPELLS.reza.radius) u.hp = Math.min(u.max, u.hp + 45 * STEP + u.max * 0.06 * STEP);
  }
  r.zones = r.zones.filter((z) => z.left > 0);
  const byId = new Map(r.builds.map((b) => [b.id, b]));

  for (const u of r.troops) {
    if (u.hp <= 0) continue;
    u.hit = Math.max(0, u.hit - STEP);
    u.cool -= STEP;
    const d = TROOPS[u.t];
    if (d.heal) {
      healer(r, u);
      continue;
    }
    let b = byId.get(u.target);
    if (!b || b.hp <= 0) {
      b = pickTarget(r, u) ?? undefined;
      u.target = b?.id ?? 0;
    }
    if (!b) continue;
    u.dir = Math.atan2(b.cy - u.y, b.cx - u.x);
    if (gap(u.x, u.y, b) > d.range) {
      const speed = d.speed * (boosted(r, u) ? 1.4 : 1) * (mod.fast ? 2.5 : 1) * STEP;
      const vx = Math.cos(u.dir) * speed;
      const vy = Math.sin(u.dir) * speed;
      // Muro no caminho: ataca o muro
      const wall = d.air || mod.through ? undefined : r.builds.find((w) => w.hp > 0 && w !== b && w.b === 'muro' && gap(u.x + vx * 2, u.y + vy * 2, w) < 0.12);
      if (wall) b = wall;
      else {
        u.x += vx;
        u.y += vy;
        continue;
      }
    }
    if (u.cool > 0) continue;
    u.cool = d.every;
    const n = (d.bomb ? d.dps * (b.b === 'muro' ? 8 : 1) : d.dps * d.every) * (boosted(r, u) ? 1.6 : 1);
    r.shots.push({ x1: u.x, y1: u.y, x2: b.cx, y2: b.cy, kind: d.bomb ? 'bomba' : u.t === 'boitata' ? 'fogo' : d.range > 2 ? 'flecha' : 'golpe', air: !!d.air });
    if (d.splash) {
      const [sx, sy] = d.bomb ? [u.x, u.y] : [b.cx, b.cy];
      for (const o of r.builds) if (o.hp > 0 && (o === b || gap(sx, sy, o) <= d.splash)) hurtBuild(r, o, d.bomb && o.b !== 'muro' ? d.dps : o === b ? n : n * 0.6);
    } else hurtBuild(r, b, n);
    if (d.bomb) hurtTroop(r, u, 1e9);
  }

  for (const b of r.builds) {
    const def = BUILDS[b.b].defense;
    if (!def || b.hp <= 0 || mod.freeze) continue;
    b.cool -= STEP;
    if (b.cool > 0) continue;
    let best: SimTroop | null = null;
    let k = 1e9;
    for (const u of r.troops) {
      if (u.hp <= 0 || (TROOPS[u.t].air ? !def.air : !def.ground)) continue;
      const dist = Math.hypot(u.x - b.cx, u.y - b.cy);
      if (dist > def.range || dist < (def.min ?? 0) || dist >= k) continue;
      k = dist;
      best = u;
    }
    if (!best) continue;
    b.cool = def.every;
    b.aim = Math.atan2(best.y - b.cy, best.x - b.cx);
    const n = dpsAt(b.b, b.level) * def.every;
    r.shots.push({ x1: b.cx, y1: b.cy, x2: best.x, y2: best.y, kind: b.b === 'catapulta' ? 'coco' : b.b === 'mirante' ? 'flecha' : 'bala', air: !!TROOPS[best.t].air });
    if (def.splash) {
      for (const u of r.troops) if (u.hp > 0 && !TROOPS[u.t].air && Math.hypot(u.x - best.x, u.y - best.y) <= def.splash) hurtTroop(r, u, n);
    } else hurtTroop(r, best, n);
  }
  r.troops = r.troops.filter((u) => u.hp > 0);
  const reserve = Object.values(r.left).some((n) => n > 0);
  const fighting = r.troops.some((u) => !TROOPS[u.t].heal);
  if (r.time <= 0 || r.percent >= 100 || (!reserve && !fighting)) r.over = true;
}
function healer(r: Raid, u: SimTroop) {
  const d = TROOPS[u.t];
  let worst: SimTroop | null = null;
  let near: SimTroop | null = null;
  for (const o of r.troops) {
    if (o === u || o.hp <= 0 || TROOPS[o.t].heal) continue;
    const dist = Math.hypot(o.x - u.x, o.y - u.y);
    if (!near || dist < Math.hypot(near.x - u.x, near.y - u.y)) near = o;
    if (o.hp < o.max && dist <= d.range && (!worst || o.hp / o.max < worst.hp / worst.max)) worst = o;
  }
  if (worst && u.cool <= 0) {
    u.cool = d.every;
    worst.hp = Math.min(worst.max, worst.hp + d.dps * d.every);
    r.shots.push({ x1: u.x, y1: u.y, x2: worst.x, y2: worst.y, kind: 'cura', air: false });
  }
  const follow = worst ?? near;
  if (!follow || Math.hypot(follow.x - u.x, follow.y - u.y) < 2) return;
  u.dir = Math.atan2(follow.y - u.y, follow.x - u.x);
  u.x += Math.cos(u.dir) * d.speed * STEP;
  u.y += Math.sin(u.dir) * d.speed * STEP;
}

/** Tropas que sobraram: as não usadas e as que sobreviveram */
export function survivors(r: Raid): Squad {
  const out = { ...r.left };
  for (const u of r.troops) out[u.t]++;
  return out;
}

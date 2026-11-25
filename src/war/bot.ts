import { CITY, ERAS, MAX_DEV, POWERS, REL, UNIT_ERA, WORKS_ERA, PowerId, UNITS, UnitId, WORKS, WorksId, devCost } from './data';
import { CityState, World, annexBlock, armyCap, armySize, atWar, citiesOf, command, hasRule, hostile, needOf, relOf, slotsIn, worksPrice } from './sim';

/** Robôs: constroem, treinam e atacam com o mesmo conjunto de ordens dos jogadores. `bot` 1 a 3 é a dificuldade */
const pick = <T,>(l: T[]) => l[Math.floor(Math.random() * l.length)];
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

export function think(w: World, i: number) {
  const p = w.players[i];
  const mine = citiesOf(w, i);
  if (!p.alive || !mine.length) return;
  const skill = p.bot;
  if (skill === 1 && Math.random() < 0.45) return;

  grow(w, i, mine);
  diplomacy(w, i, skill);
  build(w, i, mine);
  // Em paz mantém só uma guarda; em guerra usa tudo
  if (atWar(w, i) || armySize(w, i) < 3 + mine.length + p.era * 2) train(w, i, mine);
  attack(w, i, mine, skill);
  if (skill >= 2 && Math.random() < 0.06) command(w, i, { c: 'research', id: pick(['ia', 'blindagem', 'fintech', 'verde', 'motor', 'optica', 'logistica', 'cidade', ...(skill > 2 || mine.length > 12 ? ['nuclear', 'nuclear'] : [])]) });
  if (skill >= 2 && Math.random() < 0.12) support(w, i);
}

/** Cresce em paz: evolui cidades, faz acordos com vizinhas neutras e avança de era */
function grow(w: World, i: number, mine: CityState[]) {
  const p = w.players[i];
  const e = ERAS[p.era];
  if (e && mine.length >= e.cities && p.money > e.money * 1.1 && p.fuel >= e.fuel) return void command(w, i, { c: 'era' });
  // Guarda dinheiro quando a próxima era já está ao alcance
  if (e && mine.length >= e.cities && p.money > e.money * 0.45 && Math.random() < 0.75) return;
  if (Math.random() < 0.3) {
    const c = mine.filter((x) => x.dev < MAX_DEV && !x.devLeft && p.era > x.dev).sort((a, b) => a.dev - b.dev || CITY[b.id].level - CITY[a.id].level)[0];
    if (c && p.money > devCost(CITY[c.id].level, c.dev)[0] * 1.3) command(w, i, { c: 'dev', city: c.id });
  }
  if (Math.random() < 0.25) {
    const home = mine[Math.floor(Math.random() * mine.length)];
    const c = w.cities.filter((x) => x.owner < 0 && dist(x, home) < 7 && !annexBlock(w, i, x)).sort((a, b) => dist(a, home) - dist(b, home))[0];
    if (c) command(w, i, { c: 'annex', city: c.id });
  }
}
/** Fácil nunca começa guerra; Normal só tarde; Difícil mais cedo. Sempre com ultimato */
function diplomacy(w: World, i: number, skill: number) {
  const force = (k: number) => w.units.reduce((s, u) => s + (u.o === k ? u.max : 0), 0) + 1;
  for (const o of w.offers.filter((x) => x.b === i)) {
    if (Math.random() < 0.5) continue;
    const yes = o.k === REL.paz ? force(i) < force(o.a) * 1.6 || Math.random() < 0.25 : o.k === REL.comercio ? Math.random() < 0.8 : Math.random() < 0.45;
    command(w, i, { c: 'answer', from: o.a, yes });
  }
  const others = w.players.filter((p) => p.i !== i && p.alive && p.team !== w.players[i].team);
  if (Math.random() < 0.01) {
    const o = pick(others);
    const r = o && relOf(w, i, o.i);
    if (r === REL.paz) command(w, i, { c: 'dip', to: o.i, k: 'comercio' });
    else if (r === REL.guerra && force(i) < force(o.i) * 0.8) command(w, i, { c: 'dip', to: o.i, k: 'paz' });
  }
  const from = skill >= 3 ? 420 : 900;
  if (skill < 2 || w.t < from || atWar(w, i) || Math.random() > (skill >= 3 ? 0.012 : 0.004)) return;
  const prey = others.filter((o) => relOf(w, i, o.i) !== REL.alianca && force(o.i) < force(i) * 1.1).sort((a, b) => force(a.i) - force(b.i))[0];
  if (prey) command(w, i, { c: 'dip', to: prey.i, k: 'guerra' });
}

function build(w: World, i: number, mine: CityState[]) {
  const p = w.players[i];
  const has = (k: WorksId) => mine.reduce((n, c) => n + c.works.filter((x) => x.k === k).length, 0);
  const front = [...mine].sort((a, b) => threat(w, i, b) - threat(w, i, a))[0];
  const want: WorksId[] = [];
  if (has('mercado') < mine.length * 0.6 + 1) want.push('mercado');
  if (has('refinaria') < mine.length * 0.35 + 1) want.push('refinaria');
  if (!has('fabrica') && mine.length > 1) want.unshift('fabrica');
  if (has('fabrica') && !has('drones')) want.push('drones');
  if (mine.length > 4 && !has('aeroporto') && !hasRule(w, 'semar')) want.push('aeroporto');
  if (has('quartel') < 1 + mine.length / 4) want.push('quartel');
  if (mine.length > 12 && (p.res.nuclear ?? 0) > 0 && !has('silo') && !hasRule(w, 'semnuke')) want.unshift('silo');
  if (mine.length > 8 && !has('domo')) want.push('domo');
  want.push('banco', 'solar', 'shopping', 'hospital');
  for (const k of want) {
    const [m, f] = worksPrice(w, i, k);
    if (p.money < m * 1.15 || p.fuel < f) continue;
    const c = mine.find((x) => CITY[x.id].level >= WORKS[k].level && x.works.length < slotsIn(w, x) && w.players[i].era >= WORKS_ERA[k] && !(k !== 'mercado' && k !== 'refinaria' && x.works.some((y) => y.k === k)));
    if (c && !command(w, i, { c: 'build', city: c.id, k })) return;
  }
  if (front && threat(w, i, front) > 2 && p.money > 500) command(w, i, { c: 'build', city: front.id, k: pick(['torre', 'vigia', 'antiaerea'] as WorksId[]) });
}
/** Inimigos perto de uma cidade */
const threat = (w: World, i: number, c: CityState) => w.units.filter((u) => hostile(w, u.o, i) && dist(u, c) < 4.5).length;

function train(w: World, i: number, mine: CityState[]) {
  const p = w.players[i];
  if (armySize(w, i) >= armyCap(w, i)) return;
  const enemyAir = w.units.some((u) => hostile(w, u.o, i) && UNITS[u.k].cls === 'ar');
  const menu: UnitId[] = ['soldado', 'soldado', 'blindado', 'tanque', 'tanque', 'antitanque', 'artilharia', 'fpv', 'fpv', 'foguete', 'heli', 'caca', 'moto', 'medico'];
  if (enemyAir) menu.push('antiaerea', 'antiaerea');
  for (let n = 0; n < 3; n++) {
    const k = pick(menu);
    const d = UNITS[k];
    if (p.era < UNIT_ERA[k] || p.money < d.money * 1.2 || p.fuel < d.fuel) continue;
    const c = mine.filter((x) => x.q.length < 3 && x.works.some((y) => y.k === d.from && y.left <= 0)).sort((a, b) => threat(w, i, b) - threat(w, i, a))[0];
    if (c) command(w, i, { c: 'train', city: c.id, k });
  }
}

function attack(w: World, i: number, mine: CityState[], skill: number) {
  const idle = w.units.filter((u) => u.o === i && !u.go && u.k !== 'recon');
  // Defende o que está sob ataque
  const hurt = mine.filter((c) => c.hit > 0 && threat(w, i, c) > 0);
  if (hurt.length && idle.length) {
    const c = hurt[0];
    const near = idle.filter((u) => dist(u, c) < 10 && dist(u, c) > 1.5);
    if (near.length) command(w, i, { c: 'move', u: near.map((u) => u.i), x: c.x, z: c.z });
  }
  const free = idle.filter((u) => !hurt.some((c) => dist(u, c) < 2));
  if (free.length < 3 + skill) return;
  const cx = free.reduce((s, u) => s + u.x, 0) / free.length;
  const cz = free.reduce((s, u) => s + u.z, 0) / free.length;
  // Grupo em volta do mais próximo do centro
  const lead = free.reduce((b, u) => (Math.hypot(u.x - cx, u.z - cz) < Math.hypot(b.x - cx, b.z - cz) ? u : b));
  const group = free.filter((u) => dist(u, lead) < 6);
  const power = group.reduce((s, u) => s + u.hp * 0.5 + UNITS[u.k].dmg[0] * 3 + UNITS[u.k].dmg[1] * 2, 0);
  const targets = w.cities.filter((c) => hostile(w, c.owner, i) && (c.owner >= 0 || hasRule(w, 'guerra'))).map((c) => {
    const guard = w.units.filter((u) => hostile(w, u.o, i) && dist(u, c) < 2.5).length * 150;
    const strength = c.hp * 0.8 + CITY[c.id].level * 110 + guard + (c.owner >= 0 ? c.works.length * 60 : 0);
    return { c, v: (CITY[c.id].level * 60 + (c.owner >= 0 ? 60 : 30)) / (dist(c, lead) + 1.5) - (strength > power * 1.1 ? 200 : 0) };
  }).sort((a, b) => b.v - a.v);
  const t = targets[0];
  if (!t || t.v < -60) {
    // Junta forças na cidade mais próxima
    const home = mine.reduce((b, c) => (dist(c, lead) < dist(b, lead) ? c : b));
    if (group.length < free.length) command(w, i, { c: 'move', u: free.map((u) => u.i), x: home.x, z: home.z + 1 });
    return;
  }
  command(w, i, { c: 'move', u: group.map((u) => u.i), x: t.c.x, z: t.c.z, hit: true });
}

function support(w: World, i: number) {
  const p = w.players[i];
  if (p.money < 900) return;
  const spots = w.units.filter((u) => hostile(w, u.o, i));
  let best = null as null | { x: number; z: number };
  let n = 4;
  for (const u of spots) {
    const k = spots.filter((o) => dist(o, u) < 1.3).length;
    if (k > n && !w.units.some((o) => !hostile(w, o.o, i) && dist(o, u) < 1.6)) {
      n = k;
      best = u;
    }
  }
  if (!best) return;
  const k = pick((['barragem', 'aereo', 'emp', 'tatica', 'balistico', 'hidrogenio'] as PowerId[]).filter((x) => p.money > POWERS[x].money && !needOf(w, i, x) && !((p.cool[x] ?? 0) > 0)));
  if (k) command(w, i, { c: 'power', k, x: best.x, z: best.z });
}

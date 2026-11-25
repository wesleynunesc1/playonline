import { createHash } from 'node:crypto';
import { getCache } from '@vercel/functions';

/**
 * Guerra no Ceará online. A vila de cada jogador mora no aparelho dele; aqui fica uma cópia
 * publicada (renovada enquanto ele joga), a caixa de entrada de ataques e a conversa do clã.
 */
interface Entry { city: number; name: string; clan: string; trophies: number; level: number; conquered: number; shield: number; at: number }
interface Owner { secret: string; at: number }
type Mail = Record<string, unknown>;

const WEEK = 7 * 86400;
const CLAIM_MS = 4 * 86400_000; // cidade parada por 4 dias fica livre
const MAX_BASE = 40_000;
const cache = () => getCache({ namespace: 'ceara' });
const hash = (s: string) => createHash('sha256').update(`ceara:${process.env.VERCEL_PROJECT_ID ?? 'dev'}:${s}`).digest('hex').slice(0, 32);
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
const text = (v: unknown, n: number) => (typeof v === 'string' ? v.replace(/[<>]/g, '').trim().slice(0, n) : '');
const num = (v: unknown, a: number, b: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(b, Math.max(a, Math.floor(v))) : a);
const isCity = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= 2300101 && (n as number) <= 2314102;

export async function POST(req: Request): Promise<Response> {
  let b: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BASE + 4000) return json({ error: 'grande demais' }, 413);
    b = JSON.parse(raw);
  } catch {
    return json({ error: 'inválido' }, 400);
  }
  const c = cache();
  const now = Date.now();
  const index = async () => (((await c.get('index')) as Entry[] | null) ?? []).filter((e) => now - e.at < CLAIM_MS);

  if (b.op === 'list') return json({ players: await index() });
  if (b.op === 'get') {
    if (!isCity(b.city)) return json({ error: 'cidade inválida' }, 400);
    return json({ base: (await c.get(`base:${b.city}`)) ?? null });
  }

  // Daqui em diante exige ser dono da cidade
  const secret = text(b.secret, 64);
  if (!isCity(b.city) || secret.length < 16) return json({ error: 'inválido' }, 400);
  const ownerKey = `owner:${b.city}`;
  const owner = (await c.get(ownerKey)) as Owner | null;
  const taken = owner && now - owner.at < CLAIM_MS && owner.secret !== hash(secret);

  if (b.op === 'publish') {
    if (taken) return json({ error: 'Esta cidade já tem dono.', taken: true }, 409);
    const base = b.base as Record<string, unknown>;
    const name = text(base?.name, 14);
    if (!base || !name || !Array.isArray(base.builds) || base.builds.length > 260 || JSON.stringify(base).length > MAX_BASE) return json({ error: 'vila inválida' }, 400);
    const entry: Entry = {
      city: b.city, name, clan: text(base.clan, 14), trophies: num(base.trophies, 0, 99999), level: num(base.level, 1, 6),
      conquered: num(base.conquered, 0, 183), shield: num(base.shield, 0, now + 86400_000), at: now,
    };
    await Promise.all([
      c.set(ownerKey, { secret: hash(secret), at: now }, { ttl: WEEK }),
      c.set(`base:${b.city}`, { ...entry, player: true, builds: base.builds, moedas: num(base.moedas, 0, 1e7), farinha: num(base.farinha, 0, 1e7) }, { ttl: WEEK }),
    ]);
    const list = (await index()).filter((e) => e.city !== b.city);
    await c.set('index', [entry, ...list].slice(0, 184), { ttl: WEEK });
    const mail = ((await c.get(`mail:${b.city}`)) as Mail[] | null) ?? [];
    if (mail.length) await c.delete(`mail:${b.city}`);
    const chat = entry.clan ? (((await c.get(`clan:${hash(entry.clan.toLowerCase())}`)) as Mail[] | null) ?? []) : [];
    return json({ mail, chat, players: [entry, ...list] });
  }
  if (taken || !owner) return json({ error: 'não autorizado' }, 403);
  const mine = (await index()).find((e) => e.city === b.city);
  if (!mine) return json({ error: 'publique sua vila antes' }, 403);

  if (b.op === 'leave') {
    await Promise.all([c.delete(ownerKey), c.delete(`base:${b.city}`)]);
    await c.set('index', (await index()).filter((e) => e.city !== b.city), { ttl: WEEK });
    return json({ ok: true });
  }
  if (b.op === 'say') {
    if (!mine.clan) return json({ error: 'sem clã' }, 400);
    const key = `clan:${hash(mine.clan.toLowerCase())}`;
    const chat = ((await c.get(key)) as Mail[] | null) ?? [];
    const next = [{ by: mine.name, i: num(b.i, 0, 30), at: now }, ...chat].slice(0, 30);
    await c.set(key, next, { ttl: WEEK });
    return json({ chat: next });
  }

  // Ações contra ou a favor de outro jogador
  if (!isCity(b.target) || b.target === b.city) return json({ error: 'alvo inválido' }, 400);
  const target = (await index()).find((e) => e.city === b.target);
  if (!target) return json({ error: 'jogador não encontrado' }, 404);
  const mailKey = `mail:${b.target}`;
  const push = async (m: Mail) => {
    const mail = ((await c.get(mailKey)) as Mail[] | null) ?? [];
    await c.set(mailKey, [...mail, m].slice(-20), { ttl: WEEK });
  };
  if (b.op === 'raid') {
    if (target.shield > now) return json({ error: 'Cidade protegida por escudo.' }, 409);
    const base = (await c.get(`base:${b.target}`)) as { moedas: number; farinha: number } | null;
    if (!base) return json({ error: 'vila indisponível' }, 404);
    const stars = num(b.stars, 0, 3);
    // Ninguém leva mais do que a vila publicada oferecia
    await push({ k: 'raid', by: mine.name, c: b.city, stars, moedas: num(b.moedas, 0, base.moedas), farinha: num(b.farinha, 0, base.farinha), at: now });
    const shield = now + (stars ? 30 : 5) * 60_000;
    await c.set('index', (await index()).map((e) => (e.city === b.target ? { ...e, shield } : e)), { ttl: WEEK });
    return json({ ok: true });
  }
  if (b.op === 'donate') {
    if (!mine.clan || mine.clan.toLowerCase() !== target.clan.toLowerCase()) return json({ error: 'Só para o seu clã.' }, 403);
    await push({ k: 'troops', by: mine.name, t: text(b.t, 12), n: num(b.n, 1, 5), at: now });
    return json({ ok: true });
  }
  return json({ error: 'operação desconhecida' }, 400);
}

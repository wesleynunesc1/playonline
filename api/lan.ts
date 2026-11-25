import { createHash } from 'node:crypto';
import { getCache } from '@vercel/functions';

/**
 * Salas do modo Wi-Fi. Só apresenta os aparelhos uns aos outros: a partida em si é direta (WebRTC).
 * Tudo expira em segundos e o IP é guardado apenas embaralhado.
 */
interface Room { code: string; name: string; players: number; started: boolean; secret: string; seen: number; kind: string }
interface Offer { sdp: string; at: number }

const ROOM_TTL = 25;
const SIGNAL_TTL = 40;
const MAX_SDP = 20_000;
const MAX_ROOMS = 12;
const MAX_GUESTS = 8;

const cache = () => getCache({ namespace: 'lan' });
const hash = (s: string) => createHash('sha256').update(`play-online:${process.env.VERCEL_PROJECT_ID ?? 'dev'}:${s}`).digest('hex').slice(0, 24);

/** IPv4 inteiro; no IPv6 cada aparelho tem o seu, então vale o prefixo /64 da casa */
export function networkOf(ip: string): string {
  const v4 = /(\d+\.\d+\.\d+\.\d+)$/.exec(ip);
  if (v4) return v4[1];
  const [head, tail] = ip.split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const full = ip.includes('::') ? [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right] : left;
  return full.slice(0, 4).map((x) => parseInt(x || '0', 16).toString(16)).join(':');
}

const text = (v: unknown, max: number) => (typeof v === 'string' && v.length <= max ? v : '');
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });

export async function POST(req: Request): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (raw.length > MAX_SDP + 1000) return json({ error: 'grande demais' }, 413);
    body = JSON.parse(raw);
  } catch {
    return json({ error: 'inválido' }, 400);
  }
  const ip = req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? '127.0.0.1';
  // Cada jogo tem a sua lista de salas
  const kind = text(body.kind, 4) || 'we';
  const net = `net:${kind}:${hash(networkOf(ip))}`;
  const c = cache();
  const now = Date.now();
  const code = text(body.code, 4).toUpperCase();
  const roomKey = `room:${code}`;
  const fresh = (r: Room | undefined | null) => !!r && now - r.seen < ROOM_TTL * 1000;

  if (body.op === 'list') {
    const codes = ((await c.get(net)) as string[] | null) ?? [];
    const rooms = (await Promise.all(codes.map((x) => c.get(`room:${x}`)))) as (Room | null)[];
    return json({ rooms: rooms.filter(fresh).map((r) => ({ code: r!.code, name: r!.name, players: r!.players, started: r!.started })) });
  }
  if (!/^[A-Z]{4}$/.test(code)) return json({ error: 'código inválido' }, 400);
  const room = (await c.get(roomKey)) as Room | null;

  // Criador: mantém a sala viva e recebe quem quer entrar
  if (body.op === 'announce' || body.op === 'answer' || body.op === 'close') {
    const secret = hash(text(body.secret, 64));
    if (!text(body.secret, 64) || (fresh(room) && room!.secret !== secret)) return json({ error: 'sala em uso' }, 403);
    if (body.op === 'close') {
      await c.delete(roomKey);
      return json({ ok: true });
    }
    if (body.op === 'answer') {
      await c.set(`answer:${code}:${text(body.guest, 40)}:${text(body.nonce, 12)}`, text(body.sdp, MAX_SDP), { ttl: SIGNAL_TTL });
      return json({ ok: true });
    }
    const next: Room = { code, name: text(body.name, 24) || 'Sala', players: Number(body.players) || 1, started: !!body.started, secret, seen: now, kind };
    await c.set(roomKey, next, { ttl: ROOM_TTL });
    const codes = ((await c.get(net)) as string[] | null) ?? [];
    if (!codes.includes(code) || Math.random() < 0.2) await c.set(net, [code, ...codes.filter((x) => x !== code)].slice(0, MAX_ROOMS), { ttl: 600 });
    const ids = ((await c.get(`guests:${code}`)) as string[] | null) ?? [];
    const offers = await Promise.all(ids.map(async (id) => ({ id, offer: (await c.get(`offer:${code}:${id}`)) as Offer | null })));
    return json({ guests: offers.filter((o) => o.offer).map((o) => ({ id: o.id.split('|')[0], nonce: o.id.split('|')[1], sdp: o.offer!.sdp })) });
  }

  // Convidado: deixa a proposta de conexão e consulta a resposta
  if (body.op === 'join') {
    if (!fresh(room)) return json({ error: 'sala não encontrada' }, 404);
    const guest = text(body.guest, 40);
    const nonce = text(body.nonce, 12);
    const sdp = text(body.sdp, MAX_SDP);
    if (!guest || !nonce || !sdp || guest.includes('|')) return json({ error: 'inválido' }, 400);
    const answer = (await c.get(`answer:${code}:${guest}:${nonce}`)) as string | null;
    if (answer) return json({ answer });
    const id = `${guest}|${nonce}`;
    await c.set(`offer:${code}:${id}`, { sdp, at: now }, { ttl: SIGNAL_TTL });
    const ids = ((await c.get(`guests:${code}`)) as string[] | null) ?? [];
    if (!ids.includes(id)) await c.set(`guests:${code}`, [id, ...ids.filter((x) => !x.startsWith(`${guest}|`))].slice(0, MAX_GUESTS), { ttl: 120 });
    return json({ answer: null });
  }
  return json({ error: 'operação desconhecida' }, 400);
}

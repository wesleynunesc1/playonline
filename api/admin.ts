import { timingSafeEqual } from 'node:crypto';
import { getCache } from '@vercel/functions';

/** Confere a senha de administrador (variável ADMIN_PIN) com limite de tentativas por IP. */
const MAX_TRIES = 5;
const LOCK_S = 600;

export async function POST(req: Request): Promise<Response> {
  const reply = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } });
  const pin = process.env.ADMIN_PIN;
  if (!pin) return reply({ error: 'Administração não configurada.' }, 503);
  let given = '';
  try {
    const body = (await req.json()) as { pin?: unknown };
    if (typeof body.pin === 'string') given = body.pin.slice(0, 32);
  } catch { /* tratado como senha vazia */ }
  const cache = getCache({ namespace: 'admin' });
  const key = `tries:${req.headers.get('x-real-ip') ?? 'local'}`;
  const tries = ((await cache.get(key)) as number | null) ?? 0;
  if (tries >= MAX_TRIES) return reply({ error: 'Muitas tentativas. Espere 10 minutos.' }, 429);
  const a = Buffer.from(given.padEnd(32));
  const b = Buffer.from(pin.padEnd(32));
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    await cache.set(key, tries + 1, { ttl: LOCK_S });
    return reply({ error: 'Senha incorreta.' }, 401);
  }
  await cache.delete(key);
  return reply({ ok: true });
}

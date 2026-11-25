import { hooks } from '../engine/state';
import { CLAN_PHRASES, CITY, TROOPS, TroopId } from './content';
import { Base, V, me, receiveTroops, snapshot, sufferRaid, touch } from './village';

/** Ligação com os outros jogadores do Ceará. */
export interface Player { city: number; name: string; clan: string; trophies: number; level: number; conquered: number; shield: number; at: number }
export interface Chat { by: string; i: number; at: number }
export const Net = { players: [] as Player[], chat: [] as Chat[], online: false, error: '' };
const PUBLISH_MS = 20_000;

async function api<T>(body: object): Promise<T> {
  const res = await fetch('/api/ceara', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error ?? 'Sem conexão.'), { taken: !!data.taken });
  return data as T;
}
export async function loadPlayers() {
  try {
    Net.players = (await api<{ players: Player[] }>({ op: 'list' })).players.filter((p) => CITY[p.city]);
    Net.online = true;
  } catch {
    Net.online = false;
  }
  touch(false);
}
export const playerAt = (city: number) => Net.players.find((p) => p.city === city);
export const fetchBase = (city: number) => api<{ base: Base | null }>({ op: 'get', city }).then((r) => r.base);

/** Publica a vila e recebe o que aconteceu na ausência */
export async function publish(): Promise<void> {
  if (!V) return;
  try {
    const r = await api<{ mail: Record<string, unknown>[]; chat: Chat[]; players: Player[] }>({ op: 'publish', city: V.city, secret: V.secret, base: snapshot() });
    Net.online = true;
    Net.error = '';
    Net.chat = r.chat;
    Net.players = r.players.filter((p) => CITY[p.city]);
    for (const m of r.mail) {
      const by = String(m.by ?? '').slice(0, 14);
      if (m.k === 'raid') {
        const stars = Number(m.stars) || 0;
        sufferRaid(by, stars, Number(m.moedas) || 0, Number(m.farinha) || 0);
        hooks.toast(stars ? `⚔️ ${by} atacou sua cidade (${stars}★)!` : `🛡️ Sua cidade repeliu ${by}!`, stars ? 'danger' : 'success');
      } else if (m.k === 'troops' && TROOPS[m.t as TroopId]) {
        receiveTroops(m.t as TroopId, Number(m.n) || 1);
        hooks.toast(`🎁 ${by} mandou ${m.n} ${TROOPS[m.t as TroopId].name}!`, 'success');
      }
    }
  } catch (e) {
    Net.online = false;
    Net.error = (e as { taken?: boolean }).taken ? 'Sua cidade foi tomada por outro jogador enquanto você estava fora. Você continua jogando, mas sem aparecer online.' : '';
  }
  touch(false);
}
export function startSync() {
  publish();
  const timer = setInterval(() => document.hidden || publish(), PUBLISH_MS);
  return () => clearInterval(timer);
}
const auth = () => ({ city: me().city, secret: me().secret });
export const reportRaid = (target: number, stars: number, moedas: number, farinha: number) => api({ op: 'raid', ...auth(), target, stars, moedas: Math.floor(moedas), farinha: Math.floor(farinha) });
export async function say(i: number) {
  if (!CLAN_PHRASES[i]) return;
  try {
    Net.chat = (await api<{ chat: Chat[] }>({ op: 'say', ...auth(), i })).chat;
  } catch (e) {
    hooks.toast((e as Error).message, 'danger');
  }
  touch(false);
}
export async function donate(target: number, t: TroopId) {
  if (me().army[t] < 1) return hooks.toast('Você não tem essa tropa.', 'danger');
  try {
    await api({ op: 'donate', ...auth(), target, t, n: 1 });
    me().army[t]--;
    touch();
    hooks.toast(`${TROOPS[t].name} enviado!`, 'success');
  } catch (e) {
    hooks.toast((e as Error).message, 'danger');
  }
}
export function leaveCity() {
  return api({ op: 'leave', ...auth() }).catch(() => {});
}

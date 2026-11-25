/** Conexão direta (WebRTC) entre aparelhos; o servidor só apresenta um ao outro. */

export interface RoomInfo { code: string; name: string; players: number; started: boolean }
export interface Link { send: (msg: unknown) => void; close: () => void }
interface Handlers { onOpen: (link: Link, id: string) => void; onMessage: (id: string, msg: unknown) => void; onClose: (id: string) => void }

const ICE: RTCConfiguration = { iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }] };
const GATHER_MS = 2500;
const JOIN_TIMEOUT_MS = 35_000;
const MAX_MESSAGE = 60_000;

async function api<T>(body: object): Promise<T> {
  const res = await fetch('/api/lan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Falha de conexão');
  return data as T;
}
export const listRooms = () => api<{ rooms: RoomInfo[] }>({ op: 'list' }).then((r) => r.rooms);

const token = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => (b % 36).toString(36)).join('');
const LETTERS = 'ABCDEFGHJKLMNPRSTUVWXYZ';
const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => LETTERS[b % LETTERS.length]).join('');
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Identidade deste aparelho, mantida na aba para poder reconectar */
export function deviceId(): string {
  try {
    const id = sessionStorage.getItem('PLAY_ONLINE_DEVICE') ?? token(16);
    sessionStorage.setItem('PLAY_ONLINE_DEVICE', id);
    return id;
  } catch {
    return token(16);
  }
}

function gathered(pc: RTCPeerConnection) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return Promise.race([
    wait(GATHER_MS),
    new Promise<void>((ok) => pc.addEventListener('icegatheringstatechange', () => pc.iceGatheringState === 'complete' && ok())),
  ]);
}

function wire(pc: RTCPeerConnection, dc: RTCDataChannel, id: string, h: Handlers): Link {
  let open = false;
  let ended = false;
  const end = () => {
    if (ended) return;
    ended = true;
    pc.close();
    if (open) h.onClose(id);
  };
  const link: Link = {
    send: (msg) => {
      if (dc.readyState === 'open') dc.send(JSON.stringify(msg));
    },
    close: () => {
      open = false;
      end();
    },
  };
  const opened = () => {
    if (open || ended) return;
    open = true;
    h.onOpen(link, id);
  };
  dc.onopen = opened;
  dc.onclose = end;
  dc.onmessage = (e) => {
    if (typeof e.data !== 'string' || e.data.length > MAX_MESSAGE) return;
    let msg: unknown;
    try {
      msg = JSON.parse(e.data);
    } catch {
      return;
    }
    h.onMessage(id, msg);
  };
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'failed' || pc.connectionState === 'closed') end();
    // "disconnected" pode ser só uma oscilação do Wi-Fi
    if (pc.connectionState === 'disconnected') setTimeout(() => pc.connectionState === 'disconnected' && end(), 6000);
  };
  if (dc.readyState === 'open') opened();
  return link;
}

/** Abre uma sala e atende quem chega. `info` descreve a sala a cada anúncio */
export function hostRoom(info: () => Omit<RoomInfo, 'code'>, h: Handlers) {
  const code = newCode();
  const secret = token(32);
  const seen = new Set<string>();
  let closed = false;

  const answer = async (guest: string, nonce: string, sdp: string) => {
    const pc = new RTCPeerConnection(ICE);
    pc.ondatachannel = (e) => wire(pc, e.channel, guest, h);
    setTimeout(() => pc.connectionState !== 'connected' && pc.close(), JOIN_TIMEOUT_MS);
    await pc.setRemoteDescription({ type: 'offer', sdp });
    await pc.setLocalDescription(await pc.createAnswer());
    await gathered(pc);
    await api({ op: 'answer', code, secret, guest, nonce, sdp: pc.localDescription!.sdp });
  };
  const loop = async () => {
    while (!closed) {
      try {
        const { guests } = await api<{ guests: { id: string; nonce: string; sdp: string }[] }>({ op: 'announce', code, secret, ...info() });
        for (const g of guests) {
          if (seen.has(g.nonce)) continue;
          seen.add(g.nonce);
          answer(g.id, g.nonce, g.sdp).catch(() => {});
        }
      } catch { /* tenta de novo no próximo anúncio */ }
      await wait(info().started ? 5000 : 1500);
    }
  };
  loop();
  return {
    code,
    close: () => {
      closed = true;
      api({ op: 'close', code, secret }).catch(() => {});
    },
  };
}

/** Entra em uma sala; resolve quando a conexão direta abre */
export async function joinRoom(code: string, h: Handlers): Promise<Link> {
  const pc = new RTCPeerConnection(ICE);
  const dc = pc.createDataChannel('jogo');
  const guest = deviceId();
  const nonce = token(8);
  const ready = new Promise<Link>((ok) => {
    wire(pc, dc, 'host', { ...h, onOpen: (l, id) => { h.onOpen(l, id); ok(l); } });
  });
  await pc.setLocalDescription(await pc.createOffer());
  await gathered(pc);
  const sdp = pc.localDescription!.sdp;
  const limit = Date.now() + JOIN_TIMEOUT_MS;
  try {
    let reply: string | null = null;
    while (!reply && Date.now() < limit) {
      reply = (await api<{ answer: string | null }>({ op: 'join', code, guest, nonce, sdp })).answer;
      if (!reply) await wait(1200);
    }
    if (!reply) throw new Error('A sala não respondeu.');
    await pc.setRemoteDescription({ type: 'answer', sdp: reply });
    return await Promise.race([
      ready,
      wait(15_000).then(() => {
        throw new Error('Os aparelhos não conseguiram se conectar. O Wi-Fi pode bloquear a conversa entre eles.');
      }),
    ]);
  } catch (e) {
    pc.close();
    throw e;
  }
}

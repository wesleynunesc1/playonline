import React, { useState } from 'react';
import { persist as save, say } from '../casino/sim';
import { Button } from './common/Button';
import { Modal } from './common/Modal';

/** Leva todo o progresso para outro aparelho por um código ou arquivo */
const KEYS = ['PLAY_ONLINE_CASSINO', 'PLAY_ONLINE_CASSINO_HQ'];
const PREFIX = 'PO1.';

async function pipe(data: Uint8Array, stream: CompressionStream | DecompressionStream) {
  return new Uint8Array(await new Response(new Blob([data as BlobPart]).stream().pipeThrough(stream as ReadableWritablePair<Uint8Array, Uint8Array>)).arrayBuffer());
}
export async function makeCode(): Promise<string> {
  save();
  const all = Object.fromEntries(KEYS.map((k) => [k, localStorage.getItem(k)]).filter(([, v]) => v));
  const bytes = await pipe(new TextEncoder().encode(JSON.stringify(all)), new CompressionStream('deflate-raw'));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return PREFIX + btoa(bin);
}
export async function readCode(code: string): Promise<Record<string, string>> {
  const clean = code.replace(/\s+/g, '');
  if (!clean.startsWith(PREFIX)) throw new Error('formato');
  const bytes = Uint8Array.from(atob(clean.slice(PREFIX.length)), (c) => c.charCodeAt(0));
  const all = JSON.parse(new TextDecoder().decode(await pipe(bytes, new DecompressionStream('deflate-raw')))) as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const k of KEYS) {
    const v = all[k];
    if (typeof v !== 'string') continue;
    JSON.parse(v); // recusa dados corrompidos
    out[k] = v;
  }
  if (!Object.keys(out).length) throw new Error('vazio');
  return out;
}

export const BackupModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [code, setCode] = useState('');
  const [input, setInput] = useState('');
  const [sure, setSure] = useState(false);
  const create = async () => {
    const c = await makeCode();
    setCode(c);
    try {
      await navigator.clipboard.writeText(c);
      say('Código copiado!');
    } catch { /* a pessoa copia da caixa */ }
  };
  const download = async () => {
    const url = URL.createObjectURL(new Blob([code || (await makeCode())], { type: 'text/plain' }));
    Object.assign(document.createElement('a'), { href: url, download: 'play-online-backup.txt' }).click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };
  const restore = async () => {
    if (!sure) return setSure(true);
    try {
      const data = await readCode(input);
      // Sem salvar por cima ao sair
      for (const k of KEYS) localStorage.removeItem(k);
      for (const k in data) localStorage.setItem(k, data[k]);
      location.reload();
    } catch {
      setSure(false);
      say('Código inválido. Nada foi mudado.');
    }
  };
  return (
    <Modal isOpen onClose={onClose} maxWidth="md" title="💾 Levar meu progresso" subtitle="Para trocar de celular ou não perder nada">
      <p className="text-sm text-slate-300">1. Neste aparelho, crie o código. Quem tiver ele tem o seu progresso, então não mostre a ninguém.</p>
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={create}>Criar e copiar</Button>
        <Button variant="secondary" onClick={download}>Baixar arquivo</Button>
      </div>
      {code && <textarea readOnly value={code} onFocus={(e) => e.target.select()} aria-label="Seu código" className="w-full h-24 bg-slate-950 border border-slate-700 rounded-xl p-2 font-mono text-xs select-text" />}
      <p className="text-sm text-slate-300 pt-2">2. No outro aparelho, cole aqui:</p>
      <textarea value={input} onChange={(e) => { setInput(e.target.value); setSure(false); }} placeholder="PO1..." aria-label="Colar código" className="w-full h-20 bg-slate-950 border border-slate-700 rounded-xl p-2 font-mono text-xs select-text" />
      <input type="file" accept=".txt,text/plain" aria-label="Escolher arquivo" className="text-xs" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setInput(await f.text()); }} />
      <Button fullWidth variant={sure ? 'danger' : 'outline'} disabled={!input.trim()} onClick={restore}>{sure ? 'Vai apagar o que está aqui. Toque de novo' : 'Restaurar neste aparelho'}</Button>
    </Modal>
  );
};

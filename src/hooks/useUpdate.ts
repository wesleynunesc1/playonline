import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { persist as save, say } from '../casino/sim';

const CHECK_MS = 5 * 60_000;
const SCRIPT = /\/assets\/index-[\w-]+\.js/;

/** Aberto pelo ícone da tela inicial (medido na abertura: depois, "tela cheia" confundiria) */
export const isInstalled =
  ['standalone', 'fullscreen', 'minimal-ui'].some((m) => matchMedia(`(display-mode: ${m})`).matches) ||
  (navigator as { standalone?: boolean }).standalone === true;

const current = () => document.querySelector<HTMLScriptElement>('script[type="module"][src]')?.src.match(SCRIPT)?.[0];

/** Busca a página sem cache e compara o arquivo principal com o que está rodando */
async function hasNewVersion(): Promise<boolean> {
  const mine = current();
  if (!mine) return false; // desenvolvimento
  const res = await fetch('/', { cache: 'no-store' });
  if (!res.ok) throw new Error();
  const latest = (await res.text()).match(SCRIPT)?.[0];
  return !!latest && latest !== mine;
}

interface Update { available: boolean; busy: boolean }
export const useUpdate = create<Update>(() => ({ available: false, busy: false }));

export async function applyUpdate() {
  useUpdate.setState({ busy: true });
  save();
  try {
    await fetch('/', { cache: 'reload' }); // renova a página guardada pelo aparelho
    location.reload();
  } catch {
    useUpdate.setState({ busy: false });
    say('Sem conexão para atualizar.');
  }
}
/** Botão do menu: atualiza se houver versão nova; senão, avisa que está em dia */
export async function checkNow() {
  useUpdate.setState({ busy: true });
  try {
    if (await hasNewVersion()) return applyUpdate();
    say('Você já está na versão mais recente.');
  } catch {
    say('Sem conexão para verificar.');
  }
  useUpdate.setState({ busy: false });
}

/** Verifica ao abrir, ao voltar para o app e a cada 5 minutos */
export function useUpdateCheck() {
  const [last] = useState({ at: 0 });
  useEffect(() => {
    if (!isInstalled) return;
    const check = () => {
      if (document.hidden || Date.now() - last.at < 30_000) return;
      last.at = Date.now();
      hasNewVersion().then((available) => available && useUpdate.setState({ available }), () => {});
    };
    check();
    const timer = setInterval(check, CHECK_MS);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
    };
  }, [last]);
}

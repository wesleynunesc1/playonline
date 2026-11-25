import { create } from 'zustand';
import { G, M, hooks, save } from './engine/state';
import { sound } from './utils/audio';
import { music, speak } from './utils/music';

/** Estado só de interface (telas, painel aberto, país selecionado, avisos). */
export type Screen = 'home' | 'country_select' | 'game' | 'snake' | 'lan' | 'war';
export type Panel = 'imperio' | 'exercito' | 'generais' | 'diplomacia' | 'ciencia' | 'missoes' | 'mundo' | 'menu' | null;

interface App {
  screen: Screen;
  panel: Panel;
  selected: string;
  mode: string;
  admin: boolean;
  help: boolean;
  soundEnabled: boolean;
  toast: { id: number; text: string; type: 'success' | 'danger' | 'info' } | null;
  setScreen: (s: Screen) => void;
  setPanel: (p: Panel) => void;
  select: (id: string) => void;
  toggleSound: () => void;
}

// A antiga vila do Ceará deu lugar à guerra em sala
try {
  localStorage.removeItem('PLAY_ONLINE_CEARA');
} catch { /* armazenamento indisponível */ }

let toastTimer: ReturnType<typeof setTimeout>;

export const useApp = create<App>((set, get) => ({
  screen: 'home',
  panel: null,
  selected: '',
  mode: 'livre',
  admin: false,
  help: false,
  soundEnabled: sound.enabled,
  toast: null,
  setScreen: (screen) => {
    if (get().screen === 'game') save();
    set({ screen, panel: null, selected: '' });
    updateMusic();
  },
  setPanel: (panel) => {
    sound.playClick();
    set({ panel, selected: '' });
  },
  select: (selected) => {
    sound.playClick();
    set({ selected, panel: null });
  },
  toggleSound: () => {
    sound.enabled = !sound.enabled;
    set({ soundEnabled: sound.enabled });
    updateMusic();
  },
}));

/** Música muda entre paz e guerra conforme a situação */
export function updateMusic() {
  const on = useApp.getState().screen === 'game' && sound.enabled && M.music && !!G;
  music.set(on ? (G!.threat || G!.battle || G!.coalition ? 'guerra' : 'paz') : null);
}

hooks.toast = (text, type) => {
  useApp.setState({ toast: { id: Date.now() + Math.random(), text, type } });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => useApp.setState({ toast: null }), 3600);
};
const SOUNDS = {
  buy: () => sound.playBuy(), recruit: () => sound.playRecruit(), win: () => sound.playVictory(), lose: () => sound.playDefeat(),
  alert: () => sound.playCrisisAlert(), launch: () => sound.playLaunch(), impact: () => sound.playImpact(), tech: () => sound.playTechUnlocked(),
  spy: () => sound.playSabotage(),
};
hooks.sound = (name) => SOUNDS[name]();
hooks.onNews = (text) => {
  if (M.voice && sound.enabled) speak(text);
};

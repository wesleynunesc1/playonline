/**
 * Áudio sintetizado com Web Audio API (zero arquivos) + feedback háptico no mobile.
 */
type Wave = OscillatorType;

interface Note {
  freq: number;
  at: number;
  dur: number;
  gain: number;
  type: Wave;
  slideTo?: number;
}

const SOUND_KEY = 'PLAY_ONLINE_SOUND';

function readEnabled(): boolean {
  try { return localStorage.getItem(SOUND_KEY) !== '0'; } catch { return true; }
}

class SoundSystem {
  private ctx: AudioContext | null = null;
  private on = readEnabled();

  get enabled() { return this.on; }
  set enabled(value: boolean) {
    this.on = value;
    try { localStorage.setItem(SOUND_KEY, value ? '1' : '0'); } catch { /* armazenamento indisponível */ }
  }

  private getCtx(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      this.ctx = new Ctx();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  private play(notes: Note[], vibration?: number | number[]) {
    if (!this.enabled) return;
    if (vibration && typeof navigator !== 'undefined' && 'vibrate' in navigator && navigator.userActivation?.hasBeenActive) {
      try { navigator.vibrate(vibration); } catch { /* sem suporte */ }
    }
    const ctx = this.getCtx();
    if (!ctx) return;
    try {
      const t0 = ctx.currentTime;
      for (const n of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = t0 + n.at;
        osc.type = n.type;
        osc.frequency.setValueAtTime(n.freq, start);
        if (n.slideTo) osc.frequency.exponentialRampToValueAtTime(n.slideTo, start + n.dur);
        gain.gain.setValueAtTime(n.gain, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + n.dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + n.dur + 0.02);
      }
    } catch { /* navegador restringiu o áudio */ }
  }

  private arpeggio(freqs: number[], step: number, dur: number, gain: number, type: Wave): Note[] {
    return freqs.map((freq, i) => ({ freq, at: i * step, dur, gain, type }));
  }

  playClick() { this.play([{ freq: 600, slideTo: 800, at: 0, dur: 0.05, gain: 0.06, type: 'sine' }], 8); }
  playBuy() { this.play(this.arpeggio([523.25, 659.25, 783.99, 1046.5], 0.04, 0.08, 0.1, 'triangle'), 15); }
  playRecruit() { this.play([{ freq: 140, slideTo: 90, at: 0, dur: 0.15, gain: 0.14, type: 'square' }], 25); }
  playVictory() { this.play(this.arpeggio([440, 554.37, 659.25, 880], 0.08, 0.35, 0.18, 'triangle'), [40, 60, 40, 60, 80]); }
  playDefeat() { this.play(this.arpeggio([300, 260, 220, 160], 0.12, 0.2, 0.1, 'sawtooth'), [200]); }
  playSonar() { this.play([{ freq: 880, at: 0, dur: 0.35, gain: 0.05, type: 'sine' }]); }
  playTechUnlocked() { this.play(this.arpeggio([523.25, 659.25, 783.99, 1046.5, 1318.5], 0.06, 0.25, 0.13, 'sine'), [20, 40, 20]); }
  playSabotage() { this.play([{ freq: 240, slideTo: 60, at: 0, dur: 0.25, gain: 0.16, type: 'sawtooth' }], [30, 30, 30]); }
  playCrisisAlert() {
    this.play(
      [440, 587.33, 440, 587.33].map((freq, i) => ({ freq, at: i * 0.1, dur: 0.1, gain: 0.12, type: 'triangle' as Wave })),
      [100, 60, 100]
    );
  }
  /** Lançamento de míssil: chiado descendente */
  playLaunch() { this.play([{ freq: 900, slideTo: 120, at: 0, dur: 0.9, gain: 0.07, type: 'sawtooth' }], 20); }
  /** Impacto: explosão grave */
  playImpact() {
    this.play(
      [
        { freq: 90, slideTo: 30, at: 0, dur: 0.5, gain: 0.3, type: 'sine' },
        { freq: 160, slideTo: 40, at: 0, dur: 0.3, gain: 0.12, type: 'square' },
      ],
      [80, 40, 120]
    );
  }
}

export const sound = new SoundSystem();

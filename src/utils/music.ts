/** Trilha gerada na hora (sem arquivos) e locutor de notícias. */
type Mood = 'paz' | 'guerra' | null;

const SCORE = {
  paz: { beat: 0.5, bass: [110, 110, 87.3, 98], lead: [440, 523, 659, 523, 494, 587, 659, 784], wave: 'triangle' as OscillatorType, drum: false },
  guerra: { beat: 0.26, bass: [73.4, 73.4, 69.3, 82.4], lead: [293, 349, 293, 440, 415, 349, 293, 277], wave: 'sawtooth' as OscillatorType, drum: true },
};

class Music {
  private ctx: AudioContext | null = null;
  private mood: Mood = null;
  private timer: ReturnType<typeof setInterval> | undefined;
  private next = 0;
  private step = 0;

  set(mood: Mood) {
    if (mood === this.mood) return;
    this.mood = mood;
    clearInterval(this.timer);
    if (!mood) {
      this.ctx?.suspend().catch(() => {});
      return;
    }
    try {
      this.ctx ??= new AudioContext();
      this.ctx.resume().catch(() => {});
    } catch {
      return;
    }
    this.next = this.ctx.currentTime + 0.1;
    this.timer = setInterval(() => this.schedule(), 120);
  }

  private schedule() {
    const ctx = this.ctx;
    if (!ctx || !this.mood || ctx.state !== 'running') return;
    const s = SCORE[this.mood];
    // Aba em segundo plano: retoma do presente em vez de acumular notas
    if (this.next < ctx.currentTime) this.next = ctx.currentTime + 0.05;
    while (this.next < ctx.currentTime + 0.4) {
      const bar = Math.floor(this.step / 8) % 4;
      if (this.step % 4 === 0) this.note(s.bass[bar], s.beat * 3.5, 0.05, 'sine');
      if (Math.random() < 0.7) this.note(s.lead[(this.step + bar) % 8] / (bar === 3 ? 2 : 1), s.beat * 1.4, 0.012, s.wave);
      if (s.drum && this.step % 2 === 0) this.note(60, 0.12, 0.09, 'sine', 30);
      this.step++;
      this.next += s.beat;
    }
  }

  private note(freq: number, dur: number, gain: number, type: OscillatorType, slide?: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, this.next);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, this.next + dur);
    g.gain.setValueAtTime(0.0001, this.next);
    g.gain.linearRampToValueAtTime(gain, this.next + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, this.next + dur);
    o.connect(g).connect(ctx.destination);
    o.start(this.next);
    o.stop(this.next + dur + 0.02);
  }
}
export const music = new Music();

export function speak(text: string) {
  if (typeof speechSynthesis === 'undefined' || speechSynthesis.speaking) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'pt-BR';
  u.rate = 1.1;
  speechSynthesis.speak(u);
}

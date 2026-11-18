// 소리: 파일 없이 Web Audio 로 합성한다 (효과음, 배경음 3곡). 첫 터치 때 켜진다 (브라우저 자동 재생 제한)
export type Sfx = 'dmg' | 'crit' | 'heal' | 'block' | 'taken' | 'ult' | 'wave' | 'boss' | 'win' | 'lose' | 'click' | 'card' | 'rare' | 'up' | 'coin';
export type Music = 'lobby' | 'battle' | 'boss';

// 음 이름 → 주파수 (A4 = 440)
const N = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
// 곡: 화음 진행(미디 번호), 빠르기, 드럼 여부
const SONGS: Record<Music, { bpm: number; chords: number[][]; drums: boolean; bass: boolean }> = {
  lobby: { bpm: 80, chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], drums: false, bass: false },   // Am F C G
  battle: { bpm: 126, chords: [[50, 53, 57], [46, 50, 53], [48, 52, 55], [45, 49, 52]], drums: true, bass: true },  // Dm Bb C A
  boss: { bpm: 138, chords: [[45, 48, 52], [46, 49, 53], [45, 48, 52], [44, 47, 50]], drums: true, bass: true },    // Am Bbm Am G#dim
};

class Sound {
  private ctx: AudioContext | null = null;
  private sfxBus!: GainNode;
  private musBus!: GainNode;
  private noiseBuf!: AudioBuffer;
  private last: Partial<Record<Sfx, number>> = {};
  private want: Music | null = null;
  private song: Music | null = null;
  private step = 0;
  private nextAt = 0;
  sfxVol = 0.7;
  musVol = 0.35;

  constructor() {
    // 잡는 단계(capture)에서 받는다: 화면 요소가 stopPropagation 해도 놓치지 않게
    const unlock = () => { this.start(); if (this.ctx?.state === 'running') { removeEventListener('pointerdown', unlock, true); removeEventListener('keydown', unlock, true); } };
    addEventListener('pointerdown', unlock, true);
    addEventListener('keydown', unlock, true);
    // 다른 앱으로 가면 멈춘다
    document.addEventListener('visibilitychange', () => { if (!this.ctx) return; if (document.hidden) void this.ctx.suspend(); else void this.ctx.resume(); });
  }

  private start() {
    if (!this.ctx) {
      const C = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!C) return;
      this.ctx = new C();
      this.sfxBus = this.ctx.createGain();
      this.musBus = this.ctx.createGain();
      this.sfxBus.connect(this.ctx.destination);
      this.musBus.connect(this.ctx.destination);
      this.setVolume(this.sfxVol, this.musVol);
      this.noiseBuf = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      window.setInterval(() => this.schedule(), 90);
    }
    void this.ctx.resume();
    if (this.want && this.song !== this.want) this.music(this.want);
  }

  setVolume(sfx: number, mus: number) {
    this.sfxVol = sfx;
    this.musVol = mus;
    if (!this.ctx) return;
    this.sfxBus.gain.value = sfx * 0.5;
    this.musBus.gain.value = mus * 0.35;
  }

  // ───────── 합성 재료 ─────────

  private tone(bus: GainNode, f: number, t: number, dur: number, type: OscillatorType, vol: number, to?: number, cutoff?: number) {
    const c = this.ctx!;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.02, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let out: AudioNode = o;
    if (cutoff) { const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = cutoff; o.connect(lp); out = lp; }
    out.connect(g).connect(bus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noise(bus: GainNode, t: number, dur: number, vol: number, type: BiquadFilterType, f: number, to?: number) {
    const c = this.ctx!;
    const s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noiseBuf;
    fl.type = type;
    fl.frequency.setValueAtTime(f, t);
    if (to) fl.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl).connect(g).connect(bus);
    s.start(t, Math.random() * 0.5);
    s.stop(t + dur + 0.05);
  }

  // ───────── 효과음 ─────────

  play(k: Sfx) {
    if (!this.ctx || this.ctx.state !== 'running' || this.sfxVol <= 0) return;
    const t = this.ctx.currentTime;
    // 같은 소리가 한꺼번에 몰리면 시끄럽다: 짧은 소리는 간격을 둔다
    const gap = k === 'dmg' || k === 'taken' || k === 'heal' || k === 'block' ? 0.05 : k === 'card' ? 0.03 : 0;
    if (gap && t - (this.last[k] ?? -1) < gap) return;
    this.last[k] = t;
    const b = this.sfxBus;
    switch (k) {
      case 'dmg': this.noise(b, t, 0.07, 0.5, 'bandpass', 1400); this.tone(b, 150, t, 0.08, 'triangle', 0.4, 70); break;
      case 'taken': this.noise(b, t, 0.09, 0.5, 'lowpass', 600); this.tone(b, 110, t, 0.1, 'sine', 0.5, 55); break;
      case 'crit': this.noise(b, t, 0.12, 0.7, 'highpass', 2500); this.tone(b, 700, t, 0.12, 'square', 0.25, 260); this.tone(b, 90, t, 0.15, 'sine', 0.6, 45); break;
      case 'block': this.tone(b, 1100, t, 0.08, 'triangle', 0.35, 900); break;
      case 'heal': this.tone(b, 660, t, 0.22, 'sine', 0.25, 990); this.tone(b, 1320, t + 0.05, 0.2, 'sine', 0.12); break;
      case 'ult':
        this.noise(b, t, 0.6, 0.5, 'bandpass', 300, 4000);
        [0, 4, 7].forEach(i => this.tone(b, N(57 + i), t + 0.25, 0.7, 'sawtooth', 0.12, undefined, 2200));
        break;
      case 'wave': this.tone(b, 95, t, 0.45, 'sine', 0.8, 40); this.noise(b, t, 0.25, 0.3, 'lowpass', 400); break;
      case 'boss':
        this.tone(b, 80, t, 0.5, 'sine', 0.9, 35); this.tone(b, 80, t + 0.35, 0.6, 'sine', 0.9, 35);
        this.tone(b, N(46), t + 0.1, 1.2, 'sawtooth', 0.12, undefined, 900); this.tone(b, N(47), t + 0.1, 1.2, 'sawtooth', 0.12, undefined, 900);
        break;
      case 'win': [60, 64, 67, 72].forEach((n, i) => this.tone(b, N(n), t + i * 0.11, i === 3 ? 0.7 : 0.18, 'triangle', 0.35)); break;
      case 'lose': [64, 60, 57, 52].forEach((n, i) => this.tone(b, N(n), t + i * 0.18, i === 3 ? 0.9 : 0.25, 'triangle', 0.3, undefined, 1500)); break;
      case 'click': this.tone(b, 1250, t, 0.04, 'sine', 0.18); break;
      case 'card': this.noise(b, t, 0.05, 0.25, 'highpass', 3000); break;
      case 'rare': [72, 76, 79, 84].forEach((n, i) => this.tone(b, N(n), t + i * 0.06, 0.9, 'sine', 0.2)); this.noise(b, t, 0.8, 0.15, 'highpass', 6000); break;
      case 'up': [67, 71, 74, 79].forEach((n, i) => this.tone(b, N(n), t + i * 0.06, 0.25, 'triangle', 0.3)); break;
      case 'coin': this.tone(b, 1568, t, 0.08, 'square', 0.12); this.tone(b, 2093, t + 0.07, 0.2, 'square', 0.12); break;
    }
  }

  // ───────── 배경음 ─────────

  /** 곡을 바꾼다 (null = 끔). 소리가 아직 안 켜졌으면 켜질 때 튼다 */
  music(m: Music | null) {
    this.want = m;
    if (!this.ctx || this.song === m) return;
    this.song = m;
    this.step = 0;
    this.nextAt = this.ctx.currentTime + 0.1;
  }

  /** 앞으로 0.3초 안에 칠 음을 미리 걸어 둔다 (8분음표 단위, 한 화음에 8칸) */
  private schedule() {
    const c = this.ctx;
    if (!c || !this.song || c.state !== 'running' || this.musVol <= 0) { if (c) this.nextAt = c.currentTime + 0.1; return; }
    const song = SONGS[this.song];
    const len = 60 / song.bpm / 2;
    const b = this.musBus;
    while (this.nextAt < c.currentTime + 0.3) {
      const t = this.nextAt, i = this.step % 8;
      const ch = song.chords[Math.floor(this.step / 8) % song.chords.length];
      if (i === 0) ch.forEach(n => { this.tone(b, N(n), t, len * 8, 'triangle', 0.09, undefined, 1200); this.tone(b, N(n) * 1.004, t, len * 8, 'sine', 0.06); });
      // 펼친 화음
      const arp = [0, 1, 2, 1, 2, 0, 1, 2][i];
      this.tone(b, N(ch[arp] + 12), t, len * 1.6, 'sine', song.drums ? 0.07 : 0.1, undefined, 2500);
      if (song.bass) this.tone(b, N(ch[0] - 12), t, len * 0.9, 'sawtooth', 0.12, undefined, 380);
      if (song.drums) {
        if (i % 2 === 0) this.tone(b, 110, t, 0.18, 'sine', 0.5, 40);
        if (i === 2 || i === 6) this.noise(b, t, 0.12, 0.2, 'bandpass', 1800);
        if (i % 2 === 1) this.noise(b, t, 0.04, 0.08, 'highpass', 7000);
      }
      this.nextAt += len;
      this.step++;
    }
  }
}

export const sound = new Sound();

type OscKind = OscillatorType;

export class GameAudio {
  ctx: AudioContext | null = null;
  master: GainNode | null = null;
  music: GainNode | null = null;
  sfx: GainNode | null = null;
  muted = false;
  musicOn = true;
  private musicTimer = 0;
  private step = 0;

  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx({ latencyHint: "interactive" });
      this.master = this.ctx.createGain();
      this.music = this.ctx.createGain();
      this.sfx = this.ctx.createGain();
      this.music.gain.value = 0.12;
      this.sfx.gain.value = 0.28;
      this.music.connect(this.master);
      this.sfx.connect(this.master);
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    this.applyMute();
  }

  setMuted(v: boolean) {
    this.muted = v;
    this.applyMute();
  }

  private applyMute() {
    if (!this.master || !this.ctx) return;
    this.master.gain.setTargetAtTime(this.muted ? 0 : 1, this.ctx.currentTime, 0.02);
  }

  tick(dt: number) {
    if (!this.ctx || !this.music || this.muted || !this.musicOn) return;
    this.musicTimer += dt;
    if (this.musicTimer < 0.22) return;
    this.musicTimer = 0;
    const scale = [220, 196, 174.61, 164.81, 146.83, 130.81, 146.83, 164.81];
    const f = scale[this.step % scale.length]!;
    this.step += 1;
    this.tone(f, 0.18, "square", 0.05, this.music, 0.01);
    this.tone(f / 2, 0.18, "triangle", 0.04, this.music, 0.01);
  }

  land() {
    this.noise(0.06, 0.12, 900);
    this.tone(320, 0.07, "triangle", 0.08, this.sfx);
  }

  hurt() {
    this.tone(420, 0.18, "sawtooth", 0.12, this.sfx);
    this.tone(180, 0.22, "square", 0.08, this.sfx);
  }

  spring() {
    this.tone(180, 0.08, "square", 0.08, this.sfx);
    this.tone(360, 0.14, "triangle", 0.1, this.sfx, 0.06);
  }

  death() {
    this.tone(480, 0.45, "sawtooth", 0.14, this.sfx);
    this.tone(140, 0.55, "triangle", 0.1, this.sfx, 0.05);
    this.noise(0.4, 0.18, 400);
  }

  private tone(
    freq: number,
    dur: number,
    type: OscKind,
    gain: number,
    bus: GainNode | null,
    delay = 0,
  ) {
    if (!this.ctx || !bus) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * 0.55), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(bus);
    o.start(t);
    o.stop(t + dur + 0.02);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }

  private noise(dur: number, gain: number, hp: number) {
    if (!this.ctx || !this.sfx) return;
    const n = this.ctx.sampleRate * dur;
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = hp;
    const g = this.ctx.createGain();
    const t = this.ctx.currentTime;
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.sfx);
    src.start(t);
    src.stop(t + dur + 0.02);
  }
}

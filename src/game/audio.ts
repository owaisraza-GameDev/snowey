/**
 * FrostPlow 3D - Procedural Web Audio Synth Engine
 * Pure synthesized audio: diesel engine, crunchy snow plow noise,
 * pentatonic combo synth bells, turbo boost sweeps, and cozy winter ambient music.
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private masterGain: GainNode | null = null;

  // Engine synth nodes
  private engineGain: GainNode | null = null;
  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private isEngineRunning: boolean = false;

  // Snow crunch noise nodes
  private snowNoiseNode: AudioNode | null = null;
  private snowNoiseGain: GainNode | null = null;
  private snowFilter: BiquadFilterNode | null = null;

  // Ambient BGM
  private bgmGain: GainNode | null = null;
  private isMusicEnabled: boolean = true;
  private bgmTimer: number | null = null;
  private bgmStep: number = 0;

  // Pentatonic scale frequencies for combo multiplier notes
  private comboNotes = [
    261.63, // C4
    293.66, // D4
    329.63, // E4
    392.00, // G4
    440.00, // A4
    523.25, // C5
    587.33, // D5
    659.25, // E5
    783.99, // G5
    880.00, // A5
    1046.50 // C6
  ];

  public init() {
    if (this.ctx) return;
    const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtxClass) return;

    this.ctx = new AudioCtxClass();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
    this.masterGain.connect(this.ctx.destination);

    this.setupEngineSynth();
    this.setupSnowNoise();
    this.setupBgmEngine();
  }

  public resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  private setupEngineSynth() {
    if (!this.ctx || !this.masterGain) return;

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.setValueAtTime(0.001, this.ctx.currentTime);

    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.setValueAtTime(140, this.ctx.currentTime);
    this.engineFilter.Q.setValueAtTime(3.0, this.ctx.currentTime);

    this.engineOsc1 = this.ctx.createOscillator();
    this.engineOsc1.type = 'sawtooth';
    this.engineOsc1.frequency.setValueAtTime(42, this.ctx.currentTime);

    this.engineOsc2 = this.ctx.createOscillator();
    this.engineOsc2.type = 'triangle';
    this.engineOsc2.frequency.setValueAtTime(84, this.ctx.currentTime);

    const subOsc = this.ctx.createOscillator();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(28, this.ctx.currentTime);

    this.engineOsc1.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    subOsc.connect(this.engineFilter);

    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);

    this.engineOsc1.start();
    this.engineOsc2.start();
    subOsc.start();

    this.isEngineRunning = true;
  }

  private setupSnowNoise() {
    if (!this.ctx || !this.masterGain) return;

    // Generate white noise buffer
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    this.snowFilter = this.ctx.createBiquadFilter();
    this.snowFilter.type = 'bandpass';
    this.snowFilter.frequency.setValueAtTime(650, this.ctx.currentTime);
    this.snowFilter.Q.setValueAtTime(1.8, this.ctx.currentTime);

    this.snowNoiseGain = this.ctx.createGain();
    this.snowNoiseGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);

    whiteNoise.connect(this.snowFilter);
    this.snowFilter.connect(this.snowNoiseGain);
    this.snowNoiseGain.connect(this.masterGain);

    whiteNoise.start();
    this.snowNoiseNode = whiteNoise;
  }

  public updateEngineSound(speedRatio: number, isAccelerating: boolean, bladeLoadKg: number = 0) {
    if (!this.ctx || !this.engineGain || !this.engineOsc1 || !this.engineFilter || this.isMuted) return;

    const t = this.ctx.currentTime;
    const clampedSpeed = Math.min(Math.max(speedRatio, 0), 1.5);
    const loadFactor = Math.min(bladeLoadKg / 1000, 1.2);

    // Target pitch: idle is ~45Hz, drops slightly under heavy snow load strain
    const baseFreq = Math.max(38, (45 + clampedSpeed * 75 + (isAccelerating ? 15 : 0)) - loadFactor * 8);
    this.engineOsc1.frequency.setTargetAtTime(baseFreq, t, 0.08);
    if (this.engineOsc2) {
      this.engineOsc2.frequency.setTargetAtTime(baseFreq * 2.01, t, 0.08);
    }

    // Filter cut-off opens with speed, plus heavy low rumble with load
    const targetCutoff = 130 + clampedSpeed * 350 + (isAccelerating ? 120 : 0) + loadFactor * 80;
    this.engineFilter.frequency.setTargetAtTime(targetCutoff, t, 0.08);

    // Engine volume: rises with load strain
    const targetVol = 0.08 + clampedSpeed * 0.16 + (isAccelerating ? 0.05 : 0) + loadFactor * 0.07;
    this.engineGain.gain.setTargetAtTime(targetVol, t, 0.08);
  }

  public setSnowClearingIntensity(intensity: number) {
    if (!this.ctx || !this.snowNoiseGain || !this.snowFilter || this.isMuted) return;

    const t = this.ctx.currentTime;
    const clamped = Math.min(Math.max(intensity, 0), 1.0);

    // Noise volume ramps smoothly
    const targetVol = clamped * 0.22;
    this.snowNoiseGain.gain.setTargetAtTime(targetVol, t, 0.04);

    // Frequency shifts higher when plowing fast/deep snow
    const targetFreq = 480 + clamped * 450;
    this.snowFilter.frequency.setTargetAtTime(targetFreq, t, 0.06);
  }

  /**
   * Play ascending melodic pentatonic chime when snow combo increases
   */
  public playComboChime(comboLevel: number) {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    this.resume();

    const t = this.ctx.currentTime;
    const noteIndex = Math.min(Math.max(comboLevel - 1, 0), this.comboNotes.length - 1);
    const freq = this.comboNotes[noteIndex];

    // Bell chime oscillator
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = comboLevel > 5 ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(freq, t);

    // Slight frequency vibrato
    const lfo = this.ctx.createOscillator();
    const lfoGain = this.ctx.createGain();
    lfo.frequency.setValueAtTime(6.0, t);
    lfoGain.gain.setValueAtTime(2.5, t);
    lfo.connect(osc.frequency);
    lfo.start(t);
    lfo.stop(t + 0.6);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.24, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.55);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.6);

    // High shimmer harmonic on higher combos
    if (comboLevel >= 4) {
      const harmOsc = this.ctx.createOscillator();
      const harmGain = this.ctx.createGain();
      harmOsc.type = 'sine';
      harmOsc.frequency.setValueAtTime(freq * 2, t);

      harmGain.gain.setValueAtTime(0.001, t);
      harmGain.gain.linearRampToValueAtTime(0.12, t + 0.015);
      harmGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);

      harmOsc.connect(harmGain);
      harmGain.connect(this.masterGain);

      harmOsc.start(t);
      harmOsc.stop(t + 0.45);
    }
  }

  /**
   * Powerful turbo nitro rocket sound
   */
  public playTurboBoost() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    this.resume();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(80, t);
    osc.frequency.exponentialRampToValueAtTime(320, t + 0.4);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(400, t);
    filter.frequency.exponentialRampToValueAtTime(2200, t + 0.35);
    filter.Q.setValueAtTime(4.0, t);

    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.28, t + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.65);
  }

  /**
   * Impact bump when hitting snowbank, fence, or obstacle
   */
  public playBump(isHard: boolean = false) {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    this.resume();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(isHard ? 130 : 90, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.15);

    gain.gain.setValueAtTime(isHard ? 0.35 : 0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.22);
  }

  /**
   * Sound when gathered snow is dumped into a massive stack or snowbank
   */
  public playSnowDump(amountKg: number = 300) {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    this.resume();

    const t = this.ctx.currentTime;
    const factor = Math.min(amountKg / 800, 1.5);

    // Deep powdery whoosh + thump
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(95, t);
    osc.frequency.exponentialRampToValueAtTime(32, t + 0.35);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, t);
    filter.frequency.exponentialRampToValueAtTime(90, t + 0.35);

    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.3 * factor, t + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.45);
  }

  /**
   * Hydraulic servo motor sound when pivoting the snow plow blade
   */
  public playHydraulicServo() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    this.resume();

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.linearRampToValueAtTime(340, t + 0.12);
    osc.frequency.linearRampToValueAtTime(200, t + 0.22);

    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.12, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.25);
  }

  /**
   * Snow disposal chute jackpot bonus sound
   */
  public playMeltChuteBonus() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    this.resume();

    const t = this.ctx.currentTime;
    // Sizzling steam + cash chime triad
    const notes = [659.25, 830.61, 987.77, 1318.51]; // E Major chime
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + idx * 0.07);

      gain.gain.setValueAtTime(0.001, t + idx * 0.07);
      gain.gain.linearRampToValueAtTime(0.2, t + idx * 0.07 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.07 + 0.4);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t + idx * 0.07);
      osc.stop(t + idx * 0.07 + 0.45);
    });
  }

  /**
   * Purchase upgrade / cash earn sound
   */
  public playUpgradeDing() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    this.resume();

    const t = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + i * 0.06);

      gain.gain.setValueAtTime(0.001, t + i * 0.06);
      gain.gain.linearRampToValueAtTime(0.18, t + i * 0.06 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.35);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t + i * 0.06);
      osc.stop(t + i * 0.06 + 0.4);
    });
  }

  /**
   * Level victory fanfare
   */
  public playVictoryFanfare() {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    this.resume();

    const t = this.ctx.currentTime;
    const melody = [
      { freq: 392.00, delay: 0.00, dur: 0.14 }, // G4
      { freq: 523.25, delay: 0.15, dur: 0.14 }, // C5
      { freq: 659.25, delay: 0.30, dur: 0.14 }, // E5
      { freq: 783.99, delay: 0.45, dur: 0.20 }, // G5
      { freq: 659.25, delay: 0.68, dur: 0.14 }, // E5
      { freq: 1046.50, delay: 0.85, dur: 0.65 } // C6
    ];

    melody.forEach((note) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(note.freq, t + note.delay);

      gain.gain.setValueAtTime(0.001, t + note.delay);
      gain.gain.linearRampToValueAtTime(0.25, t + note.delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + note.delay + note.dur);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t + note.delay);
      osc.stop(t + note.delay + note.dur + 0.05);
    });
  }

  /**
   * Procedural Lo-Fi Winter Ambient BGM
   * Warms the scene with peaceful synthesizer chord progressions
   */
  private setupBgmEngine() {
    if (!this.ctx || !this.masterGain) return;

    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.setValueAtTime(0.12, this.ctx.currentTime);
    this.bgmGain.connect(this.masterGain);

    this.startAmbientMusicLoop();
  }

  private startAmbientMusicLoop() {
    if (this.bgmTimer) window.clearInterval(this.bgmTimer);

    // Warm chords in C Major / A Minor:
    // 1: Cmaj7 (C4, E4, G4, B4)
    // 2: Am7 (A3, C4, E4, G4)
    // 3: Fmaj7 (F3, A3, C4, E4)
    // 4: Gsus4 (G3, C4, D4, G4)
    const chords = [
      [261.63, 329.63, 392.00, 493.88],
      [220.00, 261.63, 329.63, 392.00],
      [174.61, 220.00, 261.63, 329.63],
      [196.00, 261.63, 293.66, 392.00]
    ];

    const playChordStep = () => {
      if (!this.ctx || !this.bgmGain || !this.isMusicEnabled || this.isMuted) return;
      if (this.ctx.state !== 'running') return;

      const chord = chords[this.bgmStep % chords.length];
      this.bgmStep++;

      const t = this.ctx.currentTime;
      const chordDuration = 3.8;

      chord.forEach((freq, idx) => {
        if (!this.ctx || !this.bgmGain) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = idx === 0 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, t);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(450, t);
        filter.frequency.linearRampToValueAtTime(700, t + chordDuration * 0.4);
        filter.frequency.linearRampToValueAtTime(380, t + chordDuration);

        // Soft slow envelope
        gain.gain.setValueAtTime(0.001, t);
        gain.gain.linearRampToValueAtTime(0.045, t + 0.6);
        gain.gain.exponentialRampToValueAtTime(0.001, t + chordDuration);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.bgmGain);

        osc.start(t);
        osc.stop(t + chordDuration + 0.1);
      });

      // Sporadic twinkle high bell note
      if (Math.random() > 0.3) {
        const bellNotes = [523.25, 659.25, 783.99, 1046.50, 1318.51];
        const randomNote = bellNotes[Math.floor(Math.random() * bellNotes.length)];
        const bellTime = t + 0.8 + Math.random() * 1.5;

        const bellOsc = this.ctx.createOscillator();
        const bellGain = this.ctx.createGain();
        bellOsc.type = 'sine';
        bellOsc.frequency.setValueAtTime(randomNote, bellTime);

        bellGain.gain.setValueAtTime(0.001, bellTime);
        bellGain.gain.linearRampToValueAtTime(0.03, bellTime + 0.02);
        bellGain.gain.exponentialRampToValueAtTime(0.0001, bellTime + 1.2);

        bellOsc.connect(bellGain);
        bellGain.connect(this.bgmGain);

        bellOsc.start(bellTime);
        bellOsc.stop(bellTime + 1.3);
      }
    };

    this.bgmTimer = window.setInterval(playChordStep, 4000);
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.7, this.ctx.currentTime, 0.05);
    }
  }

  public getMuted() {
    return this.isMuted;
  }

  public setMusicEnabled(enabled: boolean) {
    this.isMusicEnabled = enabled;
    if (this.bgmGain && this.ctx) {
      this.bgmGain.gain.setTargetAtTime(enabled ? 0.12 : 0, this.ctx.currentTime, 0.05);
    }
  }

  public getMusicEnabled() {
    return this.isMusicEnabled;
  }

  public dispose() {
    if (this.bgmTimer) {
      window.clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}

export const soundEngine = new SoundEngine();

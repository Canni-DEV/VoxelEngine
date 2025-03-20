export class AudioManager {
  private audioCtx: AudioContext;
  private bpm: number;
  private isMusicPlaying: boolean = false;
  private musicIntervalId?: number;
  // Duración del backing track en segundos (60 seg = 1 minuto)
  private readonly loopDuration: number = 60;

  constructor(bpm: number = 120) {
    this.audioCtx = new AudioContext();
    this.bpm = bpm;
    //this.startMusicLoop();
  }

  /**
   * Inicia un backing track de 60 segundos que se repite en loop.
   * El track consta de:
   * - Batería: rock básico 4x4 (kick en cada beat, snare en el 2do y 4to, hi-hats en subdivisiones).
   * - Bajo: groove con notas E, A, B, A (frecuencias: ~82.41, 110, 123.47 y 110 Hz).
   * - Guitarra distorsionada: arpegio con notas E3, G3, B3 y E4.
   */
  public startMusicLoop(): void {
    if (this.isMusicPlaying) return;
    this.isMusicPlaying = true;

    // Agenda el primer segmento inmediatamente.
    this.scheduleMusicSegment(this.audioCtx.currentTime + 0.1, this.loopDuration);

    // Reprograma el segmento cada loopDuration (60 seg)
    this.musicIntervalId = window.setInterval(() => {
      this.scheduleMusicSegment(this.audioCtx.currentTime + 0.1, this.loopDuration);
    }, this.loopDuration * 1000);
  }

  /**
   * Detiene el loop de backing track.
   */
  public stopMusicLoop(): void {
    if (this.musicIntervalId) {
      clearInterval(this.musicIntervalId);
      this.musicIntervalId = undefined;
      this.isMusicPlaying = false;
    }
  }

  /**
   * Permite actualizar el BPM, reiniciando el loop con la nueva configuración.
   * @param newBPM Nuevo valor de BPM.
   */
  public setBPM(newBPM: number): void {
    this.bpm = newBPM;
    if (this.isMusicPlaying) {
      this.stopMusicLoop();
      this.startMusicLoop();
    }
  }

  /**
   * Agenda en el AudioContext los eventos de cada instrumento para un segmento
   * de backing track de duración segmentDuration.
   * @param startTime Tiempo de inicio en AudioContext.currentTime.
   * @param segmentDuration Duración del segmento (60 segundos).
   */
  private scheduleMusicSegment(startTime: number, segmentDuration: number): void {
    const beatDuration = 60 / this.bpm; // Ej. 60/120 = 0.5 seg por beat
    const totalBeats = Math.floor(segmentDuration / beatDuration);

    // --- BATERÍA ---
    // Se asume un compás de 4 beats: kick en cada beat, snare en el 2do y 4to, hi-hats en subdivisiones.
    for (let beat = 0; beat < totalBeats; beat++) {
      const beatTime = startTime + beat * beatDuration;
      this.scheduleDrumKick(beatTime);
      if ((beat % 4) === 1 || (beat % 4) === 3) {
        this.scheduleDrumSnare(beatTime);
      }
      // Hi-hats en cada 8va nota (dos por beat)
      this.scheduleDrumHiHat(beatTime);
      this.scheduleDrumHiHat(beatTime + beatDuration / 2);
    }

    // --- BAJO ---
    //Groove repetitivo: E, A, B, A cada compás (4 beats)
    const bassPattern = [82.41, 110, 123.47, 110];
    const measureCount = Math.floor(totalBeats / 4);
    for (let m = 0; m < measureCount; m++) {
      const measureStart = startTime + m * 4 * beatDuration;
      bassPattern.forEach((freq, i) => {
        const noteTime = measureStart + i * beatDuration;
        this.scheduleBassNote(freq, noteTime, beatDuration * 0.4);
      });
    }
    // --- GUITARRA DISTORSIONADA ---
    //Arpegio complementario: E3, G3, B3, E4
    const guitarPattern = [164.81, 196, 246.94, 329.63];
    for (let m = 0; m < measureCount; m++) {
      const measureStart = startTime + m * 4 * beatDuration;
      guitarPattern.forEach((freq, i) => {
        const noteTime = measureStart + i * beatDuration;
        this.scheduleDistortedGuitarNote(freq, noteTime, beatDuration * 0.9);
      });
    }
  }

  // ====================
  // Métodos de instrumentación
  // ====================

  /**
   * Programa un golpe de bombo (kick) simulando un rápido descenso de frecuencia.
   * @param startTime Tiempo de inicio en AudioContext.currentTime.
   */
  private scheduleDrumKick(startTime: number): void {
    const osc = this.audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, startTime);
    osc.frequency.exponentialRampToValueAtTime(0.001, startTime + 0.1);

    const gain = this.audioCtx.createGain();
    gain.gain.setValueAtTime(1, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.1);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start(startTime);
    osc.stop(startTime + 0.1);
  }

  /**
   * Programa un golpe de snare usando ruido blanco filtrado.
   * @param startTime Tiempo de inicio en AudioContext.currentTime.
   */
  private scheduleDrumSnare(startTime: number): void {
    const bufferSize = this.audioCtx.sampleRate * 0.2;
    const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.audioCtx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = this.audioCtx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.setValueAtTime(1000, startTime);

    const gain = this.audioCtx.createGain();
    gain.gain.setValueAtTime(1, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.2);

    noise.connect(noiseFilter);
    noiseFilter.connect(gain);
    gain.connect(this.audioCtx.destination);

    noise.start(startTime);
    noise.stop(startTime + 0.2);
  }

  /**
   * Programa un hi-hat usando ruido blanco filtrado a altas frecuencias.
   * @param startTime Tiempo de inicio en AudioContext.currentTime.
   */
  private scheduleDrumHiHat(startTime: number): void {
    const bufferSize = this.audioCtx.sampleRate * 0.05;
    const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.audioCtx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.audioCtx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(5000, startTime);

    const gain = this.audioCtx.createGain();
    gain.gain.setValueAtTime(0.3, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.05);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.audioCtx.destination);

    noise.start(startTime);
    noise.stop(startTime + 0.05);
  }

  /**
   * Programa una nota de bajo con un oscilador sawtooth.
   * @param frequency Frecuencia de la nota.
   * @param startTime Tiempo de inicio (AudioContext.currentTime).
   * @param duration Duración de la nota en segundos.
   */
  private scheduleBassNote(frequency: number, startTime: number, duration: number): void {
    const osc = this.audioCtx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(frequency, startTime);

    const gain = this.audioCtx.createGain();
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.8, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  /**
   * Programa una nota de guitarra distorsionada.
   * Se utiliza un oscilador sawtooth junto con un waveshaper para simular distorsión.
   * @param frequency Frecuencia de la nota.
   * @param startTime Tiempo de inicio (AudioContext.currentTime).
   * @param duration Duración de la nota en segundos.
   */
  private scheduleDistortedGuitarNote(frequency: number, startTime: number, duration: number): void {
    const osc = this.audioCtx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(frequency, startTime);

    const waveShaper = this.audioCtx.createWaveShaper();
    waveShaper.curve = this.makeDistortionCurve(400);
    waveShaper.oversample = '4x';

    const gain = this.audioCtx.createGain();
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.7, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(waveShaper);
    waveShaper.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  /**
   * Crea una curva de distorsión para el waveshaper.
   * @param amount Cantidad de distorsión.
   */
  private makeDistortionCurve(amount: number): Float32Array {
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = i * 2 / n_samples - 1;
      curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }

  // ====================
  // Métodos para efectos cortos (sonidos de juego)
  // ====================

  public playSound(type: 'step' | 'place' | 'destroy'): void {
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    switch (type) {
      case 'step':
        osc.frequency.value = 440;
        break;
      case 'place':
        osc.frequency.value = 550;
        break;
      case 'destroy':
        osc.frequency.value = 330;
        break;
    }
    gain.gain.setValueAtTime(1, this.audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.2);
    osc.start(this.audioCtx.currentTime);
    osc.stop(this.audioCtx.currentTime + 0.2);
  }

  public playJump(): void {
    const startTime = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, startTime);
    osc.frequency.exponentialRampToValueAtTime(100, startTime + 0.3);

    const gain = this.audioCtx.createGain();
    gain.gain.setValueAtTime(0.5, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.3);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start(startTime);
    osc.stop(startTime + 0.3);
  }

  public playDamage(): void {
    const startTime = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, startTime);

    const gain = this.audioCtx.createGain();
    gain.gain.setValueAtTime(1, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.2);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start(startTime);
    osc.stop(startTime + 0.2);
  }
}

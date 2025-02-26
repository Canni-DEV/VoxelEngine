export class AudioManager {
    private audioCtx: AudioContext;
    private bpm: number = 120;
    private isMusicPlaying: boolean = false;
    private musicIntervalId?: number;
  
    constructor(bpm: number = 120) {
      this.audioCtx = new AudioContext();
      this.bpm = bpm;
      // Inicia el loop de música de fondo
      //this.playLaCucaracha();
    }
  
    /**
     * Inicia un loop de música de fondo que reproduce una
     * secuencia básica con guitarra, piano y batería.
     */
    public startMusicLoop(): void {
      if (this.isMusicPlaying) return;
      this.isMusicPlaying = true;
      const beatDuration = 60 / this.bpm; // Duración de un beat en segundos
      const loopDuration = beatDuration * 4; // Loop de 4 beats
  
      const scheduleLoop = () => {
        // Se programa con un pequeño offset para asegurar la sincronía
        const startTime = this.audioCtx.currentTime + 0.1;
  
        // --- Patrón de guitarra (arpegio sencillo) ---
        // Guitarra simulada con un oscilador sawtooth
        this.scheduleGuitarNote(196, startTime, beatDuration * 0.8);                // G3
        this.scheduleGuitarNote(246.94, startTime + beatDuration, beatDuration * 0.8);  // B3
        this.scheduleGuitarNote(293.66, startTime + 2 * beatDuration, beatDuration * 0.8); // D4
        this.scheduleGuitarNote(329.63, startTime + 3 * beatDuration, beatDuration * 0.8); // E4
  
        // --- Patrón de piano (melodía sencilla) ---
        // Piano simulado con un oscilador sine
        this.schedulePianoNote(261.63, startTime, beatDuration * 0.8);                // C4
        this.schedulePianoNote(293.66, startTime + beatDuration, beatDuration * 0.8);   // D4
        this.schedulePianoNote(329.63, startTime + 2 * beatDuration, beatDuration * 0.8); // E4
        this.schedulePianoNote(349.23, startTime + 3 * beatDuration, beatDuration * 0.8); // F4
  
        // --- Patrón de batería (kick en cada beat) ---
        for (let i = 0; i < 4; i++) {
          this.scheduleDrumBeat(startTime + i * beatDuration);
        }
      };
  
      // Programa el primer loop y luego se repite cada loopDuration (en milisegundos)
      scheduleLoop();
      this.musicIntervalId = window.setInterval(scheduleLoop, loopDuration * 1000);
    }
  
    /**
     * Detiene el loop de música de fondo.
     */
    public stopMusicLoop(): void {
      if (this.musicIntervalId) {
        clearInterval(this.musicIntervalId);
        this.musicIntervalId = undefined;
        this.isMusicPlaying = false;
      }
    }
  
    /**
     * Permite actualizar el BPM de la música. Al cambiarlo,
     * se reinicia el loop con la nueva configuración.
     * @param newBPM Nuevo valor de BPM
     */
    public setBPM(newBPM: number): void {
      this.bpm = newBPM;
      if (this.isMusicPlaying) {
        this.stopMusicLoop();
        this.startMusicLoop();
      }
    }
  
    /**
     * Programa una nota de guitarra utilizando un oscilador sawtooth.
     * @param frequency Frecuencia de la nota
     * @param startTime Tiempo de inicio de la nota (en AudioContext.currentTime)
     * @param duration Duración de la nota en segundos
     */
    private scheduleGuitarNote(frequency: number, startTime: number, duration: number): void {
      const osc = this.audioCtx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(frequency, startTime);
  
      const gain = this.audioCtx.createGain();
      // Envelope: ataque rápido y decaimiento exponencial
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(1, startTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
  
      osc.start(startTime);
      osc.stop(startTime + duration);
    }
  
    /**
     * Programa una nota de piano utilizando un oscilador sine.
     * @param frequency Frecuencia de la nota
     * @param startTime Tiempo de inicio de la nota (en AudioContext.currentTime)
     * @param duration Duración de la nota en segundos
     */
    private schedulePianoNote(frequency: number, startTime: number, duration: number): void {
      const osc = this.audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, startTime);
  
      const gain = this.audioCtx.createGain();
      // Envelope: ataque muy rápido y decaimiento suave
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.8, startTime + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
  
      osc.start(startTime);
      osc.stop(startTime + duration);
    }
  
    /**
     * Programa un golpe de batería (kick) utilizando un oscilador sine.
     * @param startTime Tiempo de inicio del golpe (en AudioContext.currentTime)
     */
    private scheduleDrumBeat(startTime: number): void {
      const osc = this.audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(150, startTime);
      // Simula un golpe descendiendo rápidamente la frecuencia
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
     * Reproduce un sonido procedural según el tipo de acción: 'step', 'place' o 'destroy'.
     * @param type Tipo de acción a reproducir
     */
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
  
    /**
     * Reproduce un sonido al saltar (jump), simulando un "whoosh" con un oscilador triangle.
     */
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
  
    /**
     * Reproduce un sonido al recibir daño (damage), usando un timbre áspero con un oscilador sawtooth.
     */
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
  
    /**
     * Programa y reproduce la melodía de "La Cucaracha" de forma secuencial.
     * La melodía se define como un arreglo de notas (frecuencia y duración).
     * Esta es una versión simplificada y aproximada de la canción.
     */
    public playLaCucaracha(): void {
      // Definición de la melodía (frecuencia en Hz y duración en segundos)
      // Nota: Los valores pueden ajustarse para mejorar la musicalidad
      const melody = [
        // Frase 1: "La cu-ca-ra-cha, la cu-ca-ra-cha"
        { frequency: 392, duration: 0.5 }, // G4
        { frequency: 392, duration: 0.5 },
        { frequency: 392, duration: 0.5 },
        { frequency: 440, duration: 0.5 }, // A4
        { frequency: 494, duration: 0.8 }, // B4
  
        { frequency: 392, duration: 0.5 },
        { frequency: 392, duration: 0.5 },
        { frequency: 392, duration: 0.5 },
        { frequency: 440, duration: 0.5 }, // A4
        { frequency: 494, duration: 0.8 }, // B4
  
        // Frase 2: "ya no puede caminar"
        { frequency: 523.25, duration: 0.5 }, // C5
        { frequency: 494, duration: 0.5 },      // B4
        { frequency: 440, duration: 0.5 },      // A4
        { frequency: 392, duration: 0.5 },      // G4
        { frequency: 349.23, duration: 0.5 },   // F4
        { frequency: 329.63, duration: 0.8 }    // E4
      ];
  
      let timeOffset = this.audioCtx.currentTime + 0.1;
      melody.forEach(note => {
        this.scheduleMelodyNote(note.frequency, timeOffset, note.duration);
        timeOffset += note.duration;
      });
    }
  
    /**
     * Programa una nota para la melodía (utilizada en playLaCucaracha)
     * utilizando un oscilador sine y un envolvente básico.
     * @param frequency Frecuencia de la nota en Hz
     * @param startTime Tiempo de inicio (AudioContext.currentTime)
     * @param duration Duración de la nota en segundos
     */
    private scheduleMelodyNote(frequency: number, startTime: number, duration: number): void {
      const osc = this.audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, startTime);
  
      const gain = this.audioCtx.createGain();
      // Envelope: ataque rápido y decaimiento exponencial
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.8, startTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
  
      osc.start(startTime);
      osc.stop(startTime + duration);
    }
  }
  
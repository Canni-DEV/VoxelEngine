import * as SimplexNoiseNS from 'simplex-noise';

export class SimplexNoiseGenerator {
  private simplex: any;

  constructor(seed: string) {
    this.simplex = SimplexNoiseNS.createNoise2D()
  }

  /**
   * Devuelve un valor de ruido en el rango [0, 1] para las coordenadas (x, y).
   */
  noise(x: number, y: number): number {
    // La función noise2D devuelve valores en [-1, 1]  
    return (this.simplex(x, y) + 1) / 2;
  }
}

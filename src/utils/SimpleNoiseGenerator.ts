import * as SimplexNoiseNS from 'simplex-noise';

export class SimplexNoiseGenerator {
  private simplex: any;

  constructor(seed: string) {
    this.simplex = SimplexNoiseNS.createNoise2D()
  }

  noise(x: number, y: number): number {
    return (this.simplex(x, y) + 1) / 2;
  }
}

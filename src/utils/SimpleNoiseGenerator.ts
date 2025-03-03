import * as SimplexNoiseNS from 'simplex-noise';
import alea from 'alea';

export class SimplexNoiseGenerator {
  private simplex: any;

  constructor(seed: string) {
    this.simplex = SimplexNoiseNS.createNoise2D(alea(seed))
  }

  noise(x: number, y: number): number {
    return (this.simplex(x, y) + 1) / 2;
  }
}

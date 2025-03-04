import { SimplexNoiseGenerator } from '../utils/SimpleNoiseGenerator';
import * as THREE from 'three';

export enum VoxelType {
  AIR = 0,
  WATER,
  SAND,
  GRASS,
  DIRT,
  MOUNTAIN,
  SNOW,
  TRUNK,
  LEAVES,
  CLOUD  
}

export class TerrainGenerator {
  private readonly maxHeight: number = 512;
  private readonly seaLevel: number = 64;

  private readonly baseFrequency: number = 0.001;
  private readonly baseAmplitude: number = 5;

  private readonly mountainFrequency: number = 0.002;
  private readonly mountainThreshold: number = 0.6;
  private readonly mountainAmplitude: number = 400;

  private readonly detailFrequency: number = 0.03;
  private readonly detailAmplitude: number = 6;

  private readonly tempFrequency: number = 0.0125;

  private readonly rainFrequency: number = 0.01;
  private readonly rainAmplitude: number = 1;

  private readonly riverFrequency: number = 0.007;
  private readonly riverThreshold: number = 0.25;

  private readonly treeFrequency: number = 0.15;

  private readonly caveCount: number = 3;           
  private readonly minCaveLength: number = 50;        
  private readonly maxCaveLength: number = 150;       
  private readonly baseCaveRadius: number = 2;        

  private noiseGen: SimplexNoiseGenerator;

  constructor(seed: string) {
    this.noiseGen = new SimplexNoiseGenerator(seed);
  }

  private mapNoise(value: number, min: number, max: number): number {
    return min + (value) * (max - min);
  }

  public getSeaLevel():number{
    return this.seaLevel;
  }

  /**
   * Calcula las propiedades del terreno en una posición global.
   * Devuelve: height, temperature, rainfall y river.
   */
  private computeTerrainProperties(worldX: number, worldZ: number): { height: number, temperature: number, rainfall: number, river: boolean } {
    const baseNoise = this.noiseGen.noise(worldX * this.baseFrequency, worldZ * this.baseFrequency);
    const baseHeight = baseNoise * this.baseAmplitude;

    const mountainNoise = this.noiseGen.noise(worldX * this.mountainFrequency, worldZ * this.mountainFrequency);
    const mountainHeight = (mountainNoise > this.mountainThreshold)
      ? (mountainNoise - this.mountainThreshold) * this.mountainAmplitude
      : 0;

    const detailNoise = this.noiseGen.noise(worldX * this.detailFrequency, worldZ * this.detailFrequency) * this.detailAmplitude;
    let height = Math.floor(baseHeight + mountainHeight + detailNoise + this.seaLevel);
    if (height < this.seaLevel) height = this.seaLevel;
    if (height > this.maxHeight - 1) height = this.maxHeight - 1;

    const temperature = this.noiseGen.noise(worldX * this.tempFrequency, worldZ * this.tempFrequency);
    const rainfall = this.noiseGen.noise(worldX * this.rainFrequency, worldZ * this.rainFrequency) * this.rainAmplitude;
    const riverNoise = this.noiseGen.noise(worldX * this.riverFrequency, worldZ * this.riverFrequency);
    const river = (riverNoise < this.riverThreshold) && (height < this.seaLevel + 10);
    if (river) height = this.seaLevel - 1;

    return { height, temperature, rainfall, river };
  }

  generateChunk(chunkX: number, chunkZ: number, size: number): VoxelType[][][] {
    const data: VoxelType[][][] = [];
    for (let x = 0; x < size; x++) {
      data[x] = [];
      for (let y = 0; y < this.maxHeight; y++) {
        data[x][y] = new Array(size).fill(VoxelType.AIR);
      }
    }
    var maxHeight = this.seaLevel + 10;
    for (let x = 0; x < size; x++) {
      for (let z = 0; z < size; z++) {
        const worldX = x + chunkX * size;
        const worldZ = z + chunkZ * size;
        const { height, temperature, rainfall, river } = this.computeTerrainProperties(worldX, worldZ);

        let topType: VoxelType;
        if (height <= this.seaLevel || river) {
          topType = VoxelType.WATER;
        } else {
          if(maxHeight < height)
            maxHeight = height;
          if (height < this.seaLevel + 4) {
            topType = VoxelType.SAND;
          } else if (height < this.seaLevel + 10) {
            topType = (temperature > 0.8) ? VoxelType.SAND : (rainfall < 0.4) ? VoxelType.DIRT : VoxelType.GRASS;
          } else if (height < this.seaLevel + 30) {
            topType = (temperature > 0.6 && rainfall < 0.4) ? VoxelType.DIRT : VoxelType.GRASS;
          } else if (height < this.seaLevel + 40) {
            topType = (temperature > 0.5) ? VoxelType.MOUNTAIN : (rainfall < 0.8) ? VoxelType.DIRT : VoxelType.GRASS;
          } else if (height < this.seaLevel + 150) {
            topType = VoxelType.MOUNTAIN;
          } else {
            topType = VoxelType.SNOW;
          }
        }

        for (let y = 0; y <= height; y++) {
          if (y === height) {
            data[x][y][z] = topType;
          } else {
            data[x][y][z] = (height <= this.seaLevel || river) ? VoxelType.SAND : VoxelType.DIRT;
          }
        }
      }
    }

    this.spawnTrees(data, size);
    this.carveCaves(data, size, chunkX, chunkZ, maxHeight);

    return data;
  }

  private carveCaves(data: VoxelType[][][], size: number, chunkX: number, chunkZ: number, maxHeight:number): void {
    for (let c = 0; c < this.caveCount; c++) {
      // Generar caveLength de forma determinística.
      const lengthNoise = this.noiseGen.noise(chunkX * 100 + c, chunkZ * 100 + c);
      const caveLength = Math.floor(this.mapNoise(lengthNoise, this.minCaveLength, this.maxCaveLength));

      // Posición inicial: startX, startZ en [0, size), startY entre seaLevel-30 y seaLevel-10.
      const startXNoise = this.noiseGen.noise(chunkX * 200 + c, chunkZ * 200 + c);
      const startX = Math.floor(this.mapNoise(startXNoise, 0, size));
      const startZNoise = this.noiseGen.noise(chunkX * 300 + c, chunkZ * 300 + c);
      const startZ = Math.floor(this.mapNoise(startZNoise, 0, size));
      const startYNoise = this.noiseGen.noise(chunkX * 400 + c, chunkZ * 400 + c);
      let startY = Math.floor(this.mapNoise(startYNoise, this.seaLevel - 30, maxHeight - 20));
      if (startY < 1) startY = 1;

      let pos = new THREE.Vector3(startX, startY, startZ);
      // Dirección inicial: usar noise para cada componente
      const dx = this.mapNoise(this.noiseGen.noise(chunkX * 500 + c, chunkZ * 500 + c), -1, 1);
      const dy = this.mapNoise(this.noiseGen.noise(chunkX * 600 + c, chunkZ * 600 + c), -0.2, 0.2);
      const dz = this.mapNoise(this.noiseGen.noise(chunkX * 700 + c, chunkZ * 700 + c), -1, 1);
      let dir = new THREE.Vector3(dx, dy, dz).normalize();

      // Avanzar a lo largo del camino
      for (let i = 0; i < caveLength; i++) {
        const xi = Math.floor(pos.x);
        const yi = Math.floor(pos.y);
        const zi = Math.floor(pos.z);
        if (xi < 1 || xi >= size - 1 || yi < 1 || yi >= this.maxHeight - 1 || zi < 1 || zi >= size - 1) break;

        // Variar el radio de la cueva según ruido
        const rNoise = this.noiseGen.noise(pos.x * 0.1, pos.z * 0.1);
        const caveRadius = this.baseCaveRadius + ( rNoise * 4);
        const rCeil = Math.ceil(caveRadius);

        // Carvar un "esferoide" en la posición actual
        for (let dx = -rCeil; dx <= rCeil; dx++) {
          for (let dy = -rCeil; dy <= rCeil; dy++) {
            for (let dz = -rCeil; dz <= rCeil; dz++) {
              if (Math.sqrt(dx * dx + dy * dy + dz * dz) <= caveRadius) {
                const nx = xi + dx;
                const ny = yi + dy;
                const nz = zi + dz;
                if (nx >= 0 && nx < size && ny >= 0 && ny < this.maxHeight && nz >= 0 && nz < size) {
                  data[nx][ny][nz] = VoxelType.AIR;
                }
              }
            }
          }
        }

        // Actualizar posición: avanza en la dirección actual.
        pos.add(dir);

        // Perturbar la dirección de forma determinística usando noise
        const perturbX = this.mapNoise(this.noiseGen.noise(chunkX * 800 + c, i), -0.1, 0.1);
        const perturbY = this.mapNoise(this.noiseGen.noise(chunkX * 900 + c, i), -0.05, 0.05);
        const perturbZ = this.mapNoise(this.noiseGen.noise(chunkX * 1000 + c, i), -0.1, 0.1);
        const perturb = new THREE.Vector3(perturbX, perturbY, perturbZ);
        dir.add(perturb).normalize();
      }
    }
  }

  private spawnTrees(data: VoxelType[][][], size: number): void {
    for (let x = 0; x < size; x++) {
      for (let z = 0; z < size; z++) {
        let topY = -1;
        for (let y = this.maxHeight - 1; y >= 0; y--) {
          if (data[x][y][z] !== VoxelType.AIR) {
            topY = y;
            break;
          }
        }
        if (topY === -1) continue;
        if (data[x][topY][z] !== VoxelType.GRASS) continue;
        const treeNoise = this.noiseGen.noise(x * 1000 * topY, z * 1000 * topY);
        if (treeNoise > this.treeFrequency) continue;

        const trunkNoise = this.noiseGen.noise(x * 5000 * topY, z * 5000 * topY);
        const trunkHeight = Math.floor(this.mapNoise(trunkNoise, 5, 11));
        if (topY + trunkHeight + 2 >= this.maxHeight) continue;
        for (let y = topY + 1; y <= topY + trunkHeight; y++) {
          data[x][y][z] = VoxelType.TRUNK;
        }
        const canopyNoise = this.noiseGen.noise(x * 2000, z * 2000);
        const canopyHeight = Math.floor(this.mapNoise(canopyNoise, 2, 4));
        for (let layer = 0; layer < canopyHeight; layer++) {
          const radius = (layer === 0) ? 2 : 1;
          const canopyY = topY + trunkHeight + layer;
          for (let dx = -radius; dx <= radius; dx++) {
            for (let dz = -radius; dz <= radius; dz++) {
              const nx = x + dx;
              const nz = z + dz;
              if (nx < 0 || nx >= size || nz < 0 || nz >= size) continue;
              const leafNoise = this.noiseGen.noise(dx * 3000 * topY, dz * 3000 * topY);
              if (leafNoise < 0.15) continue;
              if (data[nx][canopyY][nz] === VoxelType.AIR) {
                data[nx][canopyY][nz] = VoxelType.LEAVES;
              }
            }
          }
        }
      }
    }
  }
}

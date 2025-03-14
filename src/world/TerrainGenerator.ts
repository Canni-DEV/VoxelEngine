import { SimplexNoiseGenerator } from '../utils/SimpleNoiseGenerator';
import * as THREE from 'three';

export enum VoxelType {
  AIR = 0,
  WATER,
  SAND,
  GRASS,
  DIRT,
  STONE,
  SNOW,
  TRUNK,
  LEAVES,
  CLOUD
}

export class TerrainGenerator {
  private readonly maxHeight: number = 512;
  private readonly seaLevel: number = 48;

  private readonly baseFrequency: number = 0.001;
  private readonly baseAmplitude: number = 5;

  private readonly mountainFrequency: number = 0.002;
  private readonly mountainThreshold: number = 0.6;
  private readonly mountainAmplitude: number = 400;

  private readonly oceanFrequency: number = 0.001;
  private readonly oceanThreshold: number = 0.65;
  private readonly oceanAmplitude: number = 120;

  private readonly detailFrequency: number = 0.06;
  private readonly detailAmplitude: number = 6;

  private readonly tempFrequency: number = 0.0125;

  private readonly rainFrequency: number = 0.01;
  private readonly rainAmplitude: number = 1;

  private readonly treeFrequency: number = 0.15;

  private readonly caveCount: number = 3;
  private readonly minCaveLength: number = 50;
  private readonly maxCaveLength: number = 150;
  private readonly baseCaveRadius: number = 2;

  // Nuevos parámetros configurables (pueden inicializarse en el constructor o ser modificables)
  private octaves: number = 4;
  private persistence: number = 3;
  private lacunarity: number = 2.3;

  // Definición de rangos de altura:
  private oceanFloorHeight: number = 20;         // Altura mínima para fondo oceánico
  private prairieMaxHeight: number = 80;          // Aproximadamente seaLevel (64) + 50 bloques para praderas


  private noiseGen: SimplexNoiseGenerator;

  constructor(seed: string) {
    this.noiseGen = new SimplexNoiseGenerator(seed);
  }

  private mapNoise(value: number, min: number, max: number): number {
    return min + value * (max - min);
  }

  public getSeaLevel(): number {
    return this.seaLevel;
  }

  private computeTerrainProperties(worldX: number, worldZ: number, persistenceVariance: number): { height: number, temperature: number, rainfall: number } {
    let amplitude = this.baseAmplitude;
    let frequency = this.baseFrequency;
    let noiseSum = 0;
    let amplitudeSum = 0;

    for (let i = 0; i < this.octaves; i++) {
      const noiseVal = this.noiseGen.noise(worldX * frequency, worldZ * frequency);
      noiseSum += noiseVal * amplitude;
      amplitudeSum += amplitude;
      amplitude *= this.persistence * persistenceVariance;
      frequency *= this.lacunarity;
    }
    const fBm = noiseSum / amplitudeSum;
    const heightRange = this.prairieMaxHeight - this.oceanFloorHeight;
    let baseHeight = this.oceanFloorHeight + fBm * heightRange;

    const oceanNoise = this.noiseGen.noise(worldX * this.oceanFrequency + 66666, worldZ * this.oceanFrequency + 66666);
    const oceanHeight = (oceanNoise > this.oceanThreshold)
      ? (oceanNoise - this.oceanThreshold) * -this.oceanAmplitude
      : 0;


    const mountainNoise = this.noiseGen.noise(worldX * this.mountainFrequency + 200, worldZ * this.mountainFrequency + 400);
    const mountainHeight = (mountainNoise > this.mountainThreshold)
      ? (mountainNoise - this.mountainThreshold) * this.mountainAmplitude
      : 0;

    const detailNoise = this.noiseGen.noise(worldX * this.detailFrequency, worldZ * this.detailFrequency) * this.detailAmplitude;

    let finalHeight = Math.floor(baseHeight + mountainHeight + oceanHeight + detailNoise);
    if (finalHeight > this.maxHeight - 1) finalHeight = this.maxHeight - 1;
    if (finalHeight < 1) finalHeight = 1;

    const temperature = this.noiseGen.noise(worldX * this.tempFrequency, worldZ * this.tempFrequency);
    const rainfall = this.noiseGen.noise(worldX * this.rainFrequency, worldZ * this.rainFrequency) * this.rainAmplitude;

    return { height: Math.floor(finalHeight), temperature, rainfall };
  }

  private initializeChunk(size: number): VoxelType[][][] {
    const data: VoxelType[][][] = [];
    for (let x = 0; x < size; x++) {
      data[x] = [];
      for (let y = 0; y < this.maxHeight; y++) {
        data[x][y] = new Array(size).fill(VoxelType.AIR);
      }
    }
    return data;
  }

  private generateHeightMap(chunkX: number, chunkZ: number, size: number): { height: number, temperature: number, rainfall: number, river: boolean }[][] {
    const map = new Array(size);
    const persistenceVariance = this.noiseGen.noise(444444 + chunkX * 0.00005, 444444 + chunkZ * 0.00005);
    for (let x = 0; x < size; x++) {
      map[x] = new Array(size);
      for (let z = 0; z < size; z++) {
        const worldX = x + chunkX * size;
        const worldZ = z + chunkZ * size;
        map[x][z] = this.computeTerrainProperties(worldX, worldZ, persistenceVariance);
      }
    }
    return map;
  }

  private terrainShaping(data: VoxelType[][][], heightMap: { height: number }[][], size: number): void {
    for (let x = 0; x < size; x++) {
      for (let z = 0; z < size; z++) {
        const { height } = heightMap[x][z];
        for (let y = 0; y <= height; y++) {
          data[x][y][z] = VoxelType.STONE;
        }
      }
    }
  }

  private waterFilling(data: VoxelType[][][], heightMap: { height: number }[][], size: number): void {
    for (let x = 0; x < size; x++) {
      for (let z = 0; z < size; z++) {
        const { height } = heightMap[x][z];
        if (height < this.seaLevel) {
          for (let y = height + 1; y <= this.seaLevel && y < this.maxHeight; y++) {
            data[x][y][z] = VoxelType.WATER;
          }
        }
      }
    }
  }

  private getSurfaceDecoration(worldX: number, worldZ: number, height: number, temperature: number, rainfall: number)
    : { top: VoxelType, filler: VoxelType, thickness: number } {
    if (height < this.seaLevel + 4) {
      const thickness = Math.floor(this.mapNoise(this.noiseGen.noise(worldX * 10, worldZ * 10), 8, 10));
      return { top: VoxelType.SAND, filler: VoxelType.SAND, thickness };
    }
    if (height < this.seaLevel + 10) {
      const thickness = Math.floor(this.mapNoise(this.noiseGen.noise(worldX * 20, worldZ * 20), 5, 8));
      if (temperature > 0.8) {
        return { top: VoxelType.SAND, filler: VoxelType.SAND, thickness };
      } else if (rainfall < 0.4) {
        return { top: VoxelType.DIRT, filler: VoxelType.DIRT, thickness };
      } else {
        return { top: VoxelType.GRASS, filler: VoxelType.DIRT, thickness };
      }
    }
    if (height < this.seaLevel + 30) {
      const thickness = Math.floor(this.mapNoise(this.noiseGen.noise(worldX * 30, worldZ * 30), 5, 8));
      if (temperature > 0.6 && rainfall < 0.4) {
        return { top: VoxelType.DIRT, filler: VoxelType.DIRT, thickness };
      } else {
        return { top: VoxelType.GRASS, filler: VoxelType.DIRT, thickness };
      }
    }
    if (height < this.seaLevel + 40) {
      const thickness = Math.floor(this.mapNoise(this.noiseGen.noise(worldX * 40, worldZ * 40), 5, 8));
      if (temperature > 0.5) {
        return { top: VoxelType.STONE, filler: VoxelType.DIRT, thickness };
      } else if (rainfall < 0.8) {
        return { top: VoxelType.DIRT, filler: VoxelType.DIRT, thickness };
      } else {
        return { top: VoxelType.GRASS, filler: VoxelType.DIRT, thickness };
      }
    }
    if (height < this.seaLevel + 150) {
      return { top: VoxelType.STONE, filler: VoxelType.STONE, thickness: 1 };
    }
    return { top: VoxelType.SNOW, filler: VoxelType.SNOW, thickness: 1 };
  }

  private surfaceDecoration(data: VoxelType[][][], heightMap: { height: number, temperature: number, rainfall: number }[][], chunkX: number, chunkZ: number, size: number): void {
    for (let x = 0; x < size; x++) {
      for (let z = 0; z < size; z++) {
        const worldX = x + chunkX * size;
        const worldZ = z + chunkZ * size;
        const { height, temperature, rainfall } = heightMap[x][z];
        if (height < 0 || height >= this.maxHeight) continue;
        const deco = this.getSurfaceDecoration(worldX, worldZ, height, temperature, rainfall);
        const start = Math.max(0, height - deco.thickness + 1);
        for (let y = start; y <= height; y++) {
          data[x][y][z] = (y === height) ? deco.top : deco.filler;
        }
      }
    }
  }

  public generateChunk(chunkX: number, chunkZ: number, size: number): VoxelType[][][] {
    const data = this.initializeChunk(size);
    const heightMap = this.generateHeightMap(chunkX, chunkZ, size);
    this.terrainShaping(data, heightMap, size);
    this.waterFilling(data, heightMap, size);
    this.surfaceDecoration(data, heightMap, chunkX, chunkZ, size);
    this.spawnTrees(data, size);
    this.carveCaves(data, size, chunkX, chunkZ, heightMap);
    return data;
  }

  private carveCaves(data: VoxelType[][][], size: number, chunkX: number, chunkZ: number, heightMap: { height: number, temperature: number, rainfall: number }[][]): void {
    let maxHeight = this.seaLevel;
    for (let x = 0; x < size; x++) {
      for (let z = 0; z < size; z++) {
        const { height } = heightMap[x][z];
        if (height > maxHeight) maxHeight = height;
      }
    }
    for (let c = 0; c < this.caveCount; c++) {
      const lengthNoise = this.noiseGen.noise(chunkX * 100 + c, chunkZ * 100 + c);
      const caveLength = Math.floor(this.mapNoise(lengthNoise, this.minCaveLength, this.maxCaveLength));

      const startXNoise = this.noiseGen.noise(chunkX * 200 + c, chunkZ * 200 + c);
      const startX = Math.floor(this.mapNoise(startXNoise, 0, size));
      const startZNoise = this.noiseGen.noise(chunkX * 300 + c, chunkZ * 300 + c);
      const startZ = Math.floor(this.mapNoise(startZNoise, 0, size));
      const startYNoise = this.noiseGen.noise(chunkX * 400 + c, chunkZ * 400 + c);
      let startY = Math.floor(this.mapNoise(startYNoise, this.seaLevel - 30, maxHeight - 20));
      if (startY < 1) startY = 1;

      let pos = new THREE.Vector3(startX, startY, startZ);
      const dx = this.mapNoise(this.noiseGen.noise(chunkX * 500 + c, chunkZ * 500 + c), -1, 1);
      const dy = this.mapNoise(this.noiseGen.noise(chunkX * 600 + c, chunkZ * 600 + c), -0.2, 0.2);
      const dz = this.mapNoise(this.noiseGen.noise(chunkX * 700 + c, chunkZ * 700 + c), -1, 1);
      let dir = new THREE.Vector3(dx, dy, dz).normalize();

      for (let i = 0; i < caveLength; i++) {
        const xi = Math.floor(pos.x);
        const yi = Math.floor(pos.y);
        const zi = Math.floor(pos.z);
        if (xi < 1 || xi >= size - 1 || yi < 1 || yi >= this.maxHeight - 1 || zi < 1 || zi >= size - 1) break;

        const rNoise = this.noiseGen.noise(pos.x * 0.1, pos.z * 0.1);
        const caveRadius = this.baseCaveRadius + (rNoise * 4);
        const rCeil = Math.ceil(caveRadius);

        for (let dx = -rCeil; dx <= rCeil; dx++) {
          for (let dy = -rCeil; dy <= rCeil; dy++) {
            for (let dz = -rCeil; dz <= rCeil; dz++) {
              if (Math.sqrt(dx * dx + dy * dy + dz * dz) <= caveRadius) {
                const nx = xi + dx;
                const ny = yi + dy;
                const nz = zi + dz;
                if (nx >= 0 && nx < size && ny >= 0 && ny < this.maxHeight && nz >= 0 && nz < size && data[nx][ny][nz] !== VoxelType.WATER) {
                  data[nx][ny][nz] = VoxelType.AIR;
                }
              }
            }
          }
        }

        pos.add(dir);
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

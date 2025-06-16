import { SimplexNoiseGenerator } from '../utils/SimpleNoiseGenerator';
import * as THREE from 'three';
import { TerrainConfig } from './TerrainConfig';

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
  LEAVES_AUTUMN,
  LEAVES_YOUNG,
  LEAVES_CHERRY,
  CLOUD,
  BEDROCK
}

const DEFAULT_CONFIG: Required<TerrainConfig> = {
  maxHeight: 256,
  seaLevel: 48,
  baseFrequency: 0.001,
  baseAmplitude: 5,
  mountainFrequency: 0.002,
  mountainThreshold: 0.6,
  mountainAmplitude: 400,
  oceanFrequency: 0.001,
  oceanThreshold: 0.65,
  oceanAmplitude: 120,
  detailFrequency: 0.06,
  detailAmplitude: 6,
  tempFrequency: 0.0125,
  rainFrequency: 0.01,
  rainAmplitude: 1,
  treeFrequency: 0.15,
  caveCount: 3,
  minCaveLength: 50,
  maxCaveLength: 150,
  baseCaveRadius: 2,
  octaves: 4,
  persistence: 3,
  lacunarity: 2.3,
  oceanFloorHeight: 20,
  prairieMaxHeight: 80,
};

export class TerrainGenerator {
  private readonly maxHeight: number;
  private readonly seaLevel: number;

  private readonly baseFrequency: number;
  private readonly baseAmplitude: number;

  private readonly mountainFrequency: number;
  private readonly mountainThreshold: number;
  private readonly mountainAmplitude: number;

  private readonly oceanFrequency: number;
  private readonly oceanThreshold: number;
  private readonly oceanAmplitude: number;

  private readonly detailFrequency: number;
  private readonly detailAmplitude: number;

  private readonly tempFrequency: number;

  private readonly rainFrequency: number;
  private readonly rainAmplitude: number;

  private readonly treeFrequency: number;

  private readonly caveCount: number;
  private readonly minCaveLength: number;
  private readonly maxCaveLength: number;
  private readonly baseCaveRadius: number;

  private octaves: number;
  private persistence: number;
  private lacunarity: number;

  private oceanFloorHeight: number;
  private prairieMaxHeight: number;


  private noiseGen: SimplexNoiseGenerator;

  constructor(seed: string | null, config: TerrainConfig = {}) {
    const cfg = { ...DEFAULT_CONFIG, ...config };

    this.maxHeight = cfg.maxHeight;
    this.seaLevel = cfg.seaLevel;

    this.baseFrequency = cfg.baseFrequency;
    this.baseAmplitude = cfg.baseAmplitude;

    this.mountainFrequency = cfg.mountainFrequency;
    this.mountainThreshold = cfg.mountainThreshold;
    this.mountainAmplitude = cfg.mountainAmplitude;

    this.oceanFrequency = cfg.oceanFrequency;
    this.oceanThreshold = cfg.oceanThreshold;
    this.oceanAmplitude = cfg.oceanAmplitude;

    this.detailFrequency = cfg.detailFrequency;
    this.detailAmplitude = cfg.detailAmplitude;

    this.tempFrequency = cfg.tempFrequency;

    this.rainFrequency = cfg.rainFrequency;
    this.rainAmplitude = cfg.rainAmplitude;

    this.treeFrequency = cfg.treeFrequency;

    this.caveCount = cfg.caveCount;
    this.minCaveLength = cfg.minCaveLength;
    this.maxCaveLength = cfg.maxCaveLength;
    this.baseCaveRadius = cfg.baseCaveRadius;

    this.octaves = cfg.octaves;
    this.persistence = cfg.persistence;
    this.lacunarity = cfg.lacunarity;

    this.oceanFloorHeight = cfg.oceanFloorHeight;
    this.prairieMaxHeight = cfg.prairieMaxHeight;

    this.noiseGen = new SimplexNoiseGenerator(seed);
  }

  private mapNoise(value: number, min: number, max: number): number {
    return min + value * (max - min);
  }

  public getSeaLevel(): number {
    return this.seaLevel;
  }

  public getMaxHeight(): number {
    return this.maxHeight;
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

  private initializeChunk(size: number): Uint8Array {
    const data = new Uint8Array(size * this.maxHeight * size);
    data.fill(VoxelType.AIR);
    return data;
  }

  private index(x: number, y: number, z: number, size: number): number {
    return x * this.maxHeight * size + y * size + z;
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

  private terrainShaping(data: Uint8Array, heightMap: { height: number }[][], size: number): void {
    for (let x = 0; x < size; x++) {
      for (let z = 0; z < size; z++) {
        const { height } = heightMap[x][z];
        data[this.index(x, 0, z, size)] = VoxelType.BEDROCK;
        for (let y = 1; y <= height; y++) {
          data[this.index(x, y, z, size)] = VoxelType.STONE;
        }
      }
    }
  }

  private waterFilling(data: Uint8Array, heightMap: { height: number }[][], size: number): void {
    for (let x = 0; x < size; x++) {
      for (let z = 0; z < size; z++) {
        const { height } = heightMap[x][z];
        if (height < this.seaLevel) {
          for (let y = height + 1; y <= this.seaLevel && y < this.maxHeight; y++) {
            data[this.index(x, y, z, size)] = VoxelType.WATER;
          }
        }
      }
    }
  }

  private clouds(data: Uint8Array, chunkX: number, chunkZ: number, size: number): void {
    const cloudFrequency = 0.1;
    const quantStep = 0.2;
    const threshold = 0.6;

    for (let x = 0; x < size; x++) {
      for (let z = 0; z < size; z++) {
        // Convertir a coordenadas globales
        const worldX = chunkX * size + x;
        const worldZ = chunkZ * size + z;

        // Calcular el ruido para esta posición con la frecuencia alta
        let noiseVal = this.noiseGen.noise(worldX * cloudFrequency, worldZ * cloudFrequency);
        // Cuantizamos el valor para que sea "cuadriculado"
        noiseVal = Math.floor(noiseVal / quantStep) * quantStep;

        // Si el valor supera el umbral, se asigna un voxel de nube en la capa superior
        if (noiseVal > threshold) {
          // Suponiendo que queremos las nubes en la última capa (podrías ajustar la altura)
          data[this.index(x, this.maxHeight - 1, z, size)] = VoxelType.CLOUD;
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

  private surfaceDecoration(data: Uint8Array, heightMap: { height: number, temperature: number, rainfall: number }[][], chunkX: number, chunkZ: number, size: number): void {
    for (let x = 0; x < size; x++) {
      for (let z = 0; z < size; z++) {
        const worldX = x + chunkX * size;
        const worldZ = z + chunkZ * size;
        const { height, temperature, rainfall } = heightMap[x][z];
        if (height < 0 || height >= this.maxHeight) continue;
        const deco = this.getSurfaceDecoration(worldX, worldZ, height, temperature, rainfall);
        const start = Math.max(0, height - deco.thickness + 1);
        for (let y = start; y <= height; y++) {
          data[this.index(x, y, z, size)] = (y === height) ? deco.top : deco.filler;
        }
      }
    }
  }

  public generateChunk(chunkX: number, chunkZ: number, size: number): Uint8Array {
    const data = this.initializeChunk(size);
    const heightMap = this.generateHeightMap(chunkX, chunkZ, size);
    this.terrainShaping(data, heightMap, size);
    this.waterFilling(data, heightMap, size);
    this.surfaceDecoration(data, heightMap, chunkX, chunkZ, size);
    this.spawnTrees(data, size, chunkX, chunkZ);
    this.carveCaves(data, size, chunkX, chunkZ, heightMap);
    //this.clouds(data,chunkX,chunkZ,size);
    return data;
  }

  private carveCaves(data: Uint8Array, size: number, chunkX: number, chunkZ: number, heightMap: { height: number, temperature: number, rainfall: number }[][]): void {
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
                if (nx >= 0 && nx < size && ny >= 0 && ny < this.maxHeight && nz >= 0 && nz < size && data[this.index(nx, ny, nz, size)] !== VoxelType.WATER && data[this.index(nx, ny, nz, size)] !== VoxelType.BEDROCK) {
                  data[this.index(nx, ny, nz, size)] = VoxelType.AIR;
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

  private spawnTrees(data: Uint8Array, size: number, chunkX: number, chunkZ: number): void {
    for (let x = 0; x < size; x++) {
      for (let z = 0; z < size; z++) {
        let topY = -1;
        for (let y = this.maxHeight - 1; y >= 0; y--) {
          if (data[this.index(x, y, z, size)] !== VoxelType.AIR) {
            topY = y;
            break;
          }
        }
        if (topY === -1) continue;
        if (data[this.index(x, topY, z, size)] !== VoxelType.GRASS) continue;
        const treeNoise = this.noiseGen.noise(x * 1000 * topY, z * 1000 * topY);
        const treeNoiseType = this.noiseGen.noise(chunkX * 0.01 + 5000, chunkZ * 0.01 + 5000);
        if (treeNoise > this.treeFrequency) continue;

        const trunkNoise = this.noiseGen.noise(x * 5000 * topY, z * 5000 * topY);
        const trunkHeight = Math.floor(this.mapNoise(trunkNoise, 4, 11));
        if (topY + trunkHeight + 2 >= this.maxHeight) continue;
        for (let y = topY + 1; y <= topY + trunkHeight; y++) {
          data[this.index(x, y, z, size)] = VoxelType.TRUNK;
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
              if (data[this.index(nx, canopyY, nz, size)] === VoxelType.AIR) {
                if (trunkHeight < 6) {
                  data[this.index(nx, canopyY, nz, size)] = VoxelType.LEAVES_YOUNG;
                  continue;
                }
                if (trunkHeight > 9) {
                  data[this.index(nx, canopyY, nz, size)] = VoxelType.LEAVES_AUTUMN;
                  continue;
                }
                if (treeNoiseType < 0.12 && treeNoiseType > 0.10) {
                  data[this.index(nx, canopyY, nz, size)] = VoxelType.LEAVES_CHERRY;
                  continue;
                }
                data[this.index(nx, canopyY, nz, size)] = VoxelType.LEAVES;
              }
            }
          }
        }
      }
    }
  }
}

import { SimplexNoiseGenerator } from '../utils/SimpleNoiseGenerator';

/** Tipos de voxel */
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
  CLOUD  // Nuevo tipo para nubes
}

export class TerrainGenerator {
  // Altura máxima (número de voxeles en Y) y nivel del mar.
  private readonly maxHeight: number = 256;
  private readonly seaLevel: number = 64;

  // Parámetros para la altura base (terreno general)
  private readonly baseFrequency: number = 0.001;
  private readonly baseAmplitude: number = 2;

  // Parámetros para la componente montañosa
  private readonly mountainFrequency: number = 0.002;
  private readonly mountainThreshold: number = 0.5;
  private readonly mountainAmplitude: number = 220;

  // Parámetros para detalles finos
  private readonly detailFrequency: number = 0.03;
  private readonly detailAmplitude: number = 5;

  // Parámetros para temperatura (se usa para biomas)
  private readonly tempFrequency: number = 0.0125;

  // Parámetros para lluvia (nuevos, para determinar biomas húmedos o secos)
  private readonly rainFrequency: number = 0.01;
  private readonly rainAmplitude: number = 1;

  // Parámetros para la generación de ríos
  private readonly riverFrequency: number = 0.005;
  private readonly riverThreshold: number = 0.25;

  // Parámetro para la frecuencia de árboles (solo en biomas forestales)
  private readonly treeFrequency: number = 0.03; // 3% de las columnas con pasto spawnearán un árbol

  private noiseGen: SimplexNoiseGenerator;

  constructor(seed: string = "seed") {
    this.noiseGen = new SimplexNoiseGenerator(seed);
  }

  /**
   * Calcula las propiedades del terreno en una posición global.
   * Devuelve: height, temperature, rainfall y river.
   */
  private computeTerrainProperties(worldX: number, worldZ: number): { height: number, temperature: number, rainfall: number, river: boolean } {
    // Ruido base para la elevación general
    const baseNoise = this.noiseGen.noise(worldX * this.baseFrequency, worldZ * this.baseFrequency);
    const baseHeight = baseNoise * this.baseAmplitude;

    // Ruido para montañas
    const mountainNoise = this.noiseGen.noise(worldX * this.mountainFrequency, worldZ * this.mountainFrequency);
    const mountainHeight = (mountainNoise > this.mountainThreshold)
      ? (mountainNoise - this.mountainThreshold) * this.mountainAmplitude
      : 0;

    // Ruido para detalles finos
    const detailNoise = this.noiseGen.noise(worldX * this.detailFrequency, worldZ * this.detailFrequency) * this.detailAmplitude;

    // Calcular altura base
    let height = Math.floor(baseHeight + mountainHeight + detailNoise + this.seaLevel);
    if (height < this.seaLevel) height = this.seaLevel;
    if (height > this.maxHeight - 1) height = this.maxHeight - 1;

    // Temperatura (valor entre -1 y 1, por ejemplo)
    const temperature = this.noiseGen.noise(worldX * this.tempFrequency, worldZ * this.tempFrequency);
    // Lluvia (valor entre -1 y 1)
    const rainfall = this.noiseGen.noise(worldX * this.rainFrequency, worldZ * this.rainFrequency) * this.rainAmplitude;
    
    // Ruido para ríos
    const riverNoise = this.noiseGen.noise(worldX * this.riverFrequency, worldZ * this.riverFrequency);
    const river = (riverNoise < this.riverThreshold) && (height < this.seaLevel + 10);
    if (river) height = this.seaLevel - 1;

    return { height, temperature, rainfall, river };
  }

  generateChunk(chunkX: number, chunkZ: number, size: number): VoxelType[][][] {
    // Preasigna la matriz 3D con AIR.
    const data: VoxelType[][][] = [];
    for (let x = 0; x < size; x++) {
      data[x] = [];
      for (let y = 0; y < this.maxHeight; y++) {
        data[x][y] = new Array(size).fill(VoxelType.AIR);
      }
    }

    // Genera el terreno base.
    for (let x = 0; x < size; x++) {
      for (let z = 0; z < size; z++) {
        const worldX = x + chunkX * size;
        const worldZ = z + chunkZ * size;
        const { height, temperature, rainfall, river } = this.computeTerrainProperties(worldX, worldZ);

        // Seleccionar el bioma basado en altura, temperatura y lluvia.
        let topType: VoxelType;
        if (height <= this.seaLevel || river) {
          topType = VoxelType.WATER;
        } else {
          // Ejemplos:
          // - Desierto: alta temperatura (>0.6) y baja lluvia (<0.3) => SAND.
          // - Pradera: temperatura moderada y lluvia moderada => GRASS.
          // - Bosque: similar a pradera, pero se pueden spawnear árboles.
          // - Montaña: elevación alta, se usa MOUNTAIN o SNOW si la temperatura es baja.
          if (height < this.seaLevel + 4) {
            topType = VoxelType.SAND;
          } else if (height < this.seaLevel + 50) {
            topType = (temperature > 0.6 && rainfall < 0.3) ? VoxelType.SAND : VoxelType.GRASS;
          } else if (height < this.seaLevel + 70) {
            topType = (temperature > 0.5) ? VoxelType.MOUNTAIN : VoxelType.DIRT;
          } else if (height < this.seaLevel + 100) {
            topType = VoxelType.MOUNTAIN;
          } else {
            topType = VoxelType.SNOW;
          }
        }

        // Rellenar la columna: la capa superior es topType, el resto se llena con DIRT o SAND.
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
    return data;
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
        if (Math.random() > this.treeFrequency) continue;

        const trunkHeight = Math.floor(Math.random() * 6) + 5;
        if (topY + trunkHeight + 2 >= this.maxHeight) continue;
        for (let y = topY + 1; y <= topY + trunkHeight; y++) {
          data[x][y][z] = VoxelType.TRUNK;
        }
        const canopyHeight = Math.floor(Math.random() * 2) + 2;
        for (let layer = 0; layer < canopyHeight; layer++) {
          const radius = (layer === 0) ? 2 : 1;
          const canopyY = topY + trunkHeight + layer;
          for (let dx = -radius; dx <= radius; dx++) {
            for (let dz = -radius; dz <= radius; dz++) {
              const nx = x + dx;
              const nz = z + dz;
              if (nx < 0 || nx >= size || nz < 0 || nz >= size) continue;
              if (Math.random() < 0.2) continue;
              if (data[nx][canopyY][nz] === VoxelType.AIR) {
                data[nx][canopyY][nz] = VoxelType.LEAVES;
              }
            }
          }
        }
      }
    }
  }

  generateTestChunk(chunkX: number, chunkZ: number, size: number): VoxelType[][][] {
    const data: VoxelType[][][] = [];
    for (let x = 0; x < size; x++) {
      data[x] = [];
      for (let y = 0; y < this.maxHeight; y++) {
        data[x][y] = new Array(size).fill(VoxelType.AIR);
      }
    }
    const centerX = Math.floor(size / 2);
    const centerY = 0;
    const centerZ = Math.floor(size / 2);
    data[centerX][centerY][centerZ] = VoxelType.DIRT;
    return data;
  }
}

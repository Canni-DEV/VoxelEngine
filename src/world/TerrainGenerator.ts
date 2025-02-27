// TerrainGenerator.ts
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
  LEAVES
}

export class TerrainGenerator {
  // Altura máxima (número de voxeles en Y)
  private readonly maxHeight: number = 256;
  // Nivel del mar (base de elevación)
  private readonly seaLevel: number = 64;

  // Parámetros para la altura base (islas grandes)
  private readonly baseFrequency: number = 0.001;
  private readonly baseAmplitude: number = 2;

  // Parámetros para la componente montañosa
  private readonly mountainFrequency: number = 0.002;
  private readonly mountainThreshold: number = 0.5;
  private readonly mountainAmplitude: number = 220;

  // Parámetros para detalles finos
  private readonly detailFrequency: number = 0.03;
  private readonly detailAmplitude: number = 5;

  // Parámetros para bioma/temperatura
  private readonly tempFrequency: number = 0.0125;

  // Parámetros para la generación de ríos
  private readonly riverFrequency: number = 0.005;
  private readonly riverThreshold: number = 0.25;

  // Parámetro para la frecuencia de árboles (por columna elegible)
  private readonly treeFrequency: number = 0.03; // 3% de las columnas con pasto spawnearán un árbol

  private noiseGen: SimplexNoiseGenerator;

  constructor() {
    this.noiseGen = new SimplexNoiseGenerator("seed");
  }

  private computeTerrainProperties(worldX: number, worldZ: number): { height: number, temperature: number, river: boolean } {
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
    const riverNoise = this.noiseGen.noise(worldX * this.riverFrequency, worldZ * this.riverFrequency);
    const river = riverNoise < this.riverThreshold && height < this.seaLevel + 10;
    if (river) height = this.seaLevel- 1;

    return { height, temperature, river };
  }

  /**
   * Genera un chunk de dimensiones [size x maxHeight x size] donde cada celda es un VoxelType.
   * chunkX y chunkZ son las coordenadas del chunk en el mundo.
   */
  generateChunk(chunkX: number, chunkZ: number, size: number): VoxelType[][][] {
    const data: VoxelType[][][] = [];
    for (let x = 0; x < size; x++) {
      data[x] = [];
      for (let y = 0; y < this.maxHeight; y++) {
        data[x][y] = new Array(size).fill(VoxelType.AIR);
      }
    }

    for (let x = 0; x < size; x++) {
      for (let z = 0; z < size; z++) {
        const worldX = x + chunkX * size;
        const worldZ = z + chunkZ * size;
        const { height, temperature, river } = this.computeTerrainProperties(worldX, worldZ);

        // Determinación del tipo de bloque en la superficie:
        // Si la columna está por debajo del nivel del mar o es un río, la superficie será WATER.
        // Si no, se asigna según la elevación y, en tierra firme, se usa:
        // - Cerca del nivel del mar: SAND
        // - Moderada elevación: GRASS (o DIRT en zonas frías)
        // - Elevación alta: MOUNTAIN, y muy alta: SNOW.
        let topType: VoxelType;
        if (height <= this.seaLevel || river) {
          topType = VoxelType.WATER;
        } else if (height < this.seaLevel + 4) {
          topType = VoxelType.SAND;
        } else if (height < this.seaLevel + 50) {
          topType = temperature > 0.5 ? VoxelType.GRASS : VoxelType.DIRT;
        } else if (height < this.seaLevel + 70) {
          topType = temperature > 0.3 ?  VoxelType.MOUNTAIN : VoxelType.DIRT;
        } else if (height < this.seaLevel + 100) {
          topType = VoxelType.MOUNTAIN;
        }        
        else {
          topType = VoxelType.SNOW;
        }

        // Rellenar la columna: la capa superior toma topType; el resto se llena con DIRT o SAND.
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
        // Buscar la capa superior en esta columna.
        let topY = -1;
        for (let y = this.maxHeight - 1; y >= 0; y--) {
          if (data[x][y][z] !== VoxelType.AIR) {
            topY = y;
            break;
          }
        }
        if (topY === -1) continue; // Columna vacía.

        // Condición para spawnear árbol: el bloque superior debe ser GRASS.
        if (data[x][topY][z] !== VoxelType.GRASS) continue;

        // Con una probabilidad determinada, se spawnea un árbol.
        if (Math.random() > this.treeFrequency) continue;

        // Spawnea un árbol: primero, define el tronco y luego la copa.
        // Tronco: altura aleatoria entre 5 y 10.
        const trunkHeight = Math.floor(Math.random() * 6) + 5;
        // Verificar que el árbol quepa.
        if (topY + trunkHeight + 2 >= this.maxHeight) continue;

        // Establecer el tronco (usando VoxelType.TRUNK).
        for (let y = topY + 1; y <= topY + trunkHeight; y++) {
          data[x][y][z] = VoxelType.TRUNK;
        }

        // Copa: altura entre 2 y 3.
        const canopyHeight = Math.floor(Math.random() * 2) + 2;
        // Para cada capa de la copa, definir un radio (capa inferior más ancha, superior más reducida).
        for (let layer = 0; layer < canopyHeight; layer++) {
          // Radio varía: capa 0: 2, capa 1: 1 (si canopyHeight>=2) o 2 (si canopyHeight==1)
          const radius = (layer === 0) ? 2 : 1;
          const canopyY = topY + trunkHeight + layer;
          // Iterar sobre la sección horizontal 2*radius en x y z.
          for (let dx = -radius; dx <= radius; dx++) {
            for (let dz = -radius; dz <= radius; dz++) {
              const nx = x + dx;
              const nz = z + dz;
              // Verificar límites del chunk.
              if (nx < 0 || nx >= size || nz < 0 || nz >= size) continue;
              // Para dar variedad, omitir algunos voxeles con probabilidad.
              if (Math.random() < 0.2) continue;
              // Solo colocar hoja si el espacio está vacío.
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

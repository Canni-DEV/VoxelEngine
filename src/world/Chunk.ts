import * as THREE from 'three';
import { TerrainGenerator, VoxelType } from './TerrainGenerator';

export class Chunk {
  public x: number;
  public z: number;
  public size: number;
  public mesh: THREE.Mesh;
  public terrainData: VoxelType[][][];
  public modified: boolean = false;

  public static proceduralTexture: THREE.CanvasTexture = Chunk.generateProceduralTexture();

  // Colores y lookup para cada tipo de voxel.
  private static readonly WATER_COLOR = new THREE.Color(0x3399ff);
  private static readonly SAND_COLOR = new THREE.Color(0xC2B280);
  private static readonly GRASS_COLOR = new THREE.Color(0x00cc00);
  private static readonly DIRT_COLOR = new THREE.Color(0x855E42);
  private static readonly STONE_COLOR = new THREE.Color(0x888888);
  private static readonly SNOW_COLOR = new THREE.Color(0xffffff);
  private static readonly TRUNK_COLOR = new THREE.Color(0x513C29);
  private static readonly LEAVES_COLOR = new THREE.Color(0x116303);

  private static readonly VOXEL_COLORS: { [key: number]: THREE.Color } = {
    [VoxelType.WATER]: Chunk.WATER_COLOR,
    [VoxelType.SAND]: Chunk.SAND_COLOR,
    [VoxelType.GRASS]: Chunk.GRASS_COLOR,
    [VoxelType.DIRT]: Chunk.DIRT_COLOR,
    [VoxelType.STONE]: Chunk.STONE_COLOR,
    [VoxelType.SNOW]: Chunk.SNOW_COLOR,
    [VoxelType.TRUNK]: Chunk.TRUNK_COLOR,
    [VoxelType.LEAVES]: Chunk.LEAVES_COLOR,
  };

  constructor(x: number, z: number, size: number, terrainGenerator: TerrainGenerator) {
    this.x = x;
    this.z = z;
    this.size = size;
    this.terrainData = terrainGenerator.generateChunk(x, z, size);
    this.mesh = this.createMesh();
    this.mesh.userData.chunk = this;
  }

  private static generateProceduralTexture(): THREE.CanvasTexture {
    const texSize = 24;
    const canvas = document.createElement('canvas');
    canvas.width = texSize;
    canvas.height = texSize;
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.createImageData(texSize, texSize);
    const totalPixels = texSize * texSize;

    for (let i = 0; i < totalPixels; i++) {
      const index = i * 4;
      const factor = 0.8 + Math.random() * 0.2;
      const value = Math.floor(255 * factor);
      imageData.data[index] = value;
      imageData.data[index + 1] = value;
      imageData.data[index + 2] = value;
      imageData.data[index + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }

  private getVoxel(x: number, y: number, z: number): VoxelType {
    if (x < 0 || x >= this.size || y < 0 || y >= this.terrainData[0].length || z < 0 || z >= this.size) {
      return VoxelType.AIR;
    }
    return this.terrainData[x][y][z];
  }

  private createMesh(): THREE.Mesh {
  // ================================================================
  // PASO 1: Malla opaca (greedy meshing) – se ignoran los voxeles de agua
  // ================================================================
  const positionsOpaque: number[] = [];
  const indicesOpaque: number[] = [];
  const colorsOpaque: number[] = [];
  const normalsOpaque: number[] = [];
  const uvsOpaque: number[] = [];
  let vertexOffsetOpaque = 0;

  // Dimensiones del chunk: [X, Y, Z]
  const dims = [this.size, this.terrainData[0].length, this.size];
  const worldOffset = new THREE.Vector3(this.x * this.size, 0, this.z * this.size);

  // Función auxiliar para calcular el índice en la máscara 2D
  const getMaskIndex = (i: number, j: number, width: number): number => i + j * width;

  // Greedy meshing en cada eje (0: X, 1: Y, 2: Z)
  for (let d = 0; d < 3; d++) {
    const u = (d + 1) % 3;
    const v = (d + 2) % 3;
    const dimU = dims[u];
    const dimV = dims[v];

    const x = [0, 0, 0];
    const q = [0, 0, 0];
    q[d] = 1;

    for (x[d] = 0; x[d] <= dims[d]; x[d]++) {
      // Crear la máscara 2D para la slice actual
      const mask: (null | { voxel: VoxelType; backface: boolean })[] =
        new Array(dimU * dimV).fill(null);

      for (let j = 0; j < dimV; j++) {
        for (let i = 0; i < dimU; i++) {
          x[u] = i;
          x[v] = j;

          // Obtener los voxeles A y B, tratando el agua como AIR para la malla opaca
          let voxelA = (x[d] < dims[d])
            ? this.getVoxel(x[0], x[1], x[2])
            : VoxelType.AIR;
          let voxelB: VoxelType;
          if (x[d] > 0) {
            const pos = [x[0] - q[0], x[1] - q[1], x[2] - q[2]];
            voxelB = this.getVoxel(pos[0], pos[1], pos[2]);
          } else {
            voxelB = VoxelType.AIR;
          }
          if (voxelA === VoxelType.WATER) { voxelA = VoxelType.AIR; }
          if (voxelB === VoxelType.WATER) { voxelB = VoxelType.AIR; }

          let maskValue: null | { voxel: VoxelType; backface: boolean } = null;
          if (voxelA !== VoxelType.AIR && voxelB === VoxelType.AIR) {
            // Para la capa inferior en Y se fuerza front face
            maskValue = (d === 1 && x[1] === 0)
              ? { voxel: voxelA, backface: false }
              : { voxel: voxelA, backface: true };
          } else if (voxelA === VoxelType.AIR && voxelB !== VoxelType.AIR) {
            maskValue = { voxel: voxelB, backface: false };
          }
          mask[getMaskIndex(i, j, dimU)] = maskValue;
        }
      }

      // Procesado greedy sobre la máscara 2D
      for (let j = 0; j < dimV; j++) {
        for (let i = 0; i < dimU;) {
          const idx = getMaskIndex(i, j, dimU);
          const cell = mask[idx];
          if (cell) {
            let w = 1;
            while (i + w < dimU) {
              const neighbor = mask[getMaskIndex(i + w, j, dimU)];
              if (neighbor && neighbor.voxel === cell.voxel && neighbor.backface === cell.backface) {
                w++;
              } else {
                break;
              }
            }
            let h = 1;
            outer: for (; j + h < dimV; h++) {
              for (let k = 0; k < w; k++) {
                const neighbor = mask[getMaskIndex(i + k, j + h, dimU)];
                if (!neighbor || neighbor.voxel !== cell.voxel || neighbor.backface !== cell.backface) {
                  break outer;
                }
              }
            }

            // Posición inicial para el quad
            x[u] = i;
            x[v] = j;
            const pos = [x[0], x[1], x[2]];

            const du = [0, 0, 0];
            const dv = [0, 0, 0];
            du[u] = w;
            dv[v] = h;

            const vertices: [number, number, number][] = new Array(4);
            if (!cell.backface) {
              vertices[0] = [pos[0], pos[1], pos[2]];
              vertices[1] = [pos[0] + du[0], pos[1] + du[1], pos[2] + du[2]];
              vertices[2] = [pos[0] + du[0] + dv[0], pos[1] + du[1] + dv[1], pos[2] + du[2] + dv[2]];
              vertices[3] = [pos[0] + dv[0], pos[1] + dv[1], pos[2] + dv[2]];
            } else {
              vertices[0] = [pos[0], pos[1], pos[2]];
              vertices[1] = [pos[0] + dv[0], pos[1] + dv[1], pos[2] + dv[2]];
              vertices[2] = [pos[0] + du[0] + dv[0], pos[1] + du[1] + dv[1], pos[2] + du[2] + dv[2]];
              vertices[3] = [pos[0] + du[0], pos[1] + du[1], pos[2] + du[2]];
            }

            // Aplicar offset global
            for (let n = 0; n < 4; n++) {
              vertices[n][0] += worldOffset.x;
              vertices[n][1] += worldOffset.y;
              vertices[n][2] += worldOffset.z;
            }

            const normal = [q[0], q[1], q[2]];
            if (cell.backface) {
              normal[0] = -normal[0];
              normal[1] = -normal[1];
              normal[2] = -normal[2];
            }

            const voxelColor = Chunk.VOXEL_COLORS[cell.voxel] || new THREE.Color(0x000000);
            const quadUVs: [number, number][] = [];
            for (let n = 0; n < 4; n++) {
              let uCoord = 0, vCoord = 0;
              const [vx, vy, vz] = vertices[n];
              if (d === 1) {
                uCoord = vx;
                vCoord = vz;
              } else if (d === 0) {
                uCoord = vz;
                vCoord = vy;
              } else if (d === 2) {
                uCoord = vx;
                vCoord = vy;
              }
              quadUVs.push([uCoord, vCoord]);
            }

            for (let n = 0; n < 4; n++) {
              positionsOpaque.push(vertices[n][0], vertices[n][1], vertices[n][2]);
              normalsOpaque.push(normal[0], normal[1], normal[2]);
              colorsOpaque.push(voxelColor.r, voxelColor.g, voxelColor.b);
              uvsOpaque.push(quadUVs[n][0], quadUVs[n][1]);
            }

            indicesOpaque.push(vertexOffsetOpaque, vertexOffsetOpaque + 1, vertexOffsetOpaque + 2);
            indicesOpaque.push(vertexOffsetOpaque, vertexOffsetOpaque + 2, vertexOffsetOpaque + 3);
            vertexOffsetOpaque += 4;

            for (let l = 0; l < h; l++) {
              for (let k = 0; k < w; k++) {
                mask[getMaskIndex(i + k, j + l, dimU)] = null;
              }
            }
            i += w;
          } else {
            i++;
          }
        }
      }
    }
  }

//WATER
const positionsWater: number[] = [];
const indicesWater: number[] = [];
const colorsWater: number[] = [];
const normalsWater: number[] = [];
const uvsWater: number[] = [];
let vertexOffsetWater = 0;

for (let y = 0; y < dims[1]; y++) {
  // Creamos una máscara 2D para X y Z
  // Si mask[x + z*size] == true => hay agua en (x,y,z) y arriba no es agua
  const mask = new Array(this.size * this.size).fill(false);

  // Llenar la máscara
  for (let z = 0; z < this.size; z++) {
    for (let x = 0; x < this.size; x++) {
      const voxel = this.getVoxel(x, y, z);
      const above = (y + 1 < dims[1]) ? this.getVoxel(x, y + 1, z) : VoxelType.AIR;
      if (voxel === VoxelType.WATER && above !== VoxelType.WATER) {
        mask[x + z * this.size] = true;
      }
    }
  }

  // Aplicar Greedy Meshing en la máscara 2D (X,Z)
  let z = 0;
  while (z < this.size) {
    let x = 0;
    while (x < this.size) {
      const idx = x + z * this.size;
      if (mask[idx]) {
        // Encontrar la anchura w
        let w = 1;
        while (x + w < this.size && mask[idx + w]) {
          w++;
        }
        // Encontrar la altura h
        let h = 1;
        outer: for (; z + h < this.size; h++) {
          for (let k = 0; k < w; k++) {
            if (!mask[(x + k) + (z + h) * this.size]) {
              break outer;
            }
          }
        }

        // Tenemos un rectángulo w x h en (x,z)
        // Generamos un quad (x, y+1, z) => (x+w, y+1, z+h)
        const x0 = x;
        const z0 = z;
        const x1 = x + w;
        const z1 = z + h;

        // Construir los 4 vértices
        const quadVerts = [
          new THREE.Vector3(x0, y + 1, z0),
          new THREE.Vector3(x1, y + 1, z0),
          new THREE.Vector3(x1, y + 1, z1),
          new THREE.Vector3(x0, y + 1, z1)
        ];

        // Desplazar a coordenadas globales
        for (let v = 0; v < 4; v++) {
          quadVerts[v].x += this.x * this.size;
          quadVerts[v].z += this.z * this.size;

          positionsWater.push(quadVerts[v].x, quadVerts[v].y, quadVerts[v].z);
          // Normal superior => (0,1,0)
          normalsWater.push(0, 1, 0);

          // Color de agua
          const waterColor = Chunk.VOXEL_COLORS[VoxelType.WATER] || new THREE.Color(0x0000ff);
          colorsWater.push(waterColor.r, waterColor.g, waterColor.b);
        }

        // UVs: se puede mapear en función de w, h, etc.
        // (aquí un ejemplo simple)
        uvsWater.push(0, 0);
        uvsWater.push(w, 0);
        uvsWater.push(w, h);
        uvsWater.push(0, h);

        // Dos triángulos
        indicesWater.push(
          vertexOffsetWater,
          vertexOffsetWater + 1,
          vertexOffsetWater + 2
        );
        indicesWater.push(
          vertexOffsetWater,
          vertexOffsetWater + 2,
          vertexOffsetWater + 3
        );
        vertexOffsetWater += 4;

        // Limpiar la máscara en esa zona
        for (let zz = 0; zz < h; zz++) {
          for (let xx = 0; xx < w; xx++) {
            mask[(x + xx) + (z + zz) * this.size] = false;
          }
        }
        x += w; // Saltamos
      } else {
        x++;
      }
    }
    z++;
  }
}

  // ================================================================
  // COMBINAR GEOMETRÍAS OPACA Y DE AGUA EN UN SOLO BUFFER
  // ================================================================
  const opaqueVertexCount = vertexOffsetOpaque;
  // Ajustar índices del agua
  const indicesWaterAdjusted = indicesWater.map(idx => idx + opaqueVertexCount);

  const positions = positionsOpaque.concat(positionsWater);
  const normals = normalsOpaque.concat(normalsWater);
  const colors = colorsOpaque.concat(colorsWater);
  const uvs = uvsOpaque.concat(uvsWater);
  const indices = indicesOpaque.concat(indicesWaterAdjusted);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3).setUsage(THREE.StaticDrawUsage));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3).setUsage(THREE.StaticDrawUsage));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3).setUsage(THREE.StaticDrawUsage));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2).setUsage(THREE.StaticDrawUsage));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();

  geometry.addGroup(0, indicesOpaque.length, 0);
  geometry.addGroup(indicesOpaque.length, indicesWaterAdjusted.length, 1);

  const opaqueMaterial = new THREE.MeshPhongMaterial({
    vertexColors: true,
    map: Chunk.proceduralTexture,
    side: THREE.FrontSide,
    transparent: false
  });
  if (opaqueMaterial.map) {
    opaqueMaterial.map.wrapS = THREE.RepeatWrapping;
    opaqueMaterial.map.wrapT = THREE.RepeatWrapping;
  }

  const waterMaterial = new THREE.MeshPhongMaterial({
    vertexColors: true,
    map: Chunk.proceduralTexture,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.8
  });
  if (waterMaterial.map) {
    waterMaterial.map.wrapS = THREE.RepeatWrapping;
    waterMaterial.map.wrapT = THREE.RepeatWrapping;
  }

  const mesh = new THREE.Mesh(geometry, [opaqueMaterial, waterMaterial]);
  return mesh;
}

  

  public updateVoxel(localX: number, y: number, localZ: number, newType: VoxelType): void {
    if (
      localX < 0 ||
      localX >= this.size ||
      localZ < 0 ||
      localZ >= this.size ||
      y < 0 ||
      y >= this.terrainData[0].length
    ) {
      return;
    }
    this.terrainData[localX][y][localZ] = newType;
    this.modified = true;
    this.rebuildMesh();
  }

  public rebuildMesh(): void {
    const newMesh = this.createMesh();
    if (this.mesh.material instanceof THREE.Material) {
      this.mesh.material.dispose();
    } else if (Array.isArray(this.mesh.material)) {
      for (const material of this.mesh.material) {
        material.dispose();
      }
    }
    this.mesh.geometry.dispose();

    this.mesh.geometry = newMesh.geometry;
    this.mesh.material = newMesh.material;
    this.mesh.userData.chunk = this;
  }

  public Delete(): void {
    if (this.mesh.material instanceof THREE.Material) {
      this.mesh.material.dispose();
    } else if (Array.isArray(this.mesh.material)) {
      for (const material of this.mesh.material) {
        material.dispose();
      }
    }
    this.mesh.geometry.dispose();
  }
}

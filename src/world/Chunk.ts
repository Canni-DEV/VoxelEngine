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
  private static readonly MOUNTAIN_COLOR = new THREE.Color(0x888888);
  private static readonly SNOW_COLOR = new THREE.Color(0xffffff);
  private static readonly TRUNK_COLOR = new THREE.Color(0x513C29);
  private static readonly LEAVES_COLOR = new THREE.Color(0x116303);

  private static readonly VOXEL_COLORS: { [key: number]: THREE.Color } = {
    [VoxelType.WATER]: Chunk.WATER_COLOR,
    [VoxelType.SAND]: Chunk.SAND_COLOR,
    [VoxelType.GRASS]: Chunk.GRASS_COLOR,
    [VoxelType.DIRT]: Chunk.DIRT_COLOR,
    [VoxelType.MOUNTAIN]: Chunk.MOUNTAIN_COLOR,
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

  /**
   * Retorna el voxel en la posición dada; si está fuera de rango se considera AIR.
   */
  private getVoxel(x: number, y: number, z: number): VoxelType {
    if (x < 0 || x >= this.size || y < 0 || y >= this.terrainData[0].length || z < 0 || z >= this.size) {
      return VoxelType.AIR;
    }
    return this.terrainData[x][y][z];
  }

  /**
   * Crea la malla del chunk aplicando greedy meshing.
   *
   * Se recorre cada eje (d = 0: X, d = 1: Y, d = 2: Z). Para cada slice se construye una máscara 2D
   * comparando el voxel actual (voxelA) y su vecino en la dirección opuesta (voxelB).
   * Se marca la celda cuando una cara está expuesta, se fusionan áreas contiguas y se generan
   * los buffers de vértices, índices, normales, colores y UV. Los UV se calculan en función del tamaño
   * del quad y se ajusta su orden para ciertas caras laterales.
   *
   * **Corrección en eje Y:** Para la capa inferior (y==0) se fuerza que la cara se genere como front face,
   * para que la normal quede apuntando hacia arriba y se ilumine.
   */
  private createMesh(): THREE.Mesh {
    const positions: number[] = [];
    const indices: number[] = [];
    const colors: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const waterFlags: number[] = [];

    const dims = [this.size, this.terrainData[0].length, this.size];
    const worldOffset = new THREE.Vector3(this.x * this.size, 0, this.z * this.size);
    let vertexOffset = 0;

    // Iterar sobre cada eje (0: X, 1: Y, 2: Z)
    for (let d = 0; d < 3; d++) {
      const u = (d + 1) % 3;
      const v = (d + 2) % 3;
      const dimU = dims[u];
      const dimV = dims[v];

      const x = [0, 0, 0];
      const q = [0, 0, 0];
      q[d] = 1;

      for (x[d] = 0; x[d] <= dims[d]; x[d]++) {
        // Crear máscara 2D para la slice actual
        const mask: (null | { voxel: VoxelType; backface: boolean })[] =
          new Array(dimU * dimV).fill(null);

        for (let j = 0; j < dimV; j++) {
          for (let i = 0; i < dimU; i++) {
            x[u] = i;
            x[v] = j;

            const voxelA = (x[d] < dims[d])
              ? this.getVoxel(x[0], x[1], x[2])
              : VoxelType.AIR;
            let voxelB: VoxelType;
            if (x[d] > 0) {
              const pos = [x[0] - q[0], x[1] - q[1], x[2] - q[2]];
              voxelB = this.getVoxel(pos[0], pos[1], pos[2]);
            } else {
              voxelB = VoxelType.AIR;
            }

            let maskValue: null | { voxel: VoxelType; backface: boolean } = null;
            if (voxelA !== VoxelType.AIR && voxelB === VoxelType.AIR) {
              // En eje Y: para la capa inferior forzamos front face
              maskValue = (d === 1 && x[1] === 0)
                ? { voxel: voxelA, backface: false }
                : { voxel: voxelA, backface: true };
            } else if (voxelA === VoxelType.AIR && voxelB !== VoxelType.AIR) {
              maskValue = { voxel: voxelB, backface: false };
            }
            mask[i + j * dimU] = maskValue;
          }
        }

        // Greedy meshing sobre la máscara 2D
        for (let j = 0; j < dimV; j++) {
          for (let i = 0; i < dimU;) {
            const idx = i + j * dimU;
            const cell = mask[idx];
            if (cell) {
              let w = 1;
              while (
                i + w < dimU &&
                mask[idx + w] &&
                mask[idx + w]!.voxel === cell.voxel &&
                mask[idx + w]!.backface === cell.backface
              ) { w++; }
              let h = 1;
              outer: for (; j + h < dimV; h++) {
                for (let k = 0; k < w; k++) {
                  const nextCell = mask[i + k + (j + h) * dimU];
                  if (!nextCell || nextCell.voxel !== cell.voxel || nextCell.backface !== cell.backface) {
                    break outer;
                  }
                }
              }

              x[u] = i;
              x[v] = j;
              const pos = [x[0], x[1], x[2]];

              const du = [0, 0, 0];
              const dv = [0, 0, 0];
              du[u] = w;
              dv[v] = h;

              // Generar los 4 vértices del quad
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
              const isWater = cell.voxel === VoxelType.WATER ? 1.0 : 0.0;

              // Calcular UV basadas en la posición de cada vértice en el plano de la cara.
              // Esto asegura que cada voxel se texturice con un tile de 1x1 independientemente de la fusión.
              const quadUVs: [number, number][] = [];
              for (let n = 0; n < 4; n++) {
                const vx = vertices[n][0];
                const vy = vertices[n][1];
                const vz = vertices[n][2];
                let uCoord = 0, vCoord = 0;
                if (d === 1) {
                  // Para caras horizontales, usar X y Z
                  uCoord = vx;
                  vCoord = vz;
                } else if (d === 0) {
                  // Cara en X: usar Z y Y
                  uCoord = vz;
                  vCoord = vy;
                } else if (d === 2) {
                  // Cara en Z: usar X y Y
                  uCoord = vx;
                  vCoord = vy;
                }
                quadUVs.push([uCoord, vCoord]);
              }

              // Añadir atributos para cada vértice
              for (let n = 0; n < 4; n++) {
                positions.push(vertices[n][0], vertices[n][1], vertices[n][2]);
                normals.push(normal[0], normal[1], normal[2]);
                colors.push(voxelColor.r, voxelColor.g, voxelColor.b);
                uvs.push(quadUVs[n][0], quadUVs[n][1]);
                waterFlags.push(isWater);
              }

              indices.push(vertexOffset, vertexOffset + 1, vertexOffset + 2);
              indices.push(vertexOffset, vertexOffset + 2, vertexOffset + 3);
              vertexOffset += 4;

              for (let l = 0; l < h; l++) {
                for (let k = 0; k < w; k++) {
                  mask[i + k + (j + l) * dimU] = null;
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

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute('isWater', new THREE.Float32BufferAttribute(waterFlags, 1));
    geometry.setIndex(indices);

    const material = new THREE.MeshPhongMaterial({
      vertexColors: true,
      map: Chunk.proceduralTexture,
      side: THREE.FrontSide,
      transparent: true
    });
    // Asegúrate de que el mapa tenga wrap en ambos ejes para repetir la textura
    if (material.map) {
      material.map.wrapS = THREE.RepeatWrapping;
      material.map.wrapT = THREE.RepeatWrapping;
    }

    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0.0 };

      shader.vertexShader = `
        uniform float uTime;
        attribute float isWater;
        varying float vIsWater;
      ` + shader.vertexShader;

      shader.vertexShader = shader.vertexShader.replace(
        '#include <uv_vertex>',
        `#include <uv_vertex>
         if(isWater > 0.5) {
           vec4 worldPos = modelMatrix * vec4( position, 1.0 );
           vUv = worldPos.xz * 0.1;
         }`
      );

      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         if(isWater > 0.5) {
           vec4 worldPos = modelMatrix * vec4( position, 1.0 );
           transformed.y += sin(worldPos.x * 0.1 + uTime * 3.0) * 0.1;
         }`
      );

      shader.vertexShader = shader.vertexShader.replace(
        '#include <color_vertex>',
        `#include <color_vertex>
         vIsWater = isWater;
         `
      );

      shader.fragmentShader = `
        uniform float uTime;
        varying float vIsWater;
      ` + shader.fragmentShader;

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
         if(vIsWater > 0.5){
           gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.0, 0.5, 1.0), 0.1);
         }`
      );

      (material as any).userData.shader = shader;
    };

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
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

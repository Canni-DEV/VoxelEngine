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

  // Definición de las caras (cada cara tiene una dirección y 4 vértices locales)
  private static readonly FACE_DEFINITIONS = [
    // Izquierda (x = 0)
    {
      dir: [-1, 0, 0],
      vertices: [
        [0, 0, 1],
        [0, 1, 1],
        [0, 1, 0],
        [0, 0, 0]
      ]
    },
    // Derecha (x = 1)
    {
      dir: [1, 0, 0],
      vertices: [
        [1, 0, 0],
        [1, 1, 0],
        [1, 1, 1],
        [1, 0, 1]
      ]
    },
    // Inferior (y = 0)
    {
      dir: [0, -1, 0],
      vertices: [
        [0, 0, 0],
        [1, 0, 0],
        [1, 0, 1],
        [0, 0, 1]
      ]
    },
    // Superior (y = 1)
    {
      dir: [0, 1, 0],
      vertices: [
        [0, 1, 1],
        [1, 1, 1],
        [1, 1, 0],
        [0, 1, 0]
      ]
    },
    // Trasera (z = 0)
    {
      dir: [0, 0, -1],
      vertices: [
        [0, 0, 0],
        [0, 1, 0],
        [1, 1, 0],
        [1, 0, 0]
      ]
    },
    // Frontal (z = 1)
    {
      dir: [0, 0, 1],
      vertices: [
        [1, 0, 1],
        [1, 1, 1],
        [0, 1, 1],
        [0, 0, 1]
      ]
    }
  ];

  // Colores predefinidos para cada tipo de voxel
  private static readonly WATER_COLOR = new THREE.Color(0x3399ff);
  private static readonly SAND_COLOR = new THREE.Color(0xC2B280);
  private static readonly GRASS_COLOR = new THREE.Color(0x00cc00);
  private static readonly DIRT_COLOR = new THREE.Color(0x8B4513);
  private static readonly MOUNTAIN_COLOR = new THREE.Color(0x888888);
  private static readonly SNOW_COLOR = new THREE.Color(0xffffff);
  private static readonly TRUNK_COLOR = new THREE.Color(0x513C29);
  private static readonly LEAVES_COLOR = new THREE.Color(0x116303);

  // Lookup para obtener el color según el tipo de voxel.
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
    // Se genera y cachea el terrainData
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
      const factor = 0.8 + Math.random() * 0.2; // Brillo entre 0.8 y 1.0
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

  private createMesh(): THREE.Mesh {
    const positions: number[] = [];
    const indices: number[] = [];
    const colors: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const waterFlags: number[] = []; // 1.0 si el voxel es WATER, 0.0 en caso contrario.

    let vertexOffset = 0;

    // Caché de variables
    const size = this.size;
    const terrain = this.terrainData;
    const maxHeight = terrain[0].length;
    const worldOffsetX = this.x * size;
    const worldOffsetZ = this.z * size;

    // UV fija para cada cara (se mapea la textura completa)
    const faceUVs = [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 0]
    ];

    // Recorremos cada posición en la matriz 3D.
    for (let i = 0; i < size; i++) {
      for (let j = 0; j < maxHeight; j++) {
        const column = terrain[i][j];
        for (let k = 0; k < size; k++) {
          const voxel = column[k];
          if (voxel === VoxelType.AIR) continue; // No renderizamos aire

          // Para cada bloque, iteramos sobre sus caras
          for (let f = 0; f < Chunk.FACE_DEFINITIONS.length; f++) {
            const face = Chunk.FACE_DEFINITIONS[f];
            const ni = i + face.dir[0];
            const nj = j + face.dir[1];
            const nk = k + face.dir[2];

            // Si el vecino está fuera de rango o es aire, renderizamos esta cara.
            if (
              ni < 0 || ni >= size ||
              nj < 0 || nj >= maxHeight ||
              nk < 0 || nk >= size ||
              terrain[ni][nj][nk] === VoxelType.AIR
            ) {
              // Se obtiene el color del voxel a través del lookup.
              const color = Chunk.VOXEL_COLORS[voxel] || new THREE.Color(0x000000);

              for (let v = 0; v < 4; v++) {
                const vertex = face.vertices[v];
                // Posición global
                positions.push(
                  vertex[0] + i + worldOffsetX,
                  vertex[1] + j,
                  vertex[2] + k + worldOffsetZ
                );
                // Normal fija (ya es un vector unitario)
                normals.push(face.dir[0], face.dir[1], face.dir[2]);
                // Color obtenido
                colors.push(color.r, color.g, color.b);
                // Coordenadas UV
                uvs.push(faceUVs[v][0], faceUVs[v][1]);
                // Bandera para agua
                waterFlags.push(voxel === VoxelType.WATER ? 1.0 : 0.0);
              }

              // Índices para formar dos triángulos
              indices.push(vertexOffset, vertexOffset + 1, vertexOffset + 2);
              indices.push(vertexOffset, vertexOffset + 2, vertexOffset + 3);
              vertexOffset += 4;
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
      flatShading: true,
      transparent: true // Permitir transparencia
    });

    // Inyectamos código en el shader solo para voxeles de agua.
    material.onBeforeCompile = (shader) => {
      // Añadimos el uniform para el tiempo.
      shader.uniforms.uTime = { value: 0.0 };

      // Inyectamos en el fragment shader las declaraciones necesarias.
      shader.fragmentShader = `uniform float uTime;
varying float vIsWater;
` + shader.fragmentShader;

      // Reemplazamos el código de dithering para inyectar el efecto de agua.
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
if (vIsWater > 0.5) {
  float wave = 0.1 * sin(uTime * 50.0 + vUv.y * 10.0);
  gl_FragColor.a = 0.5 + wave;
  gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.0, 0.5, 1.0), 0.5);
}
`
      );

      // Inyección en el vertex shader para pasar el atributo isWater.
      shader.vertexShader = `attribute float isWater;
varying float vIsWater;
` + shader.vertexShader;
      
      shader.vertexShader = shader.vertexShader.replace(
        '#include <color_vertex>',
        `#include <color_vertex>
vIsWater = isWater;
`
      );

      // Guardamos el shader en userData para actualizar uTime en el render loop.
      (material as any).userData.shader = shader;
    };

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  public updateVoxel(localX: number, y: number, localZ: number, newType: VoxelType): void {
    if (
      localX < 0 || localX >= this.size ||
      localZ < 0 || localZ >= this.size ||
      y < 0 || y >= this.terrainData[0].length
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

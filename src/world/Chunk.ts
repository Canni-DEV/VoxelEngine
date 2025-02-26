import * as THREE from 'three';
import { TerrainGenerator, VoxelType } from './TerrainGenerator';

export class Chunk {
  public x: number;
  public z: number;
  public size: number;
  public mesh: THREE.Mesh;
  public terrainData: VoxelType[][][];
  public modified: boolean = false;    // Marca si el chunk ha sido editado

  // Se genera la textura procedural una sola vez y se reutiliza en todos los chunks.
  public static proceduralTexture: THREE.CanvasTexture = Chunk.generateProceduralTexture();

  // Definición de las caras (cada cara tiene una dirección y 4 vértices locales)
  private static FACE_DEFINITIONS = [
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

  // Colores base para cada tipo de voxel
  private static WATER_COLOR = new THREE.Color(0x3399ff);
  private static SAND_COLOR = new THREE.Color(0xC2B280);
  private static GRASS_COLOR = new THREE.Color(0x00cc00);
  private static DIRT_COLOR = new THREE.Color(0x8B4513);
  private static MOUNTAIN_COLOR = new THREE.Color(0x888888);
  private static SNOW_COLOR = new THREE.Color(0xffffff);
  private static TRUNK_COLOR = new THREE.Color(0x513C29);
  private static LEAVES_COLOR = new THREE.Color(0x116303);

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

    for (let y = 0; y < texSize; y++) {
      for (let x = 0; x < texSize; x++) {
        const index = (y * texSize + x) * 4;
        const factor = 0.8 + Math.random() * 0.2; // Brillo entre 0.8 y 1.0
        const value = Math.floor(255 * factor);
        imageData.data[index] = value;
        imageData.data[index + 1] = value;
        imageData.data[index + 2] = value;
        imageData.data[index + 3] = 255;
      }
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

    // Cacheo del alto máximo (número de niveles en Y) y offsets de posición del chunk.
    const maxHeight = this.terrainData[0].length;
    const worldOffsetX = this.x * this.size;
    const worldOffsetZ = this.z * this.size;

    // UV fija para cada cara (se mapea la textura completa)
    const faceUVs = [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 0]
    ];

    // Recorremos cada posición en la matriz 3D.
    for (let i = 0; i < this.size; i++) {
      for (let j = 0; j < maxHeight; j++) {
        for (let k = 0; k < this.size; k++) {
          const voxel = this.terrainData[i][j][k];
          if (voxel === VoxelType.AIR) continue; // No renderizamos aire

          // Para cada bloque, iteramos sobre sus caras
          for (const face of Chunk.FACE_DEFINITIONS) {
            const ni = i + face.dir[0];
            const nj = j + face.dir[1];
            const nk = k + face.dir[2];

            // Si el vecino está fuera de rango o es aire, renderizamos esta cara.
            if (
              ni < 0 || ni >= this.size ||
              nj < 0 || nj >= maxHeight ||
              nk < 0 || nk >= this.size ||
              this.terrainData[ni][nj][nk] === VoxelType.AIR
            ) {
              // Obtenemos el color según el tipo de voxel
              const color = this.getColorFromVoxel(voxel, face.dir);

              for (let v = 0; v < face.vertices.length; v++) {
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
    // Nuevo atributo para identificar vértices de agua.
    geometry.setAttribute('isWater', new THREE.Float32BufferAttribute(waterFlags, 1));
    geometry.setIndex(indices);
    // No llamamos a computeVertexNormals() porque asignamos las normales manualmente.

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
      shader.fragmentShader = `
        uniform float uTime;
        varying float vIsWater;
      ` + shader.fragmentShader;
    
      // Reemplazamos la inclusión del código de dithering para inyectar nuestro efecto.
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <dithering_fragment>',
        `#include <dithering_fragment>
         if (vIsWater > 0.5) {
           // Efecto de olas: modula ligeramente la transparencia según el tiempo y la coordenada vUv.y.
           float wave = 0.1 * sin(uTime * 50.0 + vUv.y * 10.0);
           gl_FragColor.a = 0.5 + wave;
           // Mezcla el color actual con un azul deseado para el agua.
           gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.0, 0.5, 1.0), 0.5);
         }
        `
      );
    
      // En el vertex shader, inyectamos nuestro atributo isWater y lo pasamos como varying.
      shader.vertexShader = `
        attribute float isWater;
        varying float vIsWater;
      ` + shader.vertexShader;
      
      shader.vertexShader = shader.vertexShader.replace(
        '#include <color_vertex>',
        `#include <color_vertex>
         vIsWater = isWater;
        `
      );
    
      // Guardamos el shader en userData para poder actualizar uTime en el render loop.
      (material as any).userData.shader = shader;
    };

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  private getColorFromVoxel(voxel: VoxelType, faceDir: number[]): THREE.Color {
    switch (voxel) {
      case VoxelType.WATER:
        return Chunk.WATER_COLOR;
      case VoxelType.SAND:
        return Chunk.SAND_COLOR;
      case VoxelType.GRASS:
        return Chunk.GRASS_COLOR;
      case VoxelType.DIRT:
        return Chunk.DIRT_COLOR;
      case VoxelType.MOUNTAIN:
        return Chunk.MOUNTAIN_COLOR;
      case VoxelType.SNOW:
        return Chunk.SNOW_COLOR;
      case VoxelType.TRUNK:
        return Chunk.TRUNK_COLOR;
      case VoxelType.LEAVES:
        return Chunk.LEAVES_COLOR;
      default:
        return new THREE.Color(0x000000);
    }
  }

  /**
  * Permite actualizar (modificar) el voxel en la posición local (x, y, z)
  * y reconstruir la malla del chunk.
  */
  public updateVoxel(localX: number, y: number, localZ: number, newType: VoxelType): void {
    if (localX < 0 || localX >= this.size || localZ < 0 || localZ >= this.size || y < 0 || y >= this.terrainData[0].length) {
      return;
    }
    this.terrainData[localX][y][localZ] = newType;
    this.modified = true;
    this.rebuildMesh();
  }

  /**
   * Reconstruye la malla del chunk a partir de los datos actuales.
   */
  public rebuildMesh(): void {
    // Se crea una nueva geometría y material a partir de los datos actuales,
    // utilizando el mismo método que se usa para construir el mesh inicialmente.
    const newMesh = this.createMesh();
    // Liberamos la memoria ocupada por la geometría y material antiguos.
    if (this.mesh.material instanceof THREE.Material) {
      this.mesh.material.dispose()
    } else if (Array.isArray(this.mesh.material)) {
      for (const material of this.mesh.material) {
        material.dispose()
      }
    }
    this.mesh.geometry.dispose();

    // Actualizamos la geometría y material del mesh existente (in-place).
    // Esto es importante para que el mesh referenciado en la escena siga siendo el mismo objeto,
    // evitando tener que removerlo y agregarlo de nuevo, lo que puede afectar a otras referencias (por ejemplo, en el raycaster).
    this.mesh.geometry = newMesh.geometry;
    this.mesh.material = newMesh.material;
    this.mesh.userData.chunk = this;
  }

  public Delete(): void {
    if (this.mesh.material instanceof THREE.Material) {
      this.mesh.material.dispose()
    } else if (Array.isArray(this.mesh.material)) {
      for (const material of this.mesh.material) {
        material.dispose()
      }
    }
    this.mesh.geometry.dispose();
  }
}

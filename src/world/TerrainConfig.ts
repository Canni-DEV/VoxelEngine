export interface TerrainConfig {
  maxHeight?: number;
  seaLevel?: number;
  baseFrequency?: number;
  baseAmplitude?: number;
  mountainFrequency?: number;
  mountainThreshold?: number;
  mountainAmplitude?: number;
  oceanFrequency?: number;
  oceanThreshold?: number;
  oceanAmplitude?: number;
  detailFrequency?: number;
  detailAmplitude?: number;
  tempFrequency?: number;
  rainFrequency?: number;
  rainAmplitude?: number;
  treeFrequency?: number;
  caveCount?: number;
  minCaveLength?: number;
  maxCaveLength?: number;
  baseCaveRadius?: number;
  octaves?: number;
  persistence?: number;
  lacunarity?: number;
  oceanFloorHeight?: number;
  prairieMaxHeight?: number;
}

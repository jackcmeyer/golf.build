import type { VoxelWorld } from './VoxelWorld'
import { VoxelType } from '../voxelTypes'
import { CHUNK_HEIGHT } from './constants'
import { initWorld } from './worldInit'

// ── Noise ─────────────────────────────────────────────────────────────────────

function hashf(a: number, b: number, seed: number): number {
  let h = ((a * 1619 + b * 31337 + seed * 6971) | 0) >>> 0
  h = ((h ^ (h >>> 16)) * 0x45d9f3b) >>> 0
  h = ((h ^ (h >>> 16)) * 0x45d9f3b) >>> 0
  h = (h ^ (h >>> 16)) >>> 0
  return h / 0xffffffff
}

function smoothNoise(x: number, z: number, seed: number): number {
  const ix = Math.floor(x)
  const iz = Math.floor(z)
  const fx = x - ix
  const fz = z - iz
  const ux = fx * fx * (3 - 2 * fx)
  const uz = fz * fz * (3 - 2 * fz)
  const a = hashf(ix, iz, seed)
  const b = hashf(ix + 1, iz, seed)
  const c = hashf(ix, iz + 1, seed)
  const d = hashf(ix + 1, iz + 1, seed)
  return a * (1 - ux) * (1 - uz) + b * ux * (1 - uz) + c * (1 - ux) * uz + d * ux * uz
}

function fbm(x: number, z: number, seed: number, octaves: number): number {
  let v = 0
  let amp = 1
  let freq = 1
  let total = 0
  for (let i = 0; i < octaves; i++) {
    v += smoothNoise(x * freq, z * freq, seed + i * 97) * amp
    total += amp
    amp *= 0.5
    freq *= 2
  }
  return v / total
}

// ── Preset configs ────────────────────────────────────────────────────────────

interface PresetConfig {
  seed: number
  heightScale: number // multiplier on fbm height
  baseHeight: number // min height
  octaves: number
  surfaceFn: (nx: number, nz: number, h: number, noise: number) => VoxelType
}

const PARKLAND: PresetConfig = {
  seed: 42,
  heightScale: 5,
  baseHeight: 2,
  octaves: 4,
  surfaceFn: (nx, nz, _h, noise) => {
    const fairwayBias = Math.max(0, (nz + 0.1) * 0.2)
    const fairwayW = 0.12 + Math.abs(nz) * 0.02
    if (Math.abs(nx - fairwayBias) < fairwayW && nz > -0.38 && nz < 0.28)
      return VoxelType.FAIRWAY_GRASS
    if (nz > 0.22 && nz < 0.36 && Math.abs(nx) < 0.08) return VoxelType.GREEN_GRASS
    if (nz < -0.32 && nz > -0.42 && Math.abs(nx) < 0.06) return VoxelType.TEE_GRASS
    if (nz > 0.06 && nz < 0.22 && nx > -0.3 && nx < -0.14 && noise > 0.45)
      return VoxelType.STILL_WATER
    if (Math.abs(nx - fairwayBias) < fairwayW + 0.08 && nz > -0.4 && nz < 0.3)
      return VoxelType.INTERMEDIATE_ROUGH
    return noise > 0.6 ? VoxelType.DEEP_ROUGH : VoxelType.PRIMARY_ROUGH
  },
}

const LINKS: PresetConfig = {
  seed: 137,
  heightScale: 3,
  baseHeight: 1,
  octaves: 5,
  surfaceFn: (nx, nz, _h, noise) => {
    const fairwayW = 0.1 + Math.abs(nz) * 0.015
    if (Math.abs(nx) < fairwayW && nz > -0.38 && nz < 0.28) return VoxelType.FAIRWAY_GRASS
    if (nz > 0.22 && nz < 0.36 && Math.abs(nx) < 0.07) return VoxelType.GREEN_GRASS
    if (nz < -0.32 && nz > -0.42 && Math.abs(nx) < 0.06) return VoxelType.TEE_GRASS
    if (Math.abs(nx) > 0.38 || nz < -0.44 || nz > 0.42) return VoxelType.HEATHER
    if (noise > 0.58) return VoxelType.FESCUE
    if (Math.abs(nx) < fairwayW + 0.08 && nz > -0.4 && nz < 0.3) return VoxelType.INTERMEDIATE_ROUGH
    return VoxelType.PRIMARY_ROUGH
  },
}

const MOUNTAIN: PresetConfig = {
  seed: 251,
  heightScale: 10,
  baseHeight: 2,
  octaves: 6,
  surfaceFn: (nx, nz, h, noise) => {
    const fairwayW = 0.09 + Math.abs(nz) * 0.015
    if (Math.abs(nx) < fairwayW && nz > -0.38 && nz < 0.28) return VoxelType.FAIRWAY_GRASS
    if (nz > 0.22 && nz < 0.36 && Math.abs(nx) < 0.07) return VoxelType.GREEN_GRASS
    if (nz < -0.32 && nz > -0.42 && Math.abs(nx) < 0.06) return VoxelType.TEE_GRASS
    if (h > 8 || noise > 0.7) return VoxelType.ROCK_OUTCROP
    if (Math.abs(nx) < fairwayW + 0.07) return VoxelType.INTERMEDIATE_ROUGH
    return noise > 0.5 ? VoxelType.DEEP_ROUGH : VoxelType.PRIMARY_ROUGH
  },
}

const DESERT: PresetConfig = {
  seed: 88,
  heightScale: 2,
  baseHeight: 1,
  octaves: 3,
  surfaceFn: (nx, nz, _h, noise) => {
    const fairwayW = 0.11
    if (Math.abs(nx) < fairwayW && nz > -0.38 && nz < 0.28) return VoxelType.FAIRWAY_GRASS
    if (nz > 0.22 && nz < 0.36 && Math.abs(nx) < 0.07) return VoxelType.GREEN_GRASS
    if (nz < -0.32 && nz > -0.42 && Math.abs(nx) < 0.06) return VoxelType.TEE_GRASS
    if (noise > 0.65) return VoxelType.BUNKER_SAND_WHITE
    if (noise > 0.45) return VoxelType.WASTE_AREA
    return VoxelType.BARE_SOIL
  },
}

// ── Generators ────────────────────────────────────────────────────────────────

function applyPreset(world: VoxelWorld, cfg: PresetConfig) {
  const W = world.widthInVoxels
  const D = world.depthInVoxels
  for (let wx = 0; wx < W; wx++) {
    for (let wz = 0; wz < D; wz++) {
      const nx = wx / W - 0.5
      const nz = wz / D - 0.5
      const noise = fbm(wx / 40, wz / 40, cfg.seed, cfg.octaves)
      const h = Math.max(
        1,
        Math.min(CHUNK_HEIGHT - 2, Math.round(noise * cfg.heightScale + cfg.baseHeight)),
      )
      const type = cfg.surfaceFn(nx, nz, h, noise)
      const fillType = type === VoxelType.STILL_WATER ? VoxelType.STILL_WATER : VoxelType.BARE_SOIL
      for (let wy = 0; wy < (type === VoxelType.STILL_WATER ? 2 : h); wy++) {
        world.setVoxel(wx, wy, wz, fillType)
      }
      world.setVoxel(wx, type === VoxelType.STILL_WATER ? 2 : h, wz, type)
    }
  }
}

export function initBlankCanvas(world: VoxelWorld) {
  const W = world.widthInVoxels
  const D = world.depthInVoxels
  for (let wx = 0; wx < W; wx++) {
    for (let wz = 0; wz < D; wz++) {
      world.setVoxel(wx, 0, wz, VoxelType.BARE_SOIL)
      world.setVoxel(wx, 1, wz, VoxelType.FAIRWAY_GRASS)
    }
  }
}

export type TerrainPreset = 'default' | 'blank' | 'parkland' | 'links' | 'mountain' | 'desert'

export function initTerrain(world: VoxelWorld, preset: TerrainPreset) {
  switch (preset) {
    case 'blank':
      return initBlankCanvas(world)
    case 'parkland':
      return applyPreset(world, PARKLAND)
    case 'links':
      return applyPreset(world, LINKS)
    case 'mountain':
      return applyPreset(world, MOUNTAIN)
    case 'desert':
      return applyPreset(world, DESERT)
    default:
      return initWorld(world)
  }
}

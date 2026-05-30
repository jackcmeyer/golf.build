import { VoxelWorld } from './VoxelWorld'
import { VoxelType } from '../voxelTypes'
import { ObjectType } from './objectTypes'
import { VOXEL_SIZE, VOXEL_HEIGHT } from './constants'

export interface DefaultObjectPlacement {
  type: ObjectType
  x: number
  y: number
  z: number
}

// ── Layout constants (voxel coords, world = 224×224, center = 112,112) ────────

const CX = 112 // center x

// Straight par 4, ~350 yards (320m). Tee is south (high wz, close to camera).
// Green is north (low wz, far from camera — appears at top of default view).
const TEE_Z = 190 // tee center wz
const GREEN_Z = 30 // green center wz
const STREAM_Z = 76 // stream center wz (~100 yards from green)

const FW = 9 // fairway half-width in voxels (18m each side → 36m total)
const IR = 16 // intermediate-rough half-width

const CP_L = CX + FW + 1 // cart path left edge (wx = 122, right side of fairway)
const CP_R = CX + FW + 2 // cart path right edge (wx = 123, 2 voxels = 4m wide)

// ── Surface type ──────────────────────────────────────────────────────────────

function surfaceTypeAt(wx: number, wz: number): VoxelType {
  const adx = Math.abs(wx - CX)

  // Green (circular, ~18m diameter)
  if (Math.hypot(wx - CX, wz - GREEN_Z) < 9) return VoxelType.GREEN_GRASS

  // Bunkers flanking green
  if (wz > GREEN_Z - 2 && wz < GREEN_Z + 8) {
    if (wx > CX + 10 && wx < CX + 16) return VoxelType.BUNKER_SAND_WHITE
    if (wx < CX - 10 && wx > CX - 16) return VoxelType.BUNKER_SAND_WHITE
  }

  // Tee box
  if (wz > TEE_Z - 4 && wz <= TEE_Z + 2 && adx < 5) return VoxelType.TEE_GRASS

  // Stream (crosses hole width at ~100 yards from green, 8m wide)
  if (wz >= STREAM_Z - 2 && wz <= STREAM_Z + 2 && wx > 50 && wx < 175) {
    return VoxelType.STILL_WATER
  }

  // Cart path (right side, runs full hole length)
  if (wx >= CP_L && wx <= CP_R && wz >= GREEN_Z && wz <= TEE_Z + 2) {
    return VoxelType.CART_PATH_CONCRETE
  }

  // Fairway
  if (adx < FW && wz > GREEN_Z && wz < TEE_Z) return VoxelType.FAIRWAY_GRASS

  // Intermediate rough bordering fairway
  if (adx < IR && wz > GREEN_Z - 6 && wz < TEE_Z + 6) return VoxelType.INTERMEDIATE_ROUGH

  // Heather at far outer edges
  if (adx > 68 || wz < 8 || wz > 214) return VoxelType.HEATHER

  return VoxelType.PRIMARY_ROUGH
}

// ── Height ────────────────────────────────────────────────────────────────────

function heightAt(wx: number, wz: number): number {
  const nx = (wx - CX) / 112
  const nz = (wz - CX) / 112

  // Gentle rolling base (affects rough/heather most)
  const base =
    Math.sin(nx * Math.PI * 3.1) * 1.6 +
    Math.cos(nz * Math.PI * 2.7) * 1.3 +
    Math.sin((nx + nz) * Math.PI * 2.0) * 0.9 +
    Math.cos((nx - nz) * Math.PI * 1.5) * 0.7 +
    4

  // Raised tee platform
  const teeLift = Math.max(0, 1 - Math.hypot((wx - CX) / 8, (wz - TEE_Z) / 8))
  // Raised green plateau
  const greenLift = Math.max(0, 1 - Math.hypot((wx - CX) / 12, (wz - GREEN_Z) / 12))

  return Math.max(1, Math.round(base + teeLift * 4 + greenLift * 3))
}

// ── World init ────────────────────────────────────────────────────────────────

export function initWorld(world: VoxelWorld): void {
  const { widthInVoxels: W, depthInVoxels: D } = world

  for (let wx = 0; wx < W; wx++) {
    for (let wz = 0; wz < D; wz++) {
      const type = surfaceTypeAt(wx, wz)

      let h: number
      if (type === VoxelType.STILL_WATER) {
        h = 2
      } else if (type === VoxelType.BUNKER_SAND_WHITE) {
        h = Math.max(1, heightAt(wx, wz) - 1)
      } else if (type === VoxelType.TEE_GRASS) {
        h = 8
      } else {
        h = heightAt(wx, wz)
      }

      const fill = type === VoxelType.STILL_WATER ? VoxelType.STILL_WATER : VoxelType.BARE_SOIL
      for (let wy = 0; wy < h; wy++) world.setVoxel(wx, wy, wz, fill)
      world.setVoxel(wx, h, wz, type)
    }
  }
}

// ── Default object placements ─────────────────────────────────────────────────

export function getDefaultObjectPlacements(world: VoxelWorld): DefaultObjectPlacement[] {
  const halfW = world.widthInVoxels / 2
  const halfD = world.depthInVoxels / 2

  function at(wx: number, wz: number, type: ObjectType): DefaultObjectPlacement {
    const h = world.getSurfaceHeight(wx, wz)
    const y = (h >= 0 ? h + 1 : 1) * VOXEL_HEIGHT
    return { type, x: (wx - halfW) * VOXEL_SIZE, y, z: (wz - halfD) * VOXEL_SIZE }
  }

  // Tree positions along the fairway, alternating oak/pine, skipping stream zone
  // placed at the rough edge (CX ± IR = 96/128), every ~8 voxels (16m)
  const treeRows: [number, number, number, ObjectType][] = [
    // [leftWx, rightWx, wz, type]
    // before stream (start at wz=60 to clear the greenside bunkers visually)
    [94, 130, 60, ObjectType.PINE_CONIFER],
    [96, 128, 68, ObjectType.OAK_FULL],
    // gap for stream at wz=76
    // after stream
    [96, 128, 84, ObjectType.PINE_CONIFER],
    [94, 130, 92, ObjectType.OAK_FULL],
    [95, 129, 100, ObjectType.PINE_CONIFER],
    [96, 128, 108, ObjectType.OAK_FULL],
    [94, 130, 116, ObjectType.PINE_CONIFER],
    [95, 129, 124, ObjectType.OAK_FULL],
    [96, 128, 132, ObjectType.PINE_CONIFER],
    [94, 130, 140, ObjectType.OAK_FULL],
    [95, 129, 148, ObjectType.PINE_CONIFER],
    [96, 128, 156, ObjectType.OAK_FULL],
    [94, 130, 164, ObjectType.PINE_CONIFER],
    [95, 129, 172, ObjectType.OAK_FULL],
    [96, 128, 180, ObjectType.PINE_CONIFER],
  ]

  const placements: DefaultObjectPlacement[] = [
    at(CX, GREEN_Z + 4, ObjectType.FLAGSTICK_CUP),
    at(CX - 3, TEE_Z - 1, ObjectType.TEE_MARKER_RED),
    at(CX + 3, TEE_Z - 1, ObjectType.TEE_MARKER_WHITE),
    at(CP_L + 1, 110, ObjectType.GOLF_CART),
  ]

  for (const [lx, rx, wz, type] of treeRows) {
    placements.push(at(lx, wz, type))
    placements.push(
      at(rx, wz, type === ObjectType.OAK_FULL ? ObjectType.PINE_CONIFER : ObjectType.OAK_FULL),
    )
  }

  return placements
}

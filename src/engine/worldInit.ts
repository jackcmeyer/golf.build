import { VoxelWorld } from './VoxelWorld'
import { VoxelType } from '../voxelTypes'

function heightAt(wx: number, wz: number, W: number, D: number): number {
  const nx = wx / W
  const nz = wz / D
  const h =
    Math.sin(nx * Math.PI * 4.1) * 1.4 +
    Math.cos(nz * Math.PI * 3.7) * 1.2 +
    Math.sin((nx + nz) * Math.PI * 2.3) * 0.9 +
    Math.cos((nx - nz) * Math.PI * 1.8) * 0.7 +
    3
  return Math.max(1, Math.round(h))
}

function surfaceTypeAt(wx: number, wz: number, W: number, D: number): VoxelType {
  const hx = wx / W - 0.5
  const hz = wz / D - 0.5

  // Green
  if (hz >= 0.22 && hz <= 0.38 && Math.abs(hx) < 0.07) return VoxelType.GREEN_GRASS

  // Bunkers flanking green
  if (hz >= 0.2 && hz <= 0.38 && hx >= 0.07 && hx <= 0.15) return VoxelType.BUNKER_SAND_WHITE
  if (hz >= 0.2 && hz <= 0.38 && hx >= -0.15 && hx <= -0.07) return VoxelType.BUNKER_SAND_WHITE

  // Tee box
  if (hz <= -0.33 && hz >= -0.42 && Math.abs(hx) < 0.05) return VoxelType.TEE_GRASS

  // Fairway — slight dogleg right
  const fairwayBias = Math.max(0, (hz + 0.1) * 0.15)
  const fairwayWidth = 0.11 + Math.abs(hz) * 0.03
  if (hz >= -0.33 && hz <= 0.22 && Math.abs(hx - fairwayBias) < fairwayWidth) {
    return VoxelType.FAIRWAY_GRASS
  }

  // Water hazard — left of fairway mid-hole
  if (hz >= -0.05 && hz <= 0.18 && hx >= -0.32 && hx <= -0.16) return VoxelType.STILL_WATER

  // Cart path — right side of fairway
  if (hz >= -0.2 && hz <= 0.22 && hx >= 0.17 && hx <= 0.2) return VoxelType.CART_PATH_CONCRETE

  // Heather — far rough, links feel
  if (Math.abs(hx) > 0.32 || hz < -0.44 || hz > 0.4) return VoxelType.HEATHER

  // Intermediate rough bordering fairway
  const iBias = Math.max(0, (hz + 0.1) * 0.15)
  const iWidth = fairwayWidth + 0.07
  if (hz >= -0.36 && hz <= 0.25 && Math.abs(hx - iBias) < iWidth) {
    return VoxelType.INTERMEDIATE_ROUGH
  }

  return VoxelType.PRIMARY_ROUGH
}

export function initWorld(world: VoxelWorld): void {
  const { widthInVoxels: W, depthInVoxels: D } = world

  for (let wx = 0; wx < W; wx++) {
    for (let wz = 0; wz < D; wz++) {
      const type = surfaceTypeAt(wx, wz, W, D)

      let h: number
      if (type === VoxelType.STILL_WATER) {
        h = 2
      } else if (type === VoxelType.BUNKER_SAND_WHITE) {
        h = Math.max(1, heightAt(wx, wz, W, D) - 1)
      } else {
        h = heightAt(wx, wz, W, D)
      }

      for (let wy = 0; wy < h; wy++) {
        world.setVoxel(wx, wy, wz, VoxelType.BARE_SOIL)
      }
      world.setVoxel(wx, h, wz, type)
    }
  }
}

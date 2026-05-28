import { VoxelChunk } from './VoxelChunk'
import { CHUNK_SIZE, CHUNK_HEIGHT } from './constants'
import { VoxelType } from '../voxelTypes'

export class VoxelWorld {
  readonly widthInVoxels: number
  readonly depthInVoxels: number
  readonly widthInChunks: number
  readonly depthInChunks: number
  readonly chunks: Map<string, VoxelChunk> = new Map()

  constructor(widthInVoxels: number, depthInVoxels: number) {
    this.widthInVoxels = widthInVoxels
    this.depthInVoxels = depthInVoxels
    this.widthInChunks = Math.ceil(widthInVoxels / CHUNK_SIZE)
    this.depthInChunks = Math.ceil(depthInVoxels / CHUNK_SIZE)
    for (let cx = 0; cx < this.widthInChunks; cx++) {
      for (let cz = 0; cz < this.depthInChunks; cz++) {
        this.chunks.set(`${cx},${cz}`, new VoxelChunk())
      }
    }
  }

  getChunk(cx: number, cz: number): VoxelChunk | undefined {
    return this.chunks.get(`${cx},${cz}`)
  }

  private decompose(wx: number, wz: number) {
    const cx = Math.floor(wx / CHUNK_SIZE)
    const cz = Math.floor(wz / CHUNK_SIZE)
    return { cx, cz, lx: wx - cx * CHUNK_SIZE, lz: wz - cz * CHUNK_SIZE }
  }

  inBounds(wx: number, wy: number, wz: number): boolean {
    return (
      wx >= 0 && wx < this.widthInVoxels &&
      wy >= 0 && wy < CHUNK_HEIGHT &&
      wz >= 0 && wz < this.depthInVoxels
    )
  }

  getVoxelType(wx: number, wy: number, wz: number): number {
    if (!this.inBounds(wx, wy, wz)) return VoxelType.AIR
    const { cx, cz, lx, lz } = this.decompose(wx, wz)
    return this.getChunk(cx, cz)?.getType(lx, wy, lz) ?? VoxelType.AIR
  }

  setVoxel(wx: number, wy: number, wz: number, type: number, variant = 0): void {
    if (!this.inBounds(wx, wy, wz)) return
    const { cx, cz, lx, lz } = this.decompose(wx, wz)
    const chunk = this.getChunk(cx, cz)
    if (!chunk) return
    chunk.setVoxel(lx, wy, lz, type, variant)
    if (lx === 0) this.getChunk(cx - 1, cz)?.markDirty()
    if (lx === CHUNK_SIZE - 1) this.getChunk(cx + 1, cz)?.markDirty()
    if (lz === 0) this.getChunk(cx, cz - 1)?.markDirty()
    if (lz === CHUNK_SIZE - 1) this.getChunk(cx, cz + 1)?.markDirty()
  }

  getSurfaceHeight(wx: number, wz: number): number {
    if (wx < 0 || wx >= this.widthInVoxels || wz < 0 || wz >= this.depthInVoxels) return -1
    const { cx, cz, lx, lz } = this.decompose(wx, wz)
    const chunk = this.getChunk(cx, cz)
    if (!chunk) return -1
    for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
      if (chunk.getType(lx, y, lz) !== VoxelType.AIR) return y
    }
    return -1
  }
}

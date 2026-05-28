import { CHUNK_SIZE, CHUNK_HEIGHT } from './constants'

export class VoxelChunk {
  data: Uint8Array
  isDirty = true

  constructor() {
    this.data = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE * 2)
  }

  getIndex(lx: number, ly: number, lz: number): number {
    return (lx + lz * CHUNK_SIZE + ly * CHUNK_SIZE * CHUNK_SIZE) * 2
  }

  getType(lx: number, ly: number, lz: number): number {
    return this.data[this.getIndex(lx, ly, lz)]
  }

  setVoxel(lx: number, ly: number, lz: number, type: number, variant = 0): void {
    const i = this.getIndex(lx, ly, lz)
    this.data[i] = type
    this.data[i + 1] = variant
    this.isDirty = true
  }

  markDirty(): void {
    this.isDirty = true
  }

  inBounds(lx: number, ly: number, lz: number): boolean {
    return lx >= 0 && lx < CHUNK_SIZE && ly >= 0 && ly < CHUNK_HEIGHT && lz >= 0 && lz < CHUNK_SIZE
  }
}

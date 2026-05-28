import * as THREE from 'three'
import { VoxelWorld } from './VoxelWorld'
import { VoxelChunk } from './VoxelChunk'
import { CHUNK_SIZE, CHUNK_HEIGHT, VOXEL_SIZE } from './constants'
import { VoxelType, VOXEL_COLORS } from '../voxelTypes'

// Face definitions — corners in CCW winding when viewed from the face's normal direction.
// Each corner is [x, y, z] offset within a unit voxel [0,1]^3.
// Indices per face: [0, 2, 1, 1, 2, 3] — two CCW triangles.
const FACE_DEFS = [
  { dir: [-1,  0,  0] as const, normal: [-1, 0,  0] as const, bright: 0.72,
    corners: [[0,1,0],[0,0,0],[0,1,1],[0,0,1]] as [number,number,number][] },
  { dir: [ 1,  0,  0] as const, normal: [ 1, 0,  0] as const, bright: 0.72,
    corners: [[1,1,1],[1,0,1],[1,1,0],[1,0,0]] as [number,number,number][] },
  { dir: [ 0, -1,  0] as const, normal: [ 0,-1,  0] as const, bright: 0.45,
    corners: [[1,0,1],[0,0,1],[1,0,0],[0,0,0]] as [number,number,number][] },
  { dir: [ 0,  1,  0] as const, normal: [ 0, 1,  0] as const, bright: 1.0,
    corners: [[0,1,1],[1,1,1],[0,1,0],[1,1,0]] as [number,number,number][] },
  { dir: [ 0,  0, -1] as const, normal: [ 0, 0, -1] as const, bright: 0.82,
    corners: [[1,0,0],[0,0,0],[1,1,0],[0,1,0]] as [number,number,number][] },
  { dir: [ 0,  0,  1] as const, normal: [ 0, 0,  1] as const, bright: 0.82,
    corners: [[0,0,1],[1,0,1],[0,1,1],[1,1,1]] as [number,number,number][] },
]

function hexToRgb(hex: number): [number, number, number] {
  return [(hex >> 16 & 0xff) / 255, (hex >> 8 & 0xff) / 255, (hex & 0xff) / 255]
}

export function buildChunkGeometry(
  chunk: VoxelChunk,
  world: VoxelWorld,
  cx: number,
  cz: number,
): THREE.BufferGeometry {
  const positions: number[] = []
  const normals: number[] = []
  const colors: number[] = []
  const indices: number[] = []

  const worldOffsetX = cx * CHUNK_SIZE
  const worldOffsetZ = cz * CHUNK_SIZE

  for (let ly = 0; ly < CHUNK_HEIGHT; ly++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const type = chunk.getType(lx, ly, lz)
        if (type === VoxelType.AIR) continue

        const hexColor = VOXEL_COLORS[type as VoxelType] ?? 0xff00ff
        const [r, g, b] = hexToRgb(hexColor)

        for (const face of FACE_DEFS) {
          const [dx, dy, dz] = face.dir
          const neighborType = world.getVoxelType(
            worldOffsetX + lx + dx,
            ly + dy,
            worldOffsetZ + lz + dz,
          )
          if (neighborType !== VoxelType.AIR) continue

          const ndx = positions.length / 3
          const br = face.bright

          for (const [vx, vy, vz] of face.corners) {
            positions.push((lx + vx) * VOXEL_SIZE, (ly + vy) * VOXEL_SIZE, (lz + vz) * VOXEL_SIZE)
            normals.push(...face.normal)
            colors.push(r * br, g * br, b * br)
          }

          indices.push(ndx, ndx + 1, ndx + 2, ndx + 1, ndx + 3, ndx + 2)
        }
      }
    }
  }

  const geo = new THREE.BufferGeometry()
  if (positions.length === 0) return geo

  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geo.setIndex(indices)

  return geo
}

import * as THREE from 'three'

export interface HoleAnnotation {
  id: string
  kind: 'hole'
  tee: THREE.Vector3
  green: THREE.Vector3
}

export type Annotation = HoleAnnotation

export const METERS_PER_YARD = 0.9144
export const RING_STEP_YARDS = 50 // yardage arc interval

export const toYards = (meters: number) => meters / METERS_PER_YARD
export const yardsToMeters = (yards: number) => yards * METERS_PER_YARD

// ── Serialization (storage + clean JSON layer) ──────────────────────────────────
export type RawAnnotation = { id: string; kind: string; data: unknown }

const vec = (p: THREE.Vector3) => ({ x: p.x, y: p.y, z: p.z })
const toVec3 = (o: { x: number; y: number; z: number }) => new THREE.Vector3(o.x, o.y, o.z)

export function serializeAnnotation(a: Annotation): RawAnnotation {
  return { id: a.id, kind: 'hole', data: { tee: vec(a.tee), green: vec(a.green) } }
}

export function deserializeAnnotation(raw: RawAnnotation): Annotation | null {
  const d = raw.data as Record<string, { x: number; y: number; z: number }>
  if (raw.kind === 'hole' && d?.tee && d?.green) {
    return { id: raw.id, kind: 'hole', tee: toVec3(d.tee), green: toVec3(d.green) }
  }
  return null
}

export function cloneAnnotation(a: Annotation): Annotation {
  return { id: a.id, kind: 'hole', tee: a.tee.clone(), green: a.green.clone() }
}

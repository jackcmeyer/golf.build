import { supabase } from './supabase'
import { rleEncode, rleDecode } from './rle'
import type { VoxelWorld } from '../engine/VoxelWorld'
import type { ObjectManager } from '../engine/ObjectManager'

function uint8ToBase64(data: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < data.length; i++) binary += String.fromCharCode(data[i])
  return btoa(binary)
}

function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64)
  const arr = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i)
  return arr
}

const CHUNK_BATCH = 20

export async function saveCourse(
  courseId: string,
  world: VoxelWorld,
  objectManager: ObjectManager,
): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured')

  const rows: Array<{
    course_id: string
    chunk_x: number
    chunk_z: number
    data: string
    updated_at: string
  }> = []

  for (const [key, chunk] of world.chunks) {
    const [cx, cz] = key.split(',').map(Number)
    rows.push({
      course_id: courseId,
      chunk_x: cx,
      chunk_z: cz,
      data: uint8ToBase64(rleEncode(chunk.data)),
      updated_at: new Date().toISOString(),
    })
  }

  for (let i = 0; i < rows.length; i += CHUNK_BATCH) {
    const { error } = await supabase
      .from('course_chunks')
      .upsert(rows.slice(i, i + CHUNK_BATCH), { onConflict: 'course_id,chunk_x,chunk_z' })
    if (error) throw error
  }

  // Replace objects: delete all then re-insert
  const { error: delErr } = await supabase.from('course_objects').delete().eq('course_id', courseId)
  if (delErr) throw delErr

  const objects = objectManager.getAll()
  if (objects.length > 0) {
    const { error } = await supabase.from('course_objects').insert(
      objects.map((obj) => ({
        id: obj.id,
        course_id: courseId,
        type: obj.type as string,
        x: obj.position.x,
        y: obj.position.y,
        z: obj.position.z,
        rotation: obj.rotation,
      })),
    )
    if (error) throw error
  }

  const { error: updErr } = await supabase
    .from('courses')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', courseId)
  if (updErr) throw updErr
}

export type RawObject = {
  id: string
  type: string
  x: number
  y: number
  z: number
  rotation: number
}

export type LoadedCourseData = {
  chunks: Array<{ cx: number; cz: number; data: Uint8Array }>
  objects: RawObject[]
}

export async function loadCourseData(courseId: string): Promise<LoadedCourseData> {
  if (!supabase) throw new Error('Supabase not configured')

  const { data: chunkRows, error: chunksErr } = await supabase
    .from('course_chunks')
    .select('chunk_x, chunk_z, data')
    .eq('course_id', courseId)
  if (chunksErr) throw chunksErr

  const chunks = (chunkRows ?? []).map((row) => ({
    cx: row.chunk_x as number,
    cz: row.chunk_z as number,
    data: rleDecode(base64ToUint8(row.data as string)),
  }))

  const { data: objRows, error: objsErr } = await supabase
    .from('course_objects')
    .select('id, type, x, y, z, rotation')
    .eq('course_id', courseId)
  if (objsErr) throw objsErr

  const objects: RawObject[] = (objRows ?? []).map((row) => ({
    id: row.id as string,
    type: row.type as string,
    x: row.x as number,
    y: row.y as number,
    z: row.z as number,
    rotation: (row.rotation as number) ?? 0,
  }))

  return { chunks, objects }
}

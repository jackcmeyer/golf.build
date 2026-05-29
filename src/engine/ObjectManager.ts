import * as THREE from 'three'
import { ObjectType } from './objectTypes'

export interface CourseObject {
  id: string
  type: ObjectType
  position: THREE.Vector3
  rotation: number // Y-axis radians
}

export class ObjectManager {
  objects: Map<string, CourseObject> = new Map()

  place(type: ObjectType, position: THREE.Vector3, rotation = 0): CourseObject {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const obj: CourseObject = { id, type, position: position.clone(), rotation }
    this.objects.set(id, obj)
    return obj
  }

  move(id: string, position: THREE.Vector3) {
    const obj = this.objects.get(id)
    if (obj) obj.position.copy(position)
  }

  rotate(id: string, rotation: number) {
    const obj = this.objects.get(id)
    if (obj) obj.rotation = rotation
  }

  remove(id: string) {
    this.objects.delete(id)
  }

  getAll(): CourseObject[] {
    return Array.from(this.objects.values())
  }
}

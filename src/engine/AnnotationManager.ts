import * as THREE from 'three'
import type { Annotation, HoleAnnotation } from './annotationTypes'

export class AnnotationManager {
  annotations: Map<string, Annotation> = new Map()

  private _newId(): string {
    return `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  }

  placeHole(tee: THREE.Vector3, green: THREE.Vector3): HoleAnnotation {
    const ann: HoleAnnotation = {
      id: this._newId(),
      kind: 'hole',
      tee: tee.clone(),
      green: green.clone(),
    }
    this.annotations.set(ann.id, ann)
    return ann
  }

  move(id: string, key: 'tee' | 'green', position: THREE.Vector3) {
    const ann = this.annotations.get(id)
    if (!ann) return
    ann[key].copy(position)
  }

  remove(id: string) {
    this.annotations.delete(id)
  }

  getAll(): Annotation[] {
    return Array.from(this.annotations.values())
  }
}

import * as THREE from 'three'

type DragMode = 'translateX' | 'translateY' | 'translateZ' | 'rotateY' | null

const COLORS = { x: 0xff4444, y: 0x44cc44, z: 0x4488ff, rot: 0xffdd00 }

function makeMat(color: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({ color, depthTest: false })
}

function makeArrowGroup(color: number): THREE.Group {
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.75, 8), makeMat(color))
  shaft.position.y = 0.375
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.25, 8), makeMat(color))
  tip.position.y = 0.875
  const g = new THREE.Group()
  g.add(shaft, tip)
  return g
}

export class Gizmo {
  group: THREE.Group

  private _attachedId: string | null = null
  private _pos = new THREE.Vector3()
  private _rot = 0

  private _dragMode: DragMode = null
  private _dragPlane = new THREE.Plane()
  private _dragStartIntersect = new THREE.Vector3()
  private _dragCurIntersect = new THREE.Vector3()
  private _dragStartPos = new THREE.Vector3()
  private _dragStartRot = 0

  private _rc = new THREE.Raycaster()
  private _handleMeshes: THREE.Object3D[] = []
  private _modeMap = new Map<THREE.Object3D, DragMode>()

  constructor(scene: THREE.Scene) {
    this.group = new THREE.Group()
    this.group.visible = false
    scene.add(this.group)
    this._buildHandles()
  }

  private _registerGroup(grp: THREE.Group, mode: DragMode) {
    grp.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        this._handleMeshes.push(o)
        this._modeMap.set(o, mode)
        ;(o as THREE.Mesh).renderOrder = 999
      }
    })
  }

  private _buildHandles() {
    // X arrow — red, rotated so shaft points +X
    const xGrp = makeArrowGroup(COLORS.x)
    xGrp.rotation.z = -Math.PI / 2
    this.group.add(xGrp)
    this._registerGroup(xGrp, 'translateX')

    // Z arrow — blue, rotated so shaft points +Z
    const zGrp = makeArrowGroup(COLORS.z)
    zGrp.rotation.x = Math.PI / 2
    this.group.add(zGrp)
    this._registerGroup(zGrp, 'translateZ')

    // Y arrow — green, default orientation (shaft points +Y)
    const yGrp = makeArrowGroup(COLORS.y)
    this.group.add(yGrp)
    this._registerGroup(yGrp, 'translateY')

    // Rotation ring — yellow, in XZ plane
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.045, 8, 32), makeMat(COLORS.rot))
    ring.rotation.x = Math.PI / 2
    ring.renderOrder = 999
    this.group.add(ring)
    this._handleMeshes.push(ring)
    this._modeMap.set(ring, 'rotateY')
  }

  attach(id: string, position: THREE.Vector3, rotation: number) {
    this._attachedId = id
    this._pos.copy(position)
    this._rot = rotation
    this.group.position.copy(position)
    this.group.visible = true
  }

  detach() {
    this._attachedId = null
    this._dragMode = null
    this.group.visible = false
  }

  get attachedId() {
    return this._attachedId
  }
  get isDragging() {
    return this._dragMode !== null
  }
  get dragMode(): DragMode {
    return this._dragMode
  }

  updateScale(camera: THREE.Camera) {
    const dist = camera.position.distanceTo(this.group.position)
    this.group.scale.setScalar(Math.max(4, dist * 0.1))
  }

  // Returns true if a handle was hit (gizmo consumed the event).
  onPointerDown(ndc: THREE.Vector2, camera: THREE.Camera): boolean {
    if (!this.group.visible) return false
    this._rc.setFromCamera(ndc, camera)
    const hits = this._rc.intersectObjects(this._handleMeshes)
    if (hits.length === 0) return false

    const mode = this._modeMap.get(hits[0].object) ?? null
    if (!mode) return false

    this._dragStartPos.copy(this._pos)
    this._dragStartRot = this._rot

    if (mode === 'translateX' || mode === 'translateZ' || mode === 'rotateY') {
      // Horizontal plane at object height
      this._dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), this._pos)
    } else {
      // translateY: vertical plane facing camera
      const camDir = camera.position.clone().sub(this._pos)
      camDir.y = 0
      if (camDir.lengthSq() < 0.001) camDir.set(1, 0, 0)
      camDir.normalize()
      this._dragPlane.setFromNormalAndCoplanarPoint(camDir, this._pos)
    }

    if (!this._rc.ray.intersectPlane(this._dragPlane, this._dragStartIntersect)) return true
    this._dragMode = mode
    return true
  }

  // Returns what changed this frame. Caller is responsible for updating object data.
  onPointerMove(
    ndc: THREE.Vector2,
    camera: THREE.Camera,
  ): { position?: THREE.Vector3; rotation?: number } | null {
    if (!this._dragMode) return null
    this._rc.setFromCamera(ndc, camera)
    if (!this._rc.ray.intersectPlane(this._dragPlane, this._dragCurIntersect)) return null

    const dx = this._dragCurIntersect.x - this._dragStartIntersect.x
    const dy = this._dragCurIntersect.y - this._dragStartIntersect.y
    const dz = this._dragCurIntersect.z - this._dragStartIntersect.z

    if (this._dragMode === 'translateX') {
      this._pos.x = this._dragStartPos.x + dx
      this.group.position.copy(this._pos)
      return { position: this._pos.clone() }
    }
    if (this._dragMode === 'translateZ') {
      this._pos.z = this._dragStartPos.z + dz
      this.group.position.copy(this._pos)
      return { position: this._pos.clone() }
    }
    if (this._dragMode === 'translateY') {
      this._pos.y = this._dragStartPos.y + dy
      this.group.position.copy(this._pos)
      return { position: this._pos.clone() }
    }
    if (this._dragMode === 'rotateY') {
      const a0 = Math.atan2(
        this._dragStartIntersect.z - this._dragStartPos.z,
        this._dragStartIntersect.x - this._dragStartPos.x,
      )
      const a1 = Math.atan2(
        this._dragCurIntersect.z - this._dragStartPos.z,
        this._dragCurIntersect.x - this._dragStartPos.x,
      )
      this._rot = this._dragStartRot + (a1 - a0)
      return { rotation: this._rot }
    }
    return null
  }

  onPointerUp() {
    this._dragMode = null
  }
}

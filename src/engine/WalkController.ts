import * as THREE from 'three'
import type { VoxelWorld } from './VoxelWorld'
import { VOXEL_SIZE, VOXEL_HEIGHT, WORLD_WIDTH_VOXELS, WORLD_DEPTH_VOXELS } from './constants'

const EYE_HEIGHT = 1.8
const WALK_SPEED = 10
const RUN_SPEED = 20

export class WalkController {
  yaw = 0
  pitch = 0
  private keys = new Set<string>()
  private _isLocked = false
  onExitRequest: (() => void) | null = null
  onLockChange: ((locked: boolean) => void) | null = null

  constructor(
    private camera: THREE.PerspectiveCamera,
    private canvas: HTMLElement,
    private world: VoxelWorld,
  ) {}

  get isLocked() {
    return this._isLocked
  }

  enable() {
    window.addEventListener('keydown', this._onKeyDown)
    window.addEventListener('keyup', this._onKeyUp)
    document.addEventListener('mousemove', this._onMouseMove)
    document.addEventListener('pointerlockchange', this._onPointerLockChange)
  }

  disable() {
    window.removeEventListener('keydown', this._onKeyDown)
    window.removeEventListener('keyup', this._onKeyUp)
    document.removeEventListener('mousemove', this._onMouseMove)
    document.removeEventListener('pointerlockchange', this._onPointerLockChange)
    if (document.pointerLockElement === this.canvas) {
      document.exitPointerLock()
    }
    this.keys.clear()
    this._isLocked = false
  }

  requestPointerLock() {
    this.canvas.requestPointerLock()
  }

  private _onKeyDown = (e: KeyboardEvent) => {
    this.keys.add(e.code)
    // Escape while unlocked → exit walk mode
    if (e.code === 'Escape' && !this._isLocked) {
      this.onExitRequest?.()
    }
  }

  private _onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code)
  }

  private _onMouseMove = (e: MouseEvent) => {
    if (!this._isLocked) return
    this.yaw -= e.movementX * 0.002
    this.pitch = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, this.pitch - e.movementY * 0.002))
  }

  private _onPointerLockChange = () => {
    this._isLocked = document.pointerLockElement === this.canvas
    this.onLockChange?.(this._isLocked)
  }

  update(dt: number) {
    const speed = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? RUN_SPEED : WALK_SPEED

    const euler = new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ')
    this.camera.quaternion.setFromEuler(euler)

    const sinYaw = Math.sin(this.yaw)
    const cosYaw = Math.cos(this.yaw)
    // Forward: -Z rotated by yaw. Right: +X rotated by yaw.
    const forward = new THREE.Vector3(-sinYaw, 0, -cosYaw)
    const right = new THREE.Vector3(cosYaw, 0, -sinYaw)

    if (this.keys.has('KeyW') || this.keys.has('ArrowUp'))
      this.camera.position.addScaledVector(forward, speed * dt)
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown'))
      this.camera.position.addScaledVector(forward, -speed * dt)
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft'))
      this.camera.position.addScaledVector(right, -speed * dt)
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight'))
      this.camera.position.addScaledVector(right, speed * dt)

    // Clamp to world bounds
    const maxX = (WORLD_WIDTH_VOXELS / 2 - 1) * VOXEL_SIZE
    const maxZ = (WORLD_DEPTH_VOXELS / 2 - 1) * VOXEL_SIZE
    this.camera.position.x = Math.max(-maxX, Math.min(maxX, this.camera.position.x))
    this.camera.position.z = Math.max(-maxZ, Math.min(maxZ, this.camera.position.z))

    // Terrain collision: snap Y to surface height + eye height
    const vx = Math.max(
      0,
      Math.min(
        WORLD_WIDTH_VOXELS - 1,
        Math.floor(this.camera.position.x / VOXEL_SIZE + WORLD_WIDTH_VOXELS / 2),
      ),
    )
    const vz = Math.max(
      0,
      Math.min(
        WORLD_DEPTH_VOXELS - 1,
        Math.floor(this.camera.position.z / VOXEL_SIZE + WORLD_DEPTH_VOXELS / 2),
      ),
    )
    const surfaceH = this.world.getSurfaceHeight(vx, vz)
    const groundY = (surfaceH >= 0 ? surfaceH + 1 : 1) * VOXEL_HEIGHT
    this.camera.position.y = groundY + EYE_HEIGHT
  }
}

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { VoxelWorld } from '../engine/VoxelWorld'
import { buildChunkGeometry } from '../engine/ChunkMeshBuilder'
import { initWorld } from '../engine/worldInit'
import {
  VOXEL_SIZE, CHUNK_SIZE,
  WORLD_WIDTH_VOXELS, WORLD_DEPTH_VOXELS,
  CHUNK_HEIGHT,
} from '../engine/constants'
import { ToolMode, getColumnsInRadius } from '../engine/toolUtils'
import { VoxelType } from '../voxelTypes'
import { Toolbar } from './Toolbar'

const HALF_W = (WORLD_WIDTH_VOXELS / 2) * VOXEL_SIZE
const HALF_D = (WORLD_DEPTH_VOXELS / 2) * VOXEL_SIZE
// Chunks whose center is within this distance of the orbit target get LOD 0 (full detail).
// Beyond this, only top faces are generated — ~5x less geometry.
const LOD_NEAR_DIST = 200

const terrainMaterial = new THREE.MeshLambertMaterial({ vertexColors: true })

const outlineMaterial = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  vertexShader: `
    void main() {
      vec3 pos = position + normal * 0.28;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
  fragmentShader: `
    void main() {
      gl_FragColor = vec4(0.07, 0.07, 0.04, 1.0);
    }
  `,
})

export default function VoxelCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)
  const controlsRef = useRef<OrbitControls | null>(null)

  const [toolMode, setToolMode] = useState<ToolMode>('raise')
  const [brushSize, setBrushSize] = useState(3)
  const [selectedSurface, setSelectedSurface] = useState<VoxelType>(VoxelType.FAIRWAY_GRASS)

  // Refs so Three.js handlers always see current values without re-running the effect
  const toolRef = useRef(toolMode)
  const brushRef = useRef(brushSize)
  const surfaceRef = useRef(selectedSurface)
  useEffect(() => { toolRef.current = toolMode }, [toolMode])
  useEffect(() => { brushRef.current = brushSize }, [brushSize])
  useEffect(() => { surfaceRef.current = selectedSurface }, [selectedSurface])

  // Swap OrbitControls touch/mouse config when the active tool changes.
  // Orbit mode: 1-finger rotates, left-click rotates.
  // Sculpt modes: 1-finger sculpts, left-click sculpts; 2-finger still zooms/pans.
  useEffect(() => {
    const c = controlsRef.current
    if (!c) return
    if (toolMode === 'orbit') {
      c.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }
      c.touches   = { ONE: THREE.TOUCH.ROTATE,   TWO: THREE.TOUCH.DOLLY_PAN }
    } else {
      c.mouseButtons = { LEFT: null as unknown as THREE.MOUSE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }
      c.touches   = { ONE: undefined as unknown as THREE.TOUCH, TWO: THREE.TOUCH.DOLLY_PAN }
    }
  }, [toolMode])

  useEffect(() => {
    const container = containerRef.current!

    // ── World ──────────────────────────────────────────────────────────────────
    const world = new VoxelWorld(WORLD_WIDTH_VOXELS, WORLD_DEPTH_VOXELS)
    initWorld(world)

    // ── Renderer ──────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    container.appendChild(renderer.domElement)

    // ── Scene ─────────────────────────────────────────────────────────────────
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x8ab4d4)
    // Fog starts well beyond max orbit distance so it never hazes the terrain.
    scene.fog = new THREE.Fog(0x8ab4d4, 1000, 2000)

    // ── Camera ────────────────────────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 10000)
    camera.position.set(0, 220, 380)

    // ── Controls ──────────────────────────────────────────────────────────────
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 6, 0)
    controls.enableDamping = true
    controls.dampingFactor = 0.06
    controls.screenSpacePanning = false
    controls.minDistance = 8
    controls.maxDistance = 900
    controls.maxPolarAngle = Math.PI / 2.08
    // Initial config: sculpt tools active, so left/1-finger = tool (not orbit).
    // The toolMode useEffect will update this whenever the active mode changes.
    controls.mouseButtons = { LEFT: null as unknown as THREE.MOUSE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }
    controls.touches = { ONE: undefined as unknown as THREE.TOUCH, TWO: THREE.TOUCH.DOLLY_PAN }
    controlsRef.current = controls

    // ── Lighting ──────────────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xd0e8ff, 0.55))

    const sun = new THREE.DirectionalLight(0xfff4d8, 1.3)
    sun.position.set(80, 140, 60)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.near = 1
    sun.shadow.camera.far = 600
    const sc = sun.shadow.camera as THREE.OrthographicCamera
    sc.left = -300; sc.right = 300; sc.top = 300; sc.bottom = -300
    sun.shadow.bias = -0.0005
    scene.add(sun)

    // ── Chunk mesh management ─────────────────────────────────────────────────
    type ChunkEntry = { terrain: THREE.Mesh; outline: THREE.Mesh | null; geo: THREE.BufferGeometry }
    const chunkMap = new Map<string, ChunkEntry>()
    const chunkLOD = new Map<string, number>()
    const terrainMeshes: THREE.Mesh[] = []

    function getLODForChunk(cx: number, cz: number): number {
      const centerX = (cx + 0.5) * CHUNK_SIZE * VOXEL_SIZE - HALF_W
      const centerZ = (cz + 0.5) * CHUNK_SIZE * VOXEL_SIZE - HALF_D
      const dx = controls.target.x - centerX
      const dz = controls.target.z - centerZ
      return Math.sqrt(dx * dx + dz * dz) < LOD_NEAR_DIST ? 0 : 1
    }

    function rebuildChunk(key: string, cx: number, cz: number, lod: number) {
      const chunk = world.getChunk(cx, cz)
      if (!chunk) return

      const old = chunkMap.get(key)
      if (old) {
        scene.remove(old.terrain)
        if (old.outline) scene.remove(old.outline)
        old.geo.dispose()
        const ti = terrainMeshes.indexOf(old.terrain)
        if (ti !== -1) terrainMeshes.splice(ti, 1)
      }

      const geo = buildChunkGeometry(chunk, world, cx, cz, lod)

      const originX = cx * CHUNK_SIZE * VOXEL_SIZE - HALF_W
      const originZ = cz * CHUNK_SIZE * VOXEL_SIZE - HALF_D

      const terrain = new THREE.Mesh(geo, terrainMaterial)
      terrain.position.set(originX, 0, originZ)
      terrain.receiveShadow = true
      terrain.castShadow = true
      scene.add(terrain)
      terrainMeshes.push(terrain)

      // Outline only for full-detail chunks — LOD 1 top-only geometry would
      // produce an odd dark halo instead of edge outlines.
      let outline: THREE.Mesh | null = null
      if (lod === 0) {
        outline = new THREE.Mesh(geo, outlineMaterial)
        outline.position.set(originX, 0, originZ)
        scene.add(outline)
      }

      chunkMap.set(key, { terrain, outline, geo })
      chunkLOD.set(key, lod)
      chunk.isDirty = false
    }

    // Initial build — synchronous before first frame
    for (const [key, chunk] of world.chunks) {
      if (chunk.isDirty) {
        const [cx, cz] = key.split(',').map(Number)
        rebuildChunk(key, cx, cz, getLODForChunk(cx, cz))
      }
    }

    // ── Raycasting + tool application ─────────────────────────────────────────
    const raycaster = new THREE.Raycaster()
    const mouseNdc = new THREE.Vector2()
    let isLeftDown = false

    function worldCoordsFromHit(e: PointerEvent) {
      const rect = container.getBoundingClientRect()
      mouseNdc.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      )
      raycaster.setFromCamera(mouseNdc, camera)
      const hits = raycaster.intersectObjects(terrainMeshes)
      if (hits.length === 0) return null
      const hit = hits[0]
      const inward = hit.point.clone().addScaledVector(hit.face!.normal, -0.01)
      const vx = Math.floor(inward.x / VOXEL_SIZE + WORLD_WIDTH_VOXELS / 2)
      const vy = Math.floor(inward.y / VOXEL_SIZE)
      const vz = Math.floor(inward.z / VOXEL_SIZE + WORLD_DEPTH_VOXELS / 2)
      if (!world.inBounds(vx, vy, vz)) return null
      return { vx, vy, vz }
    }

    function applyTool(vx: number, vy: number, vz: number) {
      const tool = toolRef.current
      const radius = brushRef.current
      const surface = surfaceRef.current
      const cols = getColumnsInRadius(vx, vz, radius)

      if (tool === 'raise') {
        for (const [x, z] of cols) {
          const h = world.getSurfaceHeight(x, z)
          if (h >= 0 && h < CHUNK_HEIGHT - 1) {
            world.setVoxel(x, h + 1, z, world.getVoxelType(x, h, z))
          }
        }
      } else if (tool === 'lower') {
        for (const [x, z] of cols) {
          const h = world.getSurfaceHeight(x, z)
          if (h > 0) world.setVoxel(x, h, z, VoxelType.AIR)
        }
      } else if (tool === 'flatten') {
        for (const [x, z] of cols) {
          const h = world.getSurfaceHeight(x, z)
          const colType = h >= 0 ? world.getVoxelType(x, h, z) : VoxelType.PRIMARY_ROUGH
          if (h < vy) {
            for (let y = h + 1; y <= vy; y++) {
              world.setVoxel(x, y, z, y === vy ? colType : VoxelType.BARE_SOIL)
            }
          } else if (h > vy) {
            for (let y = vy + 1; y <= h; y++) world.setVoxel(x, y, z, VoxelType.AIR)
          }
        }
      } else if (tool === 'smooth') {
        // Snapshot heights before modifying
        const snap = new Map<string, number>()
        for (const [x, z] of cols) {
          for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
              const k = `${x + dx},${z + dz}`
              if (!snap.has(k)) snap.set(k, world.getSurfaceHeight(x + dx, z + dz))
            }
          }
        }
        for (const [x, z] of cols) {
          let sum = 0, count = 0
          for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
              const h2 = snap.get(`${x + dx},${z + dz}`) ?? -1
              if (h2 >= 0) { sum += h2; count++ }
            }
          }
          if (count === 0) continue
          const target = Math.round(sum / count)
          const cur = snap.get(`${x},${z}`) ?? -1
          if (cur < 0) continue
          const colType = world.getVoxelType(x, cur, z)
          if (cur < target) {
            for (let y = cur + 1; y <= target; y++) world.setVoxel(x, y, z, colType)
          } else if (cur > target) {
            for (let y = target + 1; y <= cur; y++) world.setVoxel(x, y, z, VoxelType.AIR)
          }
        }
      } else if (tool === 'paint') {
        for (const [x, z] of cols) {
          const h = world.getSurfaceHeight(x, z)
          if (h >= 0) world.setVoxel(x, h, z, surface)
        }
      }
    }

    function onPointerDown(e: PointerEvent) {
      if (e.button !== 0) return
      if (toolRef.current === 'orbit') return  // let OrbitControls own this gesture
      isLeftDown = true
      container.setPointerCapture(e.pointerId)
      const hit = worldCoordsFromHit(e)
      if (hit) applyTool(hit.vx, hit.vy, hit.vz)
    }

    function onPointerMove(e: PointerEvent) {
      if (!isLeftDown || !(e.buttons & 1)) return
      if (toolRef.current === 'orbit') return
      const hit = worldCoordsFromHit(e)
      if (hit) applyTool(hit.vx, hit.vy, hit.vz)
    }

    function onPointerUp(e: PointerEvent) {
      if (e.button !== 0) return
      isLeftDown = false
    }

    container.addEventListener('pointerdown', onPointerDown)
    container.addEventListener('pointermove', onPointerMove)
    container.addEventListener('pointerup', onPointerUp)

    // ── Resize ────────────────────────────────────────────────────────────────
    function resize() {
      const w = container.clientWidth
      const h = container.clientHeight
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(container)

    // ── Animate ───────────────────────────────────────────────────────────────
    let frameId: number
    function animate() {
      frameId = requestAnimationFrame(animate)

      // Rebuild dirty chunks and update LOD as camera moves
      for (const [key, chunk] of world.chunks) {
        const [cx, cz] = key.split(',').map(Number)
        const lod = getLODForChunk(cx, cz)
        if (chunk.isDirty || chunkLOD.get(key) !== lod) {
          rebuildChunk(key, cx, cz, lod)
        }
      }

      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(frameId)
      container.removeEventListener('pointerdown', onPointerDown)
      container.removeEventListener('pointermove', onPointerMove)
      container.removeEventListener('pointerup', onPointerUp)
      ro.disconnect()
      controls.dispose()
      renderer.dispose()
      for (const { geo } of chunkMap.values()) geo.dispose()
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement)
    }
  }, [])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      <Toolbar
        toolMode={toolMode}
        onToolChange={setToolMode}
        brushSize={brushSize}
        onBrushChange={setBrushSize}
        selectedSurface={selectedSurface}
        onSurfaceChange={setSelectedSurface}
      />
    </div>
  )
}

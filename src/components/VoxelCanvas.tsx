import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { VoxelWorld } from '../engine/VoxelWorld'
import { buildChunkGeometry, buildWaterGeometry } from '../engine/ChunkMeshBuilder'
import { initWorld } from '../engine/worldInit'
import {
  VOXEL_SIZE,
  CHUNK_SIZE,
  WORLD_WIDTH_VOXELS,
  WORLD_DEPTH_VOXELS,
  CHUNK_HEIGHT,
} from '../engine/constants'
import { ToolMode, getColumnsInRadius } from '../engine/toolUtils'
import { VoxelType } from '../voxelTypes'
import { Toolbar } from './Toolbar'
import { SkySystem } from '../engine/SkySystem'
import { createWaterMaterial } from '../engine/WaterMaterial'
import {
  getSunPosition,
  getSunIntensity,
  getAmbientIntensity,
  getFogColor,
  getWaterColor,
} from '../engine/worldState'

const HALF_W = (WORLD_WIDTH_VOXELS / 2) * VOXEL_SIZE
const HALF_D = (WORLD_DEPTH_VOXELS / 2) * VOXEL_SIZE
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
  const [timeOfDay, setTimeOfDay] = useState(14.0)

  const toolRef = useRef(toolMode)
  const brushRef = useRef(brushSize)
  const surfaceRef = useRef(selectedSurface)
  const timeOfDayRef = useRef(timeOfDay)

  useEffect(() => {
    toolRef.current = toolMode
  }, [toolMode])
  useEffect(() => {
    brushRef.current = brushSize
  }, [brushSize])
  useEffect(() => {
    surfaceRef.current = selectedSurface
  }, [selectedSurface])
  useEffect(() => {
    timeOfDayRef.current = timeOfDay
  }, [timeOfDay])

  useEffect(() => {
    const c = controlsRef.current
    if (!c) return
    if (toolMode === 'orbit') {
      c.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN,
      }
      c.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }
    } else {
      c.mouseButtons = {
        LEFT: null as unknown as THREE.MOUSE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.ROTATE,
      }
      c.touches = { ONE: undefined as unknown as THREE.TOUCH, TWO: THREE.TOUCH.DOLLY_PAN }
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
    // Background color is kept in sync with sky horizon in animate loop
    const bgColor = new THREE.Color(0x4a9ad4)
    scene.background = bgColor
    scene.fog = new THREE.Fog(0x4a9ad4, 1000, 2000)

    // ── Camera ────────────────────────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 10000)
    camera.position.set(0, 220, 380)

    // ── Controls ──────────────────────────────────────────────────────────────
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 6, 0)
    controls.enableDamping = true
    controls.dampingFactor = 0.06
    controls.screenSpacePanning = false
    controls.minDistance = 24
    controls.maxDistance = 900
    controls.maxPolarAngle = Math.PI / 2.08
    controls.mouseButtons = {
      LEFT: null as unknown as THREE.MOUSE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE,
    }
    controls.touches = { ONE: undefined as unknown as THREE.TOUCH, TWO: THREE.TOUCH.DOLLY_PAN }
    controlsRef.current = controls

    // ── Lighting ──────────────────────────────────────────────────────────────
    const ambientLight = new THREE.AmbientLight(0xd0e8ff, 0.55)
    scene.add(ambientLight)

    const sun = new THREE.DirectionalLight(0xfff4d8, 1.3)
    sun.position.copy(getSunPosition(timeOfDayRef.current))
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.near = 1
    sun.shadow.camera.far = 600
    const sc = sun.shadow.camera as THREE.OrthographicCamera
    sc.left = -300
    sc.right = 300
    sc.top = 300
    sc.bottom = -300
    sun.shadow.bias = -0.0005
    scene.add(sun)

    // ── Sky system ────────────────────────────────────────────────────────────
    const skySystem = new SkySystem(scene)

    // ── Water material (shared across all water meshes) ───────────────────────
    const waterMaterial = createWaterMaterial()

    // ── Wind state (internal — varies slowly over time) ───────────────────────
    const windDir = new THREE.Vector2(0.8, 0.4).normalize()
    let windSpeed = 0.4

    // ── Chunk mesh management ─────────────────────────────────────────────────
    type ChunkEntry = {
      terrain: THREE.Mesh
      outline: THREE.Mesh | null
      water: THREE.Mesh | null
      geo: THREE.BufferGeometry
      waterGeo: THREE.BufferGeometry
    }
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
        if (old.water) scene.remove(old.water)
        old.geo.dispose()
        old.waterGeo.dispose()
        const ti = terrainMeshes.indexOf(old.terrain)
        if (ti !== -1) terrainMeshes.splice(ti, 1)
      }

      const geo = buildChunkGeometry(chunk, world, cx, cz, lod)
      const waterGeo = buildWaterGeometry(chunk, world, cx, cz)

      const originX = cx * CHUNK_SIZE * VOXEL_SIZE - HALF_W
      const originZ = cz * CHUNK_SIZE * VOXEL_SIZE - HALF_D

      const terrain = new THREE.Mesh(geo, terrainMaterial)
      terrain.position.set(originX, 0, originZ)
      terrain.receiveShadow = true
      terrain.castShadow = true
      scene.add(terrain)
      terrainMeshes.push(terrain)

      let outline: THREE.Mesh | null = null
      if (lod === 0) {
        outline = new THREE.Mesh(geo, outlineMaterial)
        outline.position.set(originX, 0, originZ)
        scene.add(outline)
      }

      let water: THREE.Mesh | null = null
      if (waterGeo.attributes.position) {
        water = new THREE.Mesh(waterGeo, waterMaterial)
        water.position.set(originX, 0, originZ)
        scene.add(water)
      }

      chunkMap.set(key, { terrain, outline, water, geo, waterGeo })
      chunkLOD.set(key, lod)
      chunk.isDirty = false
    }

    for (const [key, chunk] of world.chunks) {
      if (chunk.isDirty) {
        const [cx, cz] = key.split(',').map(Number)
        rebuildChunk(key, cx, cz, getLODForChunk(cx, cz))
      }
    }

    // ── Brush highlight ───────────────────────────────────────────────────────
    const MAX_HIGHLIGHT = 512
    const highlightGeo = new THREE.BoxGeometry(VOXEL_SIZE * 0.96, 0.3, VOXEL_SIZE * 0.96)
    const highlightMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    })
    const highlightMesh = new THREE.InstancedMesh(highlightGeo, highlightMat, MAX_HIGHLIGHT)
    highlightMesh.count = 0
    highlightMesh.renderOrder = 1
    scene.add(highlightMesh)
    const highlightDummy = new THREE.Object3D()

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

    function updateBrushHighlight(e: PointerEvent | null) {
      if (e === null || toolRef.current === 'orbit') {
        highlightMesh.count = 0
        return
      }
      const hit = worldCoordsFromHit(e)
      if (!hit) {
        highlightMesh.count = 0
        return
      }
      const cols = getColumnsInRadius(hit.vx, hit.vz, brushRef.current)
      let i = 0
      for (const [hx, hz] of cols) {
        const h = world.getSurfaceHeight(hx, hz)
        if (h < 0) continue
        const wx = (hx - WORLD_WIDTH_VOXELS / 2) * VOXEL_SIZE + VOXEL_SIZE / 2
        const wy = (h + 1) * VOXEL_SIZE + 0.08
        const wz = (hz - WORLD_DEPTH_VOXELS / 2) * VOXEL_SIZE + VOXEL_SIZE / 2
        highlightDummy.position.set(wx, wy, wz)
        highlightDummy.updateMatrix()
        highlightMesh.setMatrixAt(i, highlightDummy.matrix)
        i++
        if (i >= MAX_HIGHLIGHT) break
      }
      highlightMesh.count = i
      highlightMesh.instanceMatrix.needsUpdate = true
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
          let sum = 0,
            count = 0
          for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
              const h2 = snap.get(`${x + dx},${z + dz}`) ?? -1
              if (h2 >= 0) {
                sum += h2
                count++
              }
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
      if (toolRef.current === 'orbit') return
      isLeftDown = true
      container.setPointerCapture(e.pointerId)
      const hit = worldCoordsFromHit(e)
      if (hit) applyTool(hit.vx, hit.vy, hit.vz)
    }

    function onPointerMove(e: PointerEvent) {
      updateBrushHighlight(e)
      if (!isLeftDown || !(e.buttons & 1)) return
      if (toolRef.current === 'orbit') return
      const hit = worldCoordsFromHit(e)
      if (hit) applyTool(hit.vx, hit.vy, hit.vz)
    }

    function onPointerUp(e: PointerEvent) {
      if (e.button !== 0) return
      isLeftDown = false
    }

    function onPointerLeave() {
      highlightMesh.count = 0
    }

    container.addEventListener('pointerdown', onPointerDown)
    container.addEventListener('pointermove', onPointerMove)
    container.addEventListener('pointerup', onPointerUp)
    container.addEventListener('pointerleave', onPointerLeave)

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
    const clock = new THREE.Clock()
    let frameId: number

    function animate() {
      frameId = requestAnimationFrame(animate)
      const dt = clock.getDelta()
      const elapsed = clock.getElapsedTime()
      const tod = timeOfDayRef.current

      // Rebuild dirty chunks + LOD updates
      for (const [key, chunk] of world.chunks) {
        const [cx, cz] = key.split(',').map(Number)
        const lod = getLODForChunk(cx, cz)
        if (chunk.isDirty || chunkLOD.get(key) !== lod) {
          rebuildChunk(key, cx, cz, lod)
        }
      }

      // Wind: slowly rotate direction and vary speed
      const windAngle = elapsed * 0.04
      windDir.set(Math.cos(windAngle), Math.sin(windAngle) * 0.4).normalize()
      windSpeed = 0.3 + Math.sin(elapsed * 0.11) * 0.12 + 0.12

      // Lighting — update sun + ambient to match time of day
      sun.position.copy(getSunPosition(tod))
      sun.intensity = getSunIntensity(tod)
      ambientLight.intensity = getAmbientIntensity(tod)

      // Fog + background use a muted haze color — not the raw vivid sky horizon
      const fogCol = getFogColor(tod)
      bgColor.copy(fogCol)
      ;(scene.fog as THREE.Fog).color.copy(fogCol)

      // Sky system
      skySystem.update(tod, windDir, windSpeed, dt)
      skySystem.followCamera(camera.position)

      // Water material uniforms
      waterMaterial.uniforms.uTime.value = elapsed
      waterMaterial.uniforms.uWindDir.value.copy(windDir)
      waterMaterial.uniforms.uWindSpeed.value = windSpeed
      waterMaterial.uniforms.uSunDir.value.copy(sun.position).normalize()
      waterMaterial.uniforms.uSunColor.value.copy(sun.color)
      waterMaterial.uniforms.uSunIntensity.value = sun.intensity
      waterMaterial.uniforms.uAmbientColor.value.copy(ambientLight.color)
      waterMaterial.uniforms.uAmbientIntensity.value = ambientLight.intensity
      waterMaterial.uniforms.uWaterColor.value.copy(getWaterColor(tod))

      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(frameId)
      container.removeEventListener('pointerdown', onPointerDown)
      container.removeEventListener('pointermove', onPointerMove)
      container.removeEventListener('pointerup', onPointerUp)
      container.removeEventListener('pointerleave', onPointerLeave)
      ro.disconnect()
      controls.dispose()
      renderer.dispose()
      skySystem.dispose()
      waterMaterial.dispose()
      for (const { geo, waterGeo } of chunkMap.values()) {
        geo.dispose()
        waterGeo.dispose()
      }
      highlightGeo.dispose()
      highlightMat.dispose()
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
        timeOfDay={timeOfDay}
        onTimeOfDayChange={setTimeOfDay}
      />
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { VoxelWorld } from '../engine/VoxelWorld'
import { buildChunkGeometry, buildWaterGeometry } from '../engine/ChunkMeshBuilder'
import { initWorld } from '../engine/worldInit'
import {
  VOXEL_SIZE,
  VOXEL_HEIGHT,
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
import { ObjectType, OBJECT_NAMES, OBJECT_FOOTPRINT } from '../engine/objectTypes'
import { ObjectManager } from '../engine/ObjectManager'
import { createObjectMesh, updateWindMaterials, buildGolfer } from '../engine/ObjectMeshFactory'
import { Gizmo } from '../engine/Gizmo'
import { WalkController } from '../engine/WalkController'

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
  const gizmoRef = useRef<Gizmo | null>(null)
  const golferGroupRef = useRef<THREE.Group | null>(null)

  const [toolMode, setToolMode] = useState<ToolMode>('raise')
  const [brushSize, setBrushSize] = useState(3)
  const [selectedSurface, setSelectedSurface] = useState<VoxelType>(VoxelType.FAIRWAY_GRASS)
  const [timeOfDay, setTimeOfDay] = useState(14.0)
  const [selectedObjType, setSelectedObjType] = useState<ObjectType>(ObjectType.FLAGSTICK_CUP)
  const [showGolfer, setShowGolfer] = useState(false)
  const [isWalkMode, setIsWalkMode] = useState(false)
  const [isPointerLocked, setIsPointerLocked] = useState(false)

  const toolRef = useRef(toolMode)
  const brushRef = useRef(brushSize)
  const surfaceRef = useRef(selectedSurface)
  const timeOfDayRef = useRef(timeOfDay)
  const selectedObjTypeRef = useRef(selectedObjType)
  const showGolferRef = useRef(showGolfer)
  const isWalkModeRef = useRef(false)
  const walkControllerRef = useRef<WalkController | null>(null)
  const enterWalkRef = useRef<(() => void) | null>(null)
  const exitWalkRef = useRef<(() => void) | null>(null)
  const arrowKeysRef = useRef<Set<string>>(new Set())
  const spaceHeldRef = useRef(false)
  const isPanningRef = useRef(false)
  const lastPanRef = useRef({ x: 0, y: 0 })

  type TweenState = {
    startPos: THREE.Vector3
    endPos: THREE.Vector3
    startQuat: THREE.Quaternion
    endQuat: THREE.Quaternion
    elapsed: number
    duration: number
    onComplete: () => void
  }
  const tweenRef = useRef<TweenState | null>(null)

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
    selectedObjTypeRef.current = selectedObjType
  }, [selectedObjType])
  useEffect(() => {
    showGolferRef.current = showGolfer
  }, [showGolfer])

  // Sync orbit controls mouse buttons with tool mode
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
    // Detach gizmo when leaving object mode
    if (toolMode !== 'object') {
      gizmoRef.current?.detach()
    }
    // Hide golfer when leaving object mode
    if (toolMode !== 'object' && golferGroupRef.current) {
      golferGroupRef.current.visible = false
    }
  }, [toolMode])

  // Label div refs — updated imperatively each frame (avoids React re-renders at 60fps)
  const footprintLabelRef = useRef<HTMLDivElement>(null)
  const snapLabelRef = useRef<HTMLDivElement>(null)
  const elevLabelRef = useRef<HTMLDivElement>(null)

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

    // ── Water material ────────────────────────────────────────────────────────
    const waterMaterial = createWaterMaterial()

    // ── Wind state ────────────────────────────────────────────────────────────
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
      if (isWalkModeRef.current) {
        const dx = camera.position.x - centerX
        const dz = camera.position.z - centerZ
        return Math.sqrt(dx * dx + dz * dz) < 80 ? 0 : 1
      }
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

    // ── Object system ─────────────────────────────────────────────────────────
    const objectManager = new ObjectManager()
    const objectMeshes = new Map<string, THREE.Group>()
    const objectGroups: THREE.Group[] = []
    let selectedObjId: string | null = null

    function addObjectMesh(id: string, group: THREE.Group) {
      group.userData.objectId = id
      scene.add(group)
      objectMeshes.set(id, group)
      objectGroups.push(group)
    }

    function selectObject(id: string) {
      selectedObjId = id
      const obj = objectManager.objects.get(id)!
      gizmoRef.current?.attach(id, obj.position, obj.rotation)
    }

    function deselectObject() {
      selectedObjId = null
      gizmoRef.current?.detach()
    }

    function removeObject(id: string) {
      const group = objectMeshes.get(id)
      if (group) {
        scene.remove(group)
        const idx = objectGroups.indexOf(group)
        if (idx !== -1) objectGroups.splice(idx, 1)
        group.traverse((o) => {
          const m = o as THREE.Mesh
          if (m.isMesh) m.geometry.dispose()
        })
        objectMeshes.delete(id)
      }
      objectManager.remove(id)
    }

    // ── Gizmo ─────────────────────────────────────────────────────────────────
    const gizmo = new Gizmo(scene)
    gizmoRef.current = gizmo

    // ── Golfer silhouette ─────────────────────────────────────────────────────
    const golferGroup = buildGolfer()
    golferGroup.visible = false
    scene.add(golferGroup)
    golferGroupRef.current = golferGroup

    // ── Walk mode ─────────────────────────────────────────────────────────────
    const walkController = new WalkController(camera, renderer.domElement, world)
    walkControllerRef.current = walkController
    walkController.onLockChange = (locked) => setIsPointerLocked(locked)
    walkController.onExitRequest = () => exitWalkModeInner()

    function smoothstep(t: number): number {
      return t * t * (3 - 2 * t)
    }

    function getEntryPoint(): THREE.Vector3 {
      for (const obj of objectManager.getAll()) {
        if (
          obj.type === ObjectType.TEE_MARKER_RED ||
          obj.type === ObjectType.TEE_MARKER_WHITE ||
          obj.type === ObjectType.TEE_MARKER_BLUE
        ) {
          const vx = Math.max(
            0,
            Math.min(
              WORLD_WIDTH_VOXELS - 1,
              Math.floor(obj.position.x / VOXEL_SIZE + WORLD_WIDTH_VOXELS / 2),
            ),
          )
          const vz = Math.max(
            0,
            Math.min(
              WORLD_DEPTH_VOXELS - 1,
              Math.floor(obj.position.z / VOXEL_SIZE + WORLD_DEPTH_VOXELS / 2),
            ),
          )
          const h = world.getSurfaceHeight(vx, vz)
          const groundY = (h >= 0 ? h + 1 : 1) * VOXEL_HEIGHT
          return new THREE.Vector3(obj.position.x, groundY + 1.8, obj.position.z)
        }
      }
      const h = world.getSurfaceHeight(WORLD_WIDTH_VOXELS / 2, WORLD_DEPTH_VOXELS / 2)
      const groundY = (h >= 0 ? h + 1 : 1) * VOXEL_HEIGHT
      return new THREE.Vector3(0, groundY + 1.8, 0)
    }

    function enterWalkModeInner() {
      if (isWalkModeRef.current || tweenRef.current) return
      const entry = getEntryPoint()
      controls.enabled = false
      gizmo.detach()
      golferGroup.visible = false
      highlightMesh.count = 0
      highlightMesh.instanceMatrix.needsUpdate = true

      const endQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0, 'YXZ'))
      tweenRef.current = {
        startPos: camera.position.clone(),
        endPos: entry,
        startQuat: camera.quaternion.clone(),
        endQuat,
        elapsed: 0,
        duration: 2.5,
        onComplete: () => {
          isWalkModeRef.current = true
          setIsWalkMode(true)
          walkController.yaw = 0
          walkController.pitch = 0
          walkController.enable()
          walkController.requestPointerLock()
        },
      }
    }

    function exitWalkModeInner() {
      if (!isWalkModeRef.current) return
      const camPos = camera.position.clone()
      const camQuat = camera.quaternion.clone()

      walkController.disable()
      isWalkModeRef.current = false
      setIsWalkMode(false)
      setIsPointerLocked(false)

      const endPos = new THREE.Vector3(camPos.x, camPos.y + 220, camPos.z + 380)
      controls.target.set(camPos.x, camPos.y - 1.8, camPos.z)

      const tempCam = new THREE.PerspectiveCamera()
      tempCam.position.copy(endPos)
      tempCam.lookAt(controls.target)

      tweenRef.current = {
        startPos: camPos,
        endPos,
        startQuat: camQuat,
        endQuat: tempCam.quaternion.clone(),
        elapsed: 0,
        duration: 1.5,
        onComplete: () => {
          controls.enabled = true
        },
      }
    }

    enterWalkRef.current = enterWalkModeInner
    exitWalkRef.current = exitWalkModeInner

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

    // ── Pan state ─────────────────────────────────────────────────────────────
    function applyPan(dx: number, dy: number) {
      const dist = camera.position.distanceTo(controls.target)
      const scale =
        (dist * 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5)) / container.clientHeight
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0)
      const fwd = new THREE.Vector3().crossVectors(right, new THREE.Vector3(0, 1, 0))
      camera.position.addScaledVector(right, -dx * scale)
      camera.position.addScaledVector(fwd, -dy * scale)
      controls.target.addScaledVector(right, -dx * scale)
      controls.target.addScaledVector(fwd, -dy * scale)
    }

    // ── Raycasting helpers ────────────────────────────────────────────────────
    const raycaster = new THREE.Raycaster()
    const mouseNdc = new THREE.Vector2()
    let isLeftDown = false

    function getNdc(e: PointerEvent): THREE.Vector2 {
      const rect = container.getBoundingClientRect()
      return new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      )
    }

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
      const vy = Math.floor(inward.y / VOXEL_HEIGHT)
      const vz = Math.floor(inward.z / VOXEL_SIZE + WORLD_DEPTH_VOXELS / 2)
      if (!world.inBounds(vx, vy, vz)) return null
      return { vx, vy, vz, worldPoint: hit.point }
    }

    function updateBrushHighlight(e: PointerEvent | null) {
      if (e === null || toolRef.current === 'orbit' || toolRef.current === 'object') {
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
        const wy = (h + 1) * VOXEL_HEIGHT + 0.08
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

    function updateGolferPosition(e: PointerEvent) {
      if (!showGolferRef.current) {
        golferGroup.visible = false
        return
      }
      const ndc = getNdc(e)
      raycaster.setFromCamera(ndc, camera)
      const hits = raycaster.intersectObjects(terrainMeshes)
      if (hits.length > 0) {
        golferGroup.position.copy(hits[0].point)
        golferGroup.visible = true
      } else {
        golferGroup.visible = false
      }
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

    // ── Pointer event handlers ─────────────────────────────────────────────────
    function onPointerDown(e: PointerEvent) {
      if (isWalkModeRef.current) return
      if (e.button !== 0) return

      // Space + left-drag = pan
      if (spaceHeldRef.current) {
        isPanningRef.current = true
        lastPanRef.current.x = e.clientX
        lastPanRef.current.y = e.clientY
        container.setPointerCapture(e.pointerId)
        container.style.cursor = 'grabbing'
        return
      }

      const tool = toolRef.current
      if (tool === 'orbit') return

      if (tool === 'object') {
        const ndc = getNdc(e)

        // 1. Try gizmo handles first
        if (gizmo.onPointerDown(ndc, camera)) {
          isLeftDown = true
          container.setPointerCapture(e.pointerId)
          return
        }

        // 2. Try object meshes → select
        raycaster.setFromCamera(ndc, camera)
        const objHits = raycaster.intersectObjects(objectGroups, true)
        if (objHits.length > 0) {
          let node: THREE.Object3D = objHits[0].object
          while (node.parent && !node.userData.objectId) node = node.parent
          const objId = node.userData.objectId as string | undefined
          if (objId) {
            selectObject(objId)
            return
          }
        }

        // 3. Click on terrain → place new object
        raycaster.setFromCamera(ndc, camera)
        const terrainHits = raycaster.intersectObjects(terrainMeshes)
        if (terrainHits.length > 0) {
          const point = terrainHits[0].point.clone()
          const obj = objectManager.place(selectedObjTypeRef.current, point)
          const group = createObjectMesh(obj.type)
          group.position.copy(obj.position)
          group.rotation.y = obj.rotation
          addObjectMesh(obj.id, group)
          deselectObject()
        }
        return
      }

      // Sculpt tools
      isLeftDown = true
      container.setPointerCapture(e.pointerId)
      const hit = worldCoordsFromHit(e)
      if (hit) applyTool(hit.vx, hit.vy, hit.vz)
    }

    function onPointerMove(e: PointerEvent) {
      if (isWalkModeRef.current) return

      if (isPanningRef.current) {
        applyPan(e.clientX - lastPanRef.current.x, e.clientY - lastPanRef.current.y)
        lastPanRef.current.x = e.clientX
        lastPanRef.current.y = e.clientY
        return
      }

      const tool = toolRef.current

      if (tool === 'object') {
        highlightMesh.count = 0
        updateGolferPosition(e)

        if (isLeftDown && gizmo.isDragging) {
          const ndc = getNdc(e)
          const result = gizmo.onPointerMove(ndc, camera)
          if (result) {
            const id = gizmo.attachedId!
            if (result.position) {
              objectManager.move(id, result.position)
              const grp = objectMeshes.get(id)
              if (grp) grp.position.copy(result.position)
            }
            if (result.rotation !== undefined) {
              objectManager.rotate(id, result.rotation)
              const grp = objectMeshes.get(id)
              if (grp) grp.rotation.y = result.rotation
            }
          }
        }
        return
      }

      updateBrushHighlight(e)
      if (!isLeftDown || !(e.buttons & 1)) return
      if (tool === 'orbit') return
      const hit = worldCoordsFromHit(e)
      if (hit) applyTool(hit.vx, hit.vy, hit.vz)
    }

    function onPointerUp(e: PointerEvent) {
      if (isWalkModeRef.current) return
      if (e.button !== 0) return
      if (isPanningRef.current) {
        isPanningRef.current = false
        container.style.cursor = spaceHeldRef.current ? 'grab' : ''
        return
      }
      isLeftDown = false
      if (toolRef.current === 'object') {
        gizmo.onPointerUp()
      }
    }

    function onPointerLeave() {
      highlightMesh.count = 0
      highlightMesh.instanceMatrix.needsUpdate = true
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.code === 'Space' && !isWalkModeRef.current) {
        spaceHeldRef.current = true
        container.style.cursor = 'grab'
        e.preventDefault()
      }
      if (
        !isWalkModeRef.current &&
        (e.code === 'ArrowLeft' ||
          e.code === 'ArrowRight' ||
          e.code === 'ArrowUp' ||
          e.code === 'ArrowDown')
      ) {
        arrowKeysRef.current.add(e.code)
        e.preventDefault()
      }
      if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        selectedObjId &&
        toolRef.current === 'object'
      ) {
        removeObject(selectedObjId)
        deselectObject()
      }
    }

    function onKeyUp(e: KeyboardEvent) {
      if (e.code === 'Space') {
        spaceHeldRef.current = false
        if (!isPanningRef.current) container.style.cursor = ''
      }
      arrowKeysRef.current.delete(e.code)
    }

    container.addEventListener('pointerdown', onPointerDown)
    container.addEventListener('pointermove', onPointerMove)
    container.addEventListener('pointerup', onPointerUp)
    container.addEventListener('pointerleave', onPointerLeave)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

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

    // ── Label helpers ─────────────────────────────────────────────────────────
    function projectToScreen(worldPos: THREE.Vector3): { x: number; y: number } {
      const p = worldPos.clone().project(camera)
      return {
        x: ((p.x + 1) / 2) * container.clientWidth,
        y: ((-p.y + 1) / 2) * container.clientHeight,
      }
    }

    function hideLabel(el: HTMLDivElement | null) {
      if (el) el.style.display = 'none'
    }

    function showLabel(
      el: HTMLDivElement | null,
      x: number,
      y: number,
      text: string,
      dx = 14,
      dy = 0,
    ) {
      if (!el) return
      el.style.left = `${x + dx}px`
      el.style.top = `${y + dy}px`
      el.textContent = text
      el.style.display = 'block'
    }

    // ── Animate ───────────────────────────────────────────────────────────────
    const clock = new THREE.Clock()
    let frameId: number

    function animate() {
      frameId = requestAnimationFrame(animate)
      const dt = clock.getDelta()
      const elapsed = clock.getElapsedTime()
      const tod = timeOfDayRef.current
      const inWalk = isWalkModeRef.current

      // Cinematic tween
      const tween = tweenRef.current
      if (tween) {
        tween.elapsed = Math.min(tween.elapsed + dt, tween.duration)
        const t = smoothstep(tween.elapsed / tween.duration)
        camera.position.lerpVectors(tween.startPos, tween.endPos, t)
        camera.quaternion.slerpQuaternions(tween.startQuat, tween.endQuat, t)
        if (tween.elapsed >= tween.duration) {
          tweenRef.current = null
          tween.onComplete()
        }
      } else if (inWalk) {
        walkController.update(dt)
      }

      // Rebuild dirty chunks + LOD
      for (const [key, chunk] of world.chunks) {
        const [cx, cz] = key.split(',').map(Number)
        const lod = getLODForChunk(cx, cz)
        if (chunk.isDirty || chunkLOD.get(key) !== lod) {
          rebuildChunk(key, cx, cz, lod)
        }
      }

      // Walk mode: hide far chunks, suppress outlines
      if (inWalk) {
        for (const [key, entry] of chunkMap) {
          const [cx, cz] = key.split(',').map(Number)
          const centerX = (cx + 0.5) * CHUNK_SIZE * VOXEL_SIZE - HALF_W
          const centerZ = (cz + 0.5) * CHUNK_SIZE * VOXEL_SIZE - HALF_D
          const dx = camera.position.x - centerX
          const dz = camera.position.z - centerZ
          const vis = Math.sqrt(dx * dx + dz * dz) < 220
          entry.terrain.visible = vis
          if (entry.outline) entry.outline.visible = false
          if (entry.water) entry.water.visible = vis
        }
      } else {
        for (const entry of chunkMap.values()) {
          entry.terrain.visible = true
          if (entry.outline) entry.outline.visible = true
          if (entry.water) entry.water.visible = true
        }
      }

      // Fog near/far — tighter in walk mode to hide LOD seam
      const fog = scene.fog as THREE.Fog
      fog.near = inWalk ? 180 : 1000
      fog.far = inWalk ? 260 : 2000

      // Wind
      const windAngle = elapsed * 0.04
      windDir.set(Math.cos(windAngle), Math.sin(windAngle) * 0.4).normalize()
      windSpeed = 0.3 + Math.sin(elapsed * 0.11) * 0.12 + 0.12

      // Lighting
      sun.position.copy(getSunPosition(tod))
      sun.intensity = getSunIntensity(tod)
      ambientLight.intensity = getAmbientIntensity(tod)

      // Fog + background
      const fogCol = getFogColor(tod)
      bgColor.copy(fogCol)
      ;(scene.fog as THREE.Fog).color.copy(fogCol)

      // Sky
      skySystem.update(tod, windDir, windSpeed, dt)
      skySystem.followCamera(camera.position)

      // Water
      waterMaterial.uniforms.uTime.value = elapsed
      waterMaterial.uniforms.uWindDir.value.copy(windDir)
      waterMaterial.uniforms.uWindSpeed.value = windSpeed
      waterMaterial.uniforms.uSunDir.value.copy(sun.position).normalize()
      waterMaterial.uniforms.uSunColor.value.copy(sun.color)
      waterMaterial.uniforms.uSunIntensity.value = sun.intensity
      waterMaterial.uniforms.uAmbientColor.value.copy(ambientLight.color)
      waterMaterial.uniforms.uAmbientIntensity.value = ambientLight.intensity
      waterMaterial.uniforms.uWaterColor.value.copy(getWaterColor(tod))

      // Tree wind
      updateWindMaterials(elapsed, windDir, windSpeed)

      // Gizmo scale
      if (gizmo.group.visible) {
        gizmo.updateScale(camera)
      }

      // Labels
      const fl = footprintLabelRef.current
      const sl = snapLabelRef.current
      const el = elevLabelRef.current

      if (selectedObjId && gizmo.group.visible) {
        const obj = objectManager.objects.get(selectedObjId)
        if (obj) {
          const { x, y } = projectToScreen(gizmo.group.position)

          if (!gizmo.isDragging) {
            const fp = OBJECT_FOOTPRINT[obj.type]
            showLabel(fl, x, y, `${fp[0]}m × ${fp[1]}m`)
          } else {
            hideLabel(fl)
          }

          if (
            gizmo.isDragging &&
            (gizmo.dragMode === 'translateX' || gizmo.dragMode === 'translateZ')
          ) {
            let nearest: { name: string; dist: number } | null = null
            for (const other of objectManager.getAll()) {
              if (other.id === selectedObjId) continue
              const dx2 = obj.position.x - other.position.x
              const dz2 = obj.position.z - other.position.z
              const dist = Math.sqrt(dx2 * dx2 + dz2 * dz2)
              if (dist < 50 && (!nearest || dist < nearest.dist)) {
                nearest = { name: OBJECT_NAMES[other.type], dist: Math.round(dist) }
              }
            }
            if (nearest) {
              showLabel(sl, x, y, `${nearest.dist}m from ${nearest.name}`, 14, 20)
            } else {
              hideLabel(sl)
            }
          } else {
            hideLabel(sl)
          }

          if (gizmo.isDragging && gizmo.dragMode === 'translateY') {
            showLabel(el, x, y, `Y: ${obj.position.y.toFixed(1)}m`, 14, -20)
          } else {
            hideLabel(el)
          }
        }
      } else {
        hideLabel(fl)
        hideLabel(sl)
        hideLabel(el)
      }

      // Arrow key panning (orbital / sculpt modes only)
      if (!inWalk && !tweenRef.current && arrowKeysRef.current.size > 0) {
        const dist = camera.position.distanceTo(controls.target)
        const speed = dist * 1.5 * dt
        const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0)
        const fwd = new THREE.Vector3().crossVectors(right, new THREE.Vector3(0, 1, 0))
        const offset = new THREE.Vector3()
        if (arrowKeysRef.current.has('ArrowLeft')) offset.addScaledVector(right, -speed)
        if (arrowKeysRef.current.has('ArrowRight')) offset.addScaledVector(right, speed)
        if (arrowKeysRef.current.has('ArrowUp')) offset.addScaledVector(fwd, -speed)
        if (arrowKeysRef.current.has('ArrowDown')) offset.addScaledVector(fwd, speed)
        camera.position.add(offset)
        controls.target.add(offset)
      }

      if (!inWalk) controls.update()
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(frameId)
      walkController.disable()
      container.removeEventListener('pointerdown', onPointerDown)
      container.removeEventListener('pointermove', onPointerMove)
      container.removeEventListener('pointerup', onPointerUp)
      container.removeEventListener('pointerleave', onPointerLeave)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      ro.disconnect()
      controls.dispose()
      renderer.dispose()
      skySystem.dispose()
      waterMaterial.dispose()
      for (const { geo, waterGeo } of chunkMap.values()) {
        geo.dispose()
        waterGeo.dispose()
      }
      for (const group of objectMeshes.values()) {
        group.traverse((o) => {
          const m = o as THREE.Mesh
          if (m.isMesh) m.geometry.dispose()
        })
      }
      highlightGeo.dispose()
      highlightMat.dispose()
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement)
    }
  }, [])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {!isWalkMode && (
        <Toolbar
          toolMode={toolMode}
          onToolChange={setToolMode}
          brushSize={brushSize}
          onBrushChange={setBrushSize}
          selectedSurface={selectedSurface}
          onSurfaceChange={setSelectedSurface}
          timeOfDay={timeOfDay}
          onTimeOfDayChange={setTimeOfDay}
          selectedObjType={selectedObjType}
          onObjTypeChange={setSelectedObjType}
          showGolfer={showGolfer}
          onGolferToggle={() => setShowGolfer((s) => !s)}
          onEnterWalk={() => enterWalkRef.current?.()}
        />
      )}
      {isWalkMode && (
        <>
          {/* Crosshair — always visible when locked */}
          {isPointerLocked && (
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                pointerEvents: 'none',
                color: 'rgba(255,255,255,0.7)',
                fontSize: 20,
                lineHeight: 1,
                fontFamily: 'monospace',
                textShadow: '0 0 4px rgba(0,0,0,0.8)',
                userSelect: 'none',
              }}
            >
              +
            </div>
          )}
          {/* Unlock overlay — shown when pointer lock is released */}
          {!isPointerLocked && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0,0,0,0.55)',
                backdropFilter: 'blur(2px)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 12,
                  background: 'rgba(0,0,0,0.82)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 12,
                  padding: '24px 32px',
                  fontFamily: 'monospace',
                  color: 'rgba(255,255,255,0.8)',
                  minWidth: 220,
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.05em' }}>
                  WALK MODE
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: 'rgba(255,255,255,0.4)',
                    textAlign: 'center',
                    lineHeight: 1.7,
                  }}
                >
                  WASD — move
                  <br />
                  Shift — run
                  <br />
                  Mouse — look
                  <br />
                  Esc — release mouse
                </div>
                <button
                  onClick={() => walkControllerRef.current?.requestPointerLock()}
                  style={{
                    background: 'rgba(34,197,94,0.18)',
                    border: '1px solid rgba(34,197,94,0.4)',
                    borderRadius: 6,
                    color: 'rgba(134,239,172,0.9)',
                    fontFamily: 'monospace',
                    fontSize: 11,
                    padding: '6px 16px',
                    cursor: 'pointer',
                    width: '100%',
                  }}
                >
                  Click to capture mouse
                </button>
                <button
                  onClick={() => exitWalkRef.current?.()}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 6,
                    color: 'rgba(255,255,255,0.4)',
                    fontFamily: 'monospace',
                    fontSize: 11,
                    padding: '6px 16px',
                    cursor: 'pointer',
                    width: '100%',
                  }}
                >
                  Exit walk mode
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {/* Labels — updated imperatively in animate loop */}
      <div
        ref={footprintLabelRef}
        style={{
          display: 'none',
          position: 'absolute',
          pointerEvents: 'none',
          background: 'rgba(0,0,0,0.72)',
          color: 'rgba(255,255,255,0.82)',
          padding: '3px 8px',
          borderRadius: '5px',
          fontFamily: 'monospace',
          fontSize: '11px',
          whiteSpace: 'nowrap',
        }}
      />
      <div
        ref={snapLabelRef}
        style={{
          display: 'none',
          position: 'absolute',
          pointerEvents: 'none',
          background: 'rgba(0,0,0,0.72)',
          color: 'rgba(255,255,180,0.82)',
          padding: '3px 8px',
          borderRadius: '5px',
          fontFamily: 'monospace',
          fontSize: '11px',
          whiteSpace: 'nowrap',
        }}
      />
      <div
        ref={elevLabelRef}
        style={{
          display: 'none',
          position: 'absolute',
          pointerEvents: 'none',
          background: 'rgba(0,0,0,0.72)',
          color: 'rgba(120,255,160,0.9)',
          padding: '3px 8px',
          borderRadius: '5px',
          fontFamily: 'monospace',
          fontSize: '11px',
          whiteSpace: 'nowrap',
        }}
      />
    </div>
  )
}

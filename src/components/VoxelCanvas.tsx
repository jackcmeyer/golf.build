import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { VoxelType, VOXEL_COLORS } from '../voxelTypes'

const VOXEL_SIZE = 2
const GRID = 20

function surfaceAt(x: number, z: number): VoxelType {
  if (z <= 2 && x >= 7 && x <= 12) return VoxelType.TEE_GRASS
  if (x >= 7 && x <= 12 && z >= 3 && z <= 10) return VoxelType.FAIRWAY_GRASS
  if (x >= 6 && x <= 13 && z >= 11 && z <= 16) return VoxelType.GREEN_GRASS
  if (z >= 12 && z <= 15 && (x === 4 || x === 5)) return VoxelType.BUNKER_SAND_WHITE
  if (z >= 12 && z <= 15 && (x === 14 || x === 15)) return VoxelType.BUNKER_SAND_WHITE
  if (x === 14 && z >= 3 && z <= 10) return VoxelType.CART_PATH_CONCRETE
  if (x >= 15 && z >= 15) return VoxelType.STILL_WATER
  if (x <= 3 && z >= 14) return VoxelType.HEATHER
  if (x >= 3 && x <= 16 && z >= 3 && z <= 16) return VoxelType.INTERMEDIATE_ROUGH
  return VoxelType.PRIMARY_ROUGH
}

export default function VoxelCanvas() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current!

    // ── Renderer ──────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    container.appendChild(renderer.domElement)

    // ── Scene ─────────────────────────────────────────────────────────────────
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x8ab4d4)
    scene.fog = new THREE.Fog(0x8ab4d4, 80, 200)

    // ── Camera ────────────────────────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 10000)
    camera.position.set(0, 30, 45)

    // ── Controls ──────────────────────────────────────────────────────────────
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.06
    controls.screenSpacePanning = false
    controls.minDistance = 5
    controls.maxDistance = 300
    controls.maxPolarAngle = Math.PI / 2.05

    // ── Lighting ──────────────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xd0e8ff, 0.6))

    const sunLight = new THREE.DirectionalLight(0xfff0d0, 1.4)
    sunLight.position.set(60, 100, 40)
    sunLight.castShadow = true
    sunLight.shadow.mapSize.set(2048, 2048)
    sunLight.shadow.camera.near = 0.5
    sunLight.shadow.camera.far = 300
    const sc = sunLight.shadow.camera as THREE.OrthographicCamera
    sc.left = -60; sc.right = 60; sc.top = 60; sc.bottom = -60
    sunLight.shadow.bias = -0.001
    scene.add(sunLight)

    // ── Materials ─────────────────────────────────────────────────────────────
    const materialCache = new Map<VoxelType, THREE.MeshLambertMaterial>()
    function getMaterial(type: VoxelType) {
      if (!materialCache.has(type)) {
        materialCache.set(type, new THREE.MeshLambertMaterial({
          color: VOXEL_COLORS[type] ?? 0xff00ff,
        }))
      }
      return materialCache.get(type)!
    }

    // ── Voxel grid ────────────────────────────────────────────────────────────
    const boxGeo = new THREE.BoxGeometry(VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE)
    for (let x = 0; x < GRID; x++) {
      for (let z = 0; z < GRID; z++) {
        const mesh = new THREE.Mesh(boxGeo, getMaterial(surfaceAt(x, z)))
        mesh.position.set(
          (x - GRID / 2 + 0.5) * VOXEL_SIZE,
          0,
          (z - GRID / 2 + 0.5) * VOXEL_SIZE,
        )
        mesh.receiveShadow = true
        scene.add(mesh)
      }
    }

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

    // ── Loop ──────────────────────────────────────────────────────────────────
    let frameId: number
    function animate() {
      frameId = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(frameId)
      ro.disconnect()
      controls.dispose()
      renderer.dispose()
      materialCache.forEach(m => m.dispose())
      boxGeo.dispose()
      container.removeChild(renderer.domElement)
    }
  }, [])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}

import * as THREE from 'three'
import { ObjectType } from './objectTypes'

// ── Wind material ─────────────────────────────────────────────────────────────
// Cached by color so all trees of the same foliage type share one program,
// but the spatial offset in the shader (transformed.x * 0.25) means different
// trees appear to sway at different phases even with shared uniforms.

const _windMats = new Map<number, THREE.MeshLambertMaterial>()
const _windMatList: THREE.MeshLambertMaterial[] = []

function makeWindMat(hex: number): THREE.MeshLambertMaterial {
  if (_windMats.has(hex)) return _windMats.get(hex)!
  const mat = new THREE.MeshLambertMaterial({ color: hex })
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 }
    shader.uniforms.uWindDir = { value: new THREE.Vector2(1, 0) }
    shader.uniforms.uWindSpeed = { value: 0.4 }
    shader.vertexShader = `
      uniform float uTime;
      uniform vec2 uWindDir;
      uniform float uWindSpeed;
      ${shader.vertexShader}
    `.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      float _h = max(0.0, position.y) / 6.0;
      float _w = sin(uTime * 1.7 + transformed.x * 0.25) * _h * uWindSpeed * 0.55;
      transformed.x += uWindDir.x * _w;
      transformed.z += uWindDir.y * _w;`,
    )
    mat.userData.windShader = shader
  }
  _windMats.set(hex, mat)
  _windMatList.push(mat)
  return mat
}

export function updateWindMaterials(time: number, windDir: THREE.Vector2, windSpeed: number) {
  for (const mat of _windMatList) {
    const sh = mat.userData.windShader
    if (!sh) continue
    sh.uniforms.uTime.value = time
    sh.uniforms.uWindDir.value.copy(windDir)
    sh.uniforms.uWindSpeed.value = windSpeed
  }
}

// ── Flat material cache ───────────────────────────────────────────────────────
const _flatMats = new Map<number, THREE.MeshLambertMaterial>()
function flatMat(hex: number): THREE.MeshLambertMaterial {
  if (!_flatMats.has(hex)) _flatMats.set(hex, new THREE.MeshLambertMaterial({ color: hex }))
  return _flatMats.get(hex)!
}

// ── Box helper ────────────────────────────────────────────────────────────────
function box(w: number, h: number, d: number, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
  m.castShadow = true
  m.receiveShadow = true
  return m
}

// ── Object builders ───────────────────────────────────────────────────────────

function buildFlagstick(): THREE.Group {
  const g = new THREE.Group()
  const cup = box(0.9, 0.15, 0.9, flatMat(0x888888))
  cup.position.y = 0.075
  g.add(cup)
  const pole = box(0.07, 7.2, 0.07, flatMat(0xe0e0e0))
  pole.position.y = 3.6
  g.add(pole)
  const flagMat = new THREE.MeshLambertMaterial({ color: 0xe83232, side: THREE.DoubleSide })
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.7), flagMat)
  flag.position.set(0.6, 6.1, 0)
  flag.castShadow = true
  g.add(flag)
  return g
}

function buildTeeMarker(color: number): THREE.Group {
  const g = new THREE.Group()
  const block = box(0.55, 0.55, 0.55, flatMat(color))
  block.position.y = 0.275
  g.add(block)
  return g
}

function buildBench(): THREE.Group {
  const g = new THREE.Group()
  const seat = box(1.8, 0.1, 0.5, flatMat(0x9a6830))
  seat.position.y = 0.5
  g.add(seat)
  const back = box(1.8, 0.5, 0.08, flatMat(0x9a6830))
  back.position.set(0, 0.8, -0.22)
  g.add(back)
  const legMat = flatMat(0x7a5020)
  for (const [x, z] of [
    [-0.78, 0.2],
    [0.78, 0.2],
    [-0.78, -0.2],
    [0.78, -0.2],
  ] as [number, number][]) {
    const leg = box(0.08, 0.5, 0.08, legMat)
    leg.position.set(x, 0.25, z)
    g.add(leg)
  }
  return g
}

function buildPine(): THREE.Group {
  const g = new THREE.Group()
  const trunk = box(0.45, 3.0, 0.45, flatMat(0x5a3810))
  trunk.position.y = 1.5
  g.add(trunk)
  const layers = [
    { y: 3.2, w: 3.2, h: 2.0, col: 0x2d6a1e },
    { y: 4.8, w: 2.4, h: 1.8, col: 0x267a18 },
    { y: 6.2, w: 1.5, h: 1.6, col: 0x1f8012 },
  ]
  for (const { y, w, h, col } of layers) {
    const layer = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), makeWindMat(col))
    layer.castShadow = true
    layer.position.y = y
    g.add(layer)
  }
  return g
}

function buildOak(): THREE.Group {
  const g = new THREE.Group()
  const trunk = box(0.7, 4.5, 0.7, flatMat(0x5a3810))
  trunk.position.y = 2.25
  g.add(trunk)
  const canopy = new THREE.Mesh(new THREE.IcosahedronGeometry(3.4, 1), makeWindMat(0x3a8030))
  canopy.castShadow = true
  canopy.position.y = 6.2
  g.add(canopy)
  return g
}

function buildStoneWall(): THREE.Group {
  const g = new THREE.Group()
  const mat = flatMat(0x888078)
  // 3 rows × 4 stones — fixed dims give deterministic variation
  const dims: [number, number, number][] = [
    [0.9, 0.38, 0.52],
    [0.88, 0.42, 0.5],
    [0.92, 0.4, 0.54],
    [0.86, 0.39, 0.51],
  ]
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 4; i++) {
      const [w, h, d] = dims[i]
      const stone = box(w, h, d, mat)
      stone.position.set(i * 1.02 - 1.53, row * 0.4 + h / 2, 0)
      g.add(stone)
    }
  }
  return g
}

// ── Public factory ────────────────────────────────────────────────────────────

export function createObjectMesh(type: ObjectType): THREE.Group {
  switch (type) {
    case ObjectType.FLAGSTICK_CUP:
      return buildFlagstick()
    case ObjectType.TEE_MARKER_RED:
      return buildTeeMarker(0xcc2222)
    case ObjectType.TEE_MARKER_WHITE:
      return buildTeeMarker(0xeeeeee)
    case ObjectType.TEE_MARKER_BLUE:
      return buildTeeMarker(0x2244cc)
    case ObjectType.BENCH_WOOD:
      return buildBench()
    case ObjectType.PINE_CONIFER:
      return buildPine()
    case ObjectType.OAK_FULL:
      return buildOak()
    case ObjectType.STONE_WALL:
      return buildStoneWall()
  }
}

export function buildGolfer(): THREE.Group {
  const g = new THREE.Group()
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 })
  for (const x of [-0.1, 0.1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.65, 8), mat)
    leg.position.set(x, 0.325, 0)
    g.add(leg)
  }
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 1.0, 8), mat)
  body.position.y = 1.0
  g.add(body)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 8, 8), mat)
  head.position.y = 1.7
  g.add(head)
  return g
}

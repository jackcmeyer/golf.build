import * as THREE from 'three'
import { type Annotation, RING_STEP_YARDS, toYards, yardsToMeters } from './annotationTypes'

// ── Tunables ──────────────────────────────────────────────────────────────────
const C_ARC = 0xffffff
const C_ARC_KEY = 0x5ee08a // accent for the 150-yd arc
const C_LINE = 0xffffff
const C_HANDLE = 0xffd24a // gold — reads as draggable
const ARC_BAND = 0.25 // arc thickness (m)
const ARC_LIFT = 0.4 // float above the anchor plane (m)
const ARC_SPAN = (140 * Math.PI) / 180 // hole arcs sweep ~140° toward the tee
const HANDLE_R = 3 // endpoint disc radius (m)
const LABEL_BASE_M = 7 // base world height of a label before camera rescale

// ── Text label sprites ──────────────────────────────────────────────────────────
// Canvas-textured billboard. Marked non-pickable so labels never steal a drag.
function makeTextSprite(text: string, color = '#ffffff'): THREE.Sprite {
  const font = 64
  const padX = 22
  const padY = 14
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  ctx.font = `bold ${font}px ui-monospace, monospace`
  const w = Math.ceil(ctx.measureText(text).width) + padX * 2
  const h = font + padY * 2
  canvas.width = w
  canvas.height = h
  // Context resets on resize — restate everything.
  ctx.font = `bold ${font}px ui-monospace, monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(10,12,14,0.78)'
  ctx.roundRect(0, 0, w, h, 16)
  ctx.fill()
  ctx.fillStyle = color
  ctx.fillText(text, w / 2, h / 2 + 2)

  const tex = new THREE.CanvasTexture(canvas)
  tex.minFilter = THREE.LinearFilter
  tex.anisotropy = 4
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })
  const spr = new THREE.Sprite(mat)
  const aspect = w / h
  spr.scale.set(LABEL_BASE_M * aspect, LABEL_BASE_M, 1)
  spr.renderOrder = 1001
  spr.userData.labelAspect = aspect
  spr.raycast = () => {} // never pickable
  return spr
}

// ── Primitive helpers ───────────────────────────────────────────────────────────
function overlayMat(color: number, opacity: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
    depthTest: false,
  })
}

// A flat ring band lying in the XZ plane, centered at `center`.
// thetaStart/thetaLength are in ring-local angle space (see bearing math below).
function ringBand(
  center: THREE.Vector3,
  radius: number,
  color: number,
  opacity: number,
  thetaStart = 0,
  thetaLength = Math.PI * 2,
): THREE.Mesh {
  const inner = Math.max(0.01, radius - ARC_BAND / 2)
  const outer = radius + ARC_BAND / 2
  const geo = new THREE.RingGeometry(inner, outer, 96, 1, thetaStart, thetaLength)
  const mesh = new THREE.Mesh(geo, overlayMat(color, opacity))
  mesh.rotation.x = -Math.PI / 2
  mesh.position.set(center.x, center.y + ARC_LIFT, center.z)
  mesh.renderOrder = 1000
  return mesh
}

// Filled disc handle, tagged with handleKey so the canvas can drag it.
function handleDisc(center: THREE.Vector3, key: string): THREE.Mesh {
  const geo = new THREE.CircleGeometry(HANDLE_R, 32)
  const mesh = new THREE.Mesh(geo, overlayMat(C_HANDLE, 0.85))
  mesh.rotation.x = -Math.PI / 2
  mesh.position.set(center.x, center.y + ARC_LIFT + 0.05, center.z)
  mesh.renderOrder = 1002
  mesh.userData.handleKey = key
  mesh.userData.isAnnotationHandle = true // rescaled with camera distance for grabbability
  return mesh
}

// Ring-local angle is mirrored from world bearing once laid flat (rotation.x = -90°):
// a point at world bearing θ corresponds to ring angle φ = -θ.
function worldBearing(from: THREE.Vector3, to: THREE.Vector3): number {
  return Math.atan2(to.z - from.z, to.x - from.x)
}

// ── Hole: tee → green centerline + yardage arcs counting up from the tee ─────────
function buildHole(tee: THREE.Vector3, green: THREE.Vector3): THREE.Group {
  const g = new THREE.Group()
  const lengthM = green.distanceTo(tee)
  const bearing = worldBearing(tee, green) // tee → green direction
  const phiCenter = -bearing
  const thetaStart = phiCenter - ARC_SPAN / 2

  // Yardage arcs counting up from the tee toward the green.
  const totalYards = toYards(lengthM)
  const dir = new THREE.Vector3().subVectors(green, tee).setY(0).normalize()
  for (
    let y = RING_STEP_YARDS;
    yardsToMeters(y) < lengthM && y <= totalYards;
    y += RING_STEP_YARDS
  ) {
    const r = yardsToMeters(y)
    const isKey = y === 150
    g.add(ringBand(tee, r, isKey ? C_ARC_KEY : C_ARC, isKey ? 0.85 : 0.5, thetaStart, ARC_SPAN))
    const labelPos = new THREE.Vector3().copy(tee).addScaledVector(dir, r)
    const label = makeTextSprite(String(y), isKey ? '#bdfdd4' : '#ffffff')
    label.position.set(labelPos.x, labelPos.y + ARC_LIFT + 2, labelPos.z)
    g.add(label)
  }

  // Dashed centerline, lifted above the higher endpoint.
  const lift = Math.max(tee.y, green.y) + 0.6
  const lineGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(tee.x, lift, tee.z),
    new THREE.Vector3(green.x, lift, green.z),
  ])
  const line = new THREE.Line(
    lineGeo,
    new THREE.LineDashedMaterial({
      color: C_LINE,
      transparent: true,
      opacity: 0.75,
      depthTest: false,
      dashSize: 4,
      gapSize: 3,
    }),
  )
  line.computeLineDistances()
  line.renderOrder = 1000
  line.raycast = () => {} // selection happens via arcs/handles
  g.add(line)

  // Endpoint handles.
  g.add(handleDisc(tee, 'tee'))
  g.add(handleDisc(green, 'green'))

  // Total yardage label, near the green.
  const total = makeTextSprite(`${Math.round(totalYards)} yd`, '#ffe9a8')
  total.position.set(green.x, green.y + ARC_LIFT + 6, green.z)
  g.add(total)

  return g
}

// ── Public factory ────────────────────────────────────────────────────────────
export function createAnnotationMesh(ann: Annotation): THREE.Group {
  const group = buildHole(ann.tee, ann.green)
  group.userData.annotationId = ann.id
  return group
}

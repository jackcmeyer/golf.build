import * as THREE from 'three'
import { getSkyColors, getSunPosition } from './worldState'

function createCloudTexture(): THREE.Texture {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, size, size)
  const rng = (seed: number) => {
    const x = Math.sin(seed * 127.1) * 43758.5453
    return x - Math.floor(x)
  }
  for (let i = 0; i < 40; i++) {
    const cx = rng(i * 3) * size
    const cy = rng(i * 3 + 1) * size
    const r = 18 + rng(i * 3 + 2) * 70
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r)
    grad.addColorStop(0, 'rgba(255,255,255,0.55)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fill()
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  return tex
}

function createSunTexture(): THREE.Texture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const cx = size / 2
  const cy = size / 2
  // Outer halo
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, size / 2)
  g.addColorStop(0, 'rgba(255,248,200,1)')
  g.addColorStop(0.28, 'rgba(255,230,120,0.7)')
  g.addColorStop(0.55, 'rgba(255,200,60,0.2)')
  g.addColorStop(1, 'rgba(255,180,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return new THREE.CanvasTexture(canvas)
}

const CLOUD_CONFIGS = [
  { y: 600, scale: 8000, baseOpacity: 0.55, speed: 0.008 },
  { y: 900, scale: 6000, baseOpacity: 0.38, speed: 0.005 },
  { y: 1400, scale: 10000, baseOpacity: 0.22, speed: 0.003 },
]

export class SkySystem {
  private skyMat: THREE.ShaderMaterial
  private skyMesh: THREE.Mesh
  private sunSprite: THREE.Sprite
  private sunMat: THREE.SpriteMaterial
  private cloudMats: THREE.ShaderMaterial[] = []
  private cloudMeshes: THREE.Mesh[] = []
  private cloudOffsets: THREE.Vector2[] = []
  private cloudTex: THREE.Texture
  private sunTex: THREE.Texture
  private _sunDir = new THREE.Vector3(0, 1, 0)

  constructor(scene: THREE.Scene) {
    // Sky sphere — inverted so interior faces render
    const skyGeo = new THREE.SphereGeometry(4500, 32, 16)
    skyGeo.scale(-1, 1, 1)
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.FrontSide,
      depthWrite: false,
      uniforms: {
        uTop: { value: new THREE.Color(0x1a6aaa) },
        uHorizon: { value: new THREE.Color(0x4a9ad4) },
        uGround: { value: new THREE.Color(0x8ab4d4) },
      },
      vertexShader: `
        varying float vY;
        void main() {
          vY = normalize(position).y;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uTop;
        uniform vec3 uHorizon;
        uniform vec3 uGround;
        varying float vY;
        void main() {
          vec3 color;
          if (vY >= 0.0) {
            color = mix(uHorizon, uTop, pow(clamp(vY, 0.0, 1.0), 0.55));
          } else {
            color = mix(uHorizon, uGround, pow(clamp(-vY, 0.0, 1.0), 0.4));
          }
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    })
    this.skyMesh = new THREE.Mesh(skyGeo, this.skyMat)
    this.skyMesh.renderOrder = -2
    scene.add(this.skyMesh)

    // Sun billboard sprite
    this.sunTex = createSunTexture()
    this.sunMat = new THREE.SpriteMaterial({
      map: this.sunTex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    this.sunSprite = new THREE.Sprite(this.sunMat)
    this.sunSprite.scale.set(180, 180, 1)
    this.sunSprite.renderOrder = -1
    scene.add(this.sunSprite)

    // Cloud layers
    this.cloudTex = createCloudTexture()
    for (let i = 0; i < CLOUD_CONFIGS.length; i++) {
      const cfg = CLOUD_CONFIGS[i]
      const mat = new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: {
          uTex: { value: this.cloudTex },
          uOffset: { value: new THREE.Vector2(0, 0) },
          uOpacity: { value: cfg.baseOpacity },
          uColor: { value: new THREE.Color(1, 1, 1) },
        },
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform sampler2D uTex;
          uniform vec2 uOffset;
          uniform float uOpacity;
          uniform vec3 uColor;
          varying vec2 vUv;
          void main() {
            vec4 s = texture2D(uTex, vUv + uOffset);
            gl_FragColor = vec4(uColor * s.rgb, s.a * uOpacity);
          }
        `,
      })
      const geo = new THREE.PlaneGeometry(cfg.scale, cfg.scale)
      const mesh = new THREE.Mesh(geo, mat)
      mesh.rotation.x = -Math.PI / 2
      mesh.position.y = cfg.y
      mesh.renderOrder = -1
      scene.add(mesh)
      this.cloudMats.push(mat)
      this.cloudMeshes.push(mesh)
      this.cloudOffsets.push(new THREE.Vector2(0, 0))
    }
  }

  update(timeOfDay: number, windDir: THREE.Vector2, windSpeed: number, dt: number) {
    // Sky gradient
    const [top, horizon, ground] = getSkyColors(timeOfDay)
    this.skyMat.uniforms.uTop.value.copy(top)
    this.skyMat.uniforms.uHorizon.value.copy(horizon)
    this.skyMat.uniforms.uGround.value.copy(ground)

    // Sun direction (world-space, updated here; position set in followCamera)
    this._sunDir.copy(getSunPosition(timeOfDay)).normalize()
    const dayFrac = Math.min(timeOfDay - 5.5, 21.5 - timeOfDay) / 2
    this.sunMat.opacity = Math.max(0, Math.min(1, dayFrac))
    // Warmer color at dawn/dusk
    const warmSun = timeOfDay < 9 || timeOfDay > 17
    this.sunMat.color.set(warmSun ? 0xff9944 : 0xfffce0)

    // Clouds
    const nightFade = Math.max(0, Math.min(1, Math.min(timeOfDay - 5, 22 - timeOfDay) * 0.4))
    for (let i = 0; i < CLOUD_CONFIGS.length; i++) {
      const cfg = CLOUD_CONFIGS[i]
      this.cloudOffsets[i].x += windDir.x * cfg.speed * windSpeed * dt
      this.cloudOffsets[i].y += windDir.y * cfg.speed * windSpeed * dt
      this.cloudMats[i].uniforms.uOffset.value.copy(this.cloudOffsets[i])
      this.cloudMats[i].uniforms.uOpacity.value = cfg.baseOpacity * nightFade

      const col = this.cloudMats[i].uniforms.uColor.value as THREE.Color
      if (timeOfDay < 7.5) col.set(1.0, 0.78, 0.65)
      else if (timeOfDay > 17.5) col.set(0.95, 0.6, 0.35)
      else col.set(1, 1, 1)
    }
  }

  followCamera(pos: THREE.Vector3) {
    this.skyMesh.position.set(pos.x, 0, pos.z)
    for (const mesh of this.cloudMeshes) {
      mesh.position.x = pos.x
      mesh.position.z = pos.z
    }
    // Sun tracks camera so it always appears in the same direction (infinitely far)
    this.sunSprite.position.set(
      pos.x + this._sunDir.x * 850,
      this._sunDir.y * 750,
      pos.z + this._sunDir.z * 850,
    )
  }

  dispose() {
    this.skyMat.dispose()
    this.sunMat.dispose()
    this.sunTex.dispose()
    this.cloudTex.dispose()
    for (const mat of this.cloudMats) mat.dispose()
    for (const mesh of this.cloudMeshes) (mesh.geometry as THREE.BufferGeometry).dispose()
    ;(this.skyMesh.geometry as THREE.BufferGeometry).dispose()
  }
}

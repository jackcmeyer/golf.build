import * as THREE from 'three'

export function getSunPosition(timeOfDay: number): THREE.Vector3 {
  const angle = ((timeOfDay - 6) / 14) * Math.PI
  const elevation = Math.sin(angle)
  const azimuth = ((timeOfDay - 12) / 12) * Math.PI
  return new THREE.Vector3(Math.cos(azimuth) * 1000, elevation * 800, Math.sin(azimuth) * 1000)
}

export function getSunColor(timeOfDay: number): THREE.Color {
  // Warm white at all times — pure orange/red would tint terrain unrealistically
  if (timeOfDay < 5.5 || timeOfDay > 21.5) return new THREE.Color(0x000000)
  if (timeOfDay < 7) return new THREE.Color(0xffc890) // soft peach-orange at sunrise
  if (timeOfDay < 9) return new THREE.Color(0xffe8c8) // pale warm morning
  if (timeOfDay < 16) return new THREE.Color(0xffffff) // neutral midday
  if (timeOfDay < 18.5) return new THREE.Color(0xffe8c0) // pale warm golden hour
  if (timeOfDay < 20) return new THREE.Color(0xffcc98) // gentle sunset warmth
  if (timeOfDay < 21.5) return new THREE.Color(0xffa870) // deeper at twilight's end
  return new THREE.Color(0x000000)
}

export function getSunIntensity(timeOfDay: number): number {
  if (timeOfDay < 5.5 || timeOfDay > 21.5) return 0
  if (timeOfDay < 7) return 0.35
  if (timeOfDay < 8) return 0.75
  if (timeOfDay < 9) return 1.05
  if (timeOfDay < 16) return 1.25
  if (timeOfDay < 18) return 1.0
  if (timeOfDay < 19.5) return 0.55
  if (timeOfDay < 21) return 0.25
  return 0
}

export function getAmbientColor(timeOfDay: number): THREE.Color {
  // Ambient is sky bounce light — nearly neutral, very subtle hue shift only
  if (timeOfDay < 5 || timeOfDay > 22) return new THREE.Color(0x08091a)
  if (timeOfDay < 7) return new THREE.Color(0xd8c8b8) // pale warm grey at dawn
  if (timeOfDay < 10) return new THREE.Color(0xe8edf8) // faint cool blue morning sky
  if (timeOfDay < 16) return new THREE.Color(0xd8e8f8) // pale sky blue
  if (timeOfDay < 19) return new THREE.Color(0xf0e0d0) // faint warm afternoon
  if (timeOfDay < 21) return new THREE.Color(0xe0c8b8) // gentle warm evening
  return new THREE.Color(0x08091a)
}

export function getAmbientIntensity(timeOfDay: number): number {
  if (timeOfDay < 5 || timeOfDay > 22) return 0.06
  if (timeOfDay < 7) return 0.22
  if (timeOfDay < 8) return 0.38
  if (timeOfDay < 16) return 0.48
  if (timeOfDay < 19) return 0.42
  if (timeOfDay < 21) return 0.25
  return 0.06
}

// [topColor, horizonColor, groundColor] — sky sphere gradient
// Rule: ground color must stay close to getFogColor() to avoid a harsh seam at the horizon.
// Rule: top must be a readable blue so the gradient has character, not just a dark void.
export function getSkyColors(timeOfDay: number): [THREE.Color, THREE.Color, THREE.Color] {
  if (timeOfDay < 5 || timeOfDay > 22) {
    return [new THREE.Color(0x040415), new THREE.Color(0x080818), new THREE.Color(0x060612)]
  }
  if (timeOfDay < 7) {
    // Dawn: medium navy top, muted rose-brown horizon, warm-grey ground
    return [new THREE.Color(0x223068), new THREE.Color(0x907055), new THREE.Color(0xa09080)]
  }
  if (timeOfDay < 9) {
    // Morning: clear blue, pale horizon, light blue-grey ground
    return [new THREE.Color(0x2a78b8), new THREE.Color(0x6aaed0), new THREE.Color(0x90b4c8)]
  }
  if (timeOfDay < 16) {
    // Midday: deep blue top shading to sky blue
    return [new THREE.Color(0x1a6aaa), new THREE.Color(0x4a9ad4), new THREE.Color(0x78aec8)]
  }
  if (timeOfDay < 18.5) {
    // Golden hour: visible medium-blue top, warm-brown horizon, warm-grey ground
    return [new THREE.Color(0x2a5090), new THREE.Color(0x8a6040), new THREE.Color(0x907060)]
  }
  if (timeOfDay < 20.5) {
    // Dusk: dark but visible navy, muted dark-rust horizon, dark warm-grey ground
    return [new THREE.Color(0x161632), new THREE.Color(0x583828), new THREE.Color(0x604848)]
  }
  return [new THREE.Color(0x060618), new THREE.Color(0x0e0e22), new THREE.Color(0x0c0c18)]
}

// Fog/background — tightly coupled to sky ground color so horizon blends cleanly
export function getFogColor(timeOfDay: number): THREE.Color {
  if (timeOfDay < 5 || timeOfDay > 22) return new THREE.Color(0x060612)
  if (timeOfDay < 7) return new THREE.Color(0xa09080) // dawn: warm grey
  if (timeOfDay < 10) return new THREE.Color(0x90b4c8) // morning: pale blue
  if (timeOfDay < 16) return new THREE.Color(0x8ab4d4) // midday: sky blue
  if (timeOfDay < 19) return new THREE.Color(0x907060) // golden hour: warm grey-brown
  if (timeOfDay < 21) return new THREE.Color(0x604848) // dusk: dark warm grey
  return new THREE.Color(0x060612)
}

export function getWaterColor(timeOfDay: number): THREE.Color {
  if (timeOfDay < 6 || timeOfDay > 21) return new THREE.Color(0x1a2a40)
  if (timeOfDay < 8) return new THREE.Color(0x7a8eb8)
  if (timeOfDay < 16) return new THREE.Color(0x3b9ed4)
  if (timeOfDay < 19) return new THREE.Color(0xb08860) // warm bronze reflection, not vivid gold
  if (timeOfDay < 21) return new THREE.Color(0x705040)
  return new THREE.Color(0x1a2a40)
}

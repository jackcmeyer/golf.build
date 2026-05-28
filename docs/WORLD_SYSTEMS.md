# golf.build — World Systems

## Art direction

### Visual style

- Vibrant, crisp, flat voxel faces
- Palette inspired by colored pencil and watercolor illustration
- Saturated greens, punchy sand tones, vivid water blues
- Colors feel chosen by an artist — not sampled from a photograph
- Subtle cel-shading with clean voxel outline edges
- Hard-edged cartoon shadows (reinforce illustrated aesthetic)
- Gallery should look like a wall of illustrated postcards

### Rendering approach

Three.js flat-face rendering:

1. `MeshLambertMaterial` or custom flat shader per surface type
2. Outline pass (edge detection via post-processing)
3. Directional light with cel-shaded shadow maps
4. No PBR, no HDR, no photorealistic lighting

### Indicative color palette

These are starting points — validate in Three.js against cel-shading and time-of-day shifts.

| Surface        | Hex       | Notes                 |
| -------------- | --------- | --------------------- |
| Fairway grass  | `#5DB54A` | Rich, saturated green |
| Green grass    | `#3D9E30` | Slightly darker       |
| Tee grass      | `#7DC55F` | Brighter              |
| Rough          | `#8BC34A` | Slightly yellower     |
| Deep rough     | `#4A7C2F` | Darker, wilder        |
| Fescue         | `#C8A96E` | Warm tan              |
| Bunker sand    | `#F0D08A` | Punchy yellow-sand    |
| Still water    | `#3B9ED4` | Vivid blue            |
| Cart path      | `#BDBDBD` | Neutral gray          |
| Dirt / soil    | `#8B6F47` | Warm brown            |
| Rock / outcrop | `#9E9E9E` | Cool gray             |
| Heather        | `#9C6B9C` | Purple-ish            |

---

## Ambient life system

### Global wind uniform

A single wind state drives all ambient animation simultaneously — unified world feel.

```glsl
uniform vec2 uWindDirection;  // normalized XZ direction vector
uniform float uWindSpeed;     // 0.0 (calm) - 1.0 (strong)
uniform float uTime;          // elapsed seconds, for animation offset
```

Pass this uniform to all shaders that animate with wind.

### Sky & clouds

- Animated skybox with procedural or texture-based sky gradient
- Billboard cloud layers at 2–3 different depths (parallax effect)
- Clouds drift in wind direction at different speeds per layer
- Sky color controlled by time-of-day value:
  - Dawn (5–7h): cool blue-purple, soft pink horizon
  - Morning (7–10h): bright blue
  - Noon (10–14h): pure blue, high contrast
  - Golden hour (16–19h): warm amber, orange horizon
  - Dusk (19–21h): deep orange, purple sky
  - Night (21–5h): dark blue, optional stars

### Water animation

```glsl
// UV scrolling for water surface
vec2 waterUV = vUV + uWindDirection * uTime * 0.02 * uWindSpeed;

// Sine-wave vertex displacement
float wave = sin(vWorldPos.x * 0.5 + uTime * 1.5) * 0.05
           + sin(vWorldPos.z * 0.3 + uTime * 1.2) * 0.03;
vPos.y += wave * uWindSpeed;
```

Water color tints with time of day — vivid blue at noon, reflective gold at golden hour.

### Tree & vegetation wind

Vertex shader animation — tops of trees sway, grass clumps ripple.

```glsl
// Wind sway — apply to upper vertices only (y > threshold)
float heightFactor = max(0.0, (position.y - uSwayThreshold) / uObjectHeight);
float sway = sin(uTime * uWindSpeed * 2.0 + vWorldPos.x * 0.5) * heightFactor;
vec3 windOffset = vec3(uWindDirection.x, 0.0, uWindDirection.y) * sway * uWindAmplitude;
gl_Position = projectionMatrix * modelViewMatrix * vec4(position + windOffset, 1.0);
```

Amplitude by vegetation type:
| Type | Amplitude | Notes |
|------|-----------|-------|
| Fescue / tall grass | 0.3 | Moves a lot |
| Shrubs | 0.15 | Medium |
| Deciduous trees | 0.12 | Gentle |
| Pine / conifer | 0.08 | Subtle |
| Links lone tree | 0.05 | Barely stirs |

### Grass detail

- Animated texture variation on fairway/rough surface materials
- Subtle color shimmer using sine-wave UV offset
- In walk mode: simple billboard grass sprites near camera (within 20m)
- Billboard grass fades out at distance — no per-blade simulation

---

## Day / night system

### Time of day

- Value: `timeOfDay` float, 0.0–24.0 (hours)
- Controls: UI slider in build mode, animated in timelapse mode
- Drives: sun position, sky color, ambient light, fog, water color, shadow angle

### Sun position calculation

```typescript
function getSunPosition(timeOfDay: number): THREE.Vector3 {
  // Sun rises at 6h, sets at 20h
  const hour = timeOfDay
  const angle = ((hour - 6) / 14) * Math.PI // 0 at sunrise, PI at sunset
  const elevation = Math.sin(angle)
  const azimuth = ((hour - 12) / 12) * Math.PI

  return new THREE.Vector3(Math.cos(azimuth) * 1000, elevation * 800, Math.sin(azimuth) * 1000)
}
```

### Ambient light temperature by time

```typescript
function getAmbientColor(timeOfDay: number): THREE.Color {
  if (timeOfDay < 6 || timeOfDay > 21) return new THREE.Color(0x1a1a2e) // night
  if (timeOfDay < 8) return new THREE.Color(0xffd4a0) // dawn — warm pink
  if (timeOfDay < 10) return new THREE.Color(0xfff0d0) // morning — soft warm
  if (timeOfDay < 16) return new THREE.Color(0xffffff) // midday — neutral
  if (timeOfDay < 19) return new THREE.Color(0xffb347) // golden hour — amber
  if (timeOfDay < 21) return new THREE.Color(0xff7043) // dusk — deep orange
  return new THREE.Color(0x1a1a2e)
}
```

### Timelapse mode

- Animates `timeOfDay` from 0 → 24 over ~30 seconds in orbital view
- In-app only — no video/GIF export
- Play/pause control
- Shareable as a live browser link that auto-plays on golf.build

---

## Hybrid shadow system

### Architecture decision

| Surface                     | Shadow type             | Reason                        |
| --------------------------- | ----------------------- | ----------------------------- |
| Terrain voxels              | Baked ambient occlusion | Performance — terrain is huge |
| Placed objects              | Dynamic shadow maps     | Correct positional shadows    |
| Trees                       | Dynamic shadow maps     | Most visually impactful       |
| Small objects (bench, sign) | Dynamic or no shadow    | Performance budget dependent  |

### Shadow map setup

```typescript
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap

const sun = new THREE.DirectionalLight(0xffffff, 1)
sun.castShadow = true
sun.shadow.mapSize.width = 2048
sun.shadow.mapSize.height = 2048
sun.shadow.camera.near = 0.5
sun.shadow.camera.far = 500
sun.shadow.camera.left = -200
sun.shadow.camera.right = 200
sun.shadow.camera.top = 200
sun.shadow.camera.bottom = -200
```

Shadow position updates in real time as `timeOfDay` changes.

### Performance budget

- Target: max ~200 dynamic shadow-casting objects before frame rate impact
- Objects beyond budget: render without shadow (graceful degradation)
- Benchmark this early in Phase 2 before building the full object library

### Cel-shaded shadow style

Hard edges on shadow boundaries — reinforce the illustrated aesthetic.
Achieved via shadow map + threshold in fragment shader rather than soft PCF filtering.

---

## Measurement & scale system

All measurement UI is transient — only visible during active gizmo interaction.

### Placement gizmo

When an object is selected or being placed:

- Translation handles (X/Y/Z drag arrows)
- Rotation ring (Y-axis)
- **Footprint label**: "2m × 2m" shown near object while gizmo is active
- Label disappears immediately on mouse release

### Snap-distance indicator

While dragging an object near another placed object:

- Show distance callout: "14m from tee marker"
- Appears when within ~50m of another object
- Fades on release

### Elevation label

The Z-axis (vertical) handle shows:

- "3.5m" — height above terrain base
- "+2 voxels" — alternative display

### Golfer silhouette

- 1.8m tall human figure — purely a scale reference
- Toggleable via toolbar button
- Orbital view only
- Not saved to course state
- Responds to wind shader (sways slightly)

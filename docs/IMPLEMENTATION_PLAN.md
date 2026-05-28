# golf.build — Implementation Plan

## Overview

7 phases. Each phase is stable and demoable before the next begins.
Built with AI-assisted (vibe) coding — timelines are flexible but sequencing is not.

| Phase | Name | Milestone |
|-------|------|-----------|
| 0 | Foundation | Voxel grid renders in browser on Vercel |
| 1 | Core voxel engine | Terrain sculpting + surface painting works |
| 2 | World systems | Alive world with sky, wind, day/night, shadows |
| 3 | Object system | Place objects with gizmo and scale tools |
| 4 | Walk mode | Step into your course in first person |
| 5 | Backend + persistence | Save, load, auth, gallery |
| 6 | Monetization + polish | Stripe, club identity, sharing, v1 launch |

---

## Phase 0 — Foundation

**Goal**: Get Three.js rendering something and deployed to Vercel.

### Tasks

#### 1. Vite + Vercel setup
- `npm create vite@latest golf-build -- --template vanilla-ts`
- Install Three.js: `npm install three @types/three`
- Connect to Vercel, auto-deploy on push to main
- Verify: hello world page deploys

#### 2. Three.js hello world
- Create scene, camera, renderer
- Add a rotating cube with `MeshBasicMaterial`
- Add `requestAnimationFrame` loop
- Verify: cube rotates in browser

#### 3. Orbit camera
- Add `OrbitControls` from `three/examples/jsm/controls/OrbitControls`
- Configure: zoom speed, pan enabled, damping
- Verify: mouse orbit, zoom, pan all work

#### 4. First voxel grid
- Render a flat 20×20 grid of `BoxGeometry(2, 2, 2)` cubes
- Position them correctly with 2-unit spacing
- Add 4–5 different flat colors for different "surface types"
- Verify: grid visible, colors distinct

#### 5. Flat color materials
- Create material map: `VoxelType → THREE.MeshLambertMaterial`
- Add a point light or directional light
- Verify: voxels look like colored blocks, not flat quads

#### 6. Supabase project
- Create project at supabase.com
- Add Supabase client: `npm install @supabase/supabase-js`
- Verify connection with a simple `supabase.from('test').select()`
- Set up `.env` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`

### Milestone
A flat colored voxel grid renders in a browser tab on Vercel. You can orbit around it.
This is the foundation everything else builds on.

---

## Phase 1 — Core voxel engine

**Goal**: Terrain sculpting and surface painting on a chunked canvas.

> ⚠️ Architecture note: Get the voxel state model right here. The typed array schema (type byte + variant byte per voxel) is the foundation for RLE compression, MCP compatibility, and the Supabase schema. Don't rush this.

### Tasks

#### 1. Chunked world architecture
```typescript
// World is divided into 32×32×64 chunks
// Each chunk has its own geometry that rebuilds on edit
class VoxelChunk {
  data: Uint8Array  // (32 * 32 * 64 * 2) bytes — type + variant
  mesh: THREE.Mesh | null
  isDirty: boolean

  rebuild(): void  // regenerate mesh from data
}

class VoxelWorld {
  chunks: Map<string, VoxelChunk>  // key: "cx,cz"
  width: number   // in chunks
  depth: number   // in chunks
  height: number  // in voxels (64)

  getVoxel(x, y, z): { type: number, variant: number }
  setVoxel(x, y, z, type, variant): void
  getChunk(cx, cz): VoxelChunk
}
```

#### 2. Voxel state model
- Implement `VoxelWorld` class
- Typed arrays for chunk data (2 bytes per voxel)
- `getIndex(x, y, z)` helper
- Chunk coordinate math: `chunkX = Math.floor(x / 32)`
- Test: set/get voxels, verify no off-by-one errors

#### 3. Chunk mesh generation
- Build `BufferGeometry` from chunk voxel data
- Only include visible faces (face culling — don't render faces between two solid voxels)
- Vertex colors or UV for surface type
- Mark chunk dirty → rebuild on next frame

#### 4. Terrain sculpting tools
- Raycast mouse position → world coordinate → voxel coordinate
- **Raise**: increment Y of voxels in brush radius
- **Lower**: decrement Y
- **Flatten**: set all voxels in radius to same Y
- **Smooth**: average heights in brush radius
- Brush size control (1–10 voxel radius)

#### 5. Surface paint tool
- Select surface type from palette
- Raycast → voxel face → set type byte
- Brush size control
- Implement first 10 surface materials (all grasses + sand)

#### 6. Cel-shading pass
- Flat face normals on all voxel geometry
- Outline edge detection using post-processing (`EffectComposer`)
- Or: per-face outline via backface expansion technique (simpler, more performant)
- Get the illustrated look early — it motivates everything

#### 7. Basic LOD
- Track camera distance to each chunk
- Full detail within 100m
- Simplified geometry (merge/reduce) beyond 100m
- Target: 60fps on 200×200 canvas

### Milestone
You can sculpt terrain and paint surfaces on a 200×200 canvas in the browser. It looks like golf.build. Show someone — get reactions.

---

## Phase 2 — World systems

**Goal**: A living, breathing world with dynamic sky, wind, and shadows.

### Tasks

#### 1. Skybox
- Procedural sky gradient driven by `timeOfDay`
- Billboard cloud layers (3 depths, different drift speeds)
- Clouds respond to global wind direction

#### 2. Directional light + sun
- `THREE.DirectionalLight` position calculated from `timeOfDay`
- Ambient light color shifts with time of day (warm/cool)
- `getSunPosition(timeOfDay)` helper function

#### 3. Time of day slider
- UI slider (0–24h display)
- Drives sun position, sky color, ambient light, fog
- Real-time update — no lag

#### 4. Hybrid shadow system
- Enable `renderer.shadowMap` for directional light
- Objects: `castShadow = true`, `receiveShadow = true`
- Terrain: baked AO texture (or approximate with ambient light)
- Benchmark frame rate with 50, 100, 200 shadow casters
- **Establish max shadow budget before moving to Phase 3**

#### 5. Global wind uniform
- Create wind state: `{ direction: Vector2, speed: number }`
- Pass as uniform to all shaders that need it
- Add gentle random variation over time (wind shifts slowly)

#### 6. Tree wind shader
- Vertex shader: sway upper vertices based on wind uniform
- Apply to all tree/vegetation object meshes
- Test with different amplitude values per tree type

#### 7. Water animation
- UV scroll shader on water voxel faces
- Sine-wave vertex displacement
- Water color tint changes with time of day

### Milestone
The world is alive. Drag the time slider from dawn to golden hour. Trees sway. Water moves. Take a screenshot — this is the first moment it looks like the product.

---

## Phase 3 — Object system

**Goal**: Place objects with a gizmo that shows real-world scale.

### Tasks

#### 1. Object entity model
```typescript
interface CourseObject {
  id: string
  type: ObjectType
  position: THREE.Vector3
  rotation: number      // Y-axis radians
  variant?: string
}

class ObjectManager {
  objects: Map<string, CourseObject>
  scene: THREE.Scene

  place(type, position, rotation): CourseObject
  move(id, position): void
  rotate(id, rotation): void
  remove(id): void
  getAll(): CourseObject[]
}
```

#### 2. First 10 objects
Model these as simple voxel-art meshes:
- `flagstick_cup` — pole + flag quad
- `tee_marker_red/white/blue` — small colored block
- `bench_wood` — simple plank mesh
- `pine_conifer` — layered cone shape
- `oak_full` — round canopy
- `stone_wall` — stack of stone cubes
- Apply wind shader to trees

#### 3. Placement gizmo
- On object select: show translation arrows (X/Y/Z) + rotation ring
- Drag arrow → translate on that axis
- Drag ring → rotate on Y axis
- Gizmo follows object, stays screen-space size

#### 4. Footprint dimension label
- While gizmo is active: show "2m × 2m" label near object
- Calculate from object bounding box
- Hide immediately on mouse up

#### 5. Snap-distance indicator
- While dragging: check distance to all other objects within 50m
- Show "14m from tee marker" callout if within range
- Fade on release

#### 6. Elevation label
- Z-axis gizmo handle: show current Y position in meters
- Update in real time while dragging

#### 7. Golfer silhouette
- Simple human figure mesh (1.8m tall)
- Not a real object — toggle via UI button
- Orbital view only
- Not saved to course state

### Milestone
You can sculpt terrain, paint surfaces, and place objects with a gizmo. You can put a flagstick on a green and stand a golfer silhouette next to it. This is the demo.

---

## Phase 4 — Walk mode

**Goal**: Step into your course in first person at real scale.

### Tasks

#### 1. First-person camera rig
- `THREE.PerspectiveCamera` at eye height (1.8m above terrain)
- WASD movement + mouse look
- Pointer lock on click
- Movement speed: ~5m/s walking, ~10m/s running (shift)

#### 2. Terrain collision
- Sample terrain height at player XZ position
- Keep player Y at `terrainHeight + 1.8`
- Prevent falling through terrain

#### 3. Walk mode LOD
- Near chunks (within 80m): full detail + billboard grass sprites
- Mid chunks (80–200m): simplified geometry
- Far chunks (200m+): very low detail or not rendered
- Target: 60fps in walk mode

#### 4. Cinematic transition
```typescript
// Orbital → walk
async function enterWalkMode(entryPoint?: THREE.Vector3) {
  const target = entryPoint ?? getFirstTeePosition()
  await animateOrbitalToWalk(target)  // 2–3s tween
  switchToWalkCamera()
  enablePointerLock()
}

// Walk → orbital
async function exitWalkMode() {
  const currentPos = walkCamera.position.clone()
  disablePointerLock()
  switchToOrbitalCamera()
  await animateWalkToOrbital(currentPos)  // 1.5s tween, re-centers on exit pos
}
```

#### 5. Entry point logic
- Default: first placed tee marker position
- Fallback: canvas center at terrain surface
- Click-to-drop: click any canvas point in orbital → drop in there

#### 6. Continuous world state
- `timeOfDay` value carries over between modes
- Wind state carries over
- No mode reset — the world is continuous

### Milestone
You sculpt a green, place a flag, hit walk mode, and descend onto the course in first person at golden hour with shadows raking across the fairway. This is the moment you know it's real.

---

## Phase 5 — Backend + persistence

**Goal**: Save, load, share, and let real users in.

### Tasks

#### 1. Supabase schema
Create tables: `courses`, `course_chunks`, `course_objects` (see `TECH_STACK.md`)
Add RLS policies for user data isolation.

#### 2. RLE compression
Implement `rleEncode` / `rleDecode` for chunk data.
Test round-trip fidelity. Measure compression ratios on typical golf terrain.

#### 3. Save + load
- Serialize: world state → RLE chunks → Supabase
- Load: Supabase → RLE chunks → world state → rebuild all meshes
- Handle large courses: chunked upload (send chunks in batches)
- Auto-save on idle (debounced, 30s)

#### 4. Auth flow
- Supabase email auth
- Sign up / sign in modal
- Session persistence
- Gate saving behind auth (anonymous users can build but not save)

#### 5. Project management dashboard
- List of user's saved courses
- Create new (with mode picker)
- Open existing
- Delete (with confirmation)
- Simple, not complex

#### 6. Onboarding modes
- Mode picker UI on "New project"
- Mode 1: terrain style selector → generator → populate world
- Mode 2: blank canvas → set all voxels to FAIRWAY_GRASS at y=0
- Implement terrain generator with 4 presets (Perlin noise + preset config)

#### 7. Community gallery
- Publish toggle on course
- Public gallery page: grid of course thumbnails
- Click → view course (orbital only, no editing)
- Screenshot capture on publish

### Milestone
You can sign up, build a course, save it, publish it to a gallery, and share the link. This is the point where you can let the first real users in.

---

## Phase 6 — Monetization + polish

**Goal**: Stripe, club identity, social sharing, v1 launch.

### Tasks

#### 1. Stripe integration
- Set up Stripe account and product
- Implement Stripe Checkout (hosted)
- Webhook: `checkout.session.completed` → update `profiles.is_paid`
- Enforce demo gates (canvas size, object bucket, publish)

#### 2. Club identity
- Club name input field in course settings
- Logo upload (to Supabase storage)
- AI logo generation (integrate image gen API)
- Apply logo texture to flagstick, entrance gate, scoreboard meshes

#### 3. Timelapse mode
- Animate `timeOfDay` 0→24 over 30 seconds
- Play/pause button in orbital toolbar
- Smooth loop

#### 4. Social sharing
- Share button → capture orbital screenshot → upload to Supabase
- Generate shareable URL with Open Graph metadata
- Timelapse share link: `?timelapse=true` auto-starts animation on load

#### 5. Full object library
- Model all Bucket 1 + Bucket 2 objects
- This is the most time-consuming task in Phase 6
- Prioritize objects that are most visible in the gallery screenshot
- Apply wind shader to all vegetation

#### 6. Electron wrapper
- Add Electron: `npm install electron electron-builder --save-dev`
- Main process wraps Vite dev server / built app
- Test on macOS and Windows
- Basic auto-update with `electron-updater`

### Milestone — v1.0
golf.build is live. Demo is free. Full purchase unlocks the club. Real users can build, share, and buy. Ship it.

---

## Architecture principles for the whole build

1. **State first, rendering second** — always define your data model before building the mesh that represents it
2. **Chunk everything** — no global arrays, always chunked for LOD and Supabase
3. **Objects are JSON, terrain is binary** — never mix these storage strategies
4. **Build in the open** — deploy to Vercel from Phase 0, share screenshots constantly
5. **Don't optimize prematurely** — get it working first, benchmark second, optimize third
6. **The voxel state model is sacred** — don't change the type/variant byte schema after Phase 1
7. **Wind is a global uniform** — pass it everywhere, never per-object
8. **Time of day is a single float** — everything derives from it, nothing stores its own light state

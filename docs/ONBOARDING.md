# golf.build — Onboarding & View Modes

## New project flow

When a user creates a new project they choose one of four starting modes.
Modes 1 and 2 ship in v1. Modes 3 and 4 are future.

---

## Mode 1 — The realist: plot of land

**Emotional pitch**: "Find the golf course hiding in this land — just like a real architect."

Semi-randomly generated terrain with character baked in before the designer touches it.
User picks a terrain style preset, then the generator creates a starting canvas.

### Terrain style presets (v1 — 4 presets)

#### Links
- Reference courses: Ballybunion, Carnoustie, St Andrews
- Terrain: Flat to gently rolling, very low elevation variance
- Vegetation: Sparse — mostly fescue, some lone trees
- Water: Occasional stream or coastal edge
- Surfaces: Heavy fescue, native scrub, some exposed sand/soil
- Feel: Exposed, windswept, ancient

#### Parkland
- Reference courses: Augusta National, Winged Foot, Muirfield Village
- Terrain: Rolling hills, moderate elevation variance
- Vegetation: Dense tree lines (oak, deciduous), manicured
- Water: Ponds, occasional creek
- Surfaces: Lush fairway/rough mix, manicured edges
- Feel: Beautiful, cultivated, classic American

#### Wooded
- Reference courses: Pinehurst No. 2, Bethpage Black, Augusta (back 9)
- Terrain: Tight corridors, moderate-high elevation
- Vegetation: Heavily forested (pine, conifer), pine straw everywhere
- Water: Minimal
- Surfaces: Pine straw, deep rough, fairway corridors
- Feel: Dense, dramatic, penal

#### Coastal
- Reference courses: Pebble Beach, Cape Kidnappers, Old Head
- Terrain: High elevation drama, dramatic drops, cliff edges
- Vegetation: Sparse — wind-swept, rocky outcrops
- Water: Ocean edges, dramatic water hazards
- Surfaces: Rock, fescue, native scrub, exposed sand
- Feel: Dramatic, spectacular, death-or-glory

### v1.1 addition: Mountain
- Reference courses: Banff Springs, The Broadmoor, Keystone Ranch
- Terrain: Severe elevation changes, rocky terrain
- Vegetation: Sparse at altitude, pine at lower elevations
- Water: Mountain streams, occasional lake
- Feel: Majestic, challenging, elevation-heavy

### Terrain generator parameters per preset
```typescript
interface TerrainPresetConfig {
  elevationVariance: number      // 0.0 (flat) - 1.0 (dramatic)
  treeDensity: number            // 0.0 (sparse) - 1.0 (dense)
  treeTypes: ObjectType[]        // which tree types to scatter
  primaryGrass: VoxelType        // dominant surface material
  secondaryGrass: VoxelType      // secondary surface material
  fescueCoverage: number         // 0.0 - 1.0
  waterLikelihood: number        // 0.0 - 1.0
  rockFrequency: number          // 0.0 - 1.0
  noiseScale: number             // Perlin noise frequency
  noiseOctaves: number           // detail layers
}

const LINKS: TerrainPresetConfig = {
  elevationVariance: 0.15,
  treeDensity: 0.05,
  treeTypes: ['links_lone_tree'],
  primaryGrass: VoxelType.FESCUE,
  secondaryGrass: VoxelType.NATIVE_SCRUB,
  fescueCoverage: 0.6,
  waterLikelihood: 0.2,
  rockFrequency: 0.1,
  noiseScale: 0.008,
  noiseOctaves: 3
}
```

### Future: generative sliders
Post-v1, expose these parameters as UI sliders so users can customize their random plot:
- Elevation variance
- Tree density
- Water presence
- Roughness / wildness
- Coastal influence

These sliders also become MCP API parameters in Phase 2.

---

## Mode 2 — The dreamer: blank canvas

**Emotional pitch**: "Total creative freedom. Build the world entirely from scratch."

- Starts as a flat 200×200 grid of `FAIRWAY_GRASS` voxels
- Every voxel starts at y=0 (flat)
- Expandable to 1,024×1,024 on demand (paid feature)
- No terrain character — the designer creates everything

---

## Mode 3 — The obsessive: real terrain import (future)

**Emotional pitch**: "That farm outside your hometown would make a perfect golf course."

- User drops a pin or enters a Google Maps location
- System calls Maps Elevation API to get topographic data
- Converts real-world elevation to 2m voxel grid
- Paints surface materials based on land cover data
- Designer routes holes over actual terrain

**Status**: out of scope for v1. Data model must not preclude this.

---

## Mode 4 — The archivist: import a real course (future)

**Emotional pitch**: "What if Augusta had a different back nine?"

- Import an existing golf course from an external data source (TBD)
- Recreate it faithfully, or use it as a starting point for reimagination
- Data source options: GIS data, custom scraping, community contributions

**Status**: out of scope for v1. Data source TBD.

---

## View modes

### Orbital view (build mode)

The primary interface. The course floats in front of you like a beautiful toy world.

- Camera: `THREE.PerspectiveCamera` + `OrbitControls`
- Default position: elevated, angled view (~45° elevation)
- Controls: left-drag orbit, right-drag pan, scroll zoom
- Canvas floating: course appears to float on a subtle background (sky)
- All building tools active in this mode
- Time of day slider accessible
- Golfer silhouette toggle accessible

### Walk mode (experience mode)

First-person free roam at real scale. No game logic, no score. The architect's design guides you.

- Camera: custom first-person controller
- Eye height: 1.8m (0.9 voxels above terrain surface)
- Controls: WASD movement, mouse look
- Collision: with terrain surface (can't walk through voxels)
- No collision with objects (walk through trees, benches, etc. — simplicity)
- All ambient systems (wind, water, shadows) carry over from orbital
- Time of day is the same value as orbital — continuous world state

### Walk mode transition

**"Start from beginning or start from slide"** — like PowerPoint.

**Default entry** (start from beginning):
- Drops in at the first tee box (determined by the first placed tee marker)
- If no tee marker placed, drops in at canvas center at terrain surface

**Click-to-drop** (start from slide):
- In orbital view, user can click any point on the course
- Camera descends to that exact point

**Transition animation** (2–3 seconds):
1. Orbital camera smoothly tilts from isometric angle toward level horizon
2. Camera begins pulling toward the entry point — voxels growing in size
3. Sky fills the top of the frame
4. Camera decelerates and settles at eye height (1.8m) at entry point
5. Wind kicks in at full fidelity
6. LOD snaps to walk mode quality

```typescript
async function transitionToWalkMode(entryPoint: THREE.Vector3) {
  isTransitioning = true

  // Tween orbital camera to entry position
  const startPos = orbitCamera.position.clone()
  const endPos = entryPoint.clone().add(new THREE.Vector3(0, 1.8, 0))
  const startTarget = orbitControls.target.clone()

  await tween(1000, (t) => {
    // Ease in-out cubic
    const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
    orbitCamera.position.lerpVectors(startPos, endPos, ease)
    orbitControls.target.lerpVectors(startTarget, entryPoint, ease)
  })

  // Switch to walk mode
  activeCamera = walkCamera
  walkCamera.position.copy(endPos)
  isTransitioning = false
}
```

**Reverse transition** (walk → orbital):
- Press Escape
- Camera lifts from current position back to orbital
- Orbital view re-centers on the position the player was standing
- Same animation in reverse (~1.5 seconds — faster, less dramatic)

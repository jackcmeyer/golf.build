# golf.build — Tech Stack & Architecture

## Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | Vite | Build tooling |
| 3D rendering | Three.js | Voxel engine, cameras, LOD, shaders, shadows, wind |
| Backend | Supabase | DB, auth, storage, real-time (future) |
| Hosting | Vercel | Web deployment + CI/CD |
| Payments | Stripe | One-time purchase |
| Desktop | Electron | Native wrapper (later phase) |
| AI — Phase 2 | MCP server | Agent interface for AI-assisted building |
| Import — future | Maps Elevation API | Real terrain pipeline (Mode 3) |

## Voxel grid

### Core specification
- **Voxel size**: 1 voxel = 2m × 2m × 2m — cubic, uniform, no non-square voxels
- **Canvas size**: 1,024 × 1,024 × 64 voxels (~520 acres, covers any real-world golf club)
- **Chunk size**: 32 × 32 × 64 voxels per chunk (1,024 chunks total for full canvas)
- **Default blank canvas**: 200 × 200 (expandable to 1,024 × 1,024 on demand)

### Scale reference
| Feature | Real size | Voxels |
|---------|-----------|--------|
| Green | ~30m × 30m | ~15 × 15 |
| Tee box | ~5m × 10m | ~3 × 5 |
| Fairway width | ~30–50m | ~15–25 |
| Par 4 length | ~300–400m | ~150–200 |
| Full 18-hole course | ~400 acres | ~820 × 820 |

### Why 2m?
- Proportionally true to golf at a charming scale
- Green is ~15×15 voxels — enough to sculpt character without pixel-hunting
- A par 4 feels like a par 4 in walk mode
- Locked before public launch — changing after user data exists requires a Supabase migration

## Voxel state model

### In-memory representation
Each voxel is stored as two bytes in a typed array:
- **Byte 1**: `type` — surface material enum (0–255)
- **Byte 2**: `variant` — visual variant or metadata

```typescript
// Per-chunk typed array
const chunk = new Uint8Array(32 * 32 * 64 * 2) // type + variant per voxel

// Index calculation
function getIndex(x: number, y: number, z: number): number {
  return (x + z * 32 + y * 32 * 32) * 2
}
```

### Surface material enum (type byte)
```typescript
enum VoxelType {
  AIR = 0,
  // Grasses
  FAIRWAY_GRASS = 1,
  GREEN_GRASS = 2,
  TEE_GRASS = 3,
  INTERMEDIATE_ROUGH = 4,
  PRIMARY_ROUGH = 5,
  DEEP_ROUGH = 6,
  FESCUE = 7,
  NATIVE_SCRUB = 8,
  PRACTICE_GREEN = 9,
  RANGE_TEE = 10,
  // Sand & soil
  BUNKER_SAND_WHITE = 11,
  BUNKER_SAND_BROWN = 12,
  WASTE_AREA = 13,
  BARE_SOIL = 14,
  WOOD_CHIPS = 15,
  // Water
  STILL_WATER = 16,
  MOVING_WATER = 17,
  OCEAN = 18,
  MARSH = 19,
  // Hard surfaces
  CART_PATH_CONCRETE = 20,
  CART_PATH_ASPHALT = 21,
  CART_PATH_GRAVEL = 22,
  PAVED_ROAD = 23,
  PARKING_LOT = 24,
  STEPPING_STONES = 25,
  BOARDWALK = 26,
  DRIVING_MAT = 27,
  // Natural ground
  ROCK_OUTCROP = 28,
  HEATHER = 29,
  GORSE = 30,
  PINE_STRAW = 31,
  MOSSY_GROUND = 32,
  // Built surfaces
  WOODEN_DECK = 33,
  STONE_PAVING = 34,
  BRICK = 35,
  ARTIFICIAL_TURF = 36,
  GRAVEL = 37,
}
```

## Supabase schema

### Two-table design

```sql
-- Terrain storage: RLE-compressed chunk data
CREATE TABLE course_chunks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  chunk_x INTEGER NOT NULL,
  chunk_z INTEGER NOT NULL,
  data BYTEA NOT NULL, -- RLE-compressed Uint8Array
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(course_id, chunk_x, chunk_z)
);

-- Object storage: point-placed entities
CREATE TABLE course_objects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  type TEXT NOT NULL,        -- object type enum
  x REAL NOT NULL,           -- world position
  y REAL NOT NULL,
  z REAL NOT NULL,
  rotation REAL DEFAULT 0,   -- Y-axis rotation in radians
  variant TEXT,              -- optional variant (e.g. "red", "white" for tee markers)
  metadata JSONB,            -- future extensibility
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Course metadata
CREATE TABLE courses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  name TEXT NOT NULL DEFAULT 'Untitled Course',
  club_name TEXT,
  club_logo_url TEXT,
  is_published BOOLEAN DEFAULT FALSE,
  canvas_width INTEGER DEFAULT 200,
  canvas_depth INTEGER DEFAULT 200,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### RLE compression
Golf terrain is naturally repetitive (large areas of identical surface type). Expected compression ratio: 10–50x.

```typescript
function rleEncode(data: Uint8Array): Uint8Array {
  const result: number[] = []
  let i = 0
  while (i < data.length) {
    const val = data[i]
    let count = 1
    while (i + count < data.length && data[i + count] === val && count < 255) {
      count++
    }
    result.push(count, val)
    i += count
  }
  return new Uint8Array(result)
}

function rleDecode(data: Uint8Array): Uint8Array {
  const result: number[] = []
  for (let i = 0; i < data.length; i += 2) {
    const count = data[i]
    const val = data[i + 1]
    for (let j = 0; j < count; j++) result.push(val)
  }
  return new Uint8Array(result)
}
```

## Three.js architecture

### Camera rigs
Two completely separate camera systems:

```typescript
// Orbital (build mode)
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
const orbitCamera = new THREE.PerspectiveCamera(60, aspect, 0.1, 10000)
const orbitControls = new OrbitControls(orbitCamera, renderer.domElement)

// First-person (walk mode)
// Custom character controller — NOT PointerLockControls directly
// Eye height: 1.8m = 0.9 voxels
const walkCamera = new THREE.PerspectiveCamera(75, aspect, 0.1, 2000)
```

### Rendering pipeline
1. Chunked geometry — one merged BufferGeometry per visible chunk
2. LOD — full detail within 200m, simplified beyond
3. Cel-shading — flat face normals + outline edge detection pass
4. Directional light — position driven by time-of-day (0–24h)
5. Shadow maps — dynamic for objects, baked AO for terrain
6. Wind shader — global uniform driving vertex animation

### Global wind uniform
```glsl
// Passed to all shaders that need wind
uniform vec2 uWindDirection; // normalized direction
uniform float uWindSpeed;    // 0.0 - 1.0
uniform float uTime;         // elapsed time for animation
```

## Rendering performance targets

| Scenario | Target |
|----------|--------|
| Orbital view, full 1,024×1,024 canvas | 60fps |
| Walk mode, near chunks full detail | 60fps |
| Shadow map objects | Max 200 dynamic shadow casters |
| Chunk rebuild on sculpt | <16ms (single frame) |

## MCP compatibility (Phase 2)

The object store design is MCP-ready from day one:
- Objects addressable by `{type, x, y, z}` without decode step
- Terrain addressable by `{chunk_x, chunk_z}` → decode → `{x, y, z, type}`
- Course metadata queryable via Supabase REST API

Agent-facing operations will include:
- `place_object(type, x, y, z, rotation, variant)`
- `paint_surface(x, z, radius, surface_type)`
- `sculpt_terrain(x, z, radius, delta_y)`
- `get_course_info()` → canvas size, object count, bounds

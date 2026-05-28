# golf.build — Primitives

## Overview

156 total primitives across two categories:
- **37 surface materials** — painted onto voxel faces (all tiers, all buckets)
- **119 structural objects** — point-placed entities with position, rotation, variant

All 37 surface materials ship in demo and full purchase — they are the canvas.
Structural objects are gated into three rollout buckets.

---

## Surface materials (37 total — all tiers)

### Grasses (10)
| ID | Name | Notes |
|----|------|-------|
| 1 | Fairway grass | Primary playing surface |
| 2 | Green grass (bentgrass) | Putting surface |
| 3 | Tee box grass | Tee area |
| 4 | Intermediate rough | First cut |
| 5 | Primary rough | Standard rough |
| 6 | Deep rough | Heavy rough |
| 7 | Fescue (links-style) | Links courses |
| 8 | Native scrub grass | Wild areas |
| 9 | Practice green grass | Short game area |
| 10 | Range tee grass | Driving range tee |

### Sand & soil (5)
| ID | Name |
|----|------|
| 11 | Bunker sand (white) |
| 12 | Bunker sand (brown) |
| 13 | Waste area / hardpan |
| 14 | Exposed dirt / bare soil |
| 15 | Wood chips / mulch |

### Water (4)
| ID | Name |
|----|------|
| 16 | Still water (pond / lake) |
| 17 | Moving water (stream) |
| 18 | Ocean / sea |
| 19 | Marsh / wetland |

### Hard surfaces (8)
| ID | Name |
|----|------|
| 20 | Cart path (concrete) |
| 21 | Cart path (asphalt) |
| 22 | Cart path (gravel) |
| 23 | Paved road / entrance drive |
| 24 | Parking lot asphalt |
| 25 | Stepping stones |
| 26 | Boardwalk / timber path |
| 27 | Driving mat (range) |

### Natural ground (5)
| ID | Name |
|----|------|
| 28 | Rock / outcrop |
| 29 | Heather |
| 30 | Gorse / bramble |
| 31 | Pine straw / needle bed |
| 32 | Mossy ground |

### Built surfaces (5)
| ID | Name |
|----|------|
| 33 | Wooden deck / terrace |
| 34 | Stone paving |
| 35 | Brick |
| 36 | Artificial turf |
| 37 | Gravel / decomposed granite |

---

## Structural objects — rollout buckets

### Bucket 1 — Demo (~25 objects)
Everything needed to build and walk a recognizable golf course. Free users get these.

**Hole furniture**
- Flagstick + cup
- Tee marker (red)
- Tee marker (white)
- Tee marker (blue)
- Tee marker (black / gold)
- 150-yard marker post
- OB stakes (white)
- Hazard stakes (red / yellow)

**Trees & vegetation**
- Pine / conifer
- Oak / deciduous (full)
- Oak / deciduous (bare)
- Links-style lone tree
- Shrub / bush (small)
- Shrub / bush (large)

**Boundaries**
- Stone wall (links-style)
- Wooden fence (post & rail)
- Hedgerow
- Retaining wall (stone)
- Railroad tie / sleeper

**Natural features**
- Rock outcrop / boulder
- Grass mound / knoll
- Drainage swale

**Basic amenities**
- Bench (wood)
- Trash can
- Directional sign post
- Hole number sign

---

### Bucket 2 — Full purchase, v1 (~65 objects)
Objects that turn a course into a full golf club property.

**Arrival**
- Entrance gate / arch
- Club name sign (monument)
- Entrance guardhouse
- Bag drop canopy
- Bag drop cart / rack
- Valet cone / stanchion
- Parking lot light
- Parking space markers

**Clubhouse & pro shop**
- Clubhouse (large)
- Clubhouse (cottage-style)
- Pro shop (standalone)
- Locker room building
- Outdoor terrace / patio
- Flagpole
- Scoreboard (manual)
- Scoreboard (leaderboard)
- Putting clock / practice cup
- Decorative fountain

**Practice facility — driving range**
- Range hitting bay (open)
- Range hitting bay (covered)
- Range divider netting post
- Range netting (perimeter)
- Target green (small)
- Target green (large)
- Target bunker

**Practice facility — short game**
- Practice putting green
- Chipping green
- Approach / pitch green
- Practice bunker (greenside)
- Practice bunker (fairway)
- Chipping mound
- Fringe / collar edge

**On-course structures**
- Halfway house / snack shack
- Starter shack
- Ranger / marshal station
- Covered rain shelter
- Restroom building
- Spectator stand / bleachers
- Wooden footbridge
- Stone bridge
- Gazebo
- Observation tower

**More trees & vegetation**
- Palm tree
- Bamboo stand
- Flower bed
- Ornamental grass clump

**Vehicles**
- Golf cart (in use)
- Golf cart (parked)
- Beverage cart

**Lighting & signage**
- Pathway light (low)
- Street lamp (classic)
- Flood light / range light
- Hazard warning sign
- Pace of play sign

**Club identity (paid only)**
- Club name (text field)
- Club logo (upload or AI-generate)
- Logo texture: flag
- Logo texture: entrance gate
- Logo texture: scoreboard

---

### Bucket 3 — v1.1 detail pass (~45 objects)
Trinkets and back-of-house that reward returning users. Shipped as a dedicated update.

**Course trinkets**
- Ball washer
- Towel rack
- Bench (stone)
- Recycling bin
- Water cooler / jug station
- Scorecard holder / pencil box
- Rope & stanchion barrier
- Porta-john
- Umbrella stand
- Sprinkler head
- Yardage plate / plaque
- Catch basin / drain cover

**Practice details**
- Ball pyramid / dispenser
- Ball collector vehicle
- Alignment stick rack
- Training aid basket
- Yardage flag / marker stake

**Back of house**
- Maintenance barn
- Cart barn / storage shed
- Fuel station
- Equipment wash station
- Irrigation pump house
- Compost / debris pile
- Storage container

**More structures**
- Caddie shack
- Putting clock / practice cup (moved from B2 if not done)

**More natural features**
- Driftwood log
- Dead tree / snag
- Bunker rake (lying flat)

**More boundaries**
- Chain-link fence
- Retaining wall (timber)
- Rock wall (dry stacked)

**Maintenance vehicles**
- Maintenance vehicle
- Greens mower (parked)

**Terrain preset**
- Mountain terrain preset (joins the 4 existing presets)

---

## Object entity schema

Each placed object is stored as:

```typescript
interface CourseObject {
  id: string           // UUID
  course_id: string    // parent course
  type: ObjectType     // enum
  x: number            // world position (meters)
  y: number
  z: number
  rotation: number     // Y-axis rotation (radians)
  variant?: string     // e.g. "red", "white", "covered"
  metadata?: Record<string, unknown> // future extensibility
}
```

Object types are string enums matching the names above, snake_cased:
`flagstick_cup`, `tee_marker_red`, `bench_wood`, `pine_conifer`, etc.

## Golfer silhouette (special object)
- Height: 1.8m (0.9 voxels)
- Toggleable — not part of the saved course state
- Orbital view only
- Purely a scale reference tool
- Not stored in `course_objects`

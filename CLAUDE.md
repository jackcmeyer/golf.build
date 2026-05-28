# golf.build — Claude Code Context

> This is the master context file. Read this first, then reference the linked files for detail.

## What is golf.build?

A voxel-based sketchbook where golf fans design their dream golf club. Not a rendering tool, not a simulator — a creative canvas that feels like drawing a golf club in colored pencil. Charming, scale-aware, alive with wind and light, and AI-native from day one.

**The "Figma for golf courses."**

## Quick reference

| File | Contents |
|------|----------|
| `OVERVIEW.md` | Vision, design principles, target users |
| `TECH_STACK.md` | Stack, voxel grid, canvas size, Supabase schema |
| `PRIMITIVES.md` | All 156 surface materials + objects, rollout buckets |
| `WORLD_SYSTEMS.md` | Ambient life, day/night, shadows, art direction |
| `MONETIZATION.md` | Demo vs paid, club identity, social sharing |
| `ONBOARDING.md` | 4 start modes, terrain presets, walk mode transition |
| `IMPLEMENTATION_PLAN.md` | 7 build phases with tasks and milestones |

## Critical decisions — know these cold

| Decision | Value | Notes |
|----------|-------|-------|
| Voxel size | 2m × 2m × 2m cubic | Locked before public launch |
| Canvas size | 1,024 × 1,024 × 64 voxels | ~520 acres, covers any real golf club |
| Chunk size | 32 × 32 | For LOD and Supabase storage |
| Terrain storage | RLE-compressed Uint8Array per chunk | `course_chunks` table |
| Object storage | Clean JSON per entity | `course_objects` table |
| Voxel schema | type byte + variant byte per voxel | Typed arrays, MCP-addressable |
| Monetization | Demo (free) → one-time purchase | ~$15–20 via Stripe |
| Demo limit | 9-hole canvas, ~25 objects | Full purchase unlocks everything |

## Tech stack

```
Frontend:   Vite
3D:         Three.js
Backend:    Supabase (DB + auth + storage)
Hosting:    Vercel
Payments:   Stripe
Desktop:    Electron (later)
AI (ph.2):  MCP server
```

## Current phase

**Phase 0 — Project scaffold + Three.js basics**

Tasks:
1. Vite + Vercel setup — scaffold project, deploy hello world
2. Three.js hello world — single rotating cube
3. Orbit camera — OrbitControls, zoom/pan/rotate
4. First voxel grid — flat 20×20 grid of 2-unit cubes
5. Flat color materials — MeshBasicMaterial per voxel type
6. Supabase project — create project, set up auth, verify connection

Milestone: A flat colored voxel grid renders in the browser on Vercel. You can orbit around it.

## Core design rules — never violate these

1. **Sketchbook, not renderer** — no photorealism, no CAD feel
2. **Terrain first, surface second** — sculpt land shape, then paint materials
3. **Charm over precision (60/40)** — beautiful toy world, not survey-accurate
4. **API-first data model** — course state must always be cleanly serializable
5. **Measurement is transient** — scale info only visible during gizmo interaction
6. **No persistent grid overlays or CAD rulers** — ever
7. **Objects are a separate layer** from voxel terrain — always JSON, always addressable

## Two core view modes

| Mode | Description |
|------|-------------|
| **Orbital** | 360° god-mode, floating toy world, build mode |
| **Walk** | First-person, open-world, no game logic, experience mode |

Transition: cinematic 2–3s descent. Default entry at first tee. Click-to-drop-anywhere as secondary.

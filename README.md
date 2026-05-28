# golf.build

A voxel sketchbook for designing your dream golf club.

Not a simulator. Not a rendering tool. A creative canvas — like drawing a golf course in colored pencil — alive with wind, light, and the passage of a day.

## What it is

Two modes. One world.

- **Orbital (build mode)** — god-mode view, sculpt terrain, paint surfaces, place objects
- **Walk mode** — step into your course in first person at real scale, golden hour optional

Each voxel is 2m × 2m × 2m. A green is ~15×15 voxels. A par 4 feels like a par 4.

## Stack

| Layer    | Tech                         |
| -------- | ---------------------------- |
| Frontend | Vite + React + TypeScript    |
| 3D       | Three.js                     |
| UI       | shadcn/ui + Tailwind CSS v4  |
| Backend  | Supabase (DB, auth, storage) |
| Hosting  | Vercel                       |
| Payments | Stripe (later)               |
| Desktop  | Electron (later)             |

## Getting started

```bash
pnpm install
pnpm dev
```

Requires a `.env` file with:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Build

```bash
pnpm build
```

## Linting + formatting

```bash
pnpm lint         # check
pnpm lint:fix     # auto-fix
pnpm format       # prettier write
pnpm format:check # prettier check (CI)
```

Pre-commit hooks run automatically via Husky — staged `.ts`/`.tsx` files are linted and formatted before every commit.

## Docs

Full design and implementation docs live in [`/docs`](./docs):

- [`OVERVIEW.md`](docs/OVERVIEW.md) — vision, design principles, target users
- [`TECH_STACK.md`](docs/TECH_STACK.md) — stack, voxel grid, canvas size, Supabase schema
- [`IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) — 7 build phases with tasks and milestones
- [`PRIMITIVES.md`](docs/PRIMITIVES.md) — all 156 surface materials + objects
- [`WORLD_SYSTEMS.md`](docs/WORLD_SYSTEMS.md) — sky, day/night, wind, shadows, art direction
- [`MONETIZATION.md`](docs/MONETIZATION.md) — demo vs paid, club identity, social sharing
- [`ONBOARDING.md`](docs/ONBOARDING.md) — start modes, terrain presets, walk mode transition

## Current status

Phase 1 complete — chunked voxel world, face-culled mesh generation, terrain sculpting (raise/lower/flatten/smooth/paint), cel-shading outline pass, LOD system.

Phase 2 in progress — sky, sun, day/night cycle, wind, water animation.

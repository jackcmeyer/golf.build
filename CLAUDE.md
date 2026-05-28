# golf.build — Claude Code Context

> This is the master context file. Read this first, then reference the linked files for detail.

## What is golf.build?

A voxel-based sketchbook where golf fans design their dream golf club. Not a rendering tool, not a simulator — a creative canvas that feels like drawing a golf club in colored pencil. Charming, scale-aware, alive with wind and light, and AI-native from day one.

**The "Figma for golf courses."**

## Quick reference

| File                     | Contents                                             |
| ------------------------ | ---------------------------------------------------- |
| `OVERVIEW.md`            | Vision, design principles, target users              |
| `TECH_STACK.md`          | Stack, voxel grid, canvas size, Supabase schema      |
| `PRIMITIVES.md`          | All 156 surface materials + objects, rollout buckets |
| `WORLD_SYSTEMS.md`       | Ambient life, day/night, shadows, art direction      |
| `MONETIZATION.md`        | Demo vs paid, club identity, social sharing          |
| `ONBOARDING.md`          | 4 start modes, terrain presets, walk mode transition |
| `IMPLEMENTATION_PLAN.md` | 7 build phases with tasks and milestones             |

## Critical decisions — know these cold

| Decision        | Value                               | Notes                                 |
| --------------- | ----------------------------------- | ------------------------------------- |
| Voxel size      | 2m × 2m × 2m cubic                  | Locked before public launch           |
| Canvas size     | 1,024 × 1,024 × 64 voxels           | ~520 acres, covers any real golf club |
| Chunk size      | 32 × 32                             | For LOD and Supabase storage          |
| Terrain storage | RLE-compressed Uint8Array per chunk | `course_chunks` table                 |
| Object storage  | Clean JSON per entity               | `course_objects` table                |
| Voxel schema    | type byte + variant byte per voxel  | Typed arrays, MCP-addressable         |
| Monetization    | Demo (free) → one-time purchase     | ~$15–20 via Stripe                    |
| Demo limit      | 9-hole canvas, ~25 objects          | Full purchase unlocks everything      |

## Tech stack

```
Frontend:   Vite + React
3D:         Three.js
UI:         shadcn/ui (maia style, zinc+green theme) + Tailwind CSS v4
Backend:    Supabase (DB + auth + storage)
Hosting:    Vercel
Payments:   Stripe
Desktop:    Electron (later)
AI (ph.2):  MCP server
```

## Current phase

**Phase 1 — Core voxel engine (complete)**

Chunked world, face-culled mesh generation, terrain sculpting tools (raise/lower/flatten/smooth/paint), cel-shading outline pass, LOD system.

**Next: Phase 2 — World systems** (sky, sun, day/night, wind, water animation)

## Core design rules — never violate these

1. **Sketchbook, not renderer** — no photorealism, no CAD feel
2. **Terrain first, surface second** — sculpt land shape, then paint materials
3. **Charm over precision (60/40)** — beautiful toy world, not survey-accurate
4. **API-first data model** — course state must always be cleanly serializable
5. **Measurement is transient** — scale info only visible during gizmo interaction
6. **No persistent grid overlays or CAD rulers** — ever
7. **Objects are a separate layer** from voxel terrain — always JSON, always addressable

## Two core view modes

| Mode        | Description                                              |
| ----------- | -------------------------------------------------------- |
| **Orbital** | 360° god-mode, floating toy world, build mode            |
| **Walk**    | First-person, open-world, no game logic, experience mode |

Transition: cinematic 2–3s descent. Default entry at first tee. Click-to-drop-anywhere as secondary.

---

## Behavioral guidelines

> These bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think before coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity first

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

Every changed line should trace directly to the user's request.

### 4. Goal-driven execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan before starting:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

---

## Tooling conventions

### shadcn/ui

- Style: `radix-maia`. Base color: `zinc`. Theme accent: `green`. Configured via preset `b2uTGAu7Jo`.
- Add components with `pnpm exec shadcn add <component>` — never write them by hand.
- `src/components/ui/` is generated code — don't edit it directly, and exclude it from ESLint.
- Use `cn()` from `@/lib/utils` for all className merging. Never concatenate class strings manually.
- Import components from `@/components/ui/<name>` using the `@/` alias.

### Tailwind CSS v4

- Using Tailwind v4 via `@tailwindcss/vite` — no `tailwind.config.js` file.
- Theme tokens live in `src/index.css` under `@theme inline {}` and `:root {}`.
- CSS variables (e.g. `--primary`, `--radius`) drive the shadcn token system — don't hardcode color values.
- **Critical:** never add unlayered `* { padding: 0; margin: 0 }` resets. They outrank `@layer utilities` in the cascade and will silently break Tailwind utility classes. Tailwind's Preflight (included via `@import "tailwindcss"`) handles the base reset.
- `prettier-plugin-tailwindcss` auto-sorts class names on save — don't fight the order.

### Prettier

- Config: `.prettierrc` — no semis, single quotes, 2-space tabs, trailing commas, 100-char print width.
- Run: `pnpm format` (write) or `pnpm format:check` (CI).
- `prettier-plugin-tailwindcss` is active — Tailwind classes are sorted automatically.
- `pnpm-lock.yaml` is excluded from formatting.

### ESLint

- Flat config in `eslint.config.js` — TypeScript-ESLint, react-hooks, react-refresh, prettier compat.
- Run: `pnpm lint` (check) or `pnpm lint:fix` (auto-fix).
- `src/components/ui/**` is excluded (generated shadcn code).
- `eslint-config-prettier` is last in the config — it disables any ESLint rules that conflict with Prettier.

### Husky + lint-staged

- Pre-commit hook runs lint-staged automatically on every `git commit`.
- `.ts` / `.tsx` staged files: `eslint --fix` → `prettier --write` (blocks on unfixable lint errors).
- `.js` / `.json` / `.css` / `.md` staged files: `prettier --write`.
- lint-staged re-stages any files it modifies, so formatted output is included in the commit.
- Never use `--no-verify` to skip the hook unless there's a genuine emergency.

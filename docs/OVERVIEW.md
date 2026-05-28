# golf.build — Overview

## Vision

golf.build is a sketchbook where golf fans dream. Not a rendering tool, not a simulator — a canvas for imagining the golf club you've always wanted to exist. Voxel-built, artist-colored, and alive with wind, light, and the passage of a day.

The "Figma for golf courses" — a creative canvas with two modes: a god-mode orbital view for building, and a first-person open-world walk for experiencing. The architect designs the world; the routing, cart paths, and features guide you through it. Club identity makes every course personal. AI-native from day one.

## Design principles

### 1. Sketchbook, not renderer

A canvas for dreaming. The aesthetic feels like a talented illustrator sketched a golf club in colored pencil — vibrant, expressive, intentional. Not photorealistic, not corporate. This is not a golf course rendering tool.

### 2. Charm over precision (60/40)

Courses look like beautiful toy worlds painted by an artist. Scale accuracy supports the golf identity without constraining creative joy. The 60/40 weighting means charm wins when there's a conflict.

### 3. Terrain first, surface second

Sculpt the shape of the land, then paint what it's made of. Primitives are materials and objects — not named components like "green" or "fairway". The architect's hands mold the world.

### 4. The world is alive

Wind moves trees and grass. Water flows. Clouds drift. Shadows rake across fairways as the sun moves. Not physically perfect — emotionally convincing. Everything responds to a single global wind vector.

### 5. Every club is personal

A name and a logo transform a course into a club. Club identity lives on the flag, the entrance gate, the scoreboard — and on every shared card. The moment the designer becomes an owner.

### 6. The architect guides, not the UI

Walk mode is open-world. No waypoints, no guided tour. The routing, cart paths, mounding, and features do the storytelling. Good design rewards exploration. The architect's design decisions guide the player — not UI prompts.

### 7. Scale awareness without CAD weight

Golf is a game of inches. Measurement tools are transient — visible only during active gizmo interaction. The canvas stays clean. Scale lives in the moment of placing, not as a persistent overlay. No persistent grid overlays or CAD rulers, ever.

### 8. API-first data model

Course state must be cleanly serializable and addressable from day one. This is the foundation for the MCP server (Phase 2) and Claude rendering integration (Phase 3). Never build course state in a way that can't be serialized to JSON.

## Target users

### Primary — golf fans who dream

Golf fans who love the fantasy of designing their dream course. They've debated routing on every course they've played and sketched holes on napkins. The product is for the person who, standing on the 7th tee at their home course, thinks "I'd move this green 30 yards left."

### Secondary — aspiring architects

Aspiring and amateur golf architects who want a low-friction digital canvas to prototype ideas without CAD software or professional tools. The product lowers the barrier to serious design thinking.

## Product positioning

- **Not** a golf simulation game
- **Not** a course management tool
- **Not** a CAD / rendering tool
- **Is** a creative sketchbook with game-like feel
- **Is** a canvas for dreaming and sharing golf club designs
- **Is** a community gallery of golf imagination

## Inspirations

| Product              | What we take from it                              |
| -------------------- | ------------------------------------------------- |
| tinyworld.build      | Orbital view aesthetic, charm, minimal UI         |
| Minecraft            | Voxel creative freedom, scale, chunked world      |
| RollerCoaster Tycoon | Joy of building, toy world feel                   |
| Figma                | Shareable design canvas, community, API ecosystem |

## Product name

**golf.build** — placeholder, may evolve. The `.build` TLD fits the creative tool category.

## AI-native roadmap

| Phase   | Feature                 | Description                                    |
| ------- | ----------------------- | ---------------------------------------------- |
| v1.0    | Club identity AI        | AI logo generation from text prompt            |
| Phase 2 | MCP server              | Agent builds courses via natural language      |
| Phase 3 | Claude rendering plugin | Renders orbital view into Claude conversations |

The MCP server requires the API-first data model from v1. Terrain style presets become AI prompts. Gizmo coordinates become agent-readable object references.

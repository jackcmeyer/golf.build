# golf.build — Monetization

## Model

**Demo → one-time purchase.** No subscription, no credits, no paywalled features after purchase.

This is the standard indie game model. Ship a compelling free demo that gives users the full feel of the product, then offer a one-time purchase that unlocks everything.

Price target: **~$15–20**. Refine post-launch based on user feedback and conversion data.

---

## Demo (free forever)

The core creative loop is fully unlocked. The goal is to give users enough to fall in love with the product — specifically the terrain sculpting + walk mode combo.

### What's included in demo

- Terrain sculpting tools (full)
- Surface painting tools (all 37 materials)
- Orbital view (full)
- Walk mode (full — the magic moment must be free)
- Day/night slider (full)
- Ambient life system (full)
- Bucket 1 objects (~25 objects)
- Gallery browsing (read-only)
- 1 saved project
- **9-hole canvas limit** (200×200 grid, locked)

### What's gated behind purchase

- Full 1,024×1,024 canvas (expandable from 200×200)
- Unlimited saved projects
- Gallery publishing
- Bucket 2 objects (~65 objects) including full club property
- Club identity (name + logo)
- Timelapse sharing
- Social share cards

### Demo gate enforcement

- Canvas size: enforce 200×200 max, disable expansion UI
- Object palette: show bucket 2 objects as locked/greyed with "upgrade" tooltip
- Gallery publish button: disabled with upgrade prompt
- Club identity section: hidden / upgrade prompt

---

## Full purchase

### Stripe integration

- One-time payment via Stripe Checkout
- Webhook on `checkout.session.completed` → set `user.is_paid = true` in Supabase
- No recurring billing, no seat licenses
- Access is tied to user account (not device)

### Purchase flow

1. User hits a paywall (publish button, large canvas, locked object)
2. Modal explains what they unlock
3. "Unlock golf.build — $[price]" button
4. Stripe Checkout (hosted page)
5. Webhook updates Supabase
6. User redirected back, access unlocked immediately

### Supabase user metadata

```sql
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS raw_user_meta_data jsonb;
-- Or use a profiles table:
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  is_paid BOOLEAN DEFAULT FALSE,
  paid_at TIMESTAMPTZ,
  stripe_customer_id TEXT
);
```

---

## Club identity

Club identity is the emotional core of the paid purchase. The moment someone names their club and sees their logo on the flagstick — that's when it becomes _their_ golf club.

### Club name

- Free text input — any name
- Displayed on gallery card, share cards, and in-game signage
- Stored in `courses.club_name`

### Club logo

Two paths:

**Upload**

- User uploads PNG/SVG
- Stored in Supabase storage at `clubs/{course_id}/logo.png`
- Max 2MB, square recommended

**AI generation**

- Text prompt: "crest for Lakeview Golf Club, links-style, navy and gold"
- Style presets: classic crest / minimalist wordmark / vintage badge
- Calls image generation API (TBD — Replicate/Fal/OpenAI)
- Generated image stored same as upload

### Logo placement

Club logo is a texture applied to specific object types:

- Flagstick flag face
- Entrance gate sign face
- Scoreboard face
- Club name sign face

Implementation: these objects have a designated UV region that shows either a default placeholder texture or the club logo texture when set.

```typescript
// When club logo changes, update logo texture on relevant objects
function applyClubLogo(logoUrl: string) {
  const texture = new THREE.TextureLoader().load(logoUrl)
  scene.traverse((obj) => {
    if (obj.userData.hasLogoSlot) {
      obj.material.map = texture
      obj.material.needsUpdate = true
    }
  })
}
```

---

## Social sharing

### Philosophy

No video or GIF export. Every share format resolves to a live page on golf.build.
Shares are acquisition channels, not dead-end files.

### Static course share card

- "Share" button in orbital view
- Generates a shareable URL: `golf.build/course/{id}`
- Page renders as an Open Graph card:
  - `og:image` — orbital screenshot at current time of day (captured via `renderer.domElement.toDataURL()`)
  - `og:title` — "[Club Name] — designed by [username]"
  - `og:description` — "Built on golf.build"
- Screenshot stored in Supabase storage
- Works on Twitter/X, iMessage, Slack, etc.

### Timelapse share link

- Separate "Share timelapse" button
- URL: `golf.build/course/{id}?timelapse=true`
- Page auto-plays the day cycle on load
- No download — experience lives on golf.build
- Recipients see the product in motion before signing up

### Gallery card

Each published course in the community gallery shows:

- Orbital screenshot thumbnail (at the time of day it was published)
- Club name + creator handle
- Publish date
- Click → full course view page

### Share card capture

```typescript
function captureOrbitalScreenshot(): string {
  // Render one frame at target time of day
  renderer.render(scene, orbitCamera)
  return renderer.domElement.toDataURL('image/jpeg', 0.85)
}
```

Upload to Supabase storage, save URL to `courses.thumbnail_url`.

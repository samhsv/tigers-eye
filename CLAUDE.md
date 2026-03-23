# CLAUDE.md — Tiger's Eye

## Project Overview

Tiger's Eye is a 3D interactive visualization of live Polymarket prediction markets with AI analysis. It's a portfolio/demo project designed to look premium and feel fast. The aesthetic is "Bloomberg Terminal meets a planetarium" with an Auburn University color theme.

## Quick Start

```bash
# Install dependencies
npm install

# Run locally (two terminals):
npm run dev:worker    # Cloudflare Worker on port 8787
npm run dev           # Vite dev server on port 5173

# Build for production:
npm run build
```

The OpenRouter API key must be configured for AI features: `npx wrangler secret put OPENROUTER_API_KEY`

## Architecture

**Single-page React app** with a Cloudflare Worker proxy. No database, no auth, no routing.

```
src/App.tsx                    → Root composition, wraps everything in AppProvider
src/context/AppContext.tsx      → Central state (useReducer), data fetching on mount, AI streaming trigger
src/components/GalaxyView.tsx   → 3D scene (ForceGraph3D + Three.js custom nodes)
src/components/MarketCard.tsx   → Market detail overlay with streaming AI take
src/components/FeedPanel.tsx    → Right sidebar with sorted market lists
src/components/MispricedPanel.tsx → AI "What's Mispriced?" analysis
src/components/LoadingScreen.tsx → Loading animation
src/components/Tooltip.tsx      → Hover tooltip
src/lib/polymarket.ts           → Data fetching, normalization, derived metrics
src/lib/ai.ts                   → OpenRouter SSE stream parser, prompts, model constants
src/lib/colors.ts               → Contestedness-to-color gradient (5-stop interpolation)
src/lib/format.ts               → Number/date formatting utilities
src/types/index.ts              → All TypeScript interfaces
worker/index.ts                 → Cloudflare Worker (3 proxy routes + CORS)
```

### Data Flow

1. On mount, `AppContext` calls `fetchMarkets()` → worker `/api/markets` → Polymarket Gamma API
2. Raw `RawEvent[]` response is normalized into `MarketNode[]` (parsing string prices, computing contestedness/orbSize/orbColor)
3. `buildGraphData()` creates `{ nodes: GraphNode[], links: [] }` for react-force-graph-3d
4. GalaxyView renders nodes as custom Three.js glowing orbs with category clustering forces
5. On node click → camera flies to node → `SELECT_MARKET` dispatched → MarketCard opens → AI streaming triggered
6. AI streaming: `AppContext` useEffect creates AbortController, calls `streamAIResponse()` → worker `/api/ai` → OpenRouter SSE → chunks dispatched as `APPEND_AI_TAKE`

### State Management

`AppContext.tsx` uses `useReducer` with these key actions:
- `SET_MARKETS` — bulk set markets + graphData after fetch
- `SELECT_MARKET` — opens MarketCard, resets AI take, sets aiTakeLoading
- `HOVER_MARKET` — updates tooltip
- `APPEND_AI_TAKE` — concatenates streaming AI text chunk
- `SET_MISPRICED` — stores AI mispriced picks
- `TOGGLE_FEED_PANEL` — mobile sidebar toggle

The `flyToNode(nodeId)` callback is exposed via context. It calls `galaxyRef.current.flyToNode(id)` for camera animation and dispatches `SELECT_MARKET`.

## Key Technical Details

### Polymarket API

- **Endpoint used:** `https://gamma-api.polymarket.com/events?active=true&closed=false&limit=200`
- **Critical:** `outcomePrices` in the raw response is a **string array** (e.g., `["0.85", "0.15"]`), not numbers. Must `parseFloat()`.
- **Critical:** `volume` and `liquidity` on markets are strings. Use `volumeNum`/`liquidityNum` (numeric fields) when available.
- Categories come from `event.tags[]`, not from individual markets. The `extractCategory()` function in `polymarket.ts` checks against a priority list.

### react-force-graph-3d

- Custom nodes use `THREE.Group` containing a core sphere + glow sphere. This is safe because `enableNodeDrag={false}` (Group nodes break Three.js raycasting for drag, but click/hover use spatial detection).
- Category clustering is a custom d3 force (`fg.d3Force('cluster', fn)`), not a separate package. Centers are arranged in a ring.
- The default center force is removed (`fg.d3Force('center', null)`) so clusters spread out.
- Camera animations use `fgRef.current.cameraPosition(pos, lookAt, durationMs)`.
- GalaxyView exposes `flyToNode` via `useImperativeHandle` so parent components can trigger camera moves.
- `nodeThreeObject` is memoized with `useCallback` to prevent recreating Three.js objects on re-render.

### AI Streaming (OpenRouter)

- SSE format: `data: {"choices":[{"delta":{"content":"..."}}]}\n\n`
- Termination: `data: [DONE]`
- OpenRouter sends `: OPENROUTER PROCESSING` comments — the parser skips lines not starting with `data: `
- AbortController cancels in-flight streams when the user closes MarketCard or clicks a different node
- Two models used:
  - `nvidia/nemotron-3-nano-30b-a3b:free` — per-market analysis (streaming)
  - `nvidia/nemotron-3-super-120b-a12b:free` — "What's Mispriced?" (non-streaming JSON)

### Cloudflare Worker

- Single file `worker/index.ts` with 3 routes: `GET /api/markets`, `GET /api/history/:tokenId`, `POST /api/ai`
- Markets response cached 60s at edge via Cloudflare Cache API
- AI streaming: `upstream.body` (ReadableStream) is piped directly back — no buffering
- CORS allows `localhost:*` in dev and the production Pages domain
- `OPENROUTER_API_KEY` is a Cloudflare Worker secret (not in code or env vars)

### Styling

- **Tailwind CSS v4** — uses `@tailwindcss/vite` plugin and `@theme` directive in `src/index.css`. No `tailwind.config.js`.
- All custom colors defined as `--color-*` in the `@theme` block and used as Tailwind utilities (e.g., `bg-bg-primary`, `text-auburn-glow`)
- Fonts loaded from Google Fonts via `<link>` in `index.html`
- CSS keyframe animations defined in `index.css`: `fadeInUp`, `shimmer`, `pulse-glow`, `typing-dot`

### Derived Visualization Metrics

Computed in `polymarket.ts` during normalization:
- `contestedness = 1 - Math.abs(yesPrice - 0.5) * 2` → 0 (consensus) to 1 (50/50)
- `orbSize = Math.max(1, Math.log10(volume + 1) * 1.5)` → logarithmic so mega-markets don't dominate
- `orbColor = contestednessToColor(contestedness)` → 5-stop gradient from navy (#1E3A5F) to auburn orange (#FF6B1A)
- `pulseSpeed = Math.min((volume24hr / volume) * 10, 2)` → recent activity drives glow pulse speed

## Development Notes

### Vite Dev Proxy

In development, Vite proxies `/api/*` to `localhost:8787` (the worker). No CORS issues in dev. In production, the client uses `VITE_API_BASE_URL` to hit the deployed worker directly.

### Build

`npm run build` runs `tsc -b && vite build`. The output is in `dist/`. The JS bundle is ~1.5MB (Three.js is the bulk) — this is expected for a WebGL app.

### Environment Variables

- `VITE_API_BASE_URL` — empty for local dev (proxy handles it), set to worker URL for production builds
- `OPENROUTER_API_KEY` — Cloudflare Worker secret, never in client code

### Mobile

- Galaxy: full screen, touch orbit/zoom supported natively by react-force-graph-3d
- FeedPanel: hidden by default, toggled via FAB button (bottom-right)
- MarketCard: slides up as bottom sheet
- Tooltip: hidden on touch devices (no hover concept)
- Breakpoint: `lg` (1024px) in Tailwind

### Performance Considerations

- `graphData` object reference must be stable (React state) or the force simulation resets
- `nodeThreeObject` callback is memoized with `useCallback` — recreating it causes all Three.js objects to be rebuilt
- `onEngineTick` runs every frame — keep operations lightweight (just sine wave pulse on glow meshes)
- 200 nodes is well within performance bounds for react-force-graph-3d
- Sphere geometry segments: 24 for core, 16 for glow — good quality/performance tradeoff

## Common Tasks

### Adding a new feed section
1. Add a sort function in `src/lib/polymarket.ts` (pattern: sort → slice → return)
2. Add a `<FeedSection>` block in `src/components/FeedPanel.tsx`
3. Wire into the `feeds` useMemo

### Changing AI prompts
Edit `PROMPTS` in `src/lib/ai.ts`. The market analysis prompt and mispriced prompt are separate constants.

### Changing the color scheme
Edit the `COLOR_STOPS` array in `src/lib/colors.ts` and the `@theme` block in `src/index.css`.

### Adding a new worker route
Add a route handler function in `worker/index.ts` and a route match in the main `fetch` handler at the bottom.

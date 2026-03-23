# Tiger's Eye — Implementation Guide

## Goal

Build and deploy "Tiger's Eye" — a 3D interactive visualization of live Polymarket prediction markets with on-demand AI analysis. Users open a URL, see a galaxy of glowing orbs representing real prediction markets with real money on the line, fly through the constellation, and click any market to get a fast, opinionated AI breakdown.

This is a portfolio piece / demo project. It needs to look premium, feel fast, and genuinely impress both technical and non-technical audiences. Think: Bloomberg Terminal meets a planetarium. Not a student project. Not a toy. Something that makes someone walking past a laptop stop and ask "what is that?"

## Technical Stack

- **Framework:** React 18+ with Vite
- **3D Visualization:** Three.js via `react-force-graph-3d` (wraps Three.js + d3-force-3d). This handles the force-directed graph layout, camera controls (orbit, zoom), and node rendering. Install: `npm install react-force-graph-3d three`
- **AI Models:** NVIDIA Nemotron models via OpenRouter API
  - **Nemotron 3 Nano 30B A3B** (`nvidia/nemotron-3-nano-30b-a3b:free`) — fast per-market analysis (215 tps, 0.46s latency)
  - **Nemotron 3 Super 120B A12B** (`nvidia/nemotron-3-super-120b-a12b:free`) — deep "What's Mispriced?" analysis
- **Data Source:** Polymarket Gamma API (fully public, no auth required)
  - Markets/events endpoint: `https://gamma-api.polymarket.com/events?active=true&closed=false&limit=100`
  - Individual market prices: `https://clob.polymarket.com/prices`
  - Docs: https://docs.polymarket.com/
- **Backend Proxy:** Cloudflare Workers (one worker, multiple routes)
- **Deployment:** Cloudflare Pages (static site) + Cloudflare Workers
- **Styling:** Tailwind CSS + custom CSS for Three.js scene styling
- **Fonts:** Use something distinctive — JetBrains Mono for data/numbers, a display font like "Space Grotesk" or "Outfit" or "Syne" for headings. NOT Inter, NOT Roboto, NOT Arial.

## Color System — Auburn-Inspired

This is Auburn University themed. The color palette is built around Auburn's school colors (burnt orange and navy blue) but elevated into a premium dark aesthetic:

```
--bg-primary: #0A0E1A          (deep space navy, almost black)
--bg-secondary: #111827         (dark panel backgrounds)
--bg-card: #1A1F2E              (card/overlay backgrounds)

--auburn-orange: #DD550C        (Auburn's burnt orange — the primary accent)
--auburn-orange-glow: #FF6B1A   (brighter version for glowing orbs)
--auburn-navy: #0C2340          (Auburn's navy blue)

--contested-hot: #FF6B1A        (markets near 50/50 — Auburn orange, glowing)
--contested-warm: #E8943A       (markets 60/40 range)
--neutral: #8B95A5              (markets 70/30 range)
--consensus-cool: #4A90B8       (markets 80/20 range)
--consensus-cold: #1E3A5F       (markets 90/10+ — deep navy blue)

--text-primary: #E8ECF1         (main text)
--text-secondary: #8B95A5       (secondary text)
--text-accent: #FF6B1A          (highlighted text, links)
--text-data: #A0F0C0            (numbers, prices — subtle green tint)

--ai-accent: #FFB84D            (AI-generated content highlight — warm gold)
```

Orb color mapping: market contestedness drives the color. A 50/50 market is full Auburn orange. A 95/5 market is deep navy. Everything in between is a smooth gradient through amber/teal. This means the galaxy naturally shows Auburn's colors — orange hotspots of disagreement floating in a navy field of consensus.

## Architecture

```
┌──────────────────────────────────────────────────┐
│  REACT APP (Cloudflare Pages)                    │
│                                                  │
│  ┌──────────────────────────────────────────┐    │
│  │  GalaxyView (react-force-graph-3d)       │    │
│  │  - Renders all markets as 3D nodes       │    │
│  │  - Force-directed layout by category     │    │
│  │  - Orbit/zoom controls                   │    │
│  │  - Hover → tooltip (no AI)               │    │
│  │  - Click → opens MarketCard (triggers AI)│    │
│  └──────────────────────────────────────────┘    │
│                                                  │
│  ┌──────────────┐  ┌───────────────────────┐     │
│  │  FeedPanel    │  │  MarketCard (overlay) │     │
│  │  (sidebar)    │  │  - Full market data   │     │
│  │               │  │  - Sparkline chart    │     │
│  │  🔥 Movers    │  │  - AI Take (streamed) │     │
│  │  💰 Volume    │  │  - Close button       │     │
│  │  ⚡ Active    │  └───────────────────────┘     │
│  │  🎯 Closest   │                               │
│  │               │  ┌───────────────────────┐     │
│  │  [What's      │  │  MispricedPanel       │     │
│  │   Mispriced?] │  │  (AI Super analysis)  │     │
│  │               │  │  - 3-5 picks          │     │
│  └──────────────┘  │  - Reasoning           │     │
│                     │  - "Fair price" est.   │     │
│                     └───────────────────────┘     │
│                                                  │
└────────────────────┬─────────────────────────────┘
                     │
        ┌────────────▼──────────────────┐
        │  CLOUDFLARE WORKER            │
        │  (single worker file)         │
        │                               │
        │  GET /api/markets             │
        │    → Polymarket Gamma API     │
        │    → Cache 60s                │
        │                               │
        │  GET /api/history/:id         │
        │    → Polymarket CLOB API      │
        │    → Price history for        │
        │      sparkline chart          │
        │                               │
        │  POST /api/ai                 │
        │    → OpenRouter API           │
        │    → Streams response back    │
        │    → Hides API key            │
        │                               │
        └───────────────────────────────┘
```

## Implementation Details

### 1. Cloudflare Worker (`worker.js` or `worker.ts`)

The worker has three routes:

**`GET /api/markets`**
- Fetches from `https://gamma-api.polymarket.com/events?active=true&closed=false&limit=200` (paginate if needed to get more — use `offset` param)
- Also try `https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=200` for individual market-level data
- Caches the response for 60 seconds using Cloudflare's Cache API or `cf: { cacheTtl: 60 }` on the fetch
- Returns the JSON to the client
- Add CORS headers for the Pages domain

**`GET /api/history/:conditionId`**
- Fetches price history for a specific market from Polymarket's CLOB API
- Endpoint: `https://clob.polymarket.com/prices-history?market={conditionId}&interval=1d&fidelity=60` (research the exact endpoint — may need to check Polymarket docs)
- If price history endpoint is unavailable or too complex, SKIP this feature. Use the current price only. Don't let this block the build. The sparkline is a nice-to-have, not a must-have.

**`POST /api/ai`**
- Receives `{ model: string, messages: array }` from the client
- Forwards to OpenRouter at `https://openrouter.ai/api/v1/chat/completions`
- Adds headers:
  ```
  Authorization: Bearer ${OPENROUTER_API_KEY}
  Content-Type: application/json
  HTTP-Referer: https://tigerseye.pages.dev (or whatever the deployed URL is)
  X-Title: Tiger's Eye
  ```
- **MUST support streaming.** Set `stream: true` in the OpenRouter request. Pipe the SSE stream back to the client. This is critical for the typing effect on AI responses.
- The `OPENROUTER_API_KEY` is stored as a Cloudflare Worker secret (set via `wrangler secret put OPENROUTER_API_KEY`)

**CORS:** All routes need appropriate CORS headers. In development, allow `localhost:5173`. In production, allow the Cloudflare Pages domain.

### 2. Data Fetching & Processing (`src/lib/polymarket.ts`)

On app load:
1. Fetch all active markets from `/api/markets`
2. Process each market/event into a normalized shape:

```typescript
interface MarketNode {
  id: string;               // market ID or condition ID
  question: string;         // "Will X happen by Y?"
  category: string;         // "Politics", "Crypto", "Sports", etc.
  outcomePrices: {          // current YES/NO prices (0-1 scale, representing cents)
    yes: number;
    no: number;
  };
  volume: number;           // total volume in dollars
  liquidity: number;        // current liquidity
  contestedness: number;    // computed: 1 - abs(yes - 0.5) * 2 → ranges 0 (consensus) to 1 (50/50 split)
  endDate: string;          // when the market resolves
  // Derived for visualization:
  orbSize: number;          // normalized volume → sphere radius (log scale recommended so mega-markets don't dwarf everything)
  orbColor: string;         // mapped from contestedness → auburn orange (hot) to navy (cold)
  pulseSpeed: number;       // derived from recent activity if available, else 0
}
```

3. Build the graph data structure for `react-force-graph-3d`:

```typescript
const graphData = {
  nodes: marketNodes.map(m => ({
    id: m.id,
    ...m,
    // Force graph uses these:
    group: m.category,  // used for clustering
    val: m.orbSize,     // used for node size
  })),
  links: []  // no links between nodes — they cluster by category via force simulation
};
```

**Category clustering:** Use the force graph's `d3Force` prop to add a custom clustering force. Each category gets a focal point, and nodes within a category are attracted to that point. This creates the organic cluster effect without explicit links.

```typescript
// Pseudo-code for custom clustering force
const categories = [...new Set(nodes.map(n => n.category))];
const clusterCenters = {};
categories.forEach((cat, i) => {
  const angle = (i / categories.length) * Math.PI * 2;
  const radius = 300;
  clusterCenters[cat] = {
    x: Math.cos(angle) * radius,
    y: (Math.random() - 0.5) * 150, // slight vertical spread
    z: Math.sin(angle) * radius
  };
});

// Apply as a custom d3 force
forceGraphRef.current.d3Force('cluster', (alpha) => {
  nodes.forEach(node => {
    const center = clusterCenters[node.category];
    const k = alpha * 0.3;
    node.vx += (center.x - node.x) * k;
    node.vy += (center.y - node.y) * k;
    node.vz += (center.z - node.z) * k;
  });
});
```

### 3. The Galaxy View (`src/components/GalaxyView.tsx`)

Use `react-force-graph-3d` as the core renderer.

```tsx
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';
```

**Custom node rendering:** Don't use the default spheres. Use `nodeThreeObject` to create custom glowing orbs:

```typescript
nodeThreeObject={(node) => {
  const radius = node.orbSize;
  const color = new THREE.Color(node.orbColor);

  // Core sphere
  const geometry = new THREE.SphereGeometry(radius, 32, 32);
  const material = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: 0.85,
  });
  const mesh = new THREE.Mesh(geometry, material);

  // Glow effect — slightly larger, more transparent sphere
  const glowGeometry = new THREE.SphereGeometry(radius * 1.6, 32, 32);
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: 0.15,
  });
  const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);

  const group = new THREE.Group();
  group.add(mesh);
  group.add(glowMesh);

  return group;
}}
```

**Pulse animation:** For markets with recent activity, animate the glow sphere's scale in the `onEngineTick` callback. Modulate `glowMesh.scale` with a sine wave based on `Date.now()` and the node's `pulseSpeed`.

**Background:** Set the scene background to the deep navy. Add a subtle starfield using a `THREE.Points` system with 2000-3000 tiny white dots scattered in a large sphere around the scene. OR use the force graph's `backgroundColor` prop set to `#0A0E1A`.

**Camera:** Start the camera pulled back far enough to see the full galaxy, then animate it slowly zooming in over 2-3 seconds on initial load. Use `forceGraphRef.current.cameraPosition()` with a transition.

**Category labels:** Use `nodeThreeObject` OR separate Three.js text sprites positioned at each cluster center. The labels should be subtle — low opacity, small text, just enough to orient the user. Use `THREE.Sprite` with `THREE.CanvasTexture` for text rendering.

**Hover behavior:** Use `onNodeHover` to brighten the hovered node (increase opacity, scale up slightly) and show a lightweight HTML tooltip overlay with the market question, YES price, and volume. No AI call.

**Click behavior:** Use `onNodeClick` to:
1. Fly the camera closer to the clicked node (`forceGraphRef.current.cameraPosition(...)` with a smooth transition)
2. Open the MarketCard overlay with the market's data
3. Trigger the AI analysis call

### 4. The Market Card (`src/components/MarketCard.tsx`)

An overlay/modal that appears when a node is clicked. Positioned to the side of the 3D scene (don't cover the whole galaxy — the user should still see it behind the card).

**Contents:**
- **Market question** — large, bold heading
- **Category badge** — small colored pill
- **Odds display** — YES and NO as large numbers with dollar volume underneath. Color the YES/NO based on which side is winning. Make this visually prominent — it's the core data.
- **Sparkline** (if price history is available) — a small SVG line chart showing price over time. Use a lightweight approach: just an SVG `<polyline>` with the price points. If price history isn't available from the API, skip this entirely.
- **Resolution date** — when the market closes
- **Volume and liquidity** — secondary stats
- **THE AI TAKE** — below the data section. Streams in character by character (or word by word) as the Nano model generates it. Use a monospace or slightly styled font for this section. Show a subtle typing indicator while loading.
- **Close button** (X) in the corner

**AI Call for Market Card:**

```typescript
const response = await fetch('/api/ai', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'nvidia/nemotron-3-nano-30b-a3b:free',
    messages: [
      {
        role: 'system',
        content: `You are a sharp, opinionated prediction market analyst. You give fast, punchy takes on prediction markets. Rules:
- ALWAYS reference the actual numbers (current price, volume, price movement)
- ALWAYS take a directional lean. Never say "it could go either way." Have a view.
- Keep it under 4 sentences. Punchy. No filler.
- Match the energy of the topic: serious for geopolitics/economics, irreverent for meme/pop culture markets, analytical for sports/crypto
- If the odds have moved significantly recently, call that out and speculate why
- If the market looks mispriced to you, say so bluntly
- Never use phrases like "as an AI" or "I should note that" or "it's important to consider"
- Write like a smart friend who follows markets, not like a textbook`
      },
      {
        role: 'user',
        content: `Prediction market: "${market.question}"
Current YES price: ${market.outcomePrices.yes} (meaning the crowd thinks there's a ${Math.round(market.outcomePrices.yes * 100)}% chance)
Current NO price: ${market.outcomePrices.no}
Total volume: $${formatVolume(market.volume)}
Liquidity: $${formatVolume(market.liquidity)}
Resolution date: ${market.endDate}

Give me your take.`
      }
    ],
    stream: true,
    max_tokens: 200,
    temperature: 0.8
  })
});

// Handle SSE stream and update UI character by character
```

**Streaming implementation:** Parse the SSE stream from OpenRouter. Each chunk contains a delta. Append each delta to the displayed text in state, creating the typewriter effect. The response format follows OpenAI's streaming spec since OpenRouter is OpenAI-compatible.

### 5. The Feed Panel (`src/components/FeedPanel.tsx`)

A collapsible sidebar on the right side of the screen. Collapsed by default on mobile, open by default on desktop.

**No AI calls.** Everything here is computed client-side from the fetched market data:

**🔥 BIGGEST MOVERS** — Sort all markets by absolute price change (if available in the API response — look for `priceMovePercent` or similar fields, or compute from `bestBid`/`bestAsk` vs historical if available). Show top 5. Display: market question (truncated), direction arrow (↑ or ↓), and magnitude.

**💰 HIGHEST STAKES** — Sort by volume. Top 5. Display: market question (truncated), dollar volume.

**⚡ MOST ACTIVE** — Sort by number of trades or liquidity turnover if available. Top 5. If trade count isn't in the API response, sort by liquidity instead.

**🎯 CLOSEST CALLS** — Sort by contestedness (closest to 50/50). Top 5. Display: market question, YES percentage.

**Each item is clickable.** Clicking a feed item should:
1. Fly the camera to that node in the galaxy (smooth transition)
2. Open the MarketCard for that market

**"What's Mispriced?" Button:**

At the bottom of the feed panel. Prominent button, Auburn orange, with a subtle glow/pulse animation to draw attention.

On click:
1. Disable the button, show loading state ("Analyzing..." with a spinner)
2. Gather the top 25 most active/contested markets from the already-loaded data
3. Send ONE call to Nemotron Super:

```typescript
const response = await fetch('/api/ai', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model: 'nvidia/nemotron-3-super-120b-a12b:free',
    messages: [
      {
        role: 'system',
        content: `You are a quantitative analyst who specializes in prediction markets. You're looking for mispricings — markets where the crowd consensus seems wrong based on available evidence, historical patterns, or logical reasoning. You're bold, specific, and willing to stake your reputation on your calls. Output valid JSON only.`
      },
      {
        role: 'user',
        content: `Here are 25 active prediction markets with their current crowd-consensus odds and trading volume. Identify the 3-5 markets where the current price seems MOST disconnected from likely reality.

For each pick, respond with this exact JSON format:
{
  "picks": [
    {
      "marketId": "<id of the market>",
      "question": "<the market question>",
      "currentPrice": <current YES price as decimal>,
      "fairPrice": <what you think the YES price should be>,
      "direction": "OVER" or "UNDER",
      "reasoning": "<2-3 sentence explanation of why the crowd is wrong. Be specific and bold.>"
    }
  ]
}

Markets:
${top25Markets.map(m => `- ID: ${m.id} | "${m.question}" | YES: ${m.outcomePrices.yes} | Volume: $${formatVolume(m.volume)}`).join('\n')}

Respond with ONLY the JSON. No markdown, no preamble.`
      }
    ],
    max_tokens: 1000,
    temperature: 0.7
  })
});
```

4. Parse the JSON response. Display each pick in a "THE AI THINKS THE CROWD IS WRONG" section that expands below the button. Each pick shows:
   - The market question
   - Current price vs AI's "fair price" with a visual gap indicator
   - Direction arrow (OVER/UNDER)
   - The reasoning text
   - Clickable — clicking flies to that node and opens its MarketCard

5. After generating, the button changes to a cooldown state: "Refresh in X:XX" with a 10-minute timer. This prevents spamming the Super model.

### 6. Loading Screen

On initial page load while markets are being fetched:

Dark background. The text "TIGER'S EYE" fades in, large, centered, in the display font. Below it, a subtle tagline: "A live map of what humanity thinks happens next." Below that, a minimal loading indicator (a thin orange line animating across, or a pulsing dot, or particles coalescing — pick something that fits the aesthetic). Keep it under 3 seconds.

Once data loads, the loading screen fades out and the galaxy fades in. The camera starts far away and slowly dollies in — a dramatic reveal.

### 7. Mobile Responsiveness

The 3D scene works on mobile (Three.js + WebGL handles touch events for orbit/zoom). But the layout needs to adapt:

- **Mobile:** Feed panel is hidden by default, accessible via a hamburger or tab button at the bottom. MarketCard appears as a bottom sheet sliding up from the bottom. The galaxy takes up the full screen.
- **Desktop:** Feed panel is a fixed sidebar on the right (maybe 320px wide). MarketCard appears as a floating panel to the left of the sidebar.

### 8. Project Structure

```
tigers-eye/
├── worker/
│   └── index.ts              # Cloudflare Worker (all 3 proxy routes)
├── src/
│   ├── App.tsx                # Main app component, data fetching, state management
│   ├── main.tsx               # React entry point
│   ├── index.css              # Global styles, CSS variables, fonts
│   ├── components/
│   │   ├── GalaxyView.tsx     # 3D force graph scene
│   │   ├── MarketCard.tsx     # Per-market detail overlay with AI take
│   │   ├── FeedPanel.tsx      # Sidebar with sorted lists + mispriced button
│   │   ├── MispricedPanel.tsx # Results from Super model analysis
│   │   ├── LoadingScreen.tsx  # Initial loading animation
│   │   └── Tooltip.tsx        # Hover tooltip for nodes
│   ├── lib/
│   │   ├── polymarket.ts      # Data fetching, normalization, derived metrics
│   │   ├── ai.ts              # OpenRouter streaming helper
│   │   ├── colors.ts          # Contestedness → color mapping function
│   │   └── format.ts          # Number formatting utilities
│   └── types/
│       └── index.ts           # TypeScript interfaces
├── public/
│   └── (any static assets)
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
├── wrangler.toml              # Cloudflare Workers config
└── README.md
```

### 9. Deployment

**Cloudflare Pages:**
- Build command: `npm run build`
- Output directory: `dist`
- The Vite build produces static files that Cloudflare Pages serves

**Cloudflare Workers:**
- The worker in `worker/index.ts` is deployed separately via `wrangler deploy`
- Set the `OPENROUTER_API_KEY` secret: `wrangler secret put OPENROUTER_API_KEY`
- The worker URL becomes the API base URL used by the React app
- Alternatively, use Cloudflare Pages Functions (put the worker in `functions/api/` directory) to keep everything in one deployment

**Environment variable:** The React app needs to know the worker URL. Use `VITE_API_BASE_URL` in `.env` for local dev (pointing to `http://localhost:8787`) and set it to the production worker URL for the build.

## Key Priorities (In Order)

1. **The galaxy renders and looks incredible.** This is the first impression. If the 3D scene doesn't make someone stop and look, nothing else matters. Spend time on the glow effects, the color mapping, the camera animation on load.

2. **Data loads and nodes are real.** Every orb represents a real market with real money. The hover tooltip should prove this immediately — real question, real price, real volume.

3. **Clicking works and AI streams.** The MarketCard opens, data displays cleanly, and the AI take streams in character by character. The take should be genuinely interesting/opinionated, not generic.

4. **The feed panel works.** Sorted lists render, items are clickable, camera flies to clicked nodes.

5. **"What's Mispriced?" works.** Button triggers Super model, results display, each pick is clickable.

6. **Polish.** Loading screen, animations, mobile responsiveness, edge cases.

## What NOT to Build

- No authentication or user accounts
- No actual trading functionality (read-only visualization)
- No database — everything is fetched fresh on each page load
- No complex routing — it's a single page
- No analytics or tracking
- Don't over-engineer the worker — it's a thin proxy, not a backend
- Don't spend time on SEO, meta tags, or social cards (nice-to-have later, not now)

## Notes for Claude Code

- Research the Polymarket Gamma API and CLOB API before starting. The endpoint structure and response format may differ from what's documented above. Adapt accordingly. The key data you need: list of active markets, each market's question/title, category, current YES/NO prices, volume, and ideally some measure of recent activity.
- If `react-force-graph-3d` causes issues, fall back to raw Three.js with `d3-force-3d` directly. The force graph library is a convenience, not a requirement.
- The OpenRouter API follows the OpenAI chat completions spec exactly. Use the same request/response format as OpenAI, just with the OpenRouter base URL and model IDs.
- For the streaming implementation, the SSE stream from OpenRouter uses the standard `text/event-stream` format with `data: {"choices":[{"delta":{"content":"..."}}]}` chunks. Parse these to extract the text deltas.
- Test with a handful of markets first before trying to render all 200+. The force graph can handle hundreds of nodes but start small to get the rendering right.
- The contestedness calculation is: `contestedness = 1 - Math.abs(yesPrice - 0.5) * 2`. This maps 50/50 → 1.0 (maximum contestedness) and 100/0 → 0.0 (full consensus).
- For orb sizing, use a logarithmic scale on volume so that one massive market doesn't dwarf everything else: `orbSize = Math.log10(volume + 1) * scaleFactor`.

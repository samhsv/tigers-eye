# Tiger's Eye

A 3D interactive visualization of live Polymarket prediction markets with on-demand AI analysis.

Users open a URL, see a galaxy of glowing orbs representing real prediction markets with real money on the line, fly through the constellation, and click any market to get a fast, opinionated AI breakdown. Think: Bloomberg Terminal meets a planetarium.

## Features

- **3D Galaxy View** — Force-directed graph of 200+ live prediction markets rendered as glowing orbs in Three.js. Markets cluster by category. Color maps from Auburn orange (contested 50/50 markets) to deep navy (strong consensus). Orb size reflects trading volume on a logarithmic scale.
- **Live Data** — All markets are fetched in real-time from Polymarket's Gamma API. Every orb represents a real market with real money.
- **AI Market Analysis** — Click any market to get a streamed, opinionated AI take from NVIDIA Nemotron via OpenRouter. The analysis references actual prices, volume, and price movements.
- **Market Feed Panel** — Sidebar with sorted lists: Biggest Movers, Highest Stakes, Most Active, Closest Calls. Each item is clickable — the camera flies to that market in the galaxy.
- **"What's Mispriced?" Analysis** — One-click AI analysis using a larger model to identify 3-5 markets where the crowd consensus may be wrong, with fair price estimates and reasoning.
- **Camera Animations** — Dramatic dolly-in on load, smooth fly-to transitions when clicking markets or feed items.
- **Mobile Responsive** — Full touch support for the 3D scene. Feed panel toggles via floating action button. Market cards appear as bottom sheets.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18+ with Vite |
| 3D Visualization | Three.js via `react-force-graph-3d` |
| AI Models | NVIDIA Nemotron (Nano 30B for per-market, Super 120B for mispriced analysis) via OpenRouter |
| Data Source | Polymarket Gamma API (public, no auth) |
| Backend Proxy | Cloudflare Workers |
| Deployment | Cloudflare Pages + Workers |
| Styling | Tailwind CSS v4 |
| Fonts | Space Grotesk (headings), JetBrains Mono (data/numbers) |

## Color System

Auburn University themed — burnt orange and navy blue elevated into a premium dark aesthetic:

- **Contested markets (50/50):** Auburn orange (#FF6B1A) — bright, glowing
- **Consensus markets (90/10+):** Deep navy (#1E3A5F) — cool, receding
- **Background:** Deep space navy (#0A0E1A)
- **AI content:** Warm gold (#FFB84D)
- **Data numbers:** Subtle green (#A0F0C0)

## Project Structure

```
tigers-eye/
├── worker/
│   └── index.ts              # Cloudflare Worker (markets, history, AI proxy)
├── src/
│   ├── App.tsx                # Root component
│   ├── main.tsx               # React entry point
│   ├── index.css              # Tailwind v4 theme + animations
│   ├── components/
│   │   ├── GalaxyView.tsx     # 3D force graph scene
│   │   ├── MarketCard.tsx     # Per-market detail overlay with streaming AI
│   │   ├── FeedPanel.tsx      # Sidebar with sorted market lists
│   │   ├── MispricedPanel.tsx # AI mispriced analysis results
│   │   ├── LoadingScreen.tsx  # Initial loading animation
│   │   └── Tooltip.tsx        # Hover tooltip for nodes
│   ├── context/
│   │   └── AppContext.tsx     # useReducer state management
│   ├── lib/
│   │   ├── polymarket.ts      # Data fetching, normalization, derived metrics
│   │   ├── ai.ts              # OpenRouter SSE streaming, prompts, model constants
│   │   ├── colors.ts          # Contestedness-to-color gradient mapping
│   │   └── format.ts          # Number/date formatting utilities
│   └── types/
│       └── index.ts           # All TypeScript interfaces
├── wrangler.toml              # Cloudflare Worker config
├── vite.config.ts             # Vite + Tailwind + dev proxy
└── package.json
```

## Local Development

### Prerequisites

- Node.js 18+
- An [OpenRouter](https://openrouter.ai/) API key (free tier works — the Nemotron models are free)

### Setup

```bash
# Install dependencies
npm install

# Create a local secrets file for the Cloudflare Worker
cp .dev.vars.example .dev.vars
# Then edit .dev.vars and replace the placeholder with your real OpenRouter API key

# Start both the Vite dev server and the Cloudflare Worker
# Terminal 1:
npm run dev:worker

# Terminal 2:
npm run dev
```

The app will be available at `http://localhost:5173`. The Vite dev server proxies `/api/*` requests to the worker at `localhost:8787`.

> **Note:** `.dev.vars` is gitignored — your API key stays local. The `.dev.vars.example` file is checked in as a template. For production, set the secret via `npx wrangler secret put OPENROUTER_API_KEY`.

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server (port 5173) |
| `npm run dev:worker` | Start Cloudflare Worker locally (port 8787) |
| `npm run build` | TypeScript check + Vite production build |
| `npm run preview` | Preview production build locally |
| `npm run deploy:worker` | Deploy worker to Cloudflare |

## Deployment

### Cloudflare Pages (Frontend)

```bash
npm run build
npx wrangler pages deploy dist
```

### Cloudflare Workers (API Proxy)

```bash
npx wrangler deploy
npx wrangler secret put OPENROUTER_API_KEY
```

Set `VITE_API_BASE_URL` to your deployed worker URL (e.g., `https://tigers-eye-worker.<subdomain>.workers.dev`) before building the frontend for production.

## Architecture

```
Browser → Cloudflare Pages (static React app)
              ↓
         Cloudflare Worker (proxy)
           ├── GET /api/markets → Polymarket Gamma API (cached 60s)
           ├── GET /api/history/:id → Polymarket CLOB API (cached 5m)
           └── POST /api/ai → OpenRouter API (streaming SSE)
```

The worker exists to cache Polymarket responses, hide the OpenRouter API key, add CORS headers, and pipe streaming AI responses back to the client.

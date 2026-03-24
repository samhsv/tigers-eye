 ---
  Current State: What You Have

  Data pipeline: Polymarket API → normalizeEvents() → 200 markets with ~15 data dimensions each → buildGraphData() → render

  Visual encoding (4 of 15+ dimensions used):

  ┌──────────┬────────────────────────────┬───────────────┐
  │ Channel  │          Maps To           │ Configurable? │
  ├──────────┼────────────────────────────┼───────────────┤
  │ Position │ Category (1 axis)          │ No            │
  ├──────────┼────────────────────────────┼───────────────┤
  │ Color    │ Contestedness              │ No            │
  ├──────────┼────────────────────────────┼───────────────┤
  │ Size     │ log(volume)                │ No            │
  ├──────────┼────────────────────────────┼───────────────┤
  │ Pulse    │ 24hr activity ratio        │ No            │
  ├──────────┼────────────────────────────┼───────────────┤
  │ Links    │ nothing (links: [] always) │ N/A           │
  └──────────┴────────────────────────────┴───────────────┘

  User agency: Zero. You see one fixed arrangement. You can click a dot or read a sorted list. The 3D galaxy is effectively a screensaver with clickable
   points — the spatial layout communicates almost nothing that a dropdown filter couldn't.

  AI integration: Reactive only. Click → get analysis. Press button → get mispriced picks. AI never initiates, never references the visualization, never
   suggests what to look at.

  Unused data richness: spread, bestBid/bestAsk, volume1wk, oneWeekPriceChange, endDate bucketing, event sibling relationships, liquidity-to-volume
  ratios — all captured, none surfaced visually.

  ---
  The Problem

  The galaxy looks stunning but teaches you nothing you couldn't learn from a table. There's no reason to orbit the camera, no reason to compare cluster
   shapes, no reason to come back. The 3D space is decorative, not analytical. Users think "cool" then leave.

  ---
  The Proposal: "Lens System" — Turn the Galaxy Into a Visual Query Engine

  Core Concept

  The galaxy should be a reconfigurable instrument where each visual channel (position, color, size, links) can be independently mapped to different
  data dimensions. Changing a mapping causes the galaxy to smoothly reorganize — nodes drift to new positions, shift colors, grow or shrink. The shape
  of the resulting constellation IS the insight.

  The user goes from passive observer to active explorer. They're not reading data — they're seeing answers to questions they're forming in real-time.

  ---
  Phase 1: Cluster Lenses (The Foundation)

  A LensBar at bottom-center of the screen — a horizontal pill selector that controls what dimension the galaxy clusters by. When you switch lenses, the
   d3 simulation reheats and nodes smoothly migrate to new cluster centers over ~2 seconds.

  Lenses using only existing data (zero new API calls):

  1. Category (current default)
  Clusters by topic. What you have now.

  2. Contestedness Spectrum
  Arranges markets on a linear axis from "Strong Consensus" (deep blue, left) to "Toss-Up" (orange, right). Instead of categories in a ring, you get a
  gradient bar in 3D space. Immediately reveals: which categories are most contested? Are big-money markets more or less contested than small ones? You
  can't see this from the current layout.

  Implementation: Cluster centers placed along x-axis at positions proportional to contestedness value (0→-400, 1→+400). Optional 5 sub-clusters
  ("Strong Consensus", "Likely", "Leaning", "Contested", "Toss-Up") with labeled regions.

  3. Time Horizon
  Clusters by resolution date: "This Week", "This Month", "This Quarter", "This Year", "2026+". Reveals temporal patterns — are near-term markets more
  certain than long-term ones? Is there a cluster of events all resolving the same week (election day, earnings season)?

  Implementation: Parse endDate, bucket into 5 time ranges, compute cluster centers in a ring.

  4. Momentum
  Dual-axis layout: x-axis = direction (falling left, rising right), magnitude = distance from center. Stable markets cluster at the center, volatile
  ones fly outward. Instantly shows: what's moving, in which direction, and how fast. When a group of nodes from different categories all cluster on the
   same side, that's a correlated move.

  Implementation: Position x proportional to oneDayPriceChange, y scattered within momentum bands, z randomized.

  5. Volume Tier
  Three clusters: "Whale Markets" ($1M+), "Mid-Cap" ($100K-$1M), "Small Markets" (<$100K). Size still encodes volume within each tier, so you see the
  hierarchy within each level. This reveals market structure — how much money is concentrated in the top markets vs. spread across small ones.

  Implementation: Three cluster centers, log-volume thresholds.

  6. Event Constellation
  Clusters by parent eventId. This is the first lens that uses links — sibling markets within the same event are connected by thin glowing lines. A
  presidential race with 8 candidate markets becomes a visible constellation. Multi-market events become structures; standalone markets become isolated
  stars.

  Implementation: Compute cluster center per unique eventId. Generate GraphLink entries for markets sharing an eventId. Links rendered as thin lines
  with opacity 0.15.

  Architecture for Phase 1:

  New state:
    activeCluster: 'category' | 'contestedness' | 'timeHorizon' | 'momentum' | 'volumeTier' | 'event'

  New file: src/lib/clustering.ts
    - clusterByCategory(markets)     → Record<string, ClusterCenter>
    - clusterByContestedness(markets) → Record<string, ClusterCenter>
    - clusterByTimeHorizon(markets)   → Record<string, ClusterCenter>
    - clusterByMomentum(markets)      → Record<string, ClusterCenter>
    - clusterByVolumeTier(markets)    → Record<string, ClusterCenter>
    - clusterByEvent(markets)         → Record<string, ClusterCenter>
    - getClusterLabels(mode)          → { key: string, label: string, position: ClusterCenter }[]
    - getLinksForMode(mode, markets)  → GraphLink[]

  New component: src/components/LensBar.tsx
    - Bottom-center floating bar, glass-panel style
    - 6 lens buttons with icons + labels
    - Active lens highlighted with auburn accent

  Modified: GalaxyView.tsx
    - Read activeCluster from context
    - When it changes, recompute cluster centers, update d3 forces, reheat simulation
    - Update cluster labels (SpriteText) to match new lens
    - Apply links from getLinksForMode()

  Modified: AppContext.tsx
    - New reducer action SET_CLUSTER_MODE
    - Recompute graphData.links when cluster mode changes

  The key technical detail: the d3 simulation in react-force-graph-3d supports hot-swapping forces. You already do fg.d3Force('cluster', fn) — switching
   lenses just replaces that function with one that targets different centers, then calls fg.d3ReheatSimulation(). The transition animation is free —
  it's just the simulation settling.

  ---
  Phase 2: Multi-Channel Visual Encoding

  Add two more selectors to the LensBar (or as a secondary row): "Color By" and "Size By".

  Color modes:

  ┌─────────────────────────┬───────────────────────────────────────────────────────────────────────┐
  │          Mode           │                            What it reveals                            │
  ├─────────────────────────┼───────────────────────────────────────────────────────────────────────┤
  │ Contestedness (default) │ How uncertain the market is                                           │
  ├─────────────────────────┼───────────────────────────────────────────────────────────────────────┤
  │ Momentum                │ Red = dropping, green = rising, neutral = flat                        │
  ├─────────────────────────┼───────────────────────────────────────────────────────────────────────┤
  │ Category                │ Each category gets its own color (you already have categoryToColor()) │
  ├─────────────────────────┼───────────────────────────────────────────────────────────────────────┤
  │ Spread                  │ Tight spread = efficient = blue, wide spread = inefficient = orange   │
  ├─────────────────────────┼───────────────────────────────────────────────────────────────────────┤
  │ Liquidity Ratio         │ liquidity/volume — how "deep" the market is                           │
  └─────────────────────────┴───────────────────────────────────────────────────────────────────────┘

  Size modes:

  ┌──────────────────┬─────────────────────────────┐
  │       Mode       │       What it reveals       │
  ├──────────────────┼─────────────────────────────┤
  │ Volume (default) │ How much money has been bet │
  ├──────────────────┼─────────────────────────────┤
  │ Liquidity        │ How deep the order book is  │
  ├──────────────────┼─────────────────────────────┤
  │ 24h Activity     │ What's active right now     │
  ├──────────────────┼─────────────────────────────┤
  │ Contestedness    │ How uncertain               │
  ├──────────────────┼─────────────────────────────┤
  │ Spread           │ Market efficiency           │
  └──────────────────┴─────────────────────────────┘

  This is where "holy shit" moments happen. Examples:

  - Cluster by Category + Color by Momentum → "Every crypto market is red. They're all dropping together. Something happened."
  - Cluster by Contestedness + Size by Liquidity → "The most contested markets are the smallest. The uncertain markets have thin order books — that's
  exploitable."
  - Cluster by Time Horizon + Color by Spread → "Near-term markets are all tight (efficient). Long-term ones are all wide (inefficient). Of course —
  more uncertainty = wider spreads."
  - Cluster by Event + Color by Contestedness + Size by Volume → "This election event has 8 linked markets. The main one is huge and certain. The
  sub-markets are tiny and contested. Smart money is on the favorite but retail is gambling on the long shots."

  Each combination tells a different story. The user feels like they're discovering patterns, because they are.

  Architecture for Phase 2:

  New state:
    activeColorMode: 'contestedness' | 'momentum' | 'category' | 'spread' | 'liquidityRatio'
    activeSizeMode: 'volume' | 'liquidity' | 'activity24h' | 'contestedness' | 'spread'

  New file: src/lib/visualEncoding.ts
    - computeColor(market, mode) → hex string
    - computeSize(market, mode) → number
    - getColorLegend(mode) → { label: string, colors: string[] }

  Modified: GalaxyView.tsx createOrbNode callback
    - Currently hardcodes orbSize and orbColor from market data
    - Instead, read activeColorMode/activeSizeMode from context
    - Recompute on mode change (requires rebuilding Three.js objects —
      trigger via graphData reference change)

  Modified: polymarket.ts buildGraphData()
    - Accept colorMode and sizeMode parameters
    - Compute val and orbColor based on active modes

  The Three.js objects need rebuilding when color/size modes change. The cleanest way: when a mode changes, reconstruct graphData with new
  orbColor/orbSize values and set it in state. react-force-graph-3d will re-call nodeThreeObject for nodes whose visual properties changed. The
  simulation positions are preserved because the node ids don't change.

  ---
  Phase 3: Connections & Constellations

  Expand the links system beyond event siblings:

  Connection types (toggleable):

  1. Event Siblings — markets from the same event. Always thin white lines. Shows market structure.
  2. Co-movers — connect markets whose oneDayPriceChange is within 2% of each other AND in the same direction. Color-coded: green lines for rising
  pairs, red for falling. This reveals hidden correlations — a crypto market and a tech regulation market moving together? That's a signal.
  3. Spread Anomalies — connect markets in the same category where one has a spread 3x+ wider than the other. Highlights where market efficiency breaks
  down.

  These are all computable client-side from existing data. No API calls needed.

  Architecture:

  New state:
    activeConnections: Set<'event' | 'comovers' | 'spreadAnomalies'>

  Modified: src/lib/clustering.ts
    - computeEventLinks(markets) → GraphLink[]
    - computeComoverLinks(markets) → GraphLink[]
    - computeSpreadAnomalyLinks(markets) → GraphLink[]

  Modified: GalaxyView.tsx
    - linkColor callback based on link type
    - linkOpacity, linkWidth based on strength
    - linkDirectionalParticles for animated flow on co-mover links

  react-force-graph-3d supports linkColor, linkWidth, linkOpacity, and linkDirectionalParticles out of the box. No custom Three.js needed for links.

  ---
  Phase 4: AI as Exploration Companion (The Differentiator)

  This is what separates Tiger's Eye from "another data viz." The AI doesn't just analyze individual markets — it analyzes what you're looking at.

  4A: "Read the Galaxy" — Contextual AI on Lens Changes

  When the user switches lenses, a small AI insight chip appears at the top of the screen (not blocking anything). The AI sees the current lens
  configuration and the resulting cluster shapes, and gives one punchy observation:

  - Switch to Momentum → "Three politics markets are dropping in lockstep — unusual for a non-election week. Possible shared catalyst."
  - Switch to Contestedness Spectrum → "The 50/50 zone is dominated by crypto markets. Prediction markets are essentially coin-flipping on crypto right
  now."
  - Switch to Event Constellation → "The 'Presidential Race' event has 6 sibling markets whose probabilities sum to 112%. That's not possible — there's
  12 cents of mispricing across the constellation."

  This is NOT a full analysis — it's a one-sentence nudge that makes the user go "wait, what?" and dig deeper. It's the difference between a silent
  instrument and one with a guide.

  Implementation: When activeCluster changes, build a prompt that includes the current lens name, the cluster summary stats (how many markets per
  cluster, average metrics per cluster), and ask the AI for a one-sentence observation. Use the NANO model, max_tokens: 150, streaming.

  4B: "Investigate" — Multi-Market Selection

  Let users shift-click (or long-press) multiple nodes to select a group. An "Investigate" button appears. Clicking it sends ALL selected markets to the
   AI with the prompt:

  "The user has selected these N markets from the galaxy visualization. They're currently viewing the [lens name] lens. What's the interesting
  connection or pattern between these specific markets?"

  This is powerful because the user's selection IS the query. They don't need to type anything. They see a cluster that looks interesting, select the
  nodes, and the AI tells them what they found.

  4C: "Surprise Me" — AI-Guided Lens Suggestions

  A small button in the LensBar: a sparkle icon. When clicked, the AI analyzes the full market dataset, picks the most interesting lens configuration,
  switches to it, and highlights the relevant nodes while streaming a brief explanation:

  "Switching to Momentum lens with Spread coloring. Notice the orange cluster at the top-right — those are three sports markets all surging with
  unusually wide spreads. Someone's moving these markets but there isn't enough liquidity to absorb it cleanly."

  This is the "holy shit I just found this out myself" moment — the AI points you toward something, but YOU see it in the galaxy. You're not reading a
  text summary. You're looking at glowing orbs that confirm what the AI is saying. The visual and the verbal reinforce each other.

  4D: Upgrade the Per-Market AI to be Relational

  Currently, when you click a market, the AI prompt only includes that one market's data. Upgrade it to also include:
  - The 3 most similar markets (by category + contestedness)
  - The market's event siblings (if any)
  - The current lens context

  The AI take changes from "this market is at 65%" to "this market is at 65% but its sibling markets in the same event sum to 108% — someone's wrong and
   it's probably the long shots. Also, this is the only market in the politics cluster that moved today while everything else was flat."

  Architecture for Phase 4:

  New prompts in src/lib/ai.ts:
    - PROMPTS.GALAXY_OBSERVATION — one-sentence insight about current lens
    - PROMPTS.INVESTIGATE_GROUP — multi-market relationship analysis
    - PROMPTS.SURPRISE_ME — pick the most interesting lens + explain

  New state:
    selectedNodes: Set<string>  (for multi-select)
    galaxyInsight: string       (current lens AI chip)
    galaxyInsightLoading: boolean

  New component: src/components/InsightChip.tsx
    - Top-center floating chip, fades in when lens changes
    - One sentence, AI accent color, auto-dismisses after 8s or on click

  Modified: MarketCard.tsx
    - buildMarketAnalysisMessage() includes sibling + similar market data

  Modified: AppContext.tsx
    - New actions: TOGGLE_NODE_SELECTION, SET_GALAXY_INSIGHT
    - useEffect on activeCluster changes to trigger galaxy observation

  ---
  Phase 5: Signals — Client-Side Pattern Detection (No AI Needed)

  Some patterns can be detected with pure math, no API call:

  1. Arbitrage Detector: For each event with 2+ sibling markets, sum the yes prices. If > 1.05 or < 0.95, flag it. Display as a persistent badge on the
  affected constellation.
  2. Correlation Spotter: Markets in different categories with oneDayPriceChange within 1% and same direction. Highlight with a pulsing connection line.
  3. Anomaly Flag: Markets where oneDayPriceChange is >5% but volume24hr is below median. Price moved without volume — possible manipulation or
  news-ahead-of-flow.
  4. Spread Watch: Markets where spread > 2x the category average. These are the inefficient markets where a trader could profit.

  These "Signals" can be surfaced as a section in the FeedPanel and as visual overlays (pulsing rings around anomalous nodes, special link colors for
  correlations).

  This is the purest form of "I just found this out myself" — the user sees a pulsing ring around a node, clicks it, and discovers an arbitrage
  opportunity. No AI needed. Just data.

  ---
  User Journey (After Implementation)

  1. Land on the galaxy → see it clustered by category → familiar, beautiful
  2. Notice the LensBar at bottom → try Momentum → galaxy reorganizes over 2 seconds → "whoa"
  3. See a tight red cluster form on the left → hover → all crypto → "they're all dropping together"
  4. AI chip appears at top: "Crypto cluster is moving in lockstep — 4 markets dropped 5%+ in 24h" → "okay that's interesting"
  5. Switch to Contestedness Spectrum → galaxy stretches into a gradient → giant orange orb at the far right → click → $5M market at exactly 50/50 → AI
  take: "This market has more money in it than most but is a literal coin flip. The spread is tight though — smart money is on both sides equally."
  6. Turn on Event Connections → thin lines appear between related markets → a constellation of 6 connected orbs → one of them has a pulsing ring →
  click → Arbitrage Signal: sibling prices sum to 108%
  7. Hit Surprise Me → galaxy flips to Time Horizon lens with Spread coloring → AI: "Markets resolving this week are all blue (efficient). But there's
  one orange outlier — wide spread, high volume, resolving in 3 days. Something's off." → click it → the AI take tears it apart
  8. Shift-click three orbs that looked suspicious → hit Investigate → AI: "These three markets are in different categories but all moved exactly +4.2%
  today. That's statistically unlikely to be coincidence. They may share a common catalyst."
  9. User thinks: "I just discovered a cross-market correlation that I wouldn't have found in a spreadsheet. This tool is genuinely useful."

  ---
  Implementation Priority

  I'd suggest building in this order, where each phase is a complete, shippable increment:

  1. Phase 1 (Lens System) — the single biggest impact. Transforms the app from passive to active. ~1-2 days of focused work.
  2. Phase 5 (Signals) — pure client-side, no API cost, adds immediate "discovery" moments.
  3. Phase 2 (Multi-Channel Encoding) — deepens the lens system dramatically.
  4. Phase 3 (Connections) — visual relationships make the galaxy feel alive.
  5. Phase 4 (AI Companion) — the capstone. Turns a good tool into something that feels magical.

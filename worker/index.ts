export interface Env {
  OPENROUTER_API_KEY: string;
  ALLOWED_ORIGIN?: string;
}

function corsHeaders(origin: string | null, env: Env): Record<string, string> {
  const allowed = env.ALLOWED_ORIGIN || 'https://tigerseye.pages.dev';
  const isAllowed =
    origin === allowed ||
    origin?.startsWith('http://localhost:') ||
    origin?.startsWith('http://127.0.0.1:');

  return {
    'Access-Control-Allow-Origin': isAllowed ? (origin ?? allowed) : allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function corsResponse(origin: string | null, env: Env): Response {
  return new Response(null, { status: 204, headers: corsHeaders(origin, env) });
}

// GET /api/markets — fetch events with nested markets from Polymarket
async function handleMarkets(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const cacheUrl = new URL(request.url);
  const cacheKey = new Request(cacheUrl.toString(), request);
  const cache = caches.default;

  const cached = await cache.match(cacheKey);
  if (cached) {
    const response = new Response(cached.body, cached);
    Object.entries(corsHeaders(origin, env)).forEach(([k, v]) => response.headers.set(k, v));
    return response;
  }

  const apiUrl =
    'https://gamma-api.polymarket.com/events?active=true&closed=false&limit=200&order=volume24hr&ascending=false';
  const upstream = await fetch(apiUrl, {
    headers: { Accept: 'application/json' },
  });

  if (!upstream.ok) {
    return new Response(JSON.stringify({ error: 'Upstream API error' }), {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin, env) },
    });
  }

  const data = await upstream.text();
  const response = new Response(data, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 's-maxage=60',
      ...corsHeaders(origin, env),
    },
  });

  const cacheResponse = response.clone();
  await cache.put(cacheKey, cacheResponse);

  return response;
}

// GET /api/history/:tokenId — price history from CLOB API
async function handleHistory(request: Request, env: Env, tokenId: string): Promise<Response> {
  const origin = request.headers.get('Origin');
  const url = new URL(request.url);
  const interval = url.searchParams.get('interval') || '1d';
  const fidelity = url.searchParams.get('fidelity') || '60';

  const apiUrl = `https://clob.polymarket.com/prices-history?market=${encodeURIComponent(tokenId)}&interval=${interval}&fidelity=${fidelity}`;

  const upstream = await fetch(apiUrl, {
    headers: { Accept: 'application/json' },
  });

  if (!upstream.ok) {
    return new Response(JSON.stringify({ error: 'Price history unavailable' }), {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin, env) },
    });
  }

  const data = await upstream.text();
  return new Response(data, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 's-maxage=300',
      ...corsHeaders(origin, env),
    },
  });
}

// POST /api/ai — proxy to OpenRouter with streaming support
async function handleAI(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin');
  const body = (await request.json()) as {
    model: string;
    messages: Array<{ role: string; content: string }>;
    stream?: boolean;
    max_tokens?: number;
    temperature?: number;
  };

  const openRouterBody = {
    model: body.model,
    messages: body.messages,
    stream: body.stream ?? true,
    max_tokens: body.max_tokens ?? 1000,
    temperature: body.temperature ?? 0.8,
  };

  const upstream = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': env.ALLOWED_ORIGIN || 'https://tigerseye.pages.dev',
      'X-Title': "Tiger's Eye",
    },
    body: JSON.stringify(openRouterBody),
  });

  if (!upstream.ok) {
    const errText = await upstream.text();
    return new Response(JSON.stringify({ error: 'AI API error', details: errText }), {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(origin, env) },
    });
  }

  if (body.stream !== false) {
    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        ...corsHeaders(origin, env),
      },
    });
  }

  const data = await upstream.text();
  return new Response(data, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(origin, env),
    },
  });
}

// Main fetch handler
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');

    if (request.method === 'OPTIONS') {
      return corsResponse(origin, env);
    }

    if (url.pathname === '/api/markets' && request.method === 'GET') {
      return handleMarkets(request, env);
    }

    const historyMatch = url.pathname.match(/^\/api\/history\/(.+)$/);
    if (historyMatch && request.method === 'GET') {
      return handleHistory(request, env, historyMatch[1]);
    }

    if (url.pathname === '/api/ai' && request.method === 'POST') {
      return handleAI(request, env);
    }

    return new Response('Not Found', { status: 404 });
  },
};

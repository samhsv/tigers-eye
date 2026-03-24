import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { streamAIResponse, fetchAIJSON, MODELS, PROMPTS, buildMarketAnalysisMessage, buildMispricedMessage } from './ai';
import type { MarketNode } from '../types';

function mockMarket(overrides: Partial<MarketNode> = {}): MarketNode {
  return {
    id: 'test-id',
    question: 'Will BTC hit 100k?',
    slug: 'btc-100k',
    conditionId: 'cond-1',
    eventId: 'evt-1',
    eventTitle: 'Bitcoin Prices',
    category: 'Crypto',
    outcomePrices: { yes: 0.65, no: 0.35 },
    outcomes: ['Yes', 'No'],
    volume: 2500000,
    liquidity: 500000,
    volume24hr: 50000,
    volume1wk: 200000,
    oneDayPriceChange: 0.03,
    oneWeekPriceChange: 0.08,
    lastTradePrice: 0.65,
    bestBid: 0.64,
    bestAsk: 0.66,
    spread: 0.02,
    endDate: '2025-12-31T00:00:00Z',
    contestedness: 0.7,
    orbSize: 3,
    orbColor: '#E8943A',
    pulseSpeed: 0.5,
    clobTokenIds: ['token-1'],
    image: '',
    ...overrides,
  };
}

describe('MODELS', () => {
  it('has correct model IDs', () => {
    expect(MODELS.NANO).toBe('nvidia/nemotron-3-nano-30b-a3b:free');
    expect(MODELS.SUPER).toBe('nvidia/nemotron-3-super-120b-a12b:free');
  });
});

describe('PROMPTS', () => {
  it('has non-empty market analysis prompt', () => {
    expect(PROMPTS.MARKET_ANALYSIS.length).toBeGreaterThan(100);
    expect(PROMPTS.MARKET_ANALYSIS).toContain('prediction market');
  });

  it('has non-empty mispriced analysis prompt', () => {
    expect(PROMPTS.MISPRICED_ANALYSIS.length).toBeGreaterThan(50);
    expect(PROMPTS.MISPRICED_ANALYSIS).toContain('JSON');
  });
});

describe('buildMarketAnalysisMessage', () => {
  it('includes market question', () => {
    const market = mockMarket({ question: 'Will it rain tomorrow?' });
    const msg = buildMarketAnalysisMessage(market);
    expect(msg).toContain('Will it rain tomorrow?');
  });

  it('includes YES price as percentage', () => {
    const market = mockMarket({ outcomePrices: { yes: 0.73, no: 0.27 } });
    const msg = buildMarketAnalysisMessage(market);
    expect(msg).toContain('73%');
  });

  it('includes volume', () => {
    const market = mockMarket({ volume: 2500000 });
    const msg = buildMarketAnalysisMessage(market);
    expect(msg).toContain('2.5M');
  });

  it('includes price change when present', () => {
    const market = mockMarket({ oneDayPriceChange: 0.05 });
    const msg = buildMarketAnalysisMessage(market);
    expect(msg).toContain('5.0%');
  });

  it('excludes price change when zero', () => {
    const market = mockMarket({ oneDayPriceChange: 0 });
    const msg = buildMarketAnalysisMessage(market);
    expect(msg).not.toContain('24h price change');
  });
});

describe('buildMispricedMessage', () => {
  it('includes all market IDs', () => {
    const markets = [
      mockMarket({ id: 'abc-123', question: 'Q1' }),
      mockMarket({ id: 'def-456', question: 'Q2' }),
    ];
    const msg = buildMispricedMessage(markets);
    expect(msg).toContain('abc-123');
    expect(msg).toContain('def-456');
  });

  it('includes JSON format instruction', () => {
    const msg = buildMispricedMessage([mockMarket()]);
    expect(msg).toContain('"picks"');
    expect(msg).toContain('"marketId"');
    expect(msg).toContain('ONLY the JSON');
  });
});

describe('streamAIResponse', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls onChunk for each content delta and onDone at end', async () => {
    const chunks = [
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
      'data: [DONE]\n\n',
    ];

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    });

    vi.mocked(fetch).mockResolvedValue(
      new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }),
    );

    const onChunk = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    await streamAIResponse({
      model: MODELS.NANO,
      messages: [{ role: 'user', content: 'test' }],
      onChunk,
      onDone,
      onError,
    });

    expect(onChunk).toHaveBeenCalledTimes(2);
    expect(onChunk).toHaveBeenCalledWith('Hello');
    expect(onChunk).toHaveBeenCalledWith(' world');
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it('calls onError on fetch failure', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('error', { status: 500 }),
    );

    const onChunk = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    await streamAIResponse({
      model: MODELS.NANO,
      messages: [{ role: 'user', content: 'test' }],
      onChunk,
      onDone,
      onError,
    });

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onChunk).not.toHaveBeenCalled();
  });

  it('skips malformed SSE lines gracefully', async () => {
    const chunks = [
      ': OPENROUTER PROCESSING\n\n',
      'data: not-json\n\n',
      'data: {"choices":[{"delta":{"content":"ok"}}]}\n\n',
      'data: [DONE]\n\n',
    ];

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    });

    vi.mocked(fetch).mockResolvedValue(
      new Response(stream, { status: 200 }),
    );

    const onChunk = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    await streamAIResponse({
      model: MODELS.NANO,
      messages: [{ role: 'user', content: 'test' }],
      onChunk,
      onDone,
      onError,
    });

    expect(onChunk).toHaveBeenCalledTimes(1);
    expect(onChunk).toHaveBeenCalledWith('ok');
    expect(onError).not.toHaveBeenCalled();
  });

  it('supports AbortSignal cancellation', async () => {
    const controller = new AbortController();
    controller.abort();

    const onChunk = vi.fn();
    const onDone = vi.fn();
    const onError = vi.fn();

    vi.mocked(fetch).mockRejectedValue(new DOMException('Aborted', 'AbortError'));

    await streamAIResponse({
      model: MODELS.NANO,
      messages: [{ role: 'user', content: 'test' }],
      onChunk,
      onDone,
      onError,
      signal: controller.signal,
    });

    // Aborted requests should not call onError
    expect(onError).not.toHaveBeenCalled();
  });
});

describe('fetchAIJSON', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parses JSON from response content', async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: '{"picks": [{"marketId": "1", "question": "Q1", "currentPrice": 0.5, "fairPrice": 0.7, "direction": "UNDER", "reasoning": "test"}]}',
        },
      }],
    };

    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );

    const result = await fetchAIJSON<{ picks: unknown[] }>(
      MODELS.SUPER,
      [{ role: 'user', content: 'test' }],
    );

    expect(result.picks).toHaveLength(1);
  });

  it('strips markdown code fences', async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: '```json\n{"value": 42}\n```',
        },
      }],
    };

    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );

    const result = await fetchAIJSON<{ value: number }>(
      MODELS.SUPER,
      [{ role: 'user', content: 'test' }],
    );

    expect(result.value).toBe(42);
  });

  it('throws on non-200 response', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('error', { status: 500 }),
    );

    await expect(
      fetchAIJSON(MODELS.SUPER, [{ role: 'user', content: 'test' }]),
    ).rejects.toThrow('AI API error 500');
  });
});

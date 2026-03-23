import type { AIStreamOptions, ChatMessage, MarketNode } from '../types';
import { formatVolume, priceToPercent } from './format';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

// ── Stream an AI response chunk by chunk ──
export async function streamAIResponse(options: AIStreamOptions): Promise<void> {
  const { model, messages, maxTokens, temperature, onChunk, onDone, onError, signal } = options;

  try {
    const response = await fetch(`${API_BASE}/api/ai`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        max_tokens: maxTokens ?? 300,
        temperature: temperature ?? 0.8,
      }),
      signal,
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AI API error ${response.status}: ${errText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed === '') continue;
        if (trimmed === 'data: [DONE]') {
          onDone();
          return;
        }
        if (!trimmed.startsWith('data: ')) continue;

        try {
          const json = JSON.parse(trimmed.slice(6));
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) {
            onChunk(delta);
          }
        } catch {
          // Skip malformed chunks
        }
      }
    }

    onDone();
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return;
    }
    onError(err instanceof Error ? err : new Error(String(err)));
  }
}

// ── Non-streaming AI request (for JSON responses) ──
export async function fetchAIJSON<T>(
  model: string,
  messages: ChatMessage[],
  maxTokens: number = 1000,
  temperature: number = 0.7,
): Promise<T> {
  const response = await fetch(`${API_BASE}/api/ai`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      max_tokens: maxTokens,
      temperature,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`AI API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('No content in AI response');

  const cleaned = content
    .replace(/```json\s*/g, '')
    .replace(/```\s*/g, '')
    .trim();

  return JSON.parse(cleaned) as T;
}

// ── Model constants ──
export const MODELS = {
  NANO: 'nvidia/nemotron-3-nano-30b-a3b:free',
  SUPER: 'nvidia/nemotron-3-super-120b-a12b:free',
} as const;

// ── System prompts ──
export const PROMPTS = {
  MARKET_ANALYSIS: `You are a sharp, opinionated prediction market analyst. You give fast, punchy takes on prediction markets. Rules:
- ALWAYS reference the actual numbers (current price, volume, price movement)
- ALWAYS take a directional lean. Never say "it could go either way." Have a view.
- Keep it under 4 sentences. Punchy. No filler.
- Match the energy of the topic: serious for geopolitics/economics, irreverent for meme/pop culture markets, analytical for sports/crypto
- If the odds have moved significantly recently, call that out and speculate why
- If the market looks mispriced to you, say so bluntly
- Never use phrases like "as an AI" or "I should note that" or "it's important to consider"
- Write like a smart friend who follows markets, not like a textbook`,

  MISPRICED_ANALYSIS: `You are a quantitative analyst who specializes in prediction markets. You're looking for mispricings — markets where the crowd consensus seems wrong based on available evidence, historical patterns, or logical reasoning. You're bold, specific, and willing to stake your reputation on your calls. Output valid JSON only.`,
} as const;

// ── Build market analysis user message ──
export function buildMarketAnalysisMessage(market: MarketNode): string {
  return `Prediction market: "${market.question}"
Current YES price: ${market.outcomePrices.yes} (meaning the crowd thinks there's a ${priceToPercent(market.outcomePrices.yes)} chance)
Current NO price: ${market.outcomePrices.no}
Total volume: $${formatVolume(market.volume)}
Liquidity: $${formatVolume(market.liquidity)}
Resolution date: ${market.endDate}
${market.oneDayPriceChange ? `24h price change: ${(market.oneDayPriceChange * 100).toFixed(1)}%` : ''}

Give me your take.`;
}

// ── Build mispriced analysis user message ──
export function buildMispricedMessage(markets: MarketNode[]): string {
  const marketList = markets
    .map(m => `- ID: ${m.id} | "${m.question}" | YES: ${m.outcomePrices.yes} | Volume: $${formatVolume(m.volume)}`)
    .join('\n');

  return `Here are 25 active prediction markets with their current crowd-consensus odds and trading volume. Identify the 3-5 markets where the current price seems MOST disconnected from likely reality.

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
${marketList}

Respond with ONLY the JSON. No markdown, no preamble.`;
}

import { config as loadEnv } from 'dotenv';
loadEnv();

import express, { type Response } from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';
import { computeNumerologyProfile } from '../src/lib/numerology.js';
import { buildSystemPrompt } from './bookExtractor.js';

const app = express();
app.use(cors());
app.use(express.json());

// ── LLM backend selection ─────────────────────────────────────────────────────
// If LLM_BASE_URL is set, route through any OpenAI-compatible endpoint (e.g. mlx_lm).
// Otherwise fall back to the Anthropic API.
const LLM_BASE_URL = process.env.LLM_BASE_URL?.replace(/\/$/, '');
const LLM_MODEL    = process.env.LLM_MODEL ?? 'default';
const LLM_API_KEY  = process.env.LLM_API_KEY ?? 'local';

const anthropic = LLM_BASE_URL
  ? null
  : new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

console.log(
  LLM_BASE_URL
    ? `LLM backend: local OpenAI-compatible → ${LLM_BASE_URL}  model=${LLM_MODEL}`
    : 'LLM backend: Anthropic API'
);

// ── Types ─────────────────────────────────────────────────────────────────────
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ── Streaming helpers ─────────────────────────────────────────────────────────

async function streamOpenAI(
  systemPrompt: string,
  messages: ChatMessage[],
  res: Response
): Promise<void> {
  const body = JSON.stringify({
    model: LLM_MODEL,
    stream: true,
    max_tokens: 2048,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
  });

  const upstream = await fetch(`${LLM_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${LLM_API_KEY}`,
    },
    body,
  });

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => upstream.statusText);
    throw new Error(`Upstream error ${upstream.status}: ${text}`);
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const payload = line.slice(6).trim();
      if (payload === '[DONE]') continue;

      try {
        const chunk = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string } }>;
        };
        const text = chunk.choices?.[0]?.delta?.content;
        if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
      } catch {
        // ignore malformed chunks
      }
    }
  }
}

async function streamAnthropic(
  systemPrompt: string,
  messages: ChatMessage[],
  res: Response
): Promise<void> {
  const stream = anthropic!.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: systemPrompt,
    messages: messages as Anthropic.MessageParam[],
  });

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
    }
  }
}

// ── Route ─────────────────────────────────────────────────────────────────────

app.post('/api/chat', async (req, res) => {
  const { name, birthday, messages } = req.body as {
    name: string;
    birthday: string;
    messages: ChatMessage[];
  };

  if (!name || !birthday || !Array.isArray(messages)) {
    res.status(400).json({ error: 'name, birthday, and messages are required' });
    return;
  }

  const profile = computeNumerologyProfile(name, birthday);
  const systemPrompt = buildSystemPrompt(profile);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    if (LLM_BASE_URL) {
      await streamOpenAI(systemPrompt, messages, res);
    } else {
      await streamAnthropic(systemPrompt, messages, res);
    }
    res.write('data: [DONE]\n\n');
  } catch (err) {
    console.error('LLM error:', err);
    res.write(`data: ${JSON.stringify({ error: 'Failed to get response' })}\n\n`);
  } finally {
    res.end();
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, backend: LLM_BASE_URL ? 'local' : 'anthropic' });
});

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => {
  console.log(`Numerology API server running on http://localhost:${PORT}`);
});

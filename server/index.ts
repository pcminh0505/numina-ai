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
const LLM_BASE_URL       = process.env.LLM_BASE_URL?.replace(/\/$/, '');
const LLM_MODEL          = process.env.LLM_MODEL ?? 'default';
const LLM_API_KEY        = process.env.LLM_API_KEY ?? 'local';
const LLM_ENABLE_THINKING = process.env.LLM_ENABLE_THINKING !== 'false';

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

// ── Thinking-token filter ─────────────────────────────────────────────────────
// Qwen3 (and some other reasoning models) emit <think>…</think> blocks.
// When LLM_ENABLE_THINKING=false we strip them from the stream so they never
// reach the chat UI.  We need a stateful buffer because the open/close tags
// can arrive split across multiple SSE chunks.
class ThinkingFilter {
  private buf = '';
  private inside = false;

  feed(text: string): string {
    if (LLM_ENABLE_THINKING) return text; // pass-through when thinking is on

    this.buf += text;
    let out = '';

    while (this.buf.length > 0) {
      if (this.inside) {
        const close = this.buf.indexOf('</think>');
        if (close === -1) {
          // Keep buffering — the closing tag hasn't arrived yet.
          // Retain up to 8 chars in case the tag is split across chunks.
          if (this.buf.length > 8) this.buf = this.buf.slice(-8);
          break;
        }
        this.inside = false;
        this.buf = this.buf.slice(close + 8); // skip past </think>
      } else {
        const open = this.buf.indexOf('<think>');
        if (open === -1) {
          // No opening tag anywhere — safe to emit everything except a
          // possible partial tag at the very end.
          const safe = this.buf.length > 7 ? this.buf.length - 7 : 0;
          out += this.buf.slice(0, safe);
          this.buf = this.buf.slice(safe);
          break;
        }
        out += this.buf.slice(0, open); // emit text before <think>
        this.inside = true;
        this.buf = this.buf.slice(open + 7); // skip past <think>
      }
    }

    return out;
  }

  /** Flush any remaining buffered text once the stream ends. */
  flush(): string {
    if (LLM_ENABLE_THINKING || this.inside) return '';
    const out = this.buf;
    this.buf = '';
    return out;
  }
}

async function streamOpenAI(
  systemPrompt: string,
  messages: ChatMessage[],
  res: Response
): Promise<void> {
  const requestBody: Record<string, unknown> = {
    model: LLM_MODEL,
    stream: true,
    max_tokens: 2048,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
  };

  // Ask the model to skip reasoning tokens when thinking is disabled.
  // mlx_lm honours this via chat_template_kwargs; some providers use
  // a top-level "thinking" field — we send both for compatibility.
  if (!LLM_ENABLE_THINKING) {
    requestBody['chat_template_kwargs'] = { enable_thinking: false };
    requestBody['thinking'] = { type: 'disabled' };
  }

  const upstream = await fetch(`${LLM_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${LLM_API_KEY}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!upstream.ok || !upstream.body) {
    const text = await upstream.text().catch(() => upstream.statusText);
    throw new Error(`Upstream error ${upstream.status}: ${text}`);
  }

  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();
  const filter = new ThinkingFilter();
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
        const raw = chunk.choices?.[0]?.delta?.content;
        if (!raw) continue;
        const text = filter.feed(raw);
        if (text) res.write(`data: ${JSON.stringify({ text })}\n\n`);
      } catch {
        // ignore malformed chunks
      }
    }
  }

  // Flush any trailing text the filter was holding back
  const tail = filter.flush();
  if (tail) res.write(`data: ${JSON.stringify({ text: tail })}\n\n`);
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
  res.json({
    ok: true,
    backend: LLM_BASE_URL ? 'local' : 'anthropic',
    model: LLM_BASE_URL ? LLM_MODEL : 'claude-sonnet-4-6',
    thinking: LLM_ENABLE_THINKING,
  });
});

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => {
  console.log(`Numerology API server running on http://localhost:${PORT}`);
});

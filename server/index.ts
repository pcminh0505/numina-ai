import { config as loadEnv } from 'dotenv';
loadEnv();

import express, { type Response } from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';
import { createPublicClient, http, decodeEventLog, parseAbiItem, parseAbi } from 'viem';
import { celo, celoSepolia } from 'viem/chains';
import { computeNumerologyProfile, computeAdvancedProfile } from '../src/lib/numerology.js';
import { buildSystemPrompt } from './bookExtractor.js';
import {
  getCredits,
  deductChat,
  deductOnChainCredit,
  getOnChainCreditsUsed,
  addChatCredits,
  unlockAdvanced,
  resetDailyIfNeeded,
  applyReferral,
} from './credits.js';

const app = express();
app.use(cors());
app.use(express.json());

// ── LLM backend selection ─────────────────────────────────────────────────────
// Priority: LLM_BASE_URL (local/custom) > OPENROUTER_API_KEY > ANTHROPIC_API_KEY
const LLM_BASE_URL        = process.env.LLM_BASE_URL?.replace(/\/$/, '');
const LLM_MODEL           = process.env.LLM_MODEL ?? 'meta-llama/llama-3.3-70b-instruct:free';
const LLM_MODEL_PAID      = process.env.LLM_MODEL_PAID ?? 'anthropic/claude-3.5-sonnet';
const LLM_API_KEY         = process.env.LLM_API_KEY ?? 'local';
const LLM_ENABLE_THINKING = process.env.LLM_ENABLE_THINKING !== 'false';
const OPENROUTER_API_KEY  = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

const anthropic = (LLM_BASE_URL || OPENROUTER_API_KEY)
  ? null
  : new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const effectiveBaseUrl = LLM_BASE_URL ?? (OPENROUTER_API_KEY ? OPENROUTER_BASE_URL : null);

console.log(
  effectiveBaseUrl
    ? `LLM backend: ${LLM_BASE_URL ? 'local' : 'OpenRouter'} → ${effectiveBaseUrl}  model=${LLM_MODEL}`
    : 'LLM backend: Anthropic API',
);

// ── On-chain USDC verification ────────────────────────────────────────────────
const USDC_ADDRESSES: Record<number, `0x${string}`> = {
  [celo.id]:        '0xcebA9300f2b948710d2653dD7B07f33A8B32118C',
  [celoSepolia.id]: '0x01C5C0122039549AD1493B8220cABEdD739BC44E',
};
const TREASURY_ADDRESS = process.env.X402_TREASURY_ADDRESS?.toLowerCase();
const ADVANCED_PRICE   = BigInt(process.env.X402_ADVANCED_PRICE ?? '500000');
const CREDITS_PRICE    = BigInt(process.env.X402_CREDITS_PRICE  ?? '200000');

const TRANSFER_ABI = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 value)',
);

// ── NumerologyReading contract (on-chain source of truth) ────────────────────
const READING_CONTRACT_ABI = parseAbi([
  'function hasAdvanced(address user) view returns (bool)',
  'function creditsPurchased(address user) view returns (uint256)',
]);

const READING_CONTRACT: Partial<Record<number, `0x${string}`>> = {
  [celo.id]:        (process.env.READING_CONTRACT_MAINNET ?? '') as `0x${string}`,
  [celoSepolia.id]: (process.env.READING_CONTRACT_TESTNET ?? '') as `0x${string}`,
};

async function getOnChainState(
  wallet: string,
  chainId: number,
): Promise<{ hasAdvanced: boolean; creditsPurchased: bigint } | null> {
  const contractAddress = READING_CONTRACT[chainId];
  if (!contractAddress || contractAddress.length < 10) return null;

  const chain = chainId === celo.id ? celo : celoSepolia;
  const client = createPublicClient({ chain, transport: http() });

  try {
    const [adv, credits] = await Promise.all([
      client.readContract({
        address: contractAddress,
        abi: READING_CONTRACT_ABI,
        functionName: 'hasAdvanced',
        args: [wallet as `0x${string}`],
      }),
      client.readContract({
        address: contractAddress,
        abi: READING_CONTRACT_ABI,
        functionName: 'creditsPurchased',
        args: [wallet as `0x${string}`],
      }),
    ]);
    return { hasAdvanced: adv as boolean, creditsPurchased: credits as bigint };
  } catch {
    return null;
  }
}

async function verifyUsdcTransfer(
  txHash: `0x${string}`,
  fromWallet: string,
  minAmount: bigint,
  chainId: number,
): Promise<boolean> {
  if (!TREASURY_ADDRESS) return false;
  const chain = chainId === celo.id ? celo : celoSepolia;
  const usdcAddress = USDC_ADDRESSES[chainId];
  if (!usdcAddress) return false;

  const client = createPublicClient({ chain, transport: http() });
  let receipt;
  try {
    receipt = await client.getTransactionReceipt({ hash: txHash });
  } catch {
    return false;
  }
  if (receipt.status !== 'success') return false;

  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== usdcAddress.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({ abi: [TRANSFER_ABI], data: log.data, topics: log.topics });
      const args = decoded.args as { from: string; to: string; value: bigint };
      if (
        args.from?.toLowerCase() === fromWallet.toLowerCase() &&
        args.to?.toLowerCase() === TREASURY_ADDRESS &&
        args.value >= minAmount
      ) {
        return true;
      }
    } catch {
      // not a matching Transfer event
    }
  }
  return false;
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ── Thinking-token filter ─────────────────────────────────────────────────────
class ThinkingFilter {
  private buf = '';
  private inside = false;

  feed(text: string): string {
    if (LLM_ENABLE_THINKING) return text;

    this.buf += text;
    let out = '';

    while (this.buf.length > 0) {
      if (this.inside) {
        const close = this.buf.indexOf('</think>');
        if (close === -1) {
          if (this.buf.length > 8) this.buf = this.buf.slice(-8);
          break;
        }
        this.inside = false;
        this.buf = this.buf.slice(close + 8);
      } else {
        const open = this.buf.indexOf('<think>');
        if (open === -1) {
          const safe = this.buf.length > 7 ? this.buf.length - 7 : 0;
          out += this.buf.slice(0, safe);
          this.buf = this.buf.slice(safe);
          break;
        }
        out += this.buf.slice(0, open);
        this.inside = true;
        this.buf = this.buf.slice(open + 7);
      }
    }

    return out;
  }

  flush(): string {
    if (LLM_ENABLE_THINKING || this.inside) return '';
    const out = this.buf;
    this.buf = '';
    return out;
  }
}

// ── Streaming helpers ─────────────────────────────────────────────────────────

async function streamOpenAI(
  baseUrl: string,
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: ChatMessage[],
  res: Response,
  extraHeaders: Record<string, string> = {},
): Promise<void> {
  const requestBody: Record<string, unknown> = {
    model,
    stream: true,
    max_tokens: 2048,
    messages: [{ role: 'system', content: systemPrompt }, ...messages],
  };

  if (!LLM_ENABLE_THINKING) {
    requestBody['chat_template_kwargs'] = { enable_thinking: false };
    requestBody['thinking'] = { type: 'disabled' };
  }

  const upstream = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...extraHeaders,
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

  const tail = filter.flush();
  if (tail) res.write(`data: ${JSON.stringify({ text: tail })}\n\n`);
}

async function streamAnthropic(
  systemPrompt: string,
  messages: ChatMessage[],
  res: Response,
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

// ── Routes ────────────────────────────────────────────────────────────────────

app.post('/api/chat', async (req, res) => {
  const { name, birthday, messages, wallet, tier, chainId: reqChainId } = req.body as {
    name: string;
    birthday: string;
    messages: ChatMessage[];
    wallet?: string;
    tier?: 'free' | 'advanced';
    chainId?: number;
  };

  if (!name || !birthday || !Array.isArray(messages)) {
    res.status(400).json({ error: 'name, birthday, and messages are required' });
    return;
  }

  // Credit gating — only enforce when wallet is provided
  if (wallet) {
    resetDailyIfNeeded(wallet);
    const hasFree = deductChat(wallet);
    if (!hasFree) {
      // Check on-chain credits as fallback
      const chainId  = reqChainId ?? celo.id;
      const onChain  = await getOnChainState(wallet, chainId);
      const purchased = Number(onChain?.creditsPurchased ?? 0n);
      const used      = getOnChainCreditsUsed(wallet);
      if (purchased <= used) {
        res.status(402).json({ error: 'credits_depleted' });
        return;
      }
      deductOnChainCredit(wallet);
    }
  }

  const effectiveTier = tier ?? 'free';
  const profile = effectiveTier === 'advanced'
    ? computeAdvancedProfile(name, birthday)
    : computeNumerologyProfile(name, birthday);

  const systemPrompt = buildSystemPrompt(profile, effectiveTier);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    if (effectiveBaseUrl) {
      const isOpenRouter = !LLM_BASE_URL && !!OPENROUTER_API_KEY;
      const apiKey = LLM_BASE_URL ? LLM_API_KEY : (OPENROUTER_API_KEY ?? 'local');
      const model  = effectiveTier === 'advanced' && isOpenRouter ? LLM_MODEL_PAID : LLM_MODEL;
      const extraHeaders = isOpenRouter
        ? { 'X-Title': 'Numina AI', 'HTTP-Referer': 'https://minipay.to' }
        : {};
      await streamOpenAI(effectiveBaseUrl, apiKey, model, systemPrompt, messages, res, extraHeaders);
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

app.get('/api/credits', async (req, res) => {
  const wallet  = req.query.wallet  as string | undefined;
  const chainId = parseInt((req.query.chainId as string) ?? String(celo.id), 10);
  if (!wallet) {
    res.status(400).json({ error: 'wallet is required' });
    return;
  }

  const serverState = getCredits(wallet);
  const onChain     = await getOnChainState(wallet, chainId);
  const onChainPurchased = Number(onChain?.creditsPurchased ?? 0n);
  const onChainUsed      = getOnChainCreditsUsed(wallet);
  const onChainRemaining = Math.max(0, onChainPurchased - onChainUsed);

  res.json({
    ...serverState,
    advancedUnlocked: serverState.advancedUnlocked || (onChain?.hasAdvanced ?? false),
    chatMessages: serverState.chatMessages + onChainRemaining,
    freeRemaining: serverState.freeRemaining,
  });
});

app.post('/api/unlock-advanced', async (req, res) => {
  const { wallet, txHash, chainId } = req.body as {
    wallet: string;
    txHash: `0x${string}`;
    chainId?: number;
  };
  if (!wallet || !txHash) {
    res.status(400).json({ error: 'wallet and txHash are required' });
    return;
  }
  const chain = chainId ?? celo.id;
  const valid = await verifyUsdcTransfer(txHash, wallet, ADVANCED_PRICE, chain);
  if (!valid) {
    res.status(402).json({ error: 'Payment not verified' });
    return;
  }
  unlockAdvanced(wallet);
  res.json({ ok: true });
});

app.post('/api/buy-credits', async (req, res) => {
  const { wallet, txHash, chainId } = req.body as {
    wallet: string;
    txHash: `0x${string}`;
    chainId?: number;
  };
  if (!wallet || !txHash) {
    res.status(400).json({ error: 'wallet and txHash are required' });
    return;
  }
  const chain = chainId ?? celo.id;
  const valid = await verifyUsdcTransfer(txHash, wallet, CREDITS_PRICE, chain);
  if (!valid) {
    res.status(402).json({ error: 'Payment not verified' });
    return;
  }
  addChatCredits(wallet, 20);
  res.json({ ok: true, creditsAdded: 20 });
});

app.post('/api/referral/register', (req, res) => {
  const { newWallet, referrerCode } = req.body as {
    newWallet: string;
    referrerCode: string;
  };
  if (!newWallet || !referrerCode) {
    res.status(400).json({ error: 'newWallet and referrerCode are required' });
    return;
  }
  const awarded = applyReferral(newWallet, referrerCode);
  res.json({ ok: true, awarded });
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    backend: effectiveBaseUrl ? (LLM_BASE_URL ? 'local' : 'openrouter') : 'anthropic',
    model: LLM_MODEL,
    modelPaid: LLM_MODEL_PAID,
    thinking: LLM_ENABLE_THINKING,
    selfAgentId: process.env.SELF_AGENT_ID ?? null,
  });
});

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => {
  console.log(`Numina AI API server running on http://localhost:${PORT}`);
});

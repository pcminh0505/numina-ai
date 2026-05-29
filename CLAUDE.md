# Numina AI — Project Guide

An AI-powered Pythagorean numerology oracle and 1:1 AI consultant built as a MiniPay Mini App on Celo. Users get a free instant profile, unlock advanced insights via on-chain USDC micropayment, and chat with an AI consultant backed by a configurable LLM.

## Stack

- **Vite 8** + **React 19** + TypeScript (React Compiler enabled)
- **wagmi v3** + **viem** + **@tanstack/react-query v5**
- Chains: Celo mainnet (`42220`) + Celo Sepolia testnet (`44787`)
- Package manager: **pnpm**
- Server: **Express** + **tsx** (SSE streaming, port 3001)

## Commands

```bash
pnpm dev              # Frontend dev server (port 5173)
pnpm dev:server       # Express API server (port 3001) — required for AI chat
pnpm build            # Type-check + build to dist/
pnpm lint             # ESLint

forge test            # Run 14 Solidity unit tests (no network needed)
pnpm deploy:contract  # Deploy NumerologyReading.sol to Celo Sepolia
DEPLOY_CHAIN=mainnet pnpm deploy:contract  # Deploy to Celo mainnet
pnpm register:agent   # ERC-8004 on-chain identity registration
```

## Production Deployment

```
Browser
  └─► Cloudflare Workers (numina-ai) — static Vite build + /api/* proxy
        └─► Fly.io Express (numina-ai-api, Singapore, auto-scale-to-zero)
              └─► Cloudflare Workers AI (numina-ai-llm) — Llama 3.3 70B FP8
```

| Component | URL | Config |
|---|---|---|
| Frontend | https://numina-ai.pcminh0505.workers.dev | `wrangler.toml` + `worker/proxy.js` |
| API backend | https://numina-ai-api.fly.dev | `fly.toml` + `Dockerfile` |
| LLM proxy | https://numina-ai-llm.pcminh0505.workers.dev | `wrangler.ai-proxy.toml` + `worker/ai-proxy.js` |

### Redeploy commands

```bash
pnpm build && npx wrangler deploy                          # frontend
fly deploy --app numina-ai-api                             # backend
npx wrangler deploy --config wrangler.ai-proxy.toml       # LLM proxy (rarely needed)
```

### How the LLM proxy works

`worker/ai-proxy.js` exposes `POST /v1/chat/completions` (OpenAI-compatible) backed by the `AI` binding (`@cf/meta/llama-3.3-70b-instruct-fp8-fast`). It transforms the CF Workers AI SSE format (`data: {"response":"..."}`) into OpenAI SSE format (`data: {"choices":[{"delta":{"content":"..."}}]}`), so the existing `streamOpenAI()` function in `server/index.ts` works with no changes. Protected by `AI_SECRET` (wrangler secret).

### Notes on in-memory state

The in-memory credit store (`server/credits.ts`) resets when Fly.io auto-stops the machine after idle. On-chain state (`hasAdvanced`, `creditsPurchased`) is always re-read from the Celo contract and is unaffected.

## Project Structure

```
src/
  App.tsx                        # Root: WagmiProvider + 2 tabs (Wallet, Numerology)
  lib/
    wagmi.ts                     # Wagmi config (Celo + celoSepolia, injected connector)
    numerology.ts                # All Pythagorean calculations
    numerologyEssences.ts        # 1-sentence per-number descriptions (no server call)
    readingContract.ts           # NumerologyReading ABI + address lookup by chainId
    x402.ts                      # USDC addresses, ADVANCED_PRICE, CREDITS_PRICE
    feeCurrency.ts               # CIP-64 adapter addresses + getFeeCurrencyAddress()
    referral.ts                  # generateReferralLink() + getReferralCodeFromUrl()
    tokens.ts                    # Token registry (symbol, decimals, address per chain)
  hooks/
    useAutoConnect.ts            # Auto-connect on load — required for MiniPay
    useCredits.ts                # React Query: GET /api/credits?wallet=&chainId=
    useAdvancedUnlock.ts         # approve USDC → unlockAdvanced() on contract
    useBuyCredits.ts             # approve USDC → buyCredits(1) on contract
    useReferral.ts               # POST /api/referral/register on wallet connect
  components/
    NumerologyChat.tsx           # Phase machine: entry → profile → (advanced|chat)
    NumerologyProfile.tsx        # Free instant profile card (client-side only)
    NumerologyAdvanced.tsx       # Paid advanced reading + PinnacleTimeline graph
    NumerologyChat.css           # All numerology UI styles (CSS design tokens only)
  data/
    numerologyBook.json          # ~221KB — David Phillips book passages for AI context
    advancedNumerology.json      # Personal Year, Pinnacles, Challenges text

server/
  index.ts                       # Express: /api/chat (SSE), /api/credits, /api/health
  bookExtractor.ts               # buildSystemPrompt() — profile + book passages + tier
  credits.ts                     # In-memory credit store (free daily + on-chain tracking)

worker/
  proxy.js                       # CF Worker: static site + /api/* reverse proxy to Fly.io
  ai-proxy.js                    # CF Worker: OpenAI-compatible endpoint over Workers AI

contracts/
  NumerologyReading.sol          # On-chain payment: hasAdvanced + creditsPurchased
  SimpleCounter.sol              # Demo counter

test/
  NumerologyReading.t.sol        # 14 Foundry unit tests

scripts/
  deployNumerologyReading.ts     # forge create wrapper — prints env vars after deploy
  registerERC8004.ts             # One-time ERC-8004 identity registration
```

## Numerology Phase State Machine

```
entry  ──[form submit]──►  profile  ──[Chat button]──►  chat
                              │
                              └──[Unlock button]──►  advanced content (inline)
```

- **entry**: name + birthday form; hydrates `localStorage` session on mount
- **profile**: `NumerologyProfile` (free, client-only) + `NumerologyAdvanced` paywall/content inline
- **chat**: SSE streaming; sends `{ wallet, tier, chainId }` to `/api/chat`
- Session (`profileData`, `messages`, `phase`) cached at `numerology_session_<address>`

## LLM Backend Priority

```
LLM_BASE_URL set       →  OpenAI-compatible endpoint (production: CF Workers AI proxy)
OPENROUTER_API_KEY     →  OpenRouter (free: Llama 3.3 70B / paid tier: Claude 3.5 Sonnet)
ANTHROPIC_API_KEY      →  Anthropic SDK (Claude Sonnet 4.6)
```

`LLM_ENABLE_THINKING=false` strips `<think>…</think>` tokens from Qwen3 / DeepSeek output.

## Payment Flow

1. Client reads USDC `allowance` for `NumerologyReading` contract via `publicClient.readContract`
2. If insufficient: `walletClient.writeContract(approve)` → `waitForTransactionReceipt`
3. `walletClient.writeContract(unlockAdvanced | buyCredits)` → `waitForTransactionReceipt`
4. `useReadContract(hasAdvanced)` refetches → UI unlocks
5. Server `GET /api/credits` reads `hasAdvanced` + `creditsPurchased` from chain on every call

## Credit Logic

| Source | Amount | Reset |
|---|---|---|
| Free | 5 messages/wallet | Daily UTC midnight (resets on server restart too) |
| Referral bonus | +5 to both wallets | One-time per pair |
| Purchased (on-chain) | 20 per pack ($0.20 USDC) | Never |
| Advanced unlock | Permanent | Never |

## Key wagmi v3 Patterns

### Wallet connection — always `useConnection`, never `useAccount`

```ts
import { useConnection } from 'wagmi';
const { address, isConnected, chain } = useConnection();
```

### Sequential contract calls (approve → write)

```ts
const { data: walletClient } = useWalletClient();
const publicClient = usePublicClient();

// Cast required for Celo CIP-64 feeCurrency extension
const write = walletClient.writeContract as (args: any) => Promise<`0x${string}`>;

const approveHash = await write({ address: usdcAddr, abi: erc20Abi, functionName: 'approve', args: [...], feeCurrency });
await publicClient.waitForTransactionReceipt({ hash: approveHash });

const txHash = await write({ address: contractAddr, abi: ABI, functionName: 'myFn', feeCurrency });
await publicClient.waitForTransactionReceipt({ hash: txHash });
```

### ERC20 send with CIP-64 fee abstraction

```ts
import { encodeFunctionData, erc20Abi } from 'viem';
import { getFeeCurrencyAddress } from './lib/feeCurrency';

const data = encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [to, amount] });
(sendTransaction as any)({ to: tokenAddress, data, feeCurrency: getFeeCurrencyAddress('USDC', chainId) });
```

### `useBalance` — no `token` param in v3

```ts
// Native balance only
const { data } = useBalance({ address });
const display = data ? formatEther(data.value) : '...';

// ERC20: use useReadContract with balanceOf
const { data: raw } = useReadContract({ address: TOKEN, abi: erc20Abi, functionName: 'balanceOf', args: [address!] });
```

## CSS Design Tokens

Never use hardcoded colors — always use tokens from `src/index.css`:

| Token | Usage |
|---|---|
| `var(--bg)` | Page / card backgrounds |
| `var(--code-bg)` | Secondary / input backgrounds |
| `var(--border)` | Borders and dividers |
| `var(--text-h)` | Headings |
| `var(--text)` | Body text |
| `var(--accent)` | Primary purple action color |
| `var(--accent-bg)` | Subtle accent tint |
| `var(--accent-border)` | Accent border |

## Environment Variables

### Client-side (baked in at `pnpm build`)

| Variable | Purpose |
|---|---|
| `VITE_X402_TREASURY_ADDRESS` | USDC payment recipient |
| `VITE_READING_CONTRACT_TESTNET` | NumerologyReading on Celo Sepolia |
| `VITE_READING_CONTRACT_MAINNET` | NumerologyReading on Celo mainnet |

### Server-side (Fly.io secrets in production)

| Variable | Purpose |
|---|---|
| `LLM_BASE_URL` | OpenAI-compatible LLM endpoint (production: CF Workers AI proxy `/v1`) |
| `LLM_API_KEY` | API key for the LLM endpoint (production: `AI_SECRET` of the proxy) |
| `LLM_MODEL` / `LLM_MODEL_PAID` | Model names for free / advanced tier |
| `LLM_ENABLE_THINKING` | Strip `<think>` tokens (`false` = strip) |
| `ANTHROPIC_API_KEY` | Anthropic SDK fallback |
| `OPENROUTER_API_KEY` | OpenRouter inference fallback |
| `X402_TREASURY_ADDRESS` | Server-side copy of treasury address |
| `X402_ADVANCED_PRICE` | USDC units (default: 500000 = $0.50) |
| `X402_CREDITS_PRICE` | USDC units per pack (default: 200000 = $0.20) |
| `READING_CONTRACT_TESTNET` | Contract address for viem reads |
| `READING_CONTRACT_MAINNET` | Contract address for viem reads |
| `SELF_AGENT_ID` | Self.xyz Agent ID (exposed at `/api/health`) |
| `REGISTER_PRIVATE_KEY` | Deployer key — script only, never in frontend bundle |

## Rules

1. **Never use `useAccount`** — wagmi v3 renamed it to `useConnection`
2. **Never hardcode colors** — use CSS design tokens
3. **MiniPay only shows USDC / USDT / USDm** — never expose CELO as a payment option
4. **6-decimal tokens need adapter addresses for feeCurrency** — see `feeCurrency.ts`
5. **Server must run alongside frontend** — `pnpm dev:server` on port 3001 (dev) or Fly.io (prod)
6. **Foundry artifacts gitignored** — `out/` and `cache/` are never committed

## Testing in MiniPay

```bash
pnpm dev          # port 5173
ngrok http 5173   # get public HTTPS URL
```

MiniPay: **Settings → About** → tap version 7× → **Developer Settings** → enable Developer Mode + Use Testnet → **Load test page** → paste ngrok URL.

## Contract Addresses

| Contract | Network | Address |
|---|---|---|
| NumerologyReading | Celo Sepolia | `0x8fD193Aa77835D54E83B1Ddcc0FbAa4042295e0C` |
| NumerologyReading | Celo mainnet | `0x06a0De14485e6b9F4045821C54b719ECeCc35613` |
| USDC | Celo mainnet | `0xcebA9300f2b948710d2653dD7B07f33A8B32118C` |
| USDC | Celo Sepolia | `0x01C5C0122039549AD1493B8220cABEdD739BC44E` |
| ERC-8004 Registry | Celo mainnet | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| ERC-8004 Registry | Celo Sepolia | `0x8004A818BFB912233c491871b3d84c89A494BD9e` |

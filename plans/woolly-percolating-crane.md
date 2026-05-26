# Numerology Miniapp — Proof of Ship Upgrade Plan

## Context

The current app has a basic two-tab layout (Wallet + Numerology) with a chatbot that starts only after the user enters their name/birthday. It gives nothing for free until the user starts chatting, and has no monetization, social sharing, or Web3 registration for Proof of Ship. This plan transforms it into a meaningful, tiered numerology experience:

- **Free** instant profile card (no AI cost) — eliminates the "gatekeep" feeling
- **Paid** advanced readings (Pinnacles, Challenges, Personal Year) via x402 micropayments in USDC
- **1:1 Chat** with free daily limit + paid credits
- **Social referral** system using MiniPay deeplinks
- **Proof of Ship** compliance: ERC-8004 app registration, Self.xyz Agent ID, on-chain stablecoin txs

---

## Phase 0 — Dependencies & Environment

### Packages to install
```bash
pnpm add openai  # OpenRouter uses OpenAI-compatible API
```
No Thirdweb package needed — x402 implemented manually (server verifies USDC Transfer event on-chain via viem).

### `.env.example` additions
```
OPENROUTER_API_KEY=            # Primary inference backend
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_MODEL=meta-llama/llama-3.3-70b-instruct:free  # free tier
LLM_MODEL_PAID=anthropic/claude-3.5-sonnet         # paid tier

X402_TREASURY_ADDRESS=0x...    # Wallet receiving payments
X402_ADVANCED_PRICE=500000     # 0.50 USDC (6 decimals)
X402_CREDITS_PRICE=200000      # 0.20 USDC for 20 messages

SELF_AGENT_ID=                 # From app.ai.self.xyz portal
```

---

## Phase 1 — Numerology Data Enrichment

### 1.1 New file: `src/data/advancedNumerology.json`

Add three sections the main book is missing:
- `personalYears`: keys `"1"`–`"9"` — ~200-word interpretation per year cycle
- `pinnacles`: keys `"1"`–`"9"`, `"11"`, `"22/4"` — what each pinnacle number means for a life phase
- `challenges`: keys `"0"`–`"8"` — growth guidance for each challenge number (0 = most difficult)

This is a separate file to avoid touching the 221KB `numerologyBook.json`.

### 1.2 Extend `src/lib/numerology.ts`

Add types and functions:
```typescript
export interface PinnacleSet {
  first:  { number: number|string; ageStart: number; ageEnd: number };
  second: { number: number|string; ageStart: number; ageEnd: number };
  third:  { number: number|string; ageStart: number; ageEnd: number };
  fourth: { number: number|string; ageStart: number; ageEnd: number };
}
export interface ChallengeSet {
  first: number|string; second: number|string; main: number|string;
}
export interface AdvancedNumerologyProfile extends NumerologyProfile {
  personalYear: number|string;
  pinnacles: PinnacleSet;
  challenges: ChallengeSet;
}
```

New exported functions:
- `calculatePersonalYear(birthday, year?)` — sum digits of day + month + year, reduce same as ruling number
- `calculatePinnacles(birthday)` — Pythagorean formula: First=reduce(month+day), Second=reduce(day+yearSum), Third=reduce(First+Second), Fourth=reduce(month+yearSum); age start of 2nd pinnacle = `36 - rulingNumber`
- `calculateChallenges(birthday)` — abs differences between reduced day/month/year components
- `computeAdvancedProfile(name, birthday, year?)` — wraps `computeNumerologyProfile` and appends the three new fields

### 1.3 Update `server/bookExtractor.ts`

- Add `tier: 'free' | 'advanced'` param to `buildSystemPrompt`
- Load `advancedNumerology.json` alongside the existing book
- For `tier === 'advanced'`: inject Personal Year, active Pinnacle, and main Challenge into the system prompt

---

## Phase 2 — Free Instant Profile Card

### 2.1 New file: `src/lib/numerologyEssences.ts`

Hardcoded 1-sentence essences per number type (no server round-trip):
```typescript
export const RULING_ESSENCES: Record<string, string> = {
  '1': 'The pioneer — independent, creative, self-reliant.',
  '2': 'The peacemaker — intuitive, sensitive, cooperative.',
  // ...
};
export const SOUL_URGE_ESSENCES: Record<string, string> = { ... };
export const OUTER_EXPRESSION_ESSENCES: Record<string, string> = { ... };
```

### 2.2 New file: `src/components/NumerologyProfile.tsx`

Renders a full profile card using only client-side computed data (zero latency):
- **Header**: name, Ruling Number (large), birthday
- **Numbers row**: Day Number, Soul Urge, Outer Expression — each card shows essence from `numerologyEssences.ts`
- **Birth Chart grid**: 3x3 grid (positions 1-9), present numbers highlighted (purple), missing numbers grayed out; uses `BIRTH_CHART_PLANES` from `numerology.ts`
- **Teaser section**: blurred/locked cards for "Personal Year", "Life Milestones" with lock icon and price
- **CTAs**:
  - "Explore Advanced Insights — $0.50 USDC" → triggers unlock flow
  - "Chat About My Numbers" → transitions to chat phase
- **Share row**: "Invite a friend — both get 5 free messages" with Copy Link + MiniPay invite deeplink buttons

### 2.3 Refactor `src/components/NumerologyChat.tsx`

Add a phase state machine at the top:
```typescript
type NumerologyPhase = 'entry' | 'profile' | 'advanced' | 'chat';
const [phase, setPhase] = useState<NumerologyPhase>('entry');
```

State transitions:
- `entry` → `profile`: form submit (calls `computeNumerologyProfile`, no API)
- `profile` → `chat`: "Chat About My Numbers" button (triggers first AI message)
- `profile` → `advanced`: "Unlock Advanced" button (triggers x402 flow)
- Any → `entry`: "New Reading" button

All existing SSE streaming chat code (`sendMessage`, `abortRef`, message history) stays intact — it only activates when entering the `chat` phase.

---

## Phase 3 — Server Credit System

### 3.1 New file: `server/credits.ts`

In-memory store (sufficient for Proof of Ship demo — note: resets on server restart):
```typescript
interface UserCredits {
  chatMessages: number;    // free: 5/day; paid: accumulated
  advancedUnlocked: boolean;
  lastResetDate: string;   // ISO date for daily reset
  referredBy: string | null;
}
const store = new Map<string, UserCredits>();

export function getCredits(address: string): UserCredits
export function deductChat(address: string): boolean  // false if 0 remaining
export function addChatCredits(address: string, count: number): void
export function unlockAdvanced(address: string): void
export function resetDailyIfNeeded(address: string): void  // resets free 5 at midnight UTC
export function applyReferral(newAddress: string, referrerAddress: string): boolean
```

Rules:
- Free: 5 messages/wallet/day (reset at midnight UTC)
- Referral: +5 to both parties, one-time per wallet pair
- Paid chat: 20 credits for $0.20 USDC (no expiry)
- Advanced unlock: permanent per wallet

### 3.2 New server endpoints (add to `server/index.ts`)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /api/credits` | `?wallet=0x...` | Returns `{ chatMessages, advancedUnlocked, freeRemaining }` |
| `POST /api/unlock-advanced` | body: `{ wallet, txHash }` | Verifies USDC tx on-chain, unlocks advanced |
| `POST /api/buy-credits` | body: `{ wallet, txHash }` | Verifies USDC tx, adds 20 chat credits |
| `POST /api/referral/register` | body: `{ newWallet, referrerCode }` | Awards +5 credits to both |

### 3.3 Modify `POST /api/chat`

Extend request body: `{ name, birthday, messages, wallet, tier }`.

Before streaming:
1. `resetDailyIfNeeded(wallet)`
2. `deductChat(wallet)` — if false, return `{ error: 'credits_depleted' }` with status 402
3. If `tier === 'paid'` use `LLM_MODEL_PAID`; otherwise use `LLM_MODEL`

---

## Phase 4 — x402 Payment Flow

### 4.1 Client: `src/lib/x402.ts`

x402 is implemented manually (no third-party library required):

**Server side** (`/api/unlock-advanced`, `/api/buy-credits`):
- Endpoint receives `{ wallet, txHash }` (client sends tx hash after paying)
- Server calls `publicClient.getTransactionReceipt({ hash: txHash })`
- Decodes logs for a `Transfer(from=wallet, to=treasury, value>=required)` event on the USDC contract
- If valid: credit the wallet and return 200

**Client side** (`src/lib/x402.ts`):
```typescript
export interface PaymentConfig {
  asset: `0x${string}`;       // USDC on Celo
  payTo: `0x${string}`;       // treasury address
  amountUnits: bigint;        // 500000n = 0.50 USDC
  feeCurrencySymbol: string;  // 'USDC' for CIP-64
}
```

Pattern follows `SendToken.tsx` exactly:
```typescript
const data = encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [payTo, amount] });
const feeCurrency = getFeeCurrencyAddress('USDC', chainId);
sendTransaction({ to: asset, data, feeCurrency } as Parameters<typeof sendTransaction>[0]);
```

Wait for receipt with `useWaitForTransactionReceipt`, then `POST` tx hash to unlock endpoint.
After success: `window.open(DEEPLINKS.receipt(txHash, true))` in MiniPay.

### 4.2 New hook: `src/hooks/useAdvancedUnlock.ts`

Wraps the full x402 flow (send tx → wait → POST to server → update credits):
```typescript
export function useAdvancedUnlock(wallet: string | undefined) {
  // returns: { isUnlocked, isPaying, initiate, error }
}
```

### 4.3 New hook: `src/hooks/useCredits.ts`

```typescript
export function useCredits(wallet: string | undefined) {
  // react-query GET /api/credits — refetches after payment and after each message
  // returns: { chatMessages, advancedUnlocked, freeRemaining, isLoading, refetch }
}
```

---

## Phase 5 — Advanced Features Component

### New file: `src/components/NumerologyAdvanced.tsx`

Structure:
```
NumerologyAdvanced
├── PaywallGate (if not unlocked)
│   ├── Preview cards (blurred — Personal Year snippet, Pinnacle phase, Challenge label)
│   ├── "Unlock All Advanced Insights — $0.50 USDC" button
│   └── Payment status (pending / confirming / error)
└── AdvancedContent (if unlocked)
    ├── PersonalYearCard — current year number + full interpretation from advancedNumerology.json
    ├── PinnaclesTimeline — 4 cards with age ranges; active one highlighted
    └── ChallengesCard — main challenge + 2 sub-challenges + growth guidance
```

Accessed from `NumerologyProfile.tsx` unlock button → transitions to `phase === 'advanced'` in `NumerologyChat.tsx`.

---

## Phase 6 — Social Referral System

### 6.1 New file: `src/lib/referral.ts`

```typescript
export function generateReferralLink(wallet: string): string
  // returns `${window.location.origin}?ref=${wallet.toLowerCase()}`

export function getReferralCodeFromUrl(): string | null
  // reads ?ref= param from URL
```

### 6.2 New hook: `src/hooks/useReferral.ts`

Called once in `App.tsx` after wallet connects:
1. `getReferralCodeFromUrl()` — if code exists and differs from connected wallet
2. Check `localStorage.getItem('referral_registered')` to prevent double credit
3. `POST /api/referral/register` with `{ newWallet: address, referrerCode: code }`
4. `localStorage.setItem('referral_registered', 'true')`
5. `history.replaceState` to clean `?ref=` from URL

### 6.3 Share UI in `NumerologyProfile.tsx`

```
Share your reading + gift 5 free messages to a friend
[Copy Link]  [Invite via MiniPay]
```
- Copy Link: `navigator.clipboard.writeText(generateReferralLink(address))`
- MiniPay: `window.open(DEEPLINKS.inviteFriends())` — opens MiniPay native invite screen

---

## Phase 7 — OpenRouter Model Integration

Extend `server/index.ts` model selection:

```
if LLM_BASE_URL set (local/custom)  → use OpenAI-compatible (existing code, unchanged)
else if OPENROUTER_API_KEY set       → OpenRouter
  free tier:  LLM_MODEL  (default: meta-llama/llama-3.3-70b-instruct:free)
  paid tier:  LLM_MODEL_PAID (default: anthropic/claude-3.5-sonnet)
else                                 → Anthropic SDK fallback (existing code, unchanged)
```

OpenRouter is OpenAI-compatible → existing `streamOpenAI()` function handles it with no streaming code changes. Just set correct base URL and pass `X-Title: MiniPay Numerology` + `HTTP-Referer` headers (required by OpenRouter).

---

## Phase 8 — Proof of Ship: ERC-8004 + Self.xyz

### 8.1 New file: `scripts/registerERC8004.ts`

One-time script run by the developer (not users):
```typescript
// Uses viem to call register(agentURI) on Celo IdentityRegistry
// agentURI points to a hosted JSON with: name, description, capabilities, payment.protocol=x402
// Add to package.json: "register:agent": "tsx scripts/registerERC8004.ts"
```

Agent metadata JSON to author:
```json
{
  "name": "Numerology Advisor",
  "description": "AI-powered Pythagorean numerology readings on Celo via MiniPay",
  "capabilities": ["numerology-reading", "personal-year", "pinnacles", "1-1-consulting"],
  "payment": { "protocol": "x402", "networks": ["celo"], "tokens": ["USDC", "USDm"] }
}
```

### 8.2 Self.xyz Agent ID (app-level, one-time)

1. Register at `app.ai.self.xyz` portal
2. Store resulting Agent ID as `SELF_AGENT_ID` in `.env`
3. Expose it in `GET /api/health` response for verification

Both ERC-8004 and Self.xyz are **app-level** registrations — no per-user verification flow needed.

---

## Files Modified / Created

### Modified
| File | Changes |
|------|---------|
| `src/lib/numerology.ts` | Add `PinnacleSet`, `ChallengeSet`, `AdvancedNumerologyProfile`; add 4 new calculation functions |
| `src/components/NumerologyChat.tsx` | Add `NumerologyPhase` state machine; wire credits display; pass `wallet`+`tier` to API |
| `src/components/NumerologyChat.css` | Add `np-` prefix classes for profile card, teaser cards, credits badge, paywall overlay |
| `server/index.ts` | Add 4 new endpoints; credit gating on `/api/chat`; OpenRouter tier selection; USDC tx verification |
| `server/bookExtractor.ts` | Add `tier` param; load `advancedNumerology.json`; add `buildAdvancedContextBlock` |
| `src/App.tsx` | Add `useReferral` hook call in `AppContent` after `useAutoConnect` |
| `.env.example` | Document OpenRouter, x402, and ERC-8004 vars |
| `package.json` | Add `openai` dep; add `register:agent` script |

### Created
| File | Purpose |
|------|---------|
| `src/data/advancedNumerology.json` | Personal Year (1-9), Pinnacle (1-11, 22/4), Challenge (0-8) text |
| `src/lib/numerologyEssences.ts` | Static 1-sentence essences per number for instant profile render |
| `src/lib/referral.ts` | Referral link generation + URL parsing |
| `src/lib/x402.ts` | Client-side x402 payment config + `PaymentConfig` type |
| `src/components/NumerologyProfile.tsx` | Free instant profile card |
| `src/components/NumerologyAdvanced.tsx` | Paid advanced reading (Personal Year, Pinnacles, Challenges) |
| `src/hooks/useCredits.ts` | React Query hook for `/api/credits` |
| `src/hooks/useAdvancedUnlock.ts` | Full x402 unlock flow hook |
| `src/hooks/useReferral.ts` | Referral registration on wallet connect |
| `server/credits.ts` | In-memory credit store |
| `scripts/registerERC8004.ts` | One-time ERC-8004 on-chain registration |

---

## Key Design Decisions

1. **x402 = manual USDC transfer verification** (not Thirdweb library) — client sends tx hash to server; server verifies Transfer event via viem. No new heavy dependency. Follows existing `SendToken.tsx` pattern exactly.

2. **Credits = in-memory Map** — sufficient for demo; clear upgrade path to Neon/Postgres or on-chain tokens.

3. **Advanced data = separate JSON file** — avoids touching the 221KB production `numerologyBook.json`.

4. **Phase state machine inside `NumerologyChat.tsx`** — no router needed; phases are `entry → profile → (advanced|chat)`.

5. **OpenRouter as primary inference** — same OpenAI-compatible API the server already supports; just set `LLM_BASE_URL`. Free Llama 3.3 70B for free tier, Claude 3.5 Sonnet for paid.

6. **Wallet address as referral code** — no extra infrastructure; trivially verifiable.

---

## Verification

### End-to-end test flow
1. `pnpm dev` + `pnpm dev:server` — both servers running
2. Navigate to numerology tab; enter name + birthday → profile card renders instantly (no AI call)
3. Birth chart grid shows present/missing numbers correctly
4. Click "Chat About My Numbers" → chat opens, credit counter shows "5 msgs left"
5. Send 5 messages → input disabled, "Buy 20 more for $0.20 USDC" shown
6. Connect wallet (or use MiniPay via ngrok), click "Unlock Advanced Insights" → USDC approval + transfer via MiniPay, receipt deeplink fires, advanced content unlocks
7. Advanced section shows Personal Year + 4 Pinnacles (with correct age ranges) + Challenges
8. Share link copied; open in new tab with `?ref=0xAddress` → connect wallet → both wallets show +5 credits at `GET /api/credits`
9. Run `pnpm register:agent` → ERC-8004 tx hash on Celo Sepolia (testnet first)

### Proof of Ship checklist
- [ ] ERC-8004 tx hash visible on Celoscan (from `scripts/registerERC8004.ts`)
- [ ] Self.xyz Agent ID in `/api/health` response
- [ ] At least one x402 USDC payment on-chain during demo
- [ ] App deployed and accessible via ngrok or public URL for judges

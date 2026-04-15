# Who's That Pokémon? — MiniPay Mini App

## App Concept

A "Who's That Pokémon?" quiz game built as a MiniPay mini app. Players identify Pokémon from their silhouette before time runs out. Difficulty is configurable across three axes — which generation era (Gen I through Gen IX), time pressure, and number of questions — and each combination maps to an entry price and prize pool denominated in CELO. The game loop is: pay a small entry fee → guess correctly under pressure → earn proportional rewards.

It fits MiniPay because the core mechanic maps perfectly onto a microtransaction game loop: low-stakes entry (fractions of a CELO), instant settlement, no onboarding friction. MiniPay users in emerging markets already interact with CELO and stablecoins for everyday payments — this gives them a fun, skill-based way to earn or lose small amounts, introducing them to on-chain gaming without any wallet complexity.

---

## The Prompt

> Build a "Who's That Pokémon?" quiz mini app for MiniPay (a mobile crypto wallet super-app on Celo). The app should feel like the classic Pokémon TV show segment — cinematic, nostalgic, and snappy.
>
> **Game loop:**
> Before each round the player picks difficulty: which Pokémon generations to include (Gen I–IX, single or multi-select), a time limit per question (unlimited / 20s / 10s / 5s), and how many questions (5 / 10 / 20). These choices determine an entry price (in CELO) and a maximum prize. After the round, the player sees their score and how much CELO they earned proportional to correct answers and speed.
>
> **Screens:**
> 1. **Cover** — Full-bleed banner using the classic TV show background (sky-blue starburst on the left, red speed lines on the right, the Pokémon logo and "?" mark). A silhouette of a random iconic Pokémon floats over the burst and cycles every 3 seconds. Below: "Who's that Pokémon?" title, last game score badge, and a Play button.
> 2. **Setup** — 3×3 generation grid (each gen has its own accent color), game mode toggle (Multiple Choice / Typing), time limit selector, question count selector. A live prize preview box shows entry price and max reward as options change.
> 3. **Gameplay** — Silhouette (black, `filter: brightness(0)`) reveals on correct answer with a smooth 0.55s fade. Timer bar shrinks in real time with yellow/red warning states. One mystery hint button per question (💡 Hint −35 pts) — the hint type is randomly pre-assigned from an eligible pool (type always; first-letter only in typing mode; region only in multi-gen runs). A "Give up" button reveals the answer and scores zero. Multiple choice: 2×2 staggered button grid. Typing: freeform input with normalized comparison (handles hyphens, accents, special characters).
> 4. **Results** — Animated SVG score ring, points bar, per-question breakdown (✓/✗, wrong answer shown, hint usage), and a prize box (Entry / Max reward / You earned). "Play Again" resets to cover.
>
> **Stack:** Vite 8 + React 19 + TypeScript, wagmi v3, viem, TanStack React Query v5. Celo mainnet + Celo Sepolia. Data from PokeAPI (`pokeapi.co`). All Pokémon metadata (9 generations, type colors, iconic cover Pokémon) managed in-codebase for fast access with no extra API round-trips.
>
> **Design & styling:**
> - Dark theme (`#0a0a0a` background, `#f5f5f5` text) — feels premium on mobile OLED screens
> - Accent: Celo green (`#35d07f`) for primary actions, correct answers, and earned amounts
> - Cover banner: real TV show asset (`public/cover.png`) as `background: url('/cover.png') center/cover`
> - Pokémon logo style: yellow (`#f7d02c`) with blue stroke (`#1a53a0`) — match the franchise palette
> - Generation colors: each gen has a distinct accent (Gen I red, Gen II gold, Gen III green, Gen IV blue, Gen V grey, Gen VI pink, Gen VII orange, Gen VIII teal, Gen IX violet) used for the selection grid
> - Motion: floating silhouette animation (`silhouette-float` keyframe), pulsing "?" mark, screen slide-in (`poke-screen-enter`), staggered choice buttons (`choice-pop-in`), correct flash, wrong shake, score ring draw-in, points bar grow
> - Bottom tab bar fixed at `max-width: 480px` with safe-area inset support — Quiz | Wallet | Apps
> - No emojis in code, no extra docstrings, no speculative abstractions

---

## MiniPay Context

**Primitives used (current — display only, wired up for real tx in next phase):**

| Primitive | Usage |
|---|---|
| **CELO native token** | Entry fee payment and prize payout denomination |
| **Wallet connection** | Auto-connect via wagmi injected connector on app load |
| **Chain switching** | Celo mainnet ↔ Celo Sepolia (testnet) via `useSwitchChain` |
| **Transaction send** | `useSendTransaction` — will be used for entry fee debit |
| **Contract read/write** | Game ledger contract (planned) — tracks rounds, scores, prize pools |
| **Stablecoins** | USDm / USDC / USDT available as fee currency via CIP-64 fee abstraction |

**Planned Web3 integration:**
- Player sends entry fee to a game contract before round starts
- Contract holds prize pool; distributes to player on-chain after results are submitted
- Leaderboard stored on-chain or via a lightweight indexer
- CIP-64 fee abstraction so players can pay gas in the stablecoin they hold

---

## Target User

**Primary:** Celo / MiniPay users in sub-Saharan Africa, Southeast Asia, and Latin America — mobile-first, stablecoin-native, comfortable with small crypto transactions, grew up with Pokémon or are familiar with the franchise via trading cards and mobile games.

**Why they're a good fit:**
- Already have CELO or stablecoins in MiniPay from P2P payments or merchant receipts — low barrier to spending fractions of a token on a game round
- Mobile-only users who benefit from MiniPay's no-gas-setup UX (CIP-64 means they never need to top up a separate gas wallet)
- Casual gamers who want a 2-minute skill-based experience between other daily tasks
- Crypto-curious users for whom a game is a lower-stakes first on-chain transaction than a real payment

**Secondary:** Developers and ecosystem builders exploring MiniPay mini app patterns — this codebase demonstrates wallet connection, balance display, contract interaction, fee abstraction, and a full game UI in a single well-structured starter.

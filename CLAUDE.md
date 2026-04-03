# MiniPay Miniapp Starter — Project Guide

A starter template for building miniapps inside [MiniPay](https://minipay.to/). Demonstrates every core feature: wallet connection, balances, contract reads/writes, and sending transactions.

## Stack

- **Vite 8** + **React 19** + TypeScript (React Compiler enabled)
- **wagmi v3** + **viem** + **@tanstack/react-query v5**
- Chains: Celo mainnet + Celo Sepolia testnet
- Package manager: **pnpm**

## Commands

```bash
pnpm dev        # Start dev server (port 5173)
pnpm build      # Type-check + build to dist/
pnpm lint       # ESLint
```

## Project structure

```
src/
  App.tsx                    # Root: WagmiProvider + QueryClientProvider + sections
  lib/
    wagmi.ts                 # Wagmi config (chains, injected connector)
    contracts.ts             # cUSD addresses, ABIs, COUNTER_CONTRACT_ADDRESS
  hooks/
    useAutoConnect.ts        # Auto-connect on load — required for MiniPay
  components/
    WalletInfo.tsx           # Address, network, chain ID, block number
    BalanceDisplay.tsx       # Native CELO + cUSD ERC20 balance
    CounterContract.tsx      # Read/write an on-chain SimpleCounter
    SendTransaction.tsx      # Send CELO to any address
contracts/
  SimpleCounter.sol          # Deploy this to get a counter contract address
```

## Key wagmi v3 patterns

### Wallet connection

wagmi v3 renamed `useAccount` to `useConnection`. Always use `useConnection`:

```ts
import { useConnection } from "wagmi";

const { address, isConnected, isConnecting, chain } = useConnection();
```

### Native balance

`useBalance` returns `{ decimals, symbol, value: bigint }` — there is no `formatted` field in v3:

```ts
import { useBalance } from "wagmi";
import { formatEther } from "viem";

const { data } = useBalance({ address });
const display = data ? formatEther(data.value) : "...";
```

### ERC20 token balance

`useBalance` no longer accepts a `token` parameter in v3. Use `useReadContract` with `balanceOf`:

```ts
import { useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { erc20Abi } from "./lib/contracts";

const { data: rawBalance } = useReadContract({
  address: TOKEN_ADDRESS,
  abi: erc20Abi,
  functionName: "balanceOf",
  args: [address!],
});
const display = rawBalance !== undefined ? formatUnits(rawBalance, 18) : "...";
```

### Contract reads

```ts
const { data, refetch } = useReadContract({
  address: CONTRACT_ADDRESS,
  abi: myAbi,
  functionName: "myView",
  query: { enabled: isConnected && !!CONTRACT_ADDRESS },
});
```

### Contract writes + waiting for confirmation

```ts
const { writeContract, data: txHash, isPending } = useWriteContract();
const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
  hash: txHash,
});

// Refetch after confirmation
const lastTx = useRef<`0x${string}` | undefined>();
useEffect(() => {
  if (isSuccess && txHash !== lastTx.current) {
    lastTx.current = txHash;
    void refetch();
  }
}, [isSuccess, txHash, refetch]);
```

### Send raw transaction

```ts
const { sendTransaction, data: txHash } = useSendTransaction();
sendTransaction({ to: "0x...", value: parseEther("0.001") });
```

## Token registry

`src/lib/tokens.ts` is the single source of truth for token metadata and addresses.

```ts
import { TOKENS, NATIVE_TOKEN, ERC20_TOKENS } from "./lib/tokens";
```

> **USDm = cUSD**: Mento rebranded cUSD to USDm. They share the same contract.

To add a new token, add an entry to the `TOKENS` array in `tokens.ts` — the `BalanceDisplay` component picks it up automatically.

### Batch ERC20 balances

`BalanceDisplay` uses `useReadContracts` to fetch all available ERC20 balances in a single multicall:

```ts
const { data } = useReadContracts({
  contracts: availableErc20.map((token) => ({
    address: token.addresses[chainId]!,
    abi: erc20Abi,
    functionName: "balanceOf" as const,
    args: [address!] as readonly [`0x${string}`],
  })),
});
// data[i].result is the bigint balance for availableErc20[i]
```

### Network switching

```ts
import { useSwitchChain } from "wagmi";
const { mutate: switchChain, isPending } = useSwitchChain();
switchChain({ chainId: celoSepolia.id });
```

## Adding a new feature

1. Add any new contract ABI / address to `src/lib/contracts.ts`
2. Create a component in `src/components/`
3. Import and render it in `src/App.tsx` inside `<main className="app-main">`

## Environment variables

| Variable                        | Description                                                    |
| ------------------------------- | -------------------------------------------------------------- |
| `VITE_COUNTER_CONTRACT_ADDRESS` | Deployed `SimpleCounter` address (enables the counter section) |

Copy `.env.example` to `.env` and fill in values before running.

## Deploying SimpleCounter to Celo Sepolia

```bash
forge create contracts/SimpleCounter.sol:SimpleCounter \
  --rpc-url https://alfajores-forno.celo-testnet.org \
  --private-key YOUR_PRIVATE_KEY
```

Paste the deployed address into `.env` as `VITE_COUNTER_CONTRACT_ADDRESS`.

## Testing in MiniPay via ngrok

1. `pnpm dev` — starts at `http://localhost:5173`
2. `ngrok http 5173` — get a public HTTPS URL
3. In MiniPay: **Settings → About** → tap version number 7× → **Developer Settings**
4. Enable **Developer Mode** + **Use Testnet** (Celo Sepolia)
5. Tap **Load test page** → paste the ngrok URL

The `vite.config.ts` already allows ngrok domains (`*.ngrok-free.app`, etc.).

## Contract addresses

Please refer to: https://docs.celo.org/tooling/contracts/token-contracts

# MiniPay Miniapp Quickstart

A Vite + React + TypeScript starter template for building miniapps that run inside [MiniPay](https://minipay.to/). Demonstrates every core feature you'll need.

## What's covered

| Feature | Hook / API |
| ------- | ---------- |
| Auto wallet connection | `useAutoConnect` + `useConnection` |
| Wallet address & chain info | `useConnection`, `useChainId`, `useBlockNumber` |
| Native CELO balance | `useBalance` |
| ERC20 token balances (batch) | `useReadContracts` → `balanceOf` multicall |
| Read from a contract | `useReadContract` → `SimpleCounter.getCount` |
| Write to a contract | `useWriteContract` → `increment / decrement / reset` |
| Send native CELO | `useSendTransaction` |
| Send ERC20 tokens | `useSendTransaction` + `encodeFunctionData` |
| Pay gas in stablecoins (CIP-64) | `feeCurrency` field + adapter addresses |
| Estimate gas with fee currency | `publicClient.estimateGas` + `eth_gasPrice` |
| Wait for confirmation | `useWaitForTransactionReceipt` |
| Switch networks | `useSwitchChain` |

## Getting started

```bash
pnpm install
cp .env.example .env
pnpm dev
```

## Fee abstraction (CIP-64)

Celo lets users pay gas fees in stablecoins instead of native CELO. `SendToken` demonstrates this end-to-end: choose any ERC20 token to send, then pick which token to pay gas with.

```ts
import { encodeFunctionData, erc20Abi, parseUnits } from "viem";
import { getFeeCurrencyAddress } from "./lib/feeCurrency";

const data = encodeFunctionData({
  abi: erc20Abi,
  functionName: "transfer",
  args: [recipient, parseUnits(amount, decimals)],
});

sendTransaction({
  to: TOKEN_CONTRACT_ADDRESS,
  feeCurrency: getFeeCurrencyAddress("USDm", chainId), // pay gas in USDm
  data,
});
```

- **18-decimal tokens** (USDm): use the token contract address as `feeCurrency`
- **6-decimal tokens** (USDC, USDT): must use the adapter address
- **Native CELO**: omit `feeCurrency` entirely

> MiniPay may override `feeCurrency` and pick the token the user holds most.

## Deploying the SimpleCounter contract (optional)

The on-chain counter section requires `contracts/SimpleCounter.sol` deployed to Celo Sepolia.

```bash
# Install Foundry if needed
curl -L https://foundry.paradigm.xyz | bash && foundryup

# Deploy to Celo Sepolia (chain ID 44787)
forge create contracts/SimpleCounter.sol:SimpleCounter \
  --rpc-url https://alfajores-forno.celo-testnet.org \
  --private-key YOUR_PRIVATE_KEY
```

Add the deployed address to `.env`:

```
VITE_COUNTER_CONTRACT_ADDRESS=0xYourDeployedAddress
```

Restart the dev server — the On-chain Counter section will become active.

## Testing in MiniPay with ngrok

1. Start the dev server: `pnpm dev` (runs on port 5173)
2. In a separate terminal: `ngrok http 5173`
3. Copy the `https://...ngrok-free.app` forwarding URL
4. Open MiniPay on your phone
5. Go to **Settings → About**, tap the version number repeatedly until developer mode activates
6. Go to **Settings → Developer Settings**, enable **Developer Mode** and **Use Testnet** (Celo Sepolia)
7. Tap **Load test page** and paste your ngrok URL

`vite.config.ts` already has `allowedHosts` configured for ngrok domains.

## Stack

- [Vite 8](https://vite.dev) + [React 19](https://react.dev) + TypeScript (React Compiler enabled)
- [wagmi v3](https://wagmi.sh) + [viem](https://viem.sh)
- [@tanstack/react-query v5](https://tanstack.com/query)
- Celo mainnet + Celo Sepolia testnet

## References

- [MiniPay docs — Send a transaction](https://docs.minipay.xyz/technical-references/send-transaction.html)
- [Celo fee abstraction (CIP-64)](https://docs.celo.org/tooling/overview/fee-abstraction)
- [MiniPay code library](https://docs.celo.org/build-on-celo/build-on-minipay/code-library)
- [Celo token contracts](https://docs.celo.org/tooling/contracts/token-contracts)

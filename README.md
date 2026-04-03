# MiniPay Miniapp Starter

A Vite + React + TypeScript starter template for building miniapps that run inside [MiniPay](https://minipay.to/). Demonstrates every core feature you'll need.

## What's covered

| Feature                     | Hook / API                                           |
| --------------------------- | ---------------------------------------------------- |
| Auto wallet connection      | `useAutoConnect` + `useConnection`                   |
| Wallet address & chain info | `useConnection`, `useChainId`, `useBlockNumber`      |
| Native CELO balance         | `useBalance`                                         |
| cUSD token balance (ERC20)  | `useReadContract` → `balanceOf`                      |
| Read from a contract        | `useReadContract` → `SimpleCounter.getCount`         |
| Write to a contract         | `useWriteContract` → `increment / decrement / reset` |
| Send a transaction          | `useSendTransaction`                                 |
| Wait for confirmation       | `useWaitForTransactionReceipt`                       |

## Getting started

```bash
pnpm install
cp .env.example .env
pnpm dev
```

## Deploying the SimpleCounter contract (optional)

The on-chain counter section requires you to deploy `contracts/SimpleCounter.sol` to Celo Sepolia.

### Using Foundry

```bash
# Install Foundry if needed
curl -L https://foundry.paradigm.xyz | bash && foundryup

# Deploy to Celo Sepolia (chain ID 44787)
forge create contracts/SimpleCounter.sol:SimpleCounter \
  --rpc-url https://alfajores-forno.celo-testnet.org \
  --private-key YOUR_PRIVATE_KEY
```

Copy the deployed address and add it to `.env`:

```
VITE_COUNTER_CONTRACT_ADDRESS=0xYourDeployedAddress
```

Restart the dev server — the On-chain Counter section will become active.

## Testing in MiniPay with ngrok

1. Start the dev server: `pnpm dev` (runs on port 5173 by default)
2. In a separate terminal: `ngrok http 5173`
3. Copy the `https://...ngrok-free.app` forwarding URL
4. Open MiniPay on your phone
5. Go to **Settings → About**, tap the version number repeatedly until developer mode activates
6. Go to **Settings → Developer Settings**, enable **Developer Mode** and **Use Testnet** (Celo Sepolia)
7. Tap **Load test page** and paste your ngrok URL

The `vite.config.ts` already has `allowedHosts` configured for ngrok domains.

## Stack

- [Vite 8](https://vite.dev) + [React 19](https://react.dev) + TypeScript
- [wagmi v3](https://wagmi.sh) + [viem](https://viem.sh)
- [@tanstack/react-query v5](https://tanstack.com/query)
- Celo + Celo Sepolia testnet

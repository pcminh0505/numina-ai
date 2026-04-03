// SimpleCounter contract ABI
export const counterAbi = [
  {
    name: "getCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256", name: "" }],
  },
  {
    name: "increment",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    name: "decrement",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    name: "reset",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    name: "CounterChanged",
    type: "event",
    inputs: [
      { name: "newCount", type: "uint256", indexed: false },
      { name: "changedBy", type: "address", indexed: true },
    ],
  },
] as const;

// Minimal ERC20 ABI for reading token balances
export const erc20Abi = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256", name: "" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8", name: "" }],
  },
  {
    name: "symbol",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string", name: "" }],
  },
] as const;

// Counter contract address from env (set VITE_COUNTER_CONTRACT_ADDRESS in .env)
const rawCounterAddress = import.meta.env.VITE_COUNTER_CONTRACT_ADDRESS;
export const COUNTER_CONTRACT_ADDRESS: `0x${string}` | undefined =
  rawCounterAddress && rawCounterAddress.startsWith("0x")
    ? (rawCounterAddress as `0x${string}`)
    : undefined;

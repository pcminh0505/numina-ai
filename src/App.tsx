import "./App.css";
import { Component, type ReactNode } from "react";
import { useConnection, useChainId, useReadContract, WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { erc20Abi, formatUnits } from "viem";
import { celo, celoSepolia } from "wagmi/chains";
import { config } from "./lib/wagmi";
import { useAutoConnect } from "./hooks/useAutoConnect";
import { useReferral } from "./hooks/useReferral";
import { NumerologyChat } from "./components/NumerologyChat";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000 } },
});

const USDC_ADDRESS: Partial<Record<number, `0x${string}`>> = {
  [celo.id]:        "0xcebA9300f2b948710d2653dD7B07f33A8B32118C",
  [celoSepolia.id]: "0x01C5C0122039549AD1493B8220cABEdD739BC44E",
};

function UsdcBadge({ address }: { address?: `0x${string}` }) {
  const chainId = useChainId();
  const usdcAddr = USDC_ADDRESS[chainId];
  const { data } = useReadContract({
    address: usdcAddr,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !!usdcAddr, refetchInterval: 30_000 },
  });
  if (!address || data === undefined) return null;
  const formatted = parseFloat(formatUnits(data, 6)).toFixed(2);
  return <span className="usdc-badge">${formatted}</span>;
}

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="minipay-warning" style={{ margin: 16 }}>
          Something went wrong. Please reload the app.
        </div>
      );
    }
    return this.props.children;
  }
}

function AppContent() {
  useAutoConnect();
  const { address, isConnected, isConnecting } = useConnection();
  useReferral(address);

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-title">Numina AI</span>
        <div className="header-right">
          <UsdcBadge address={address} />
          <span
            className={`status-dot ${isConnected ? "connected" : isConnecting ? "connecting" : ""}`}
            title={isConnected ? "Connected" : isConnecting ? "Connecting…" : "Disconnected"}
          />
        </div>
      </header>
      <NumerologyChat />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <AppContent />
        </QueryClientProvider>
      </WagmiProvider>
    </ErrorBoundary>
  );
}

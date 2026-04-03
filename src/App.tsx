import "./App.css";
import { useConnection, WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { config } from "./lib/wagmi";
import { useAutoConnect } from "./hooks/useAutoConnect";
import { WalletInfo } from "./components/WalletInfo";
import { BalanceDisplay } from "./components/BalanceDisplay";
import { CounterContract } from "./components/CounterContract";
import { SendTransaction } from "./components/SendTransaction";
import { NetworkSwitcher } from "./components/NetworkSwitcher";

const queryClient = new QueryClient();

function AppContent() {
  useAutoConnect();
  const { isConnected, isConnecting } = useConnection();

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-title">MiniPay Starter</span>
        <div className="header-right">
          <NetworkSwitcher />
          <span
            className={`status-dot ${isConnected ? "connected" : isConnecting ? "connecting" : ""}`}
            title={
              isConnected
                ? "Connected"
                : isConnecting
                  ? "Connecting..."
                  : "Disconnected"
            }
          />
        </div>
      </header>
      <main className="app-main">
        <WalletInfo />
        <BalanceDisplay />
        <CounterContract />
        <SendTransaction />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <AppContent />
      </QueryClientProvider>
    </WagmiProvider>
  );
}

import "./App.css";
import { Component, type ReactNode } from "react";
import { useConnection, WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { config } from "./lib/wagmi";
import { useAutoConnect } from "./hooks/useAutoConnect";
import { isMiniPayEnvironment } from "./lib/minipay";
import { WalletInfo } from "./components/WalletInfo";
import { BalanceDisplay } from "./components/BalanceDisplay";
import { CounterContract } from "./components/CounterContract";
import { SendToken } from "./components/SendToken";
import { MiniPayMethods } from "./components/MiniPayMethods";
import { NetworkSwitcher } from "./components/NetworkSwitcher";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000 } },
});

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
        {!isMiniPayEnvironment() && (
          <div className="minipay-warning">
            Not running inside MiniPay. Open this app in MiniPay to access all
            features. Some APIs (QR scan, exchange rate) will not work here.
          </div>
        )}
        <WalletInfo />
        <BalanceDisplay />
        <CounterContract />
        <SendToken />
        <MiniPayMethods />
      </main>
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

import { useState } from "react";
import { useBlockNumber, useChainId, useConnection } from "wagmi";

export function WalletInfo() {
  const { address, isConnected, isConnecting, chain } = useConnection();
  const chainId = useChainId();
  const [copied, setCopied] = useState(false);

  function copyAddress() {
    if (!address) return;
    void navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const explorerUrl = chain?.blockExplorers?.default.url ?? "https://celoscan.io";
  const { data: blockNumber } = useBlockNumber({ watch: true });

  if (isConnecting) {
    return (
      <div className="card">
        <h2>Wallet</h2>
        <p className="hint">Connecting...</p>
      </div>
    );
  }

  if (!isConnected || !address) {
    return (
      <div className="card">
        <h2>Wallet</h2>
        <p className="hint">Not connected. Open this app inside MiniPay.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>Wallet</h2>
      <div className="info-row">
        <span className="label">Address</span>
        <span className="value mono">
          {address.slice(0, 8)}...{address.slice(-6)}
        </span>
      </div>
      <div className="action-row">
        <button className="btn-ghost" onClick={copyAddress}>
          {copied ? "Copied!" : "Copy address"}
        </button>
        <a
          className="btn-ghost"
          href={`${explorerUrl}/address/${address}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          View on Celoscan
        </a>
      </div>
      <div className="info-row">
        <span className="label">Network</span>
        <span className="value">{chain?.name ?? chainId}</span>
      </div>
      <div className="info-row">
        <span className="label">Chain ID</span>
        <span className="value">{chainId}</span>
      </div>
      <div className="info-row">
        <span className="label">Block</span>
        <span className="value">{blockNumber?.toString() ?? "..."}</span>
      </div>
    </div>
  );
}

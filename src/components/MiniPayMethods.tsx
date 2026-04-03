import { useState } from "react";
import { useConnection } from "wagmi";
import { useScanQrCode } from "../hooks/useScanQrCode";
import { useGetExchangeRate } from "../hooks/useGetExchangeRate";
import { DEEPLINKS } from "../lib/minipay";

export function MiniPayMethods() {
  const { isConnected } = useConnection();
  const {
    scanQrCode,
    scannedValue,
    isPending: scanPending,
    error: scanError,
  } = useScanQrCode();
  const {
    getExchangeRate,
    rate,
    isPending: ratePending,
    error: rateError,
  } = useGetExchangeRate();
  const [from, setFrom] = useState("USDT");
  const [to, setTo] = useState("NGN");

  if (!isConnected) return null;

  return (
    <div className="card">
      <h2>MiniPay APIs</h2>

      {/* QR Code Scanner — minipay_scanQrCode */}
      <div className="info-row">
        <span className="label">QR Scanner</span>
        <button
          className="btn-ghost"
          onClick={() => void scanQrCode()}
          disabled={scanPending}
        >
          {scanPending ? "Scanning..." : "Scan QR Code"}
        </button>
      </div>
      {scannedValue && (
        <p className="hint" style={{ marginBottom: 4, wordBreak: "break-all" }}>
          {scannedValue}
        </p>
      )}
      {scanError && <p className="error">{scanError.message}</p>}

      {/* Exchange Rate — minipay_getExchangeRate */}
      <div className="info-row" style={{ flexWrap: "wrap", gap: 6 }}>
        <span className="label">Exchange rate</span>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input
            className="inline-input"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            placeholder="From"
            aria-label="From currency"
          />
          <span className="label">→</span>
          <input
            className="inline-input"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="To"
            aria-label="To currency"
          />
          <button
            className="btn-ghost"
            onClick={() => void getExchangeRate(from, to)}
            disabled={ratePending || !from || !to}
          >
            {ratePending ? "..." : "Get"}
          </button>
        </div>
      </div>
      {rate !== null && (
        <p className="hint" style={{ marginTop: 4, marginBottom: 4 }}>
          1 {from} = {rate} {to}
        </p>
      )}
      {rateError && <p className="error">{rateError.message}</p>}

      {/* Deeplinks */}
      <p className="label" style={{ marginTop: 12, marginBottom: 6 }}>
        Deeplinks
      </p>
      <div className="action-row" style={{ flexWrap: "wrap" }}>
        <a href={DEEPLINKS.addCash()} className="btn-ghost">
          Add Cash
        </a>
        <a href={DEEPLINKS.pockets()} className="btn-ghost">
          Pockets
        </a>
        <a href={DEEPLINKS.qrCode()} className="btn-ghost">
          QR Screen
        </a>
        <a href={DEEPLINKS.inviteFriends()} className="btn-ghost">
          Invite
        </a>
        <a href={DEEPLINKS.discover()} className="btn-ghost">
          Discover
        </a>
      </div>
    </div>
  );
}

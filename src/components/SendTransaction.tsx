import { useState } from "react";
import {
  useConnection,
  useSendTransaction,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseEther } from "viem";

export function SendTransaction() {
  const { address, isConnected, chain } = useConnection();
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("0.001");

  const {
    sendTransaction,
    data: txHash,
    isPending,
    error,
    reset,
  } = useSendTransaction();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  const explorerUrl =
    chain?.blockExplorers?.default.url ?? "https://celoscan.io";

  if (!isConnected) return null;

  function handleSend() {
    reset();
    const to = (recipient.trim() || address) as `0x${string}`;
    let value: bigint;
    try {
      value = parseEther(amount);
    } catch {
      return;
    }
    sendTransaction({ to, value });
  }

  const isBusy = isPending || isConfirming;

  return (
    <div className="card">
      <h2>Send Transaction</h2>
      <div className="field">
        <label>To address (leave blank to send to self)</label>
        <input
          placeholder={address ?? "0x..."}
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          disabled={isBusy}
        />
      </div>
      <div className="field">
        <label>Amount (CELO)</label>
        <input
          type="number"
          step="0.001"
          min="0"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={isBusy}
        />
      </div>
      <button
        className="btn-primary full-width"
        onClick={handleSend}
        disabled={isBusy}
      >
        {isPending
          ? "Confirm in MiniPay..."
          : isConfirming
            ? "Confirming..."
            : "Send CELO"}
      </button>
      {error && <p className="error">{error.message.split("\n")[0]}</p>}
      {isSuccess && <p className="status success">Transaction confirmed!</p>}
      {txHash && (
        <p className="tx-link">
          Tx:{" "}
          <a
            href={`${explorerUrl}/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {txHash.slice(0, 10)}...{txHash.slice(-6)}
          </a>
        </p>
      )}
    </div>
  );
}

import { useEffect, useRef } from "react";
import {
  useConnection,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { COUNTER_CONTRACT_ADDRESS, counterAbi } from "../lib/contracts";

export function CounterContract() {
  const { isConnected, chain } = useConnection();

  const {
    data: count,
    isLoading,
    error: readError,
    refetch,
  } = useReadContract({
    address: COUNTER_CONTRACT_ADDRESS,
    abi: counterAbi,
    functionName: "getCount",
    query: { enabled: isConnected && !!COUNTER_CONTRACT_ADDRESS },
  });

  const {
    writeContract,
    data: txHash,
    isPending,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Refetch counter once after each confirmed transaction
  const lastConfirmedTx = useRef<`0x${string}` | undefined>(undefined);
  useEffect(() => {
    if (isSuccess && txHash && txHash !== lastConfirmedTx.current) {
      lastConfirmedTx.current = txHash;
      void refetch();
    }
  }, [isSuccess, txHash, refetch]);

  const explorerUrl =
    chain?.blockExplorers?.default.url ?? "https://celoscan.io";

  if (!COUNTER_CONTRACT_ADDRESS) {
    return (
      <div className="card">
        <h2>On-chain Counter</h2>
        <p className="hint">
          Deploy <code>contracts/SimpleCounter.sol</code> to Celo Sepolia, then
          set <code>VITE_COUNTER_CONTRACT_ADDRESS</code> in your{" "}
          <code>.env</code> file to enable this feature.
        </p>
      </div>
    );
  }

  function handleWrite(fn: "increment" | "decrement" | "reset") {
    resetWrite();
    writeContract({
      address: COUNTER_CONTRACT_ADDRESS!,
      abi: counterAbi,
      functionName: fn,
    });
  }

  const currentCount = count ?? 0n;
  const isBusy = isPending || isConfirming;

  return (
    <div className="card">
      <h2>On-chain Counter</h2>
      <div className="counter-value">
        {isLoading ? "..." : currentCount.toString()}
      </div>
      {readError && <p className="error">Read error: {readError.message}</p>}
      <div className="btn-row">
        <button
          onClick={() => handleWrite("decrement")}
          disabled={isBusy || currentCount === 0n}
          className="btn-counter"
        >
          −
        </button>
        <button
          onClick={() => handleWrite("reset")}
          disabled={isBusy || currentCount === 0n}
          className="btn-secondary"
        >
          Reset
        </button>
        <button
          onClick={() => handleWrite("increment")}
          disabled={isBusy}
          className="btn-counter"
        >
          +
        </button>
      </div>
      {isPending && <p className="status">Confirm in MiniPay...</p>}
      {isConfirming && <p className="status">Confirming on-chain...</p>}
      {isSuccess && <p className="status success">Confirmed!</p>}
      {writeError && (
        <p className="error">{writeError.message.split("\n")[0]}</p>
      )}
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

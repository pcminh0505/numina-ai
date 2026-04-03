import { useState, useEffect } from "react";
import {
  useConnection,
  useChainId,
  useSendTransaction,
  useWaitForTransactionReceipt,
  usePublicClient,
} from "wagmi";
import {
  encodeFunctionData,
  erc20Abi,
  parseUnits,
  formatEther,
  fromHex,
  isAddress,
} from "viem";
import { ERC20_TOKENS, TOKENS, type Token } from "../lib/tokens";
import { getFeeCurrencyAddress, isSupportedFeeCurrency } from "../lib/feeCurrency";

export function SendToken() {
  const { address, isConnected, chain } = useConnection();
  const chainId = useChainId();
  // usePublicClient is typed generically; cast to access Celo CIP-64 extensions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const publicClient = usePublicClient() as any;

  const availableTokens = ERC20_TOKENS.filter((t) => !!t.addresses[chainId]);
  const availableFeeCurrencies = TOKENS.filter((t) =>
    isSupportedFeeCurrency(t.symbol, chainId),
  );

  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const [feeCurrencyToken, setFeeCurrencyToken] = useState<Token | null>(null);
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [recipientError, setRecipientError] = useState<string | null>(null);
  const [estimatedFee, setEstimatedFee] = useState<string | null>(null);
  const [estimatingFee, setEstimatingFee] = useState(false);

  // Reset selections when network changes
  useEffect(() => {
    const tokens = ERC20_TOKENS.filter((t) => !!t.addresses[chainId]);
    setSelectedToken(tokens[0] ?? null);
    const currencies = TOKENS.filter((t) =>
      isSupportedFeeCurrency(t.symbol, chainId),
    );
    const usdm = currencies.find((t) => t.symbol === "USDm");
    setFeeCurrencyToken(usdm ?? currencies[0] ?? null);
    setEstimatedFee(null);
  }, [chainId]);

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

  function validateRecipient(value: string): boolean {
    const addr = value.trim() || address;
    if (!addr || !isAddress(addr)) {
      setRecipientError("Invalid address");
      return false;
    }
    setRecipientError(null);
    return true;
  }

  async function estimateFee() {
    if (!selectedToken || !address || !publicClient) return;
    const tokenAddr = selectedToken.addresses[chainId];
    if (!tokenAddr) return;

    // feeCurrency: token address for 18-decimal tokens (USDm),
    // adapter address for 6-decimal tokens (USDC/USDT), undefined for CELO
    const feeCurrAddr = feeCurrencyToken
      ? getFeeCurrencyAddress(feeCurrencyToken.symbol, chainId)
      : undefined;

    const toAddr = (recipient.trim() || address) as `0x${string}`;
    const txData = encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: [toAddr, parseUnits(amount || "0.001", selectedToken.decimals)],
    });

    setEstimatingFee(true);
    setEstimatedFee(null);
    try {
      // CIP-64: estimateGas with feeCurrency (Celo chain extension)
      const gasLimit = (await publicClient.estimateGas({
        account: address,
        to: tokenAddr,
        data: txData,
        feeCurrency: feeCurrAddr,
      })) as bigint;

      // eth_gasPrice with feeCurrency param returns price in 18-decimal units
      // regardless of the fee token's own decimal count
      const gasPriceHex = (await publicClient.request({
        method: "eth_gasPrice",
        params: feeCurrAddr ? [feeCurrAddr] : [],
      })) as `0x${string}`;

      const gasPrice = fromHex(gasPriceHex, "bigint");
      const feeWei = gasLimit * gasPrice;
      const symbol = feeCurrencyToken?.symbol ?? "CELO";
      setEstimatedFee(
        `~${parseFloat(formatEther(feeWei)).toFixed(6)} ${symbol}`,
      );
    } catch {
      setEstimatedFee("Could not estimate");
    } finally {
      setEstimatingFee(false);
    }
  }

  function handleSend() {
    if (!selectedToken || !amount) return;
    const tokenAddr = selectedToken.addresses[chainId];
    if (!tokenAddr) return;
    if (!validateRecipient(recipient)) return;

    reset();
    const to = (recipient.trim() || address) as `0x${string}`;
    let parsedAmount: bigint;
    try {
      parsedAmount = parseUnits(amount, selectedToken.decimals);
    } catch {
      return;
    }

    // feeCurrency: token address for 18-decimal tokens (USDm),
    // adapter address for 6-decimal tokens (USDC/USDT), undefined for CELO
    const feeCurrAddr = feeCurrencyToken
      ? getFeeCurrencyAddress(feeCurrencyToken.symbol, chainId)
      : undefined;

    const data = encodeFunctionData({
      abi: erc20Abi,
      functionName: "transfer",
      args: [to, parsedAmount],
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sendTransaction as any)({
      to: tokenAddr,
      feeCurrency: feeCurrAddr,
      data,
    });
  }

  if (!isConnected || availableTokens.length === 0) return null;

  const isBusy = isPending || isConfirming;
  const canEstimate = !isBusy && !!selectedToken && !!amount && !estimatingFee;

  return (
    <div className="card">
      <h2>Send Token</h2>

      <div className="field">
        <label>Token</label>
        <select
          value={selectedToken?.symbol ?? ""}
          onChange={(e) => {
            const t = availableTokens.find((x) => x.symbol === e.target.value);
            setSelectedToken(t ?? null);
            setEstimatedFee(null);
          }}
          disabled={isBusy}
        >
          {availableTokens.map((t) => (
            <option key={t.symbol} value={t.symbol}>
              {t.symbol} — {t.name}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>To address (leave blank to send to self)</label>
        <input
          placeholder={address ?? "0x..."}
          value={recipient}
          onChange={(e) => {
            setRecipient(e.target.value);
            setRecipientError(null);
          }}
          disabled={isBusy}
        />
        {recipientError && <p className="error">{recipientError}</p>}
      </div>

      <div className="field">
        <label>Amount ({selectedToken?.symbol})</label>
        <input
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value);
            setEstimatedFee(null);
          }}
          disabled={isBusy}
        />
      </div>

      <div className="field">
        <label>Pay gas with</label>
        <select
          value={feeCurrencyToken?.symbol ?? "CELO"}
          onChange={(e) => {
            const t = availableFeeCurrencies.find(
              (x) => x.symbol === e.target.value,
            );
            setFeeCurrencyToken(t ?? null);
            setEstimatedFee(null);
          }}
          disabled={isBusy}
        >
          {availableFeeCurrencies.map((t) => (
            <option key={t.symbol} value={t.symbol}>
              {t.symbol}
            </option>
          ))}
        </select>
      </div>

      <div className="action-row">
        <button
          className="btn-ghost"
          onClick={() => void estimateFee()}
          disabled={!canEstimate}
        >
          {estimatingFee ? "Estimating..." : "Estimate fee"}
        </button>
        {estimatedFee && <span className="hint">Fee: {estimatedFee}</span>}
      </div>

      <button
        className="btn-primary full-width"
        onClick={handleSend}
        disabled={isBusy || !selectedToken || !amount}
      >
        {isPending
          ? "Confirm in MiniPay..."
          : isConfirming
            ? "Confirming..."
            : `Send ${selectedToken?.symbol ?? "Token"}`}
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

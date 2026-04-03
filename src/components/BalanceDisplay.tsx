import { useBalance, useChainId, useConnection, useReadContracts } from "wagmi";
import { formatUnits } from "viem";
import { erc20Abi } from "../lib/contracts";
import { ERC20_TOKENS, NATIVE_TOKEN, type Token } from "../lib/tokens";

function fmt(value: bigint, decimals: number, displayDecimals: number): string {
  return parseFloat(formatUnits(value, decimals)).toFixed(displayDecimals);
}

export function BalanceDisplay() {
  const { address, isConnected } = useConnection();
  const chainId = useChainId();

  // Native CELO
  const {
    data: nativeData,
    isLoading: nativeLoading,
    refetch: refetchNative,
  } = useBalance({
    address,
    query: { enabled: isConnected && !!address },
  });

  // Batch-read all ERC20 balances for tokens available on this chain
  const availableErc20 = ERC20_TOKENS.filter((t) => !!t.addresses[chainId]);

  const {
    data: erc20Results,
    isLoading: erc20Loading,
    refetch: refetchErc20,
  } = useReadContracts({
    contracts: availableErc20.map((token) => ({
      address: token.addresses[chainId]!,
      abi: erc20Abi,
      functionName: "balanceOf" as const,
      args: [address!] as readonly [`0x${string}`],
    })),
    query: { enabled: isConnected && !!address && availableErc20.length > 0 },
  });

  // Map symbol → raw balance bigint
  const balanceOf = new Map<string, bigint | undefined>(
    availableErc20.map((token, i) => [
      token.symbol,
      erc20Results?.[i]?.result as bigint | undefined,
    ]),
  );

  if (!isConnected) return null;

  function handleRefresh() {
    void refetchNative();
    void refetchErc20();
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2>Assets</h2>
        <button className="btn-ghost" onClick={handleRefresh}>
          Refresh
        </button>
      </div>

      <TokenRow
        token={NATIVE_TOKEN}
        balance={nativeData?.value}
        isLoading={nativeLoading}
        available
      />

      {ERC20_TOKENS.map((token) => {
        const available = !!token.addresses[chainId];
        return (
          <TokenRow
            key={token.symbol}
            token={token}
            balance={available ? balanceOf.get(token.symbol) : undefined}
            isLoading={available ? erc20Loading : false}
            available={available}
          />
        );
      })}
    </div>
  );
}

function TokenRow({
  token,
  balance,
  isLoading,
  available,
}: {
  token: Token;
  balance: bigint | undefined;
  isLoading: boolean;
  available: boolean;
}) {
  const formatted =
    available && balance !== undefined
      ? fmt(balance, token.decimals, token.displayDecimals)
      : null;

  return (
    <div className="token-row">
      <img
        className="token-badge"
        src={token.logoUrl}
        alt={token.symbol}
      />
      <div className="token-info">
        <span className="token-symbol">{token.symbol}</span>
        <span className="token-name">{token.name}</span>
      </div>
      <div className="token-amount">
        {!available ? (
          <span className="token-na">—</span>
        ) : isLoading ? (
          <span className="token-loading">…</span>
        ) : formatted !== null ? (
          <>
            <span className="token-value">{formatted}</span>
            <span className="token-denom"> {token.symbol}</span>
          </>
        ) : (
          <span className="token-na">N/A</span>
        )}
      </div>
    </div>
  );
}

import { useChainId, useSwitchChain } from "wagmi";
import { celo, celoSepolia } from "wagmi/chains";

const CHAINS = [celo, celoSepolia] as const;

const CHAIN_COLOR: Record<number, string> = {
  [celo.id]: "#35D07F",
  [celoSepolia.id]: "#FBCC5C",
};

export function NetworkSwitcher() {
  const chainId = useChainId();
  const { mutate: switchChain, isPending, error } = useSwitchChain();

  const current = CHAINS.find((c) => c.id === chainId);
  const next = CHAINS.find((c) => c.id !== chainId);

  function handleSwitch() {
    if (next) switchChain({ chainId: next.id });
  }

  return (
    <div className="network-switcher">
      <button
        className="network-pill"
        onClick={handleSwitch}
        disabled={isPending || !next}
        title={next ? `Switch to ${next.name}` : "No other chain configured"}
      >
        <span
          className="network-dot"
          style={{ background: CHAIN_COLOR[chainId] ?? "#ccc" }}
        />
        <span>{isPending ? "Switching…" : (current?.name ?? `Chain ${chainId}`)}</span>
      </button>
      {error && (
        <p className="network-error">{error.message.split("\n")[0]}</p>
      )}
    </div>
  );
}

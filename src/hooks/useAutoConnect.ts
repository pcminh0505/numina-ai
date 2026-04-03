import { useEffect, useState } from "react";
import { useConnect, useConnectors } from "wagmi";

/**
 * Auto-connects to the injected wallet (MiniPay) on page load.
 * Required for MiniPay — never show a manual connect button.
 *
 * Uses a hasAttempted guard so the connection is only attempted once,
 * preventing reconnection loops if the connect call triggers re-renders.
 */
export function useAutoConnect() {
  const connectors = useConnectors();
  const { connect, error, isPending } = useConnect();
  const [hasAttempted, setHasAttempted] = useState(false);

  useEffect(() => {
    if (hasAttempted || connectors.length === 0) return;

    const attemptConnect = async () => {
      try {
        await connect({ connector: connectors[0] });
      } catch (err) {
        console.error("Failed to auto-connect:", err);
      }
      setHasAttempted(true);
    };

    void attemptConnect();
  }, [connectors, connect, hasAttempted]);

  return { error, isPending };
}

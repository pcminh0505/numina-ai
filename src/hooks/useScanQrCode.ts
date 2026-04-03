import { useState } from "react";
import { useMiniPayClient } from "./useMiniPayClient";

/**
 * Opens MiniPay's native QR code scanner via minipay_scanQrCode.
 * Returns the scanned string content.
 *
 * @see https://docs.minipay.xyz/technical-references/custom-methods/scan-qr-code.html
 */
export function useScanQrCode() {
  const client = useMiniPayClient();
  const [scannedValue, setScannedValue] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function scanQrCode() {
    if (!client) return;
    setError(null);
    setIsPending(true);
    setScannedValue(null);
    try {
      // minipay_scanQrCode is a MiniPay-specific RPC extension
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (client as any).request({
        method: "minipay_scanQrCode",
        params: [],
      });
      setScannedValue(result as string);
    } catch (e) {
      if (e instanceof Error) setError(e);
    } finally {
      setIsPending(false);
    }
  }

  return { scannedValue, error, isPending, scanQrCode };
}

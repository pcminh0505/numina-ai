import { useState } from "react";
import { useMiniPayClient } from "./useMiniPayClient";

/**
 * Retrieves the exchange rate between two currency codes via minipay_getExchangeRate.
 *
 * @example
 *   getExchangeRate("USDT", "NGN") // → rate: 1620.5
 *
 * @see https://docs.minipay.xyz/technical-references/custom-methods/get-exchange-rate.html
 */
export function useGetExchangeRate() {
  const client = useMiniPayClient();
  const [rate, setRate] = useState<number | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function getExchangeRate(from: string, to: string) {
    if (!client) return;
    setError(null);
    setIsPending(true);
    setRate(null);
    try {
      // minipay_getExchangeRate is a MiniPay-specific RPC extension
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (client as any).request({
        method: "minipay_getExchangeRate",
        params: [from, to],
      });
      setRate(result as number);
    } catch (e) {
      if (e instanceof Error) setError(e);
    } finally {
      setIsPending(false);
    }
  }

  return { rate, error, isPending, getExchangeRate };
}

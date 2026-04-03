import type { EIP1193Provider } from "viem";

/** Extended provider type with MiniPay-specific fields. */
type MiniPayProvider = EIP1193Provider & {
  isMiniPay?: boolean;
};

declare global {
  interface Window {
    ethereum?: MiniPayProvider;
  }
}

/**
 * Returns true when the app is running inside MiniPay.
 * Use as a guardrail before calling MiniPay-specific APIs.
 *
 * @see https://docs.minipay.xyz/technical-references/
 */
export function isMiniPayEnvironment(): boolean {
  return typeof window !== "undefined" && window.ethereum?.isMiniPay === true;
}

/**
 * Returns the injected Ethereum provider.
 * Throws if called outside a browser or without an injected provider.
 */
export function getEthereumProvider(): EIP1193Provider {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error(
      "window.ethereum is required. Please run this app inside MiniPay.",
    );
  }
  return window.ethereum;
}

const BASE = "https://link.minipay.xyz";

/**
 * Deeplink URL builders for native MiniPay screens.
 *
 * @see https://docs.minipay.xyz/technical-references/deeplinks.html
 */
export const DEEPLINKS = {
  /** Open the Add Cash screen. Optionally pre-select tokens. */
  addCash: (tokens?: ("USDM" | "USDT" | "USDC")[]): string => {
    const url = new URL(`${BASE}/add_cash`);
    if (tokens?.length) url.searchParams.set("tokens", tokens.join(","));
    return url.toString();
  },
  /** Open a miniapp by URL inside MiniPay. */
  openMiniApp: (appUrl: string): string => {
    const url = new URL(`${BASE}/browse`);
    url.searchParams.set("url", appUrl);
    return url.toString();
  },
  /** Open the MiniApps discover tab. */
  discover: (): string => `${BASE}/discover`,
  /** Open a transaction receipt. Pass celebrate=true for confetti. */
  receipt: (tx: string, celebrate = false): string => {
    const url = new URL(`${BASE}/receipt`);
    url.searchParams.set("tx", tx);
    if (celebrate) url.searchParams.set("celebrate", "");
    return url.toString();
  },
  /** Open the QR code screen. */
  qrCode: (): string => `${BASE}/qr`,
  /** Open the Invite Friends screen. */
  inviteFriends: (): string => `${BASE}/invite_friends`,
  /** Open the Pockets (balance) screen. */
  pockets: (): string => `${BASE}/balance`,
} as const;

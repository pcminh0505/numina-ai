export function generateReferralLink(wallet: string): string {
  return `${window.location.origin}${window.location.pathname}?ref=${wallet.toLowerCase()}`;
}

export function getReferralCodeFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  return params.get('ref');
}

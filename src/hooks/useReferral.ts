import { useEffect, useRef } from 'react';
import { getReferralCodeFromUrl } from '../lib/referral';

const STORAGE_KEY = 'referral_registered';

export function useReferral(walletAddress: string | undefined) {
  const registeredRef = useRef(false);

  useEffect(() => {
    if (!walletAddress) return;
    if (registeredRef.current) return;
    if (localStorage.getItem(STORAGE_KEY)) return;

    const code = getReferralCodeFromUrl();
    if (!code) return;
    if (code.toLowerCase() === walletAddress.toLowerCase()) return;

    registeredRef.current = true;

    fetch('/api/referral/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newWallet: walletAddress, referrerCode: code }),
    })
      .then(r => r.json())
      .then((data: { ok?: boolean }) => {
        if (data.ok) {
          localStorage.setItem(STORAGE_KEY, '1');
          // Clean ?ref= from URL without reload
          const url = new URL(window.location.href);
          url.searchParams.delete('ref');
          window.history.replaceState({}, '', url.toString());
        }
      })
      .catch(() => {
        // Non-critical — ignore silently
      });
  }, [walletAddress]);
}

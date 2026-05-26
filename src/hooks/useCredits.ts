import { useQuery } from '@tanstack/react-query';
import { useChainId } from 'wagmi';

export interface Credits {
  chatMessages: number;
  advancedUnlocked: boolean;
  freeRemaining: number;
}

export function useCredits(wallet: string | undefined) {
  const chainId = useChainId();
  return useQuery<Credits>({
    queryKey: ['credits', wallet, chainId],
    queryFn: async () => {
      const res = await fetch(`/api/credits?wallet=${wallet}&chainId=${chainId}`);
      if (!res.ok) throw new Error('Failed to fetch credits');
      return res.json() as Promise<Credits>;
    },
    enabled: !!wallet,
    staleTime: 15_000,
    refetchInterval: 60_000,
  });
}

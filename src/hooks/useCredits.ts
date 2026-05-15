import { useQuery } from '@tanstack/react-query';

export interface Credits {
  chatMessages: number;
  advancedUnlocked: boolean;
  freeRemaining: number;
}

export function useCredits(wallet: string | undefined) {
  return useQuery<Credits>({
    queryKey: ['credits', wallet],
    queryFn: async () => {
      const res = await fetch(`/api/credits?wallet=${wallet}`);
      if (!res.ok) throw new Error('Failed to fetch credits');
      return res.json() as Promise<Credits>;
    },
    enabled: !!wallet,
    staleTime: 15_000,
    refetchInterval: 60_000,
  });
}

/**
 * Hook for fetching Docker networks
 */

import { useQuery } from '@tanstack/react-query';
import { getNetworks } from '../lib/api';
import type { NetworkInfo } from '../../shared/types';

export function useNetworks() {
  return useQuery<NetworkInfo[]>({
    queryKey: ['networks'],
    queryFn: getNetworks,
    staleTime: 10_000, // Consider data fresh for 10 seconds
    refetchOnWindowFocus: true, // Refetch when user returns to tab
  });
}

/**
 * Hook for fetching Docker volumes
 */

import { useQuery } from '@tanstack/react-query';
import { getVolumes } from '../lib/api';
import type { VolumeInfo } from '../../shared/types';

export function useVolumes() {
  return useQuery<VolumeInfo[]>({
    queryKey: ['volumes'],
    queryFn: getVolumes,
    staleTime: 10_000, // Consider data fresh for 10 seconds
    refetchOnWindowFocus: true, // Refetch when user returns to tab
  });
}

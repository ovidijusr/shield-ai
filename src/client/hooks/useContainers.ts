/**
 * useContainers Hook
 *
 * React Query hook for fetching container data from the backend.
 * Provides real container information for the Containers tab.
 */

import { useQuery } from '@tanstack/react-query';
import { getContainers } from '../lib/api';
import type { ContainerInfo } from '../../shared/types';

/**
 * Hook for accessing container data
 */
export function useContainers() {
  return useQuery<ContainerInfo[]>({
    queryKey: ['containers'],
    queryFn: getContainers,
    staleTime: 10_000, // Consider data stale after 10 seconds
    refetchOnWindowFocus: true, // Refresh when user returns to tab
  });
}

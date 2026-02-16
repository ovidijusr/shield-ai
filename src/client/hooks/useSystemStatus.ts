/**
 * useSystemStatus Hook
 *
 * React Query hook for polling system status (API key, Docker daemon).
 * Used by WarningBanner to display configuration warnings.
 */

import { useQuery } from '@tanstack/react-query';
import type { SystemStatus } from '../../shared/types';

const API_BASE = '/api';
const AUTH_TOKEN = (import.meta as any).env?.VITE_SHIELDAI_TOKEN || '';

/**
 * Fetch system status
 */
async function fetchSystemStatus(): Promise<SystemStatus> {
  const headers: HeadersInit = {
    ...(AUTH_TOKEN && { Authorization: `Bearer ${AUTH_TOKEN}` }),
  };

  const response = await fetch(`${API_BASE}/status`, { headers });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Hook for accessing system status with polling
 */
export function useSystemStatus() {
  return useQuery<SystemStatus>({
    queryKey: ['systemStatus'],
    queryFn: fetchSystemStatus,
    refetchInterval: 30_000, // Poll every 30 seconds
    staleTime: 15_000, // Consider data stale after 15 seconds
    refetchOnWindowFocus: true, // User may fix Docker/env vars in another window
    retry: false, // Don't retry on error - we want to show "server unreachable"
  });
}

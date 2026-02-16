/**
 * useFix Hook
 *
 * React Query hook for fix operations.
 */

import { useMutation } from '@tanstack/react-query';
import type { DiffPreview, FixResult } from '../../shared/types';
import { api } from '../lib/api';

interface UseFixOptions {
  onSuccess?: (result: FixResult) => void;
  onError?: (error: Error) => void;
}

interface FixState {
  preview: DiffPreview | null;
  applying: boolean;
  applied: boolean;
  error: string | null;
}

export function useFix(findingId?: string, options?: UseFixOptions) {
  // Preview fix mutation
  const previewMutation = useMutation<DiffPreview, Error, string>({
    mutationKey: ['fix-preview', findingId],
    mutationFn: async (id: string) => {
      return api.fetchApi<DiffPreview>(`/fix/preview`, {
        method: 'POST',
        body: JSON.stringify({ findingId: id }),
      });
    },
  });

  // Apply fix mutation
  const applyMutation = useMutation<FixResult, Error, string>({
    mutationKey: ['fix-apply', findingId],
    mutationFn: async (id: string) => {
      return api.fetchApi<FixResult>(`/fix/apply`, {
        method: 'POST',
        body: JSON.stringify({ findingId: id }),
      });
    },
    onSuccess: (result) => {
      if (result.success) {
        options?.onSuccess?.(result);
      }
    },
    onError: (error) => {
      options?.onError?.(error);
    },
  });

  // Computed state
  const state: FixState = {
    preview: previewMutation.data || null,
    applying: applyMutation.isPending,
    applied: applyMutation.isSuccess && (applyMutation.data?.success || false),
    error: previewMutation.error?.message || applyMutation.error?.message || null,
  };

  return {
    // State
    ...state,

    // Loading states
    isLoadingPreview: previewMutation.isPending,
    isApplying: applyMutation.isPending,

    // Actions
    previewFix: (id: string) => previewMutation.mutate(id),
    applyFix: (id: string) => applyMutation.mutate(id),

    // Reset
    reset: () => {
      previewMutation.reset();
      applyMutation.reset();
    },

    // Raw result
    result: applyMutation.data || null,
  };
}

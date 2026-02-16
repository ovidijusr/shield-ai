/**
 * WarningBanner Component
 *
 * Displays system warnings when critical infrastructure is missing:
 * - ANTHROPIC_API_KEY not set
 * - Docker daemon unreachable
 * - Server connection issues
 *
 * Polls status every 30s, allows temporary dismissal, reappears if issue persists.
 */

import { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { warning } from '@/lib/design';
import { useSystemStatus } from '../../hooks/useSystemStatus';

export function WarningBanner() {
  const { data, error, isError } = useSystemStatus();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // Reset dismissed warnings when status is re-checked
  useEffect(() => {
    if (data?.checkedAt) {
      setDismissed(new Set());
    }
  }, [data?.checkedAt]);

  // Build warning list
  const warnings: Array<{ id: string; message: string }> = [];

  // Server unreachable warning (highest priority)
  if (isError && error) {
    warnings.push({
      id: 'server-unreachable',
      message: 'Cannot reach ShieldAI server. Check that the backend is running.',
    });
  }

  // API key warning
  if (data && !data.apiKey.ok && data.apiKey.message) {
    warnings.push({
      id: 'api-key',
      message: data.apiKey.message,
    });
  }

  // Docker warning
  if (data && !data.docker.ok && data.docker.message) {
    warnings.push({
      id: 'docker',
      message: data.docker.message,
    });
  }

  // Filter out dismissed warnings
  const visibleWarnings = warnings.filter((w) => !dismissed.has(w.id));

  // Return null when no warnings - zero layout impact
  if (visibleWarnings.length === 0) {
    return null;
  }

  const handleDismiss = (id: string) => {
    setDismissed((prev) => new Set(prev).add(id));
  };

  return (
    <div className="container mx-auto px-4 pt-4">
      <div className="space-y-2">
        {visibleWarnings.map((w) => (
          <div
            key={w.id}
            className={`flex items-center justify-between gap-3 p-3 rounded-lg border ${warning.border} ${warning.bg}`}
          >
            <div className="flex items-center gap-3">
              <AlertTriangle className={`w-5 h-5 ${warning.icon} shrink-0`} />
              <div className={`text-sm font-medium ${warning.text}`}>
                {w.message}
              </div>
            </div>
            <button
              onClick={() => handleDismiss(w.id)}
              className={`p-1 rounded hover:bg-amber-500/20 ${warning.dismiss}`}
              aria-label="Dismiss warning"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

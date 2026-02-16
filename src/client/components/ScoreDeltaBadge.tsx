/**
 * Score Delta Badge Component
 *
 * Shows the score change since the last scan with visual indicators.
 * Celebrates improvements and highlights regressions.
 */

import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, PartyPopper } from 'lucide-react';

interface ScoreComparison {
  current: {
    score: number;
  } | null;
  previous: {
    score: number;
  } | null;
  delta: number;
  percentChange: number;
}

export function ScoreDeltaBadge() {
  const { data } = useQuery({
    queryKey: ['score-comparison'],
    queryFn: async () => {
      const response = await fetch('/api/score/comparison');
      if (!response.ok) throw new Error('Failed to fetch score comparison');
      const result = await response.json();
      return result.data as ScoreComparison;
    },
    refetchInterval: 30000,
  });

  // Don't show if no previous scan
  if (!data || !data.previous || data.delta === 0) {
    return null;
  }

  const { delta } = data;
  const isImprovement = delta > 0;
  const isSignificant = Math.abs(delta) >= 5;

  const badgeClasses = isImprovement
    ? 'bg-green-500/10 text-green-500 border-green-500/20'
    : 'bg-red-500/10 text-red-500 border-red-500/20';

  const Icon = isImprovement ? TrendingUp : TrendingDown;

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-sm font-medium ${badgeClasses}`}>
      <Icon className="w-3.5 h-3.5" />
      <span>
        {isImprovement ? '+' : ''}
        {delta} {Math.abs(delta) === 1 ? 'point' : 'points'}
      </span>
      {isImprovement && isSignificant && <PartyPopper className="w-3.5 h-3.5" />}
    </div>
  );
}

/**
 * Score Trend Chart Component
 *
 * Displays a line chart showing security score history over time.
 * Helps users visualize their security progress and trends.
 */

import { useQuery } from '@tanstack/react-query';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { TooltipProps } from 'recharts';
import { Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ScoreHistoryEntry {
  id: number;
  timestamp: Date;
  score: number;
  findingsCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
}

interface ChartDataPoint {
  date: string;
  score: number;
  fullDate: string;
  findingsCount: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
}

/**
 * Custom tooltip for score details
 */
function CustomTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload || !payload.length) {
    return null;
  }

  const data = payload[0].payload as ChartDataPoint;

  return (
    <div className="bg-background border border-border rounded-lg shadow-lg p-3">
      <p className="font-semibold mb-2">{data.fullDate}</p>
      <div className="space-y-1 text-sm">
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Score:</span>
          <span className="font-bold text-primary">{data.score}/100</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">Total Issues:</span>
          <span>{data.findingsCount}</span>
        </div>
        {data.criticalCount > 0 && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-red-500">Critical:</span>
            <span>{data.criticalCount}</span>
          </div>
        )}
        {data.highCount > 0 && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-orange-500">High:</span>
            <span>{data.highCount}</span>
          </div>
        )}
        {data.mediumCount > 0 && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-yellow-500">Medium:</span>
            <span>{data.mediumCount}</span>
          </div>
        )}
        {data.lowCount > 0 && (
          <div className="flex items-center justify-between gap-4">
            <span className="text-blue-500">Low:</span>
            <span>{data.lowCount}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Score Trend Chart Component
 */
export function ScoreTrendChart() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['score-history'],
    queryFn: async () => {
      const response = await fetch('/api/score/history?days=30');
      if (!response.ok) throw new Error('Failed to fetch score history');
      const result = await response.json();
      return result.data as ScoreHistoryEntry[];
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Transform data for chart
  const chartData: ChartDataPoint[] = (data || []).map((entry) => ({
    date: new Date(entry.timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    }),
    fullDate: new Date(entry.timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    score: entry.score,
    findingsCount: entry.findingsCount,
    criticalCount: entry.criticalCount,
    highCount: entry.highCount,
    mediumCount: entry.mediumCount,
    lowCount: entry.lowCount,
  }));

  // Calculate trend
  const getTrend = () => {
    if (chartData.length < 2) return null;
    const first = chartData[0].score;
    const last = chartData[chartData.length - 1].score;
    const delta = last - first;

    if (delta > 0)
      return {
        icon: <TrendingUp className="w-4 h-4 text-green-500" />,
        text: `+${delta} points`,
        color: 'text-green-500',
      };
    if (delta < 0)
      return {
        icon: <TrendingDown className="w-4 h-4 text-red-500" />,
        text: `${delta} points`,
        color: 'text-red-500',
      };
    return {
      icon: <Minus className="w-4 h-4 text-muted-foreground" />,
      text: 'No change',
      color: 'text-muted-foreground',
    };
  };

  const trend = getTrend();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Security Score Trend</CardTitle>
          {trend && (
            <div className={`flex items-center gap-1 text-sm ${trend.color}`}>
              {trend.icon}
              <span>{trend.text}</span>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <p className="text-red-500 mb-2">Failed to load score history</p>
            <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
          </div>
        )}

        {!isLoading && !error && chartData.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <p className="text-muted-foreground mb-2">No score history yet</p>
            <p className="text-sm text-muted-foreground">Run your first security scan to start tracking progress</p>
          </div>
        )}

        {!isLoading && !error && chartData.length > 0 && (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis domain={[0, 100]} stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="score"
                stroke="hsl(var(--primary))"
                strokeWidth={3}
                dot={{ fill: 'hsl(var(--primary))', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

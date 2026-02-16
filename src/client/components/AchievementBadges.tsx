/**
 * Achievement Badges Component
 *
 * Gamification system displaying unlockable achievements.
 * Rewards users for security improvements and milestone completions.
 */

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, Lock } from 'lucide-react';

interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt?: Date;
  progress?: number;
  total?: number;
}

interface AchievementsData {
  achievements: Achievement[];
  unlockedCount: number;
  totalCount: number;
}

/**
 * Individual Achievement Card
 */
function AchievementCard({ achievement }: { achievement: Achievement }) {
  const { unlocked, icon, title, description, unlockedAt, progress, total } = achievement;

  return (
    <div
      className={`relative p-4 rounded-lg border-2 transition-all ${
        unlocked
          ? 'bg-primary/5 border-primary shadow-lg shadow-primary/20'
          : 'bg-muted/50 border-border opacity-50 grayscale'
      }`}
    >
      {/* Lock icon for locked achievements */}
      {!unlocked && (
        <div className="absolute top-2 right-2">
          <Lock className="w-4 h-4 text-muted-foreground" />
        </div>
      )}

      {/* Icon */}
      <div className="text-4xl mb-3 text-center">{icon}</div>

      {/* Title */}
      <h3 className={`font-bold text-center mb-1 ${unlocked ? 'text-foreground' : 'text-muted-foreground'}`}>
        {title}
      </h3>

      {/* Description */}
      <p className={`text-xs text-center ${unlocked ? 'text-muted-foreground' : 'text-muted-foreground/70'}`}>
        {description}
      </p>

      {/* Unlock date */}
      {unlocked && unlockedAt && (
        <p className="text-xs text-center text-muted-foreground mt-2">
          Unlocked {new Date(unlockedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </p>
      )}

      {/* Progress bar for achievements with progress */}
      {!unlocked && progress !== undefined && total !== undefined && (
        <div className="mt-3">
          <div className="w-full bg-muted rounded-full h-1.5">
            <div
              className="bg-primary h-1.5 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-center text-muted-foreground mt-1">
            {Math.floor((progress / 100) * total)}/{total}
          </p>
        </div>
      )}

      {/* Glow effect for unlocked achievements */}
      {unlocked && (
        <div className="absolute inset-0 rounded-lg bg-primary/5 blur-xl -z-10" />
      )}
    </div>
  );
}

/**
 * Achievement Badges Grid
 */
export function AchievementBadges() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['achievements'],
    queryFn: async () => {
      const response = await fetch('/api/achievements');
      if (!response.ok) throw new Error('Failed to fetch achievements');
      const result = await response.json();
      return result.data as AchievementsData;
    },
    refetchInterval: 10000, // Refetch every 10 seconds to catch new unlocks
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Achievements</CardTitle>
            <CardDescription>Unlock achievements by improving your security posture</CardDescription>
          </div>
          {data && (
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">
                {data.unlockedCount}/{data.totalCount}
              </div>
              <div className="text-xs text-muted-foreground">Unlocked</div>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-red-500 mb-2">Failed to load achievements</p>
            <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
          </div>
        )}

        {!isLoading && !error && data && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.achievements.map((achievement) => (
              <AchievementCard key={achievement.id} achievement={achievement} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

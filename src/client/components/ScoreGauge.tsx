/**
 * ScoreGauge Component
 *
 * Visual security score gauge (0-100) with color coding.
 * "Perimeter" theme: no transitions, solid colors.
 */

interface ScoreGaugeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function ScoreGauge({ score, size = 'md', showLabel = true }: ScoreGaugeProps) {
  // Clamp score between 0-100
  const clampedScore = Math.max(0, Math.min(100, score));

  // Color coding based on score
  const getColor = () => {
    if (clampedScore >= 71) return { bg: 'bg-green-500', text: 'text-green-500', ring: 'ring-green-500/20' };
    if (clampedScore >= 41) return { bg: 'bg-amber-500', text: 'text-amber-500', ring: 'ring-amber-500/20' };
    return { bg: 'bg-red-500', text: 'text-red-500', ring: 'ring-red-500/20' };
  };

  const color = getColor();

  // Size variants
  const sizes = {
    sm: { outer: 'w-16 h-16', inner: 'w-14 h-14', text: 'text-base', label: 'text-[10px]' },
    md: { outer: 'w-24 h-24', inner: 'w-20 h-20', text: 'text-xl', label: 'text-xs' },
    lg: { outer: 'w-32 h-32', inner: 'w-28 h-28', text: 'text-2xl', label: 'text-sm' },
  };

  const sizeClasses = sizes[size];

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        {/* Circular progress indicator */}
        <svg
          className={`${sizeClasses.outer} transform -rotate-90`}
          viewBox="0 0 100 100"
        >
          {/* Background circle */}
          <circle
            cx="50"
            cy="50"
            r="40"
            className="stroke-border"
            strokeWidth="8"
            fill="none"
          />
          {/* Progress circle */}
          <circle
            cx="50"
            cy="50"
            r="40"
            className={`${color.bg.replace('bg-', 'stroke-')}`}
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${(clampedScore / 100) * 251.2} 251.2`}
          />
        </svg>

        {/* Score display in center */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className={`flex flex-col items-center justify-center ${sizeClasses.inner} rounded-full bg-card ring-4 ${color.ring}`}>
            <span className={`${sizeClasses.text} font-bold ${color.text}`}>
              {clampedScore}
            </span>
            <span className="text-xs text-muted-foreground">/ 100</span>
          </div>
        </div>
      </div>

      {showLabel && (
        <div className={`${sizeClasses.label} font-medium text-muted-foreground`}>
          Security Score
        </div>
      )}
    </div>
  );
}

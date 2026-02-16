/**
 * SeverityBadge Component
 *
 * Single source of truth for displaying severity levels.
 * Consistent styling across FindingCard, FindingsList, and any other severity display.
 */

import { Badge } from '@/components/ui/badge';
import { severity, type Severity } from '@/lib/design';

interface SeverityBadgeProps {
  level: Severity;
  className?: string;
}

export function SeverityBadge({ level, className = '' }: SeverityBadgeProps) {
  const config = severity[level];

  return (
    <Badge
      variant="outline"
      className={`${config.text} ${config.border} ${config.bg} ${className}`}
    >
      {config.label}
    </Badge>
  );
}

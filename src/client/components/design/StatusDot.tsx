/**
 * StatusDot Component
 *
 * Small colored indicator for container running/stopped status.
 * Used in ContainerGrid and any container status display.
 */

import { status, type Status } from '@/lib/design';

interface StatusDotProps {
  state: Status;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const sizeMap = {
  sm: 'w-2 h-2',
  md: 'w-3 h-3',
  lg: 'w-4 h-4',
};

export function StatusDot({
  state,
  size = 'md',
  showLabel = false,
  className = '',
}: StatusDotProps) {
  const config = status[state];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div
        className={`${sizeMap[size]} ${config.dot} rounded-full`}
        aria-label={state}
      />
      {showLabel && <span className={`text-sm ${config.text}`}>{state}</span>}
    </div>
  );
}

/**
 * DotGrid Component
 *
 * Background dot grid pattern for the "Perimeter" aesthetic.
 * Subtle green-tinted dots on a fixed position grid.
 */

import type { ReactNode } from 'react';

interface DotGridProps {
  children: ReactNode;
}

export function DotGrid({ children }: DotGridProps) {
  return (
    <div className="relative">
      {/* Dot grid background */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(34, 197, 94, 0.06) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

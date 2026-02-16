/**
 * ShieldAI Design System Tokens
 *
 * Centralized design tokens for the "Perimeter" theme.
 * Single source of truth for colors, ensuring consistency across all components.
 */

export const severity = {
  critical: {
    text: 'text-red-500',
    border: 'border-red-500',
    bg: 'bg-red-500/10',
    label: 'Critical',
  },
  high: {
    text: 'text-orange-500',
    border: 'border-orange-500',
    bg: 'bg-orange-500/10',
    label: 'High',
  },
  medium: {
    text: 'text-amber-500',
    border: 'border-amber-500',
    bg: 'bg-amber-500/10',
    label: 'Medium',
  },
  low: {
    text: 'text-sky-400',
    border: 'border-sky-400',
    bg: 'bg-sky-400/10',
    label: 'Low',
  },
  info: {
    text: 'text-muted-foreground',
    border: 'border-border',
    bg: 'bg-muted',
    label: 'Info',
  },
} as const;

export const phase = {
  quick: {
    text: 'text-emerald-400',
    dot: 'bg-emerald-400',
    label: 'Quick Checks',
  },
  opus: {
    text: 'text-teal-400',
    dot: 'bg-teal-400',
    label: 'AI Analysis',
  },
  done: {
    text: 'text-green-500',
    dot: 'bg-green-500',
    label: 'Complete',
  },
} as const;

export const status = {
  running: {
    text: 'text-green-500',
    dot: 'bg-green-500',
    border: 'border-green-500',
  },
  stopped: {
    text: 'text-muted-foreground',
    dot: 'bg-muted-foreground',
    border: 'border-border',
  },
} as const;

export const warning = {
  text: 'text-amber-500',
  border: 'border-amber-500/50',
  bg: 'bg-amber-500/10',
  icon: 'text-amber-500',
  dismiss: 'text-amber-500/60 hover:text-amber-500',
} as const;

export type Severity = keyof typeof severity;
export type Phase = keyof typeof phase;
export type Status = keyof typeof status;

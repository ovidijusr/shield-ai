/**
 * ScanProgress Component
 *
 * Shows audit progress with streaming updates.
 * "Perimeter" colors: emerald for quick checks, teal for AI, green for done.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2, Brain, CheckCircle2 } from 'lucide-react';
import { phase } from '@/lib/design';

interface ScanProgressProps {
  phase: 'idle' | 'quick' | 'opus' | 'done';
  quickCheckCount: number;
  opusCheckCount: number;
  findingsCount: number;
}

export function ScanProgress({
  phase: currentPhase,
  quickCheckCount,
  opusCheckCount,
  findingsCount,
}: ScanProgressProps) {
  const getPhaseInfo = () => {
    switch (currentPhase) {
      case 'quick':
        return {
          icon: Loader2,
          title: 'Running Quick Checks',
          description: 'Performing fast security scans...',
          color: 'text-emerald-400',
        };
      case 'opus':
        return {
          icon: Brain,
          title: 'Deep AI Analysis',
          description: 'Claude Opus is analyzing your infrastructure...',
          color: 'text-teal-400',
        };
      case 'done':
        return {
          icon: CheckCircle2,
          title: 'Audit Complete',
          description: 'Security analysis finished',
          color: 'text-green-500',
        };
      default:
        return {
          icon: Loader2,
          title: 'Initializing',
          description: 'Preparing security audit...',
          color: 'text-muted-foreground',
        };
    }
  };

  const phaseInfo = getPhaseInfo();
  const Icon = phaseInfo.icon;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className={`${phaseInfo.color}`}>
            <Icon
              className={`w-6 h-6 ${currentPhase !== 'done' ? 'animate-spin' : ''}`}
            />
          </div>
          <div className="flex-1">
            <CardTitle className="text-base">{phaseInfo.title}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{phaseInfo.description}</p>
          </div>
          <Badge variant="secondary" className="shrink-0">
            {findingsCount} findings
          </Badge>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {/* Progress Steps */}
          <div className="flex items-center gap-4">
            {/* Quick Checks Step */}
            <div className="flex items-center gap-2 flex-1">
              <div
                className={`w-2 h-2 rounded-full ${
                  quickCheckCount > 0 ? phase.quick.dot : 'bg-border'
                }`}
              />
              <span className="text-sm text-muted-foreground">
                Quick: {quickCheckCount}
              </span>
            </div>

            {/* Opus Analysis Step */}
            <div className="flex items-center gap-2 flex-1">
              <div
                className={`w-2 h-2 rounded-full ${
                  opusCheckCount > 0 ? phase.opus.dot : 'bg-border'
                }`}
              />
              <span className="text-sm text-muted-foreground">
                AI: {opusCheckCount}
              </span>
            </div>

            {/* Done Step */}
            <div className="flex items-center gap-2 flex-1">
              <div
                className={`w-2 h-2 rounded-full ${
                  currentPhase === 'done' ? phase.done.dot : 'bg-border'
                }`}
              />
              <span className="text-sm text-muted-foreground">
                {currentPhase === 'done' ? 'Complete' : 'Pending'}
              </span>
            </div>
          </div>

          {/* Live Feed */}
          {currentPhase !== 'idle' && (
            <div className="mt-4">
              <div className="text-xs font-medium text-muted-foreground mb-2">
                Live Activity
              </div>
              <ScrollArea className="h-32 rounded-lg bg-background border border-border">
                <div className="p-3 space-y-2">
                  {quickCheckCount > 0 && (
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <CheckCircle2 className={`w-3 h-3 ${phase.quick.text}`} />
                      Quick checks completed: {quickCheckCount} findings
                    </div>
                  )}
                  {currentPhase === 'opus' && (
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <Loader2 className={`w-3 h-3 ${phase.opus.text} animate-spin`} />
                      Analyzing with Claude Opus...
                    </div>
                  )}
                  {opusCheckCount > 0 && (
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <Brain className={`w-3 h-3 ${phase.opus.text}`} />
                      AI findings: {opusCheckCount}
                    </div>
                  )}
                  {currentPhase === 'done' && (
                    <div className="text-xs flex items-center gap-2">
                      <CheckCircle2 className={`w-3 h-3 ${phase.done.text}`} />
                      <span className={phase.done.text}>Audit completed successfully</span>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

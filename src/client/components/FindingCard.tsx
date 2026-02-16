/**
 * FindingCard Component
 *
 * Displays a single security finding with severity, description, and actions.
 * Uses centralized SeverityBadge for consistent styling.
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SeverityBadge } from './design/SeverityBadge';
import { ChevronDown, ChevronRight, Wrench, AlertTriangle } from 'lucide-react';
import { severity } from '@/lib/design';
import type { Finding } from '../../shared/types';

interface FindingCardProps {
  finding: Finding;
  onFix?: (findingId: string) => void;
}

export function FindingCard({ finding, onFix }: FindingCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const config = severity[finding.severity];

  return (
    <Card className={`${config.bg} border-l-4 ${config.border}`}>
      <CardHeader className="pb-1">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1.5">
              <SeverityBadge level={finding.severity} />
              {finding.container && (
                <Badge variant="outline" className="shrink-0 text-[10px] py-0">
                  {finding.container}
                </Badge>
              )}
              <Badge variant="ghost" className="shrink-0 text-[10px] py-0">
                {finding.category}
              </Badge>
            </div>
            <CardTitle className="text-sm leading-tight">{finding.title}</CardTitle>
          </div>
          {finding.fix && onFix && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onFix(finding.id)}
              className="shrink-0 h-7 px-2"
            >
              <Wrench className="w-3 h-3 mr-1" />
              <span className="text-xs">Fix</span>
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-1">
        <p className="text-xs text-foreground/90 mb-2">{finding.description}</p>

        {/* Expandable Details */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          {isExpanded ? (
            <ChevronDown className="w-3 h-3" />
          ) : (
            <ChevronRight className="w-3 h-3" />
          )}
          {isExpanded ? 'Hide' : 'Show'} details
        </button>

        {isExpanded && (
          <div className="mt-2 space-y-2 border-t border-border pt-2">
            {/* Risk Explanation */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-orange-500" />
                <span className="text-sm font-medium">Risk</span>
              </div>
              <p className="text-sm text-muted-foreground ml-6">{finding.risk}</p>
            </div>

            {/* Fix Information */}
            {finding.fix && (
              <div>
                <span className="text-sm font-medium block mb-2">How to Fix</span>
                <p className="text-sm text-muted-foreground mb-2">{finding.fix.description}</p>

                {finding.fix.sideEffects && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 mt-2">
                    <p className="text-xs text-amber-300">
                      <strong>Side Effects:</strong> {finding.fix.sideEffects}
                    </p>
                  </div>
                )}

                {finding.fix.requiresRestart && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Note: Container restart required after applying fix
                  </p>
                )}
              </div>
            )}

            {/* Source Badge */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Source:</span>
              <Badge variant="ghost" className="text-xs">
                {finding.source === 'quick_check' ? 'Quick Check' : 'AI Analysis'}
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

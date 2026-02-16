/**
 * FindingsList Component
 *
 * List of all security findings sorted by severity with collapsible sections.
 * Uses centralized design tokens for consistency.
 */

import { useState } from 'react';
import { FindingCard } from './FindingCard';
import { UfwBypassAlert } from './UfwBypassAlert';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { severity } from '@/lib/design';
import type { Finding, Severity } from '../../shared/types';

interface FindingsListProps {
  findings: Finding[];
  onFix?: (findingId: string) => void;
  isLoading?: boolean;
}

export function FindingsList({ findings, onFix, isLoading }: FindingsListProps) {
  const [expandedSections, setExpandedSections] = useState<Set<Severity>>(
    new Set(['critical', 'high', 'medium', 'low', 'info'])
  );

  const toggleSection = (sev: Severity) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sev)) {
      newExpanded.delete(sev);
    } else {
      newExpanded.add(sev);
    }
    setExpandedSections(newExpanded);
  };

  // Group findings by severity
  const groupedFindings = findings.reduce((acc, finding) => {
    if (!acc[finding.severity]) {
      acc[finding.severity] = [];
    }
    acc[finding.severity].push(finding);
    return acc;
  }, {} as Record<Severity, Finding[]>);

  const severityOrder: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-border border-t-emerald-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading findings...</p>
        </div>
      </div>
    );
  }

  if (findings.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-3xl">✓</span>
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">No Security Issues Found</h3>
        <p className="text-sm text-muted-foreground">
          Your Docker setup looks good! No critical security findings detected.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Header */}
      <div className="flex flex-wrap gap-2 mb-4">
        {severityOrder.map((sev) => {
          const count = groupedFindings[sev]?.length || 0;
          if (count === 0) return null;
          const config = severity[sev];
          return (
            <Badge
              key={sev}
              variant="outline"
              className={`${config.text} ${config.border}`}
            >
              {config.label}: {count}
            </Badge>
          );
        })}
      </div>

      {/* Grouped Findings */}
      {severityOrder.map((sev) => {
        const severityFindings = groupedFindings[sev] || [];
        if (severityFindings.length === 0) return null;

        const config = severity[sev];
        const isExpanded = expandedSections.has(sev);

        return (
          <div key={sev} className="space-y-3">
            {/* Section Header */}
            <button
              onClick={() => toggleSection(sev)}
              className="flex items-center gap-3 w-full group"
            >
              <div className={`w-1 h-6 ${config.bg.replace('/10', '')} rounded-full`} />
              <span className={`text-lg font-semibold ${config.text}`}>
                {config.label}
              </span>
              <Badge variant="secondary" className="ml-auto">
                {severityFindings.length}
              </Badge>
              {isExpanded ? (
                <ChevronDown className="w-5 h-5 text-muted-foreground group-hover:text-foreground" />
              ) : (
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground" />
              )}
            </button>

            {/* Section Content */}
            {isExpanded && (
              <div className="ml-4 space-y-3">
                {severityFindings.map((finding) => {
                  // Use specialized alert for UFW bypass findings
                  if (finding.category === 'firewall') {
                    return <UfwBypassAlert key={finding.id} finding={finding} onFix={onFix} />;
                  }
                  return <FindingCard key={finding.id} finding={finding} onFix={onFix} />;
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

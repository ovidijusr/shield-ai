/**
 * useAudit Hook
 *
 * React Query hook for triggering audit and streaming findings via SSE.
 * Persists audit results to database for survival across page refreshes.
 */

import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { Finding, GoodPractice, StreamEvent } from '../../shared/types';
import { createSSEConnection, saveAuditResult, getAuditHistory } from '../lib/api';

interface AuditState {
  findings: Finding[];
  goodPractices: GoodPractice[];
  quickCheckCount: number;
  opusCheckCount: number;
  score: number | null;
  isStreaming: boolean;
  phase: 'idle' | 'quick' | 'opus' | 'done';
  timestamp?: number; // When audit was completed
  auditId?: string; // Database ID of the audit
}

/**
 * Get empty audit state
 */
function getEmptyState(): AuditState {
  return {
    findings: [],
    goodPractices: [],
    quickCheckCount: 0,
    opusCheckCount: 0,
    score: null,
    isStreaming: false,
    phase: 'idle',
  };
}

/**
 * Generate unique audit ID
 */
function generateAuditId(): string {
  return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function useAudit() {
  const [auditState, setAuditState] = useState<AuditState>(getEmptyState);

  // Load most recent audit on mount
  const { data: auditHistory } = useQuery({
    queryKey: ['audit-history'],
    queryFn: () => getAuditHistory(1, 0),
    staleTime: 30000, // 30 seconds
  });

  // Restore most recent audit if available
  useEffect(() => {
    if (auditHistory && auditHistory.length > 0 && !auditState.auditId) {
      const latest = auditHistory[0];
      // Don't reload if we already have results
      if (auditState.findings.length === 0) {
        setAuditState({
          findings: [],
          goodPractices: [],
          quickCheckCount: latest.quickCheckCount,
          opusCheckCount: latest.opusCheckCount,
          score: latest.score,
          isStreaming: false,
          phase: latest.findingsCount > 0 ? 'done' : 'idle',
          timestamp: latest.timestamp,
          auditId: latest.id,
        });
      }
    }
  }, [auditHistory]);

  const mutation = useMutation({
    mutationFn: async () => {
      return new Promise<AuditState>((resolve, reject) => {
        const auditId = generateAuditId();
        const startTime = Date.now();
        let findings: Finding[] = [];
        let goodPractices: GoodPractice[] = [];
        let quickCheckCount = 0;
        let opusCheckCount = 0;
        let score: number | null = null;
        let hasSeenOpusFindings = false;
        let settled = false; // Track if Promise was already resolved/rejected

        // Clear old results when starting new audit
        setAuditState({
          findings: [],
          goodPractices: [],
          quickCheckCount: 0,
          opusCheckCount: 0,
          score: null,
          isStreaming: true,
          phase: 'quick',
          auditId,
          timestamp: startTime,
        });

        createSSEConnection(
          '/audit',
          (event: StreamEvent) => {
            if (event.type === 'finding' && event.data) {
              // Individual finding received
              const finding = event.data as Finding;
              findings = [...findings, finding];

              // Count as quick check finding (before Opus phase)
              if (finding.source === 'quick_check') {
                quickCheckCount++;
              } else {
                // First opus finding - transition phase
                if (!hasSeenOpusFindings) {
                  hasSeenOpusFindings = true;
                  setAuditState((prev) => ({
                    ...prev,
                    phase: 'opus',
                  }));
                }
                opusCheckCount++;
              }

              setAuditState((prev) => ({
                ...prev,
                findings,
                quickCheckCount,
                opusCheckCount,
              }));
            } else if (event.type === 'good-practice' && event.data) {
              // Good practice received (from Opus)
              const practice = event.data as GoodPractice;
              goodPractices = [...goodPractices, practice];

              setAuditState((prev) => ({
                ...prev,
                goodPractices,
              }));
            } else if (event.type === 'complete' && event.data) {
              // Audit complete with final result
              const result = event.data as any;
              // Keep score as null if backend explicitly set it to null (API key missing)
              score = result.overallScore !== undefined ? result.overallScore : null;

              // Use good practices from result if not already collected
              const finalPractices = goodPractices.length > 0 ? goodPractices : (result.goodPractices || []);

              const endTime = Date.now();
              const duration = endTime - startTime;

              // Show "Audit Complete" state briefly before hiding
              setAuditState({
                findings,
                goodPractices: finalPractices,
                quickCheckCount,
                opusCheckCount,
                score,
                isStreaming: true, // Keep showing progress for the "done" phase
                phase: 'done',
                auditId,
                timestamp: startTime,
              });

              // Save audit to database (fire and forget)
              saveAuditResult({
                id: auditId,
                timestamp: startTime,
                findings,
                goodPractices: finalPractices,
                quickCheckCount,
                opusCheckCount,
                score,
                duration,
                containerCount: result.containerCount || 0,
                networkCount: result.networkCount || 0,
                volumeCount: result.volumeCount || 0,
              }).catch(err => {
                console.error('Failed to save audit to database:', err);
              });

              // After 1.5s, hide the progress display
              setTimeout(() => {
                setAuditState((prev) => ({
                  ...prev,
                  isStreaming: false,
                }));
              }, 1500);

              settled = true;
              resolve({
                findings,
                goodPractices: finalPractices,
                quickCheckCount,
                opusCheckCount,
                score,
                isStreaming: false,
                phase: 'done',
                auditId,
                timestamp: startTime,
              });
            } else if (event.type === 'error') {
              settled = true;
              reject(new Error(event.error || 'Audit failed'));
            }
          },
          (error) => {
            if (!settled) {
              settled = true;
              setAuditState((prev) => ({
                ...prev,
                isStreaming: false,
                phase: 'idle',
              }));
              reject(error);
            }
          },
          () => {
            // Connection closed - fallback if 'complete' event was lost
            if (!settled) {
              settled = true;
              const finalPhase = findings.length > 0 ? 'done' : 'idle';

              setAuditState((prev) => ({
                ...prev,
                isStreaming: false,
                phase: finalPhase,
              }));

              resolve({
                findings,
                goodPractices,
                quickCheckCount,
                opusCheckCount,
                score,
                isStreaming: false,
                phase: finalPhase,
              });
            } else {
              // Normal close after 'complete' event - just update state
              setAuditState((prev) => ({
                ...prev,
                isStreaming: false,
              }));
            }
          }
        );
      });
    },
  });

  return {
    runAudit: mutation.mutate,
    isLoading: mutation.isPending || auditState.isStreaming,
    error: mutation.error,
    data: auditState,
    reset: () => {
      mutation.reset();
      setAuditState(getEmptyState());
    },
  };
}


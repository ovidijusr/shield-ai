/**
 * API client for ShieldAI backend
 */

import type { DashboardStats, StreamEvent, ContainerInfo, NetworkInfo, VolumeInfo } from '../../shared/types';

const API_BASE = '/api';
const AUTH_TOKEN = (import.meta as any).env?.VITE_SHIELDAI_TOKEN || '';

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(AUTH_TOKEN && { Authorization: `Bearer ${AUTH_TOKEN}` }),
    ...options?.headers,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Helper for consuming Server-Sent Events with line buffering and abort support
 */
export function createSSEConnection(
  url: string,
  onEvent: (event: StreamEvent) => void,
  onError: (error: Error) => void,
  onComplete: () => void
): AbortController {
  const abortController = new AbortController();
  const headers: HeadersInit = {
    ...(AUTH_TOKEN && { Authorization: `Bearer ${AUTH_TOKEN}` }),
  };

  fetch(`${API_BASE}${url}`, {
    method: 'POST',
    headers,
    signal: abortController.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      // Line buffer to handle chunks split mid-line
      let lineBuffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        // Prepend any buffered partial line from previous chunk
        const fullChunk = lineBuffer + chunk;
        const lines = fullChunk.split('\n');

        // Last element might be incomplete - save it for next chunk
        lineBuffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const payload = line.slice(6);
            // Skip [DONE] sentinel
            if (payload === '[DONE]') {
              continue;
            }
            try {
              const data = JSON.parse(payload);
              onEvent(data);
            } catch (err) {
              console.error('Failed to parse SSE data:', payload.slice(0, 100), err);
            }
          }
        }
      }

      // Process any remaining buffered line
      if (lineBuffer.startsWith('data: ')) {
        const payload = lineBuffer.slice(6);
        if (payload !== '[DONE]') {
          try {
            const data = JSON.parse(payload);
            onEvent(data);
          } catch (err) {
            console.error('Failed to parse final SSE data:', payload.slice(0, 100), err);
          }
        }
      }

      onComplete();
    })
    .catch((err) => {
      if (err.name !== 'AbortError') {
        onError(err);
      }
    });

  return abortController;
}

/**
 * Get dashboard statistics
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  return fetchApi<DashboardStats>('/stats');
}

/**
 * Get all containers (running and stopped)
 */
export async function getContainers(): Promise<ContainerInfo[]> {
  return fetchApi<ContainerInfo[]>('/containers');
}

/**
 * Get all Docker networks
 */
export async function getNetworks(): Promise<NetworkInfo[]> {
  return fetchApi<NetworkInfo[]>('/networks');
}

/**
 * Get all Docker volumes
 */
export async function getVolumes(): Promise<VolumeInfo[]> {
  return fetchApi<VolumeInfo[]>('/volumes');
}

/**
 * Audit History API
 */
export interface AuditRecord {
  id: string;
  timestamp: number;
  findings: any[];
  goodPractices: any[];
  quickCheckCount: number;
  opusCheckCount: number;
  score: number | null;
  duration: number;
  containerCount: number;
  networkCount: number;
  volumeCount: number;
}

export interface AuditSummary {
  id: string;
  timestamp: number;
  findingsCount: number;
  goodPracticesCount: number;
  quickCheckCount: number;
  opusCheckCount: number;
  score: number | null;
  duration: number;
  containerCount: number;
  networkCount: number;
  volumeCount: number;
}

export interface AuditStats {
  totalAudits: number;
  totalFindings: number;
  averageScore: number | null;
  lastAuditTimestamp: number | null;
}

/**
 * Save audit result to database
 */
export async function saveAuditResult(audit: AuditRecord): Promise<{ success: boolean; id: string }> {
  return fetchApi<{ success: boolean; id: string }>('/audits', {
    method: 'POST',
    body: JSON.stringify(audit),
  });
}

/**
 * Get audit history summaries
 */
export async function getAuditHistory(limit = 50, offset = 0): Promise<AuditSummary[]> {
  return fetchApi<AuditSummary[]>(`/audits?limit=${limit}&offset=${offset}`);
}

/**
 * Get specific audit by ID
 */
export async function getAuditById(id: string): Promise<AuditRecord> {
  return fetchApi<AuditRecord>(`/audits/${id}`);
}

/**
 * Get audit statistics
 */
export async function getAuditStatistics(): Promise<AuditStats> {
  return fetchApi<AuditStats>('/audits/stats');
}

/**
 * Delete audit by ID
 */
export async function deleteAuditById(id: string): Promise<{ success: boolean }> {
  return fetchApi<{ success: boolean }>(`/audits/${id}`, {
    method: 'DELETE',
  });
}

export const api = {
  fetchApi,
  getDashboardStats,
  getContainers,
  getNetworks,
  getVolumes,
  createSSEConnection,
  saveAuditResult,
  getAuditHistory,
  getAuditById,
  getAuditStatistics,
  deleteAuditById,
};

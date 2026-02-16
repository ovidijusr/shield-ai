/**
 * Scan Visualization
 *
 * Visual representation of containers being scanned in real-time.
 * Shows which containers are being analyzed with animated states.
 */

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Container,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Shield,
  Cpu,
  Network,
  HardDrive
} from 'lucide-react';

interface ScanVisualizationProps {
  phase: 'idle' | 'quick' | 'opus' | 'done';
  findingsCount?: number;
}

interface ScanTarget {
  id: string;
  name: string;
  type: 'container' | 'network' | 'volume';
  status: 'pending' | 'scanning' | 'complete' | 'issues';
  issuesFound: number;
}

export function ScanVisualization({ phase }: ScanVisualizationProps) {
  const [targets, setTargets] = useState<ScanTarget[]>([
    { id: '1', name: 'web-app', type: 'container', status: 'pending', issuesFound: 0 },
    { id: '2', name: 'api-server', type: 'container', status: 'pending', issuesFound: 0 },
    { id: '3', name: 'database', type: 'container', status: 'pending', issuesFound: 0 },
    { id: '4', name: 'redis-cache', type: 'container', status: 'pending', issuesFound: 0 },
    { id: '5', name: 'bridge-net', type: 'network', status: 'pending', issuesFound: 0 },
    { id: '6', name: 'app-data', type: 'volume', status: 'pending', issuesFound: 0 },
  ]);

  // Simulate scanning progression
  useEffect(() => {
    if (phase === 'idle' || phase === 'done') {
      return;
    }

    let currentIndex = 0;
    const scanInterval = setInterval(() => {
      setTargets(prev => {
        const updated = [...prev];

        // Mark previous as complete
        if (currentIndex > 0 && updated[currentIndex - 1].status === 'scanning') {
          updated[currentIndex - 1].status = Math.random() > 0.6 ? 'issues' : 'complete';
          updated[currentIndex - 1].issuesFound = updated[currentIndex - 1].status === 'issues'
            ? Math.floor(Math.random() * 5) + 1
            : 0;
        }

        // Start scanning next
        if (currentIndex < updated.length) {
          updated[currentIndex].status = 'scanning';
          currentIndex++;
        }

        return updated;
      });
    }, 1500);

    return () => clearInterval(scanInterval);
  }, [phase]);

  // Mark all as complete when audit is done
  useEffect(() => {
    if (phase === 'done') {
      setTargets(prev =>
        prev.map(t => ({
          ...t,
          status: t.status === 'scanning' || t.status === 'pending' ? 'complete' : t.status,
        }))
      );
    }
  }, [phase]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'container': return Container;
      case 'network': return Network;
      case 'volume': return HardDrive;
      default: return Shield;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'container': return 'text-blue-400 border-blue-400/30';
      case 'network': return 'text-purple-400 border-purple-400/30';
      case 'volume': return 'text-cyan-400 border-cyan-400/30';
      default: return 'text-gray-400 border-gray-400/30';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'scanning': return <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />;
      case 'complete': return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      case 'issues': return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      default: return <Cpu className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'scanning': return 'bg-cyan-500/10 border-cyan-500/30';
      case 'complete': return 'bg-green-500/10 border-green-500/30';
      case 'issues': return 'bg-amber-500/10 border-amber-500/30';
      default: return 'bg-gray-500/5 border-gray-700/30';
    }
  };

  if (phase === 'idle') {
    return null;
  }

  return (
    <Card className="bg-black/40 border border-emerald-500/20 backdrop-blur-sm">
      <div className="p-4 border-b border-emerald-500/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Scan Targets
            </h3>
          </div>
          <Badge variant="outline" className="text-xs border-emerald-500/30 text-emerald-400">
            {targets.filter(t => t.status === 'complete' || t.status === 'issues').length} / {targets.length}
          </Badge>
        </div>
      </div>

      <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {targets.map((target, index) => {
          const Icon = getIcon(target.type);

          return (
            <div
              key={target.id}
              className={`
                relative p-4 rounded-lg border transition-all duration-300
                ${getStatusBg(target.status)}
                ${target.status === 'scanning' ? 'shadow-lg shadow-cyan-500/20 scale-105' : ''}
              `}
              style={{
                animationDelay: `${index * 100}ms`,
                animation: target.status === 'scanning' ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none'
              }}
            >
              {/* Scanning beam effect */}
              {target.status === 'scanning' && (
                <div className="absolute inset-0 overflow-hidden rounded-lg">
                  <div
                    className="absolute w-full h-1 bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent"
                    style={{
                      animation: 'scan-beam 2s linear infinite',
                    }}
                  />
                </div>
              )}

              <div className="relative z-10">
                <div className="flex items-start justify-between mb-3">
                  <div className={`p-2 rounded ${getTypeColor(target.type)} border`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  {getStatusIcon(target.status)}
                </div>

                <div className="space-y-1">
                  <div className="font-mono text-sm text-white font-medium truncate">
                    {target.name}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 h-4 ${getTypeColor(target.type)}`}
                    >
                      {target.type}
                    </Badge>
                    {target.issuesFound > 0 && (
                      <Badge
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 h-4 border-amber-400/30 text-amber-400"
                      >
                        {target.issuesFound} issues
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Status text */}
                <div className="mt-2 text-xs text-gray-400 font-mono">
                  {target.status === 'pending' && 'Queued...'}
                  {target.status === 'scanning' && 'Analyzing...'}
                  {target.status === 'complete' && 'Secure'}
                  {target.status === 'issues' && 'Issues found'}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes scan-beam {
          0% {
            top: 0;
          }
          100% {
            top: 100%;
          }
        }
      `}</style>
    </Card>
  );
}

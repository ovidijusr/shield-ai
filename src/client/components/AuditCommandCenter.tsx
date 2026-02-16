/**
 * Audit Command Center
 *
 * Real-time security audit visualization with comprehensive status feedback.
 * Distinctive retro-futuristic "command center" aesthetic.
 */

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Shield,
  Activity,
  Zap,
  Brain,
  CheckCircle2,
  Search,
  Container,
  Network,
  HardDrive,
  TrendingUp
} from 'lucide-react';

interface AuditCommandCenterProps {
  phase: 'idle' | 'quick' | 'opus' | 'done';
  quickCheckCount: number;
  opusCheckCount: number;
  findingsCount: number;
  containerCount?: number;
  networkCount?: number;
  volumeCount?: number;
}

interface ActivityLog {
  id: string;
  timestamp: Date;
  message: string;
  type: 'scan' | 'finding' | 'analysis' | 'complete';
  severity?: 'critical' | 'high' | 'medium' | 'low';
}

export function AuditCommandCenter({
  phase,
  quickCheckCount,
  opusCheckCount,
  findingsCount,
  containerCount = 0,
  networkCount = 0,
  volumeCount = 0,
}: AuditCommandCenterProps) {
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [scanRate, setScanRate] = useState(0);

  // Timer for elapsed time
  useEffect(() => {
    if (phase === 'quick' || phase === 'opus') {
      const startTime = Date.now();
      const timer = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [phase]);

  // Generate activity logs based on phase changes
  useEffect(() => {
    const addLog = (message: string, type: ActivityLog['type'], severity?: ActivityLog['severity']) => {
      const log: ActivityLog = {
        id: `${Date.now()}-${Math.random()}`,
        timestamp: new Date(),
        message,
        type,
        severity,
      };
      setActivityLogs(prev => [log, ...prev].slice(0, 20)); // Keep last 20
    };

    if (phase === 'quick' && activityLogs.length === 0) {
      addLog('Initializing security audit...', 'scan');
      addLog(`Discovered ${containerCount} containers, ${networkCount} networks, ${volumeCount} volumes`, 'scan');
      addLog('Starting quick security checks...', 'scan');
    }

    if (quickCheckCount > 0 && phase === 'quick') {
      addLog(`Quick check completed: ${quickCheckCount} findings detected`, 'finding');
    }

    if (phase === 'opus') {
      addLog('Initializing Claude Opus deep analysis...', 'analysis');
      addLog('Running AI-powered security assessment...', 'analysis');
    }

    if (opusCheckCount > 0 && phase === 'opus') {
      addLog(`AI analysis discovered ${opusCheckCount} additional insights`, 'finding');
    }

    if (phase === 'done') {
      addLog(`Audit completed: ${findingsCount} total findings`, 'complete');
      addLog('Security report ready for review', 'complete');
    }
  }, [phase, quickCheckCount, opusCheckCount, findingsCount, containerCount, networkCount, volumeCount]);

  // Calculate scan rate
  useEffect(() => {
    if (elapsedTime > 0) {
      const rate = Math.round((quickCheckCount + opusCheckCount) / elapsedTime);
      setScanRate(rate);
    }
  }, [elapsedTime, quickCheckCount, opusCheckCount]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getPhaseProgress = () => {
    switch (phase) {
      case 'quick': return 33;
      case 'opus': return 66;
      case 'done': return 100;
      default: return 0;
    }
  };

  const getStatusColor = () => {
    switch (phase) {
      case 'quick': return 'text-cyan-400';
      case 'opus': return 'text-purple-400';
      case 'done': return 'text-green-400';
      default: return 'text-gray-400';
    }
  };

  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case 'critical': return 'text-red-400';
      case 'high': return 'text-orange-400';
      case 'medium': return 'text-yellow-400';
      case 'low': return 'text-blue-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="space-y-4" style={{ fontFamily: 'var(--font-mono), monospace' }}>
      {/* Main Status Header */}
      <Card className="bg-black/40 border border-emerald-500/20 backdrop-blur-sm relative overflow-hidden">
        {/* Scan line effect */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute w-full h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent"
            style={{
              animation: phase !== 'idle' && phase !== 'done' ? 'scan 3s linear infinite' : 'none',
            }}
          />
        </div>

        <div className="p-6 relative z-10">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="relative">
                <Shield className={`w-8 h-8 ${getStatusColor()}`} />
                {(phase === 'quick' || phase === 'opus') && (
                  <div className="absolute inset-0">
                    <div className={`w-8 h-8 ${getStatusColor()} animate-ping opacity-20`}>
                      <Shield className="w-8 h-8" />
                    </div>
                  </div>
                )}
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold text-white tracking-tight">
                    {phase === 'idle' && 'Standby'}
                    {phase === 'quick' && 'SCANNING...'}
                    {phase === 'opus' && 'DEEP ANALYSIS...'}
                    {phase === 'done' && 'COMPLETE'}
                  </h2>
                  <Badge
                    variant="outline"
                    className={`${getStatusColor()} border-current uppercase text-xs tracking-wider`}
                  >
                    {phase}
                  </Badge>
                </div>
                <p className="text-sm text-gray-400 mt-1 font-mono">
                  {phase === 'quick' && 'Running automated security checks'}
                  {phase === 'opus' && 'AI-powered vulnerability analysis active'}
                  {phase === 'done' && 'Security audit finished successfully'}
                  {phase === 'idle' && 'Ready to initiate security audit'}
                </p>
              </div>
            </div>

            {/* Live Metrics */}
            {(phase !== 'idle') && (
              <div className="grid grid-cols-3 gap-6 text-right">
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Time</div>
                  <div className="text-lg font-bold text-cyan-400 font-mono">
                    {formatTime(elapsedTime)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Findings</div>
                  <div className="text-lg font-bold text-amber-400 font-mono">
                    {findingsCount}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Rate</div>
                  <div className="text-lg font-bold text-green-400 font-mono">
                    {scanRate}/s
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
              <span>PROGRESS</span>
              <span>{getPhaseProgress()}%</span>
            </div>
            <div className="h-2 bg-gray-800/50 rounded-full overflow-hidden border border-gray-700/50">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 via-purple-500 to-green-500 transition-all duration-500 relative"
                style={{ width: `${getPhaseProgress()}%` }}
              >
                {(phase === 'quick' || phase === 'opus') && (
                  <div className="absolute inset-0 bg-white/20 animate-pulse" />
                )}
              </div>
            </div>

            {/* Phase Indicators */}
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className={`flex items-center gap-2 ${phase === 'quick' || quickCheckCount > 0 ? 'text-cyan-400' : 'text-gray-600'}`}>
                <Zap className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wider">Quick: {quickCheckCount}</span>
              </div>
              <div className={`flex items-center gap-2 ${phase === 'opus' || opusCheckCount > 0 ? 'text-purple-400' : 'text-gray-600'}`}>
                <Brain className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wider">AI: {opusCheckCount}</span>
              </div>
              <div className={`flex items-center gap-2 ${phase === 'done' ? 'text-green-400' : 'text-gray-600'}`}>
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-xs uppercase tracking-wider">
                  {phase === 'done' ? 'Complete' : 'Pending'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Infrastructure Status */}
        <Card className="bg-black/40 border border-emerald-500/20 backdrop-blur-sm">
          <div className="p-4 border-b border-emerald-500/20">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Infrastructure Scan
              </h3>
            </div>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded border border-gray-800">
              <div className="flex items-center gap-3">
                <Container className="w-5 h-5 text-blue-400" />
                <span className="text-sm text-gray-300">Containers</span>
              </div>
              <span className="text-lg font-bold text-blue-400 font-mono">{containerCount}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded border border-gray-800">
              <div className="flex items-center gap-3">
                <Network className="w-5 h-5 text-purple-400" />
                <span className="text-sm text-gray-300">Networks</span>
              </div>
              <span className="text-lg font-bold text-purple-400 font-mono">{networkCount}</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-900/50 rounded border border-gray-800">
              <div className="flex items-center gap-3">
                <HardDrive className="w-5 h-5 text-cyan-400" />
                <span className="text-sm text-gray-300">Volumes</span>
              </div>
              <span className="text-lg font-bold text-cyan-400 font-mono">{volumeCount}</span>
            </div>
          </div>
        </Card>

        {/* Activity Feed */}
        <Card className="bg-black/40 border border-emerald-500/20 backdrop-blur-sm">
          <div className="p-4 border-b border-emerald-500/20">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Live Activity Feed
              </h3>
            </div>
          </div>
          <div className="h-[240px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-transparent">
            <div className="p-4 space-y-2">
              {activityLogs.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                  <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Waiting for audit to begin...</p>
                </div>
              ) : (
                activityLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 p-2 rounded bg-gray-900/30 border border-gray-800/50 hover:border-gray-700 transition-colors animate-in slide-in-from-top-2 duration-300"
                  >
                    <div className="text-xs text-gray-500 font-mono whitespace-nowrap mt-0.5">
                      {log.timestamp.toLocaleTimeString('en-US', {
                        hour12: false,
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </div>
                    <div className="flex-1">
                      <span className={`text-xs ${getSeverityColor(log.severity)}`}>
                        {log.message}
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 h-4 border-gray-700 text-gray-400"
                    >
                      {log.type}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>
      </div>

      <style>{`
        @keyframes scan {
          0% {
            top: 0;
          }
          100% {
            top: 100%;
          }
        }
      `}</style>
    </div>
  );
}

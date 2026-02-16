/**
 * Dashboard Component
 *
 * Main dashboard showing security score, container overview, and findings summary.
 * Uses "Perimeter" palette: emerald for containers, teal for networks, cyan for volumes.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ScoreGauge } from './ScoreGauge';
import { ScoreDeltaBadge } from './ScoreDeltaBadge';
import { ScoreTrendChart } from './ScoreTrendChart';
import { AchievementBadges } from './AchievementBadges';
import { PortExposureMap } from './PortExposureMap';
import { getDashboardStats, getContainers, getNetworks, getVolumes } from '../lib/api';
import { Container, Network, HardDrive, Shield, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import type { ContainerInfo, NetworkInfo, VolumeInfo } from '../../shared/types';

interface DashboardProps {
  score: number | null;
  findingsCount: number;
}

export function Dashboard({ score, findingsCount }: DashboardProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: getDashboardStats,
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const { data: containers = [] } = useQuery({
    queryKey: ['containers'],
    queryFn: getContainers,
    refetchInterval: 10000,
  });

  const { data: networks = [] } = useQuery({
    queryKey: ['networks'],
    queryFn: getNetworks,
    refetchInterval: 10000,
  });

  const { data: volumes = [] } = useQuery({
    queryKey: ['volumes'],
    queryFn: getVolumes,
    refetchInterval: 10000,
  });

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      // If clicking already-open section, close it (empty set)
      if (prev.has(section)) {
        return new Set();
      }
      // Otherwise, close all others and open only this one
      return new Set([section]);
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Top Section Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Score Gauge Skeleton */}
          <Card className="md:col-span-2 lg:col-span-1">
            <CardContent className="flex items-center justify-center py-8">
              <div className="flex flex-col items-center gap-2">
                <Skeleton className="w-32 h-32 rounded-full" />
                <Skeleton className="w-24 h-4" />
              </div>
            </CardContent>
          </Card>

          {/* Stat Card Skeletons */}
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="w-20 h-4" />
                  <Skeleton className="w-4 h-4" />
                </div>
              </CardHeader>
              <CardContent>
                <Skeleton className="w-16 h-8 mb-2" />
                <Skeleton className="w-24 h-3" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Bottom Section Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Findings Summary Skeleton */}
          <Card>
            <CardHeader>
              <Skeleton className="w-32 h-5" />
            </CardHeader>
            <CardContent>
              <div className="text-center py-4">
                <Skeleton className="w-20 h-12 mx-auto mb-2" />
                <Skeleton className="w-32 h-4 mx-auto" />
              </div>
            </CardContent>
          </Card>

          {/* Exposed Ports Skeleton */}
          <Card>
            <CardHeader>
              <Skeleton className="w-28 h-5" />
            </CardHeader>
            <CardContent>
              <div className="text-center py-4">
                <Skeleton className="w-20 h-12 mx-auto mb-2" />
                <Skeleton className="w-36 h-4 mx-auto" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const displayScore = score !== null ? score : stats?.lastScore ?? null;

  return (
    <div className="space-y-3">
      {/* Top Section: Score and Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Security Score Card */}
        <Card className="md:col-span-2 lg:col-span-1">
          <CardContent className="flex flex-col items-center justify-center py-2 gap-2">
            {displayScore !== null ? (
              <>
                <ScoreGauge score={displayScore} size="md" showLabel={true} />
                <ScoreDeltaBadge />
              </>
            ) : (
              <div className="text-center">
                <Shield className="w-16 h-16 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No audit yet</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Run your first audit</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Container Count - Expandable */}
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => toggleSection('containers')}>
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-medium text-muted-foreground">Containers</CardTitle>
              <div className="flex items-center gap-1.5">
                <Container className="w-3.5 h-3.5 text-emerald-500" />
                {containers.length > 0 && (
                  expandedSections.has('containers') ?
                    <ChevronUp className="w-3 h-3" /> :
                    <ChevronDown className="w-3 h-3" />
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pb-2 pt-1">
            <div className="text-2xl font-bold text-foreground">{stats?.totalContainers ?? 0}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">{stats?.runningContainers ?? 0} running</p>
          </CardContent>
        </Card>

        {/* Network Count - Expandable */}
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => toggleSection('networks')}>
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-medium text-muted-foreground">Networks</CardTitle>
              <div className="flex items-center gap-1.5">
                <Network className="w-3.5 h-3.5 text-teal-500" />
                {networks.length > 0 && (
                  expandedSections.has('networks') ?
                    <ChevronUp className="w-3 h-3" /> :
                    <ChevronDown className="w-3 h-3" />
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pb-2 pt-1">
            <div className="text-2xl font-bold text-foreground">{stats?.totalNetworks ?? 0}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Docker networks</p>
          </CardContent>
        </Card>

        {/* Volume Count - Expandable */}
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => toggleSection('volumes')}>
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-medium text-muted-foreground">Volumes</CardTitle>
              <div className="flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-cyan-500" />
                {volumes.length > 0 && (
                  expandedSections.has('volumes') ?
                    <ChevronUp className="w-3 h-3" /> :
                    <ChevronDown className="w-3 h-3" />
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pb-2 pt-1">
            <div className="text-2xl font-bold text-foreground">{stats?.totalVolumes ?? 0}</div>
            <p className="text-[10px] text-muted-foreground mt-0.5">Data volumes</p>
          </CardContent>
        </Card>
      </div>

      {/* Expandable Container Details */}
      {expandedSections.has('containers') && containers.length > 0 && (
        <Card>
          <CardContent className="pt-6 space-y-2">
            {containers.map((container) => (
              <ContainerCard key={container.id} container={container} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Expandable Network Details */}
      {expandedSections.has('networks') && networks.length > 0 && (
        <Card>
          <CardContent className="pt-6 space-y-2">
            {networks.map((network) => (
              <NetworkCard key={network.id} network={network} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Expandable Volume Details */}
      {expandedSections.has('volumes') && volumes.length > 0 && (
        <Card>
          <CardContent className="pt-6 space-y-2">
            {volumes.map((volume) => (
              <VolumeCard key={volume.name} volume={volume} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Score Trend Chart - Full Width */}
      {displayScore !== null && <ScoreTrendChart />}

      {/* Bottom Section: Findings and Exposed Ports */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Findings Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Security Findings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-4">
              <div className="text-4xl font-bold text-orange-500 mb-2">
                {findingsCount}
              </div>
              <p className="text-sm text-muted-foreground">
                {findingsCount === 0 ? 'No issues found' : findingsCount === 1 ? 'Issue detected' : 'Issues detected'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Port Exposure Map - Enhanced visualization */}
        <PortExposureMap containers={containers} />
      </div>

      {/* Achievements - Full Width */}
      {displayScore !== null && <AchievementBadges />}

      {/* Last Scan Info */}
      {stats?.lastAuditAt && (
        <Card>
          <CardContent className="flex items-center gap-2 py-3">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Last scan: {new Date(stats.lastAuditAt).toLocaleString()}
            </span>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface ContainerCardProps {
  container: ContainerInfo;
}

function ContainerCard({ container }: ContainerCardProps) {
  const isRunning = container.status.toLowerCase().includes('running');

  return (
    <div className="group flex items-center py-2.5 border-b border-border/30 last:border-0 hover:bg-accent/20 transition-all duration-200">
      {/* Status Indicator */}
      <div className="flex items-center justify-center w-8 flex-shrink-0">
        <div
          className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
            isRunning
              ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] group-hover:shadow-[0_0_12px_rgba(16,185,129,0.8)]'
              : 'bg-zinc-600'
          }`}
        />
      </div>

      {/* Container Name */}
      <div className="flex-1 min-w-0 px-3">
        <span className="font-mono text-xs text-foreground/90 tracking-tight truncate block group-hover:text-foreground transition-colors">
          {container.name}
        </span>
      </div>

      {/* Status Badge */}
      <div className="w-16 flex-shrink-0 px-2">
        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium tracking-wide uppercase ${
          isRunning
            ? 'bg-emerald-500/10 text-emerald-400'
            : 'bg-zinc-800 text-zinc-500'
        }`}>
          {container.status}
        </span>
      </div>

      {/* Image */}
      <div className="flex-1 min-w-0 px-3">
        <span className="font-mono text-[11px] text-muted-foreground truncate block">
          {container.image}
        </span>
      </div>

      {/* Port Count */}
      <div className="w-12 flex-shrink-0 text-right px-3">
        {container.ports && container.ports.length > 0 && (
          <span className="font-mono text-[10px] text-muted-foreground/70">
            {container.ports.length}p
          </span>
        )}
      </div>
    </div>
  );
}

interface NetworkCardProps {
  network: NetworkInfo;
}

function NetworkCard({ network }: NetworkCardProps) {
  const isInternal = network.internal;

  return (
    <div className="group flex items-center py-2.5 border-b border-border/30 last:border-0 hover:bg-accent/20 transition-all duration-200">
      {/* Status Indicator */}
      <div className="flex items-center justify-center w-8 flex-shrink-0">
        <div
          className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
            isInternal
              ? 'bg-zinc-600'
              : 'bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.6)] group-hover:shadow-[0_0_12px_rgba(20,184,166,0.8)]'
          }`}
        />
      </div>

      {/* Network Name */}
      <div className="flex-1 min-w-0 px-3">
        <span className="font-mono text-xs text-foreground/90 tracking-tight truncate block group-hover:text-foreground transition-colors">
          {network.name}
        </span>
      </div>

      {/* Driver Badge */}
      <div className="w-20 flex-shrink-0 px-2">
        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium tracking-wide uppercase bg-teal-500/10 text-teal-400">
          {network.driver}
        </span>
      </div>

      {/* Scope */}
      <div className="flex-1 min-w-0 px-3">
        <span className="font-mono text-[11px] text-muted-foreground truncate block">
          {network.scope}
        </span>
      </div>

      {/* Container Count */}
      <div className="w-12 flex-shrink-0 text-right px-3">
        {network.containers.length > 0 && (
          <span className="font-mono text-[10px] text-muted-foreground/70">
            {network.containers.length}c
          </span>
        )}
      </div>
    </div>
  );
}

interface VolumeCardProps {
  volume: VolumeInfo;
}

function VolumeCard({ volume }: VolumeCardProps) {
  const isUsed = volume.usedBy.length > 0;

  return (
    <div className="group flex items-center py-2.5 border-b border-border/30 last:border-0 hover:bg-accent/20 transition-all duration-200">
      {/* Status Indicator */}
      <div className="flex items-center justify-center w-8 flex-shrink-0">
        <div
          className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
            isUsed
              ? 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.6)] group-hover:shadow-[0_0_12px_rgba(6,182,212,0.8)]'
              : 'bg-zinc-600'
          }`}
        />
      </div>

      {/* Volume Name */}
      <div className="flex-1 min-w-0 px-3">
        <span className="font-mono text-xs text-foreground/90 tracking-tight truncate block group-hover:text-foreground transition-colors">
          {volume.name}
        </span>
      </div>

      {/* Driver Badge */}
      <div className="w-20 flex-shrink-0 px-2">
        <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium tracking-wide uppercase bg-cyan-500/10 text-cyan-400">
          {volume.driver}
        </span>
      </div>

      {/* Mount Point */}
      <div className="flex-1 min-w-0 px-3">
        <span className="font-mono text-[11px] text-muted-foreground truncate block">
          {volume.mountPoint}
        </span>
      </div>

      {/* Usage Count */}
      <div className="w-12 flex-shrink-0 text-right px-3">
        {volume.usedBy.length > 0 && (
          <span className="font-mono text-[10px] text-muted-foreground/70">
            {volume.usedBy.length}u
          </span>
        )}
      </div>
    </div>
  );
}


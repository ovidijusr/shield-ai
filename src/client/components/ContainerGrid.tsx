/**
 * ContainerGrid Component
 *
 * Grid view of all containers with status indicators.
 * Uses StatusDot component for consistent status display.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusDot } from './design/StatusDot';
import { Container, Network } from 'lucide-react';
import { status } from '@/lib/design';
import type { ContainerInfo } from '../../shared/types';

interface ContainerGridProps {
  containers: ContainerInfo[];
  isLoading?: boolean;
}

export function ContainerGrid({ containers, isLoading }: ContainerGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="border-l-4 border-border">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 flex-1">
                  <Skeleton className="w-3 h-3 rounded-full" />
                  <Skeleton className="w-32 h-4" />
                </div>
                <Skeleton className="w-16 h-5" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Image skeleton */}
              <div>
                <Skeleton className="w-12 h-3 mb-1" />
                <Skeleton className="w-full h-4" />
              </div>
              {/* Ports skeleton */}
              <div>
                <Skeleton className="w-10 h-3 mb-1" />
                <div className="flex gap-1">
                  <Skeleton className="w-16 h-5" />
                  <Skeleton className="w-16 h-5" />
                </div>
              </div>
              {/* Networks skeleton */}
              <div className="flex items-center gap-2">
                <Skeleton className="w-3 h-3" />
                <Skeleton className="w-24 h-3" />
              </div>
              {/* Security indicators skeleton */}
              <div className="flex gap-1 pt-2 border-t border-border">
                <Skeleton className="w-16 h-5" />
                <Skeleton className="w-20 h-5" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (containers.length === 0) {
    return (
      <div className="text-center py-12">
        <Container className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">No Containers Found</h3>
        <p className="text-sm text-muted-foreground">
          Start some Docker containers to see them here
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {containers.map((container) => (
        <ContainerCard key={container.id} container={container} />
      ))}
    </div>
  );
}

interface ContainerCardProps {
  container: ContainerInfo;
}

function ContainerCard({ container }: ContainerCardProps) {
  const isRunning = container.status.toLowerCase().includes('up') ||
                    container.status.toLowerCase().includes('running');

  const statusState = isRunning ? 'running' : 'stopped';
  const statusConfig = status[statusState];

  return (
    <Card className={`${statusConfig.border} border-l-4 cursor-pointer`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <StatusDot state={statusState} size="sm" />
            <CardTitle className="text-sm truncate">{container.name}</CardTitle>
          </div>
          <Badge variant={isRunning ? 'default' : 'secondary'} className="shrink-0 text-xs">
            {isRunning ? 'Running' : 'Stopped'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Image */}
        <div>
          <span className="text-xs text-muted-foreground">Image</span>
          <p className="text-sm text-foreground truncate font-mono" title={container.image}>
            {container.image}
          </p>
        </div>

        {/* Ports */}
        {container.ports.length > 0 && (
          <div>
            <span className="text-xs text-muted-foreground">Ports</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {container.ports.slice(0, 3).map((port, idx) => (
                <Badge key={idx} variant="outline" className="text-xs font-mono">
                  {port.hostPort ? `${port.hostPort}:` : ''}{port.containerPort}/{port.protocol}
                </Badge>
              ))}
              {container.ports.length > 3 && (
                <Badge variant="ghost" className="text-xs">
                  +{container.ports.length - 3} more
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Networks */}
        {container.networks.length > 0 && (
          <div className="flex items-center gap-2 text-xs">
            <Network className="w-3 h-3 text-muted-foreground" />
            <span className="text-muted-foreground truncate font-mono">
              {container.networks.join(', ')}
            </span>
          </div>
        )}

        {/* Security Indicators */}
        <div className="flex flex-wrap gap-1 pt-2 border-t border-border">
          {container.privileged && (
            <Badge variant="destructive" className="text-xs">
              Privileged
            </Badge>
          )}
          {container.user === 'root' && (
            <Badge variant="outline" className="text-xs text-orange-400 border-orange-500/30">
              Root User
            </Badge>
          )}
          {!container.readOnlyRootfs && (
            <Badge variant="ghost" className="text-xs text-muted-foreground">
              RW Filesystem
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

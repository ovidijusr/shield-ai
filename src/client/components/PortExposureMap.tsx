/**
 * Port Exposure Map Component
 *
 * Visual dashboard showing network exposure status with traffic light colors.
 * Helps users quickly identify which services are exposed and their risk levels.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Database,
  Globe,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import type { ContainerInfo } from '../../shared/types';

interface PortExposureMapProps {
  containers: ContainerInfo[];
}

interface ExposedPort {
  containerName: string;
  port: number;
  hostPort: number;
  protocol: string;
  boundTo: string;
  isPublic: boolean;
  riskLevel: 'critical' | 'high' | 'medium' | 'low' | 'safe';
  serviceName?: string;
}

export function PortExposureMap({ containers }: PortExposureMapProps) {
  // Analyze all containers and their port exposure
  const exposedPorts: ExposedPort[] = [];
  const safeContainers: string[] = [];

  for (const container of containers) {
    if (container.ports.length === 0) {
      safeContainers.push(container.name);
      continue;
    }

    let hasExposedPorts = false;

    for (const port of container.ports) {
      if (port.hostPort) {
        const isPublic = port.hostIp === '0.0.0.0' || port.hostIp === '::' || port.hostIp === '';
        const isSafe = port.hostIp === '127.0.0.1' || port.hostIp === '::1';

        if (isPublic) {
          hasExposedPorts = true;

          // Determine risk level based on service type (simplified heuristics)
          let riskLevel: ExposedPort['riskLevel'] = 'medium';
          const image = container.image.toLowerCase();

          // Databases = CRITICAL
          if (
            image.includes('postgres') ||
            image.includes('mysql') ||
            image.includes('mongo') ||
            image.includes('redis') ||
            image.includes('mariadb')
          ) {
            riskLevel = 'critical';
          }
          // Management UIs = CRITICAL
          else if (
            image.includes('portainer') ||
            image.includes('phpmyadmin') ||
            image.includes('adminer') ||
            image.includes('grafana')
          ) {
            riskLevel = 'critical';
          }
          // APIs = HIGH
          else if (
            image.includes('api') ||
            image.includes('node') ||
            image.includes('python') ||
            image.includes('golang')
          ) {
            riskLevel = 'high';
          }

          exposedPorts.push({
            containerName: container.name,
            port: port.containerPort,
            hostPort: port.hostPort,
            protocol: port.protocol,
            boundTo: port.hostIp,
            isPublic,
            riskLevel,
          });
        } else if (isSafe) {
          // Properly bound to localhost
          continue;
        } else {
          // Bound to specific IP (LAN)
          exposedPorts.push({
            containerName: container.name,
            port: port.containerPort,
            hostPort: port.hostPort,
            protocol: port.protocol,
            boundTo: port.hostIp,
            isPublic: false,
            riskLevel: 'low',
          });
        }
      }
    }

    if (!hasExposedPorts && container.ports.length > 0) {
      safeContainers.push(container.name);
    }
  }

  // Group by risk level
  const criticalPorts = exposedPorts.filter((p) => p.riskLevel === 'critical');
  const highRiskPorts = exposedPorts.filter((p) => p.riskLevel === 'high');
  const mediumRiskPorts = exposedPorts.filter((p) => p.riskLevel === 'medium');
  const lowRiskPorts = exposedPorts.filter((p) => p.riskLevel === 'low');

  const getRiskIcon = (level: string) => {
    switch (level) {
      case 'critical':
        return <ShieldAlert className="w-4 h-4 text-red-500" />;
      case 'high':
        return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      case 'medium':
        return <Globe className="w-4 h-4 text-yellow-500" />;
      case 'low':
        return <Shield className="w-4 h-4 text-blue-500" />;
      case 'safe':
        return <ShieldCheck className="w-4 h-4 text-green-500" />;
      default:
        return <Server className="w-4 h-4" />;
    }
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'critical':
        return 'bg-red-500/10 border-red-500/30 text-red-400';
      case 'high':
        return 'bg-orange-500/10 border-orange-500/30 text-orange-400';
      case 'medium':
        return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400';
      case 'low':
        return 'bg-blue-500/10 border-blue-500/30 text-blue-400';
      case 'safe':
        return 'bg-green-500/10 border-green-500/30 text-green-400';
      default:
        return 'bg-muted border-border text-muted-foreground';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="w-5 h-5" />
          Network Exposure
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-2">
          <div className={`p-3 rounded-lg border ${getRiskColor('critical')}`}>
            <div className="flex items-center gap-2 mb-1">
              {getRiskIcon('critical')}
              <span className="text-xs font-medium">Critical</span>
            </div>
            <p className="text-2xl font-bold">{criticalPorts.length}</p>
          </div>

          <div className={`p-3 rounded-lg border ${getRiskColor('high')}`}>
            <div className="flex items-center gap-2 mb-1">
              {getRiskIcon('high')}
              <span className="text-xs font-medium">High</span>
            </div>
            <p className="text-2xl font-bold">{highRiskPorts.length}</p>
          </div>

          <div className={`p-3 rounded-lg border ${getRiskColor('medium')}`}>
            <div className="flex items-center gap-2 mb-1">
              {getRiskIcon('medium')}
              <span className="text-xs font-medium">Medium</span>
            </div>
            <p className="text-2xl font-bold">{mediumRiskPorts.length}</p>
          </div>

          <div className={`p-3 rounded-lg border ${getRiskColor('safe')}`}>
            <div className="flex items-center gap-2 mb-1">
              {getRiskIcon('safe')}
              <span className="text-xs font-medium">Protected</span>
            </div>
            <p className="text-2xl font-bold">{safeContainers.length}</p>
          </div>
        </div>

        {/* Exposed Ports List */}
        {exposedPorts.length > 0 ? (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground mb-2">
              Exposed Services
            </h4>

            {/* Critical (show first) */}
            {criticalPorts.map((port, idx) => (
              <PortRow key={idx} port={port} />
            ))}

            {/* High Risk */}
            {highRiskPorts.map((port, idx) => (
              <PortRow key={idx} port={port} />
            ))}

            {/* Medium Risk */}
            {mediumRiskPorts.map((port, idx) => (
              <PortRow key={idx} port={port} />
            ))}

            {/* Low Risk (LAN) */}
            {lowRiskPorts.map((port, idx) => (
              <PortRow key={idx} port={port} />
            ))}
          </div>
        ) : (
          <div className="text-center py-6 bg-green-500/10 border border-green-500/20 rounded-lg">
            <Lock className="w-8 h-8 text-green-500 mx-auto mb-2" />
            <p className="text-sm font-medium text-green-400">All Ports Protected</p>
            <p className="text-xs text-muted-foreground mt-1">
              No services are exposed to the public internet
            </p>
          </div>
        )}

        {/* Safe Containers */}
        {safeContainers.length > 0 && (
          <div className="pt-4 border-t border-border">
            <h4 className="text-sm font-medium text-muted-foreground mb-2">
              Protected Containers
            </h4>
            <div className="flex flex-wrap gap-2">
              {safeContainers.slice(0, 6).map((name) => (
                <Badge key={name} variant="outline" className="text-green-400 border-green-500/50">
                  <ShieldCheck className="w-3 h-3 mr-1" />
                  {name}
                </Badge>
              ))}
              {safeContainers.length > 6 && (
                <Badge variant="ghost" className="text-xs">
                  +{safeContainers.length - 6} more
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Individual port row with traffic light indicator
 */
function PortRow({ port }: { port: ExposedPort }) {
  const getRiskIcon = (level: string) => {
    switch (level) {
      case 'critical':
        return <Database className="w-4 h-4 text-red-500" />;
      case 'high':
        return <AlertTriangle className="w-4 h-4 text-orange-500" />;
      case 'medium':
        return <Globe className="w-4 h-4 text-yellow-500" />;
      case 'low':
        return <Shield className="w-4 h-4 text-blue-500" />;
      default:
        return <Server className="w-4 h-4" />;
    }
  };

  const getRiskBg = (level: string) => {
    switch (level) {
      case 'critical':
        return 'bg-red-500/10 border-red-500/30';
      case 'high':
        return 'bg-orange-500/10 border-orange-500/30';
      case 'medium':
        return 'bg-yellow-500/10 border-yellow-500/30';
      case 'low':
        return 'bg-blue-500/10 border-blue-500/30';
      default:
        return 'bg-muted border-border';
    }
  };

  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg border ${getRiskBg(port.riskLevel)}`}>
      {/* Traffic light indicator */}
      <div className="shrink-0">{getRiskIcon(port.riskLevel)}</div>

      {/* Port info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium truncate">{port.containerName}</span>
          <Badge variant="ghost" className="text-xs shrink-0">
            {port.boundTo}:{port.hostPort}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {port.isPublic ? (
            <span className="text-red-400">Exposed to internet (0.0.0.0)</span>
          ) : (
            <span className="text-blue-400">LAN only ({port.boundTo})</span>
          )}
        </p>
      </div>

      {/* Risk level badge */}
      <Badge
        variant={port.riskLevel === 'critical' ? 'destructive' : 'secondary'}
        className="shrink-0 text-xs"
      >
        {port.riskLevel}
      </Badge>
    </div>
  );
}

/**
 * UFW Bypass Alert Component
 *
 * Dramatic, attention-grabbing alert for the critical UFW bypass finding.
 * This is the #1 killer feature - most users don't know Docker bypasses UFW.
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  Shield,
  ShieldAlert,
  Copy,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type { Finding } from '../../shared/types';

interface UfwBypassAlertProps {
  finding: Finding;
  onFix?: (findingId: string) => void;
}

export function UfwBypassAlert({ finding, onFix }: UfwBypassAlertProps) {
  const [showDetails, setShowDetails] = useState(true); // Expanded by default
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);

  // Extract exposed ports from the risk message
  const exposedPortsMatch = finding.risk.match(/Exposed ports: (.+)/);
  const exposedPorts = exposedPortsMatch ? exposedPortsMatch[1] : 'See details below';

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCommand(label);
    setTimeout(() => setCopiedCommand(null), 2000);
  };

  // Fix commands as individual steps
  const fixCommands = finding.fix?.commands || [];

  return (
    <Card className="border-2 border-red-500/50 bg-gradient-to-br from-red-950/30 via-orange-950/20 to-red-950/30 shadow-xl">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-4">
          {/* Large warning icon with pulse animation */}
          <div className="shrink-0">
            <div className="relative">
              <div className="absolute inset-0 bg-red-500/20 rounded-full animate-ping" />
              <div className="relative bg-red-500/10 p-3 rounded-full border-2 border-red-500">
                <ShieldAlert className="w-8 h-8 text-red-500" />
              </div>
            </div>
          </div>

          {/* Title and severity */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Badge className="bg-red-500 text-white border-red-600">
                CRITICAL
              </Badge>
              <Badge variant="outline" className="text-red-400 border-red-500/50">
                System-Wide
              </Badge>
              <Badge variant="ghost" className="text-xs">
                {finding.category}
              </Badge>
            </div>
            <CardTitle className="text-xl text-red-400 mb-2">
              ⚠️ Your Firewall Isn't Working
            </CardTitle>
            <p className="text-base text-foreground/90 font-medium">
              {finding.title}
            </p>
          </div>

          {/* Fix button */}
          {finding.fix && onFix && (
            <Button
              size="lg"
              onClick={() => onFix(finding.id)}
              className="shrink-0 bg-orange-600 hover:bg-orange-700"
            >
              <Shield className="w-4 h-4 mr-2" />
              Show Fix
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Key message */}
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <p className="text-sm text-foreground/90">
            Docker is manipulating <code className="text-red-400 bg-red-950/50 px-1 py-0.5 rounded">iptables</code> directly,
            bypassing your UFW firewall configuration. Even though UFW shows as{' '}
            <span className="text-green-400 font-semibold">"active"</span>, Docker containers with published ports are still
            accessible from the network.
          </p>
        </div>

        {/* Affected ports */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-medium">Exposed Ports</span>
          </div>
          <div className="ml-6 bg-background/50 rounded-lg p-3 border border-border">
            <p className="text-sm font-mono text-muted-foreground">
              {exposedPorts}
            </p>
          </div>
        </div>

        {/* Risk explanation */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-medium">What This Means</span>
          </div>
          <p className="text-sm text-muted-foreground ml-6">
            {finding.risk}
          </p>
        </div>

        {/* Expandable fix section */}
        <div className="border-t border-border pt-4">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-2 text-sm font-medium hover:text-foreground/80 mb-3"
          >
            {showDetails ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
            {showDetails ? 'Hide' : 'Show'} Fix Commands
          </button>

          {showDetails && finding.fix && (
            <div className="space-y-4 ml-6">
              {/* Fix description */}
              <p className="text-sm text-muted-foreground">
                {finding.fix.description}
              </p>

              {/* Command blocks */}
              <div className="space-y-2">
                {fixCommands.map((cmd, idx) => {
                  // Skip empty lines and comments for the copy button
                  const commandLabel = `Command ${Math.floor(idx / 3) + 1}`;

                  if (!cmd.trim()) {
                    return <div key={idx} className="h-2" />;
                  }

                  if (cmd.trim().startsWith('#')) {
                    return (
                      <p key={idx} className="text-xs text-muted-foreground">
                        {cmd}
                      </p>
                    );
                  }

                  return (
                    <div key={idx} className="flex items-center gap-2 group">
                      <code className="flex-1 bg-background/80 border border-border rounded px-3 py-2 text-xs font-mono">
                        {cmd}
                      </code>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(cmd, commandLabel)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        {copiedCommand === commandLabel ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>

              {/* Side effects warning */}
              {finding.fix.sideEffects && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                  <p className="text-xs text-amber-300">
                    <strong>⚠️ Important:</strong> {finding.fix.sideEffects}
                  </p>
                </div>
              )}

              {/* Restart notice */}
              {finding.fix.requiresRestart && (
                <p className="text-xs text-muted-foreground">
                  Note: Container restart required after applying fix
                </p>
              )}
            </div>
          )}
        </div>

        {/* Learn more link */}
        <div className="text-xs text-muted-foreground pt-2 border-t border-border">
          <a
            href="https://github.com/docker/for-linux/issues/690"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300 underline"
          >
            Learn more about Docker and UFW →
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

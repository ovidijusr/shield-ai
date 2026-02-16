/**
 * ShieldAI Main Application Component
 *
 * Main layout with header, tabs, and content areas for Dashboard, Findings, and Chat.
 * "Perimeter" design: green-tinted dark, solid colors, no transitions.
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dashboard } from './components/Dashboard';
import { FindingsList } from './components/FindingsList';
import { AuditCommandCenter } from './components/AuditCommandCenter';
import { ScanVisualization } from './components/ScanVisualization';
import { GoodPractices } from './components/GoodPractices';
import { ContainerGrid } from './components/ContainerGrid';
import { FixPreview } from './components/FixPreview';
import { ChatPanel } from './components/ChatPanel';
import { DotGrid } from './components/design/DotGrid';
import { WarningBanner } from './components/design/WarningBanner';
import { useAudit } from './hooks/useAudit';
import { useContainers } from './hooks/useContainers';
import { Shield, PlayCircle, AlertTriangle, MessageSquare, Container as ContainerIcon } from 'lucide-react';

function App() {
  // Get initial tab from URL hash or default to 'dashboard'
  const getInitialTab = () => {
    const hash = window.location.hash.slice(1); // Remove '#'
    const validTabs = ['dashboard', 'findings', 'containers', 'chat'];
    return validTabs.includes(hash) ? hash : 'dashboard';
  };

  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [fixDialogOpen, setFixDialogOpen] = useState(false);
  const [selectedFindingId, setSelectedFindingId] = useState<string>('');
  const { runAudit, isLoading, data, error } = useAudit();
  const { data: containers = [], isLoading: containersLoading } = useContainers();

  // Update URL hash when tab changes
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    window.location.hash = tab;
  };

  // Listen for hash changes (browser back/forward)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1);
      const validTabs = ['dashboard', 'findings', 'containers', 'chat'];
      if (validTabs.includes(hash)) {
        setActiveTab(hash);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleRunAudit = () => {
    runAudit();
  };

  const handleFix = (findingId: string) => {
    setSelectedFindingId(findingId);
    setFixDialogOpen(true);
  };

  const handleFixSuccess = () => {
    // Re-run audit after fix, but only if not already running
    if (!isLoading) {
      runAudit();
    }
  };

  return (
    <DotGrid>
      <div className="min-h-screen bg-background text-foreground">
        {/* Header */}
        <header className="relative bg-black/50 backdrop-blur-md sticky top-0 z-50">
          <div className="absolute bottom-0 left-4 right-4 h-px bg-border rounded-full" />
          <div className="container mx-auto px-4 py-2">
            <div className="flex items-center justify-between gap-3">
              {/* Logo and Title */}
              <div className="flex items-center gap-4">
                <button
                  onClick={() => handleTabChange('dashboard')}
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer"
                >
                  <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
                    <Shield className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h1 className="text-lg font-bold text-emerald-400">
                      ShieldAI
                    </h1>
                    <p className="text-[10px] text-muted-foreground">Docker Security</p>
                  </div>
                </button>

                {/* Navigation Tabs */}
                <nav className="hidden lg:flex items-center gap-0.5">
                  <button
                    onClick={() => handleTabChange('dashboard')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-all cursor-pointer ${
                      activeTab === 'dashboard'
                        ? 'bg-accent text-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/50 hover:underline hover:decoration-emerald-500 hover:underline-offset-4'
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span>Dashboard</span>
                  </button>
                  <button
                    onClick={() => handleTabChange('findings')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-all cursor-pointer ${
                      activeTab === 'findings'
                        ? 'bg-accent text-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/50 hover:underline hover:decoration-emerald-500 hover:underline-offset-4'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Findings</span>
                    {data.findings.length > 0 && (
                      <Badge variant="destructive" className="ml-0.5 text-[10px] h-3.5 px-1">
                        {data.findings.length}
                      </Badge>
                    )}
                  </button>
                  <button
                    onClick={() => handleTabChange('containers')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-all cursor-pointer ${
                      activeTab === 'containers'
                        ? 'bg-accent text-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/50 hover:underline hover:decoration-emerald-500 hover:underline-offset-4'
                    }`}
                  >
                    <ContainerIcon className="w-3.5 h-3.5" />
                    <span>Containers</span>
                  </button>
                  <button
                    onClick={() => handleTabChange('chat')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-all cursor-pointer ${
                      activeTab === 'chat'
                        ? 'bg-accent text-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/50 hover:underline hover:decoration-emerald-500 hover:underline-offset-4'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Chat</span>
                  </button>
                </nav>
              </div>

              {/* Run Audit Button */}
              <Button
                onClick={handleRunAudit}
                disabled={isLoading}
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
              >
                {isLoading ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin mr-1.5" />
                    Running...
                  </>
                ) : (
                  <>
                    <PlayCircle className="w-3.5 h-3.5 mr-1.5" />
                    Run Audit
                  </>
                )}
              </Button>
            </div>
          </div>
        </header>

        {/* Warning Banner */}
        <WarningBanner />

        {/* Main Content */}
        <main className="container mx-auto px-4 py-4">
          {/* Error Display */}
          {error && (
            <Card className="mb-6 bg-red-500/10 border-red-500/50">
              <div className="p-4 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                <div>
                  <div className="font-medium text-red-400">Audit Failed</div>
                  <div className="text-sm text-red-300">{error.message}</div>
                </div>
              </div>
            </Card>
          )}

          {/* Scan Progress - Enhanced Command Center */}
          {isLoading && (
            <div className="mb-6 space-y-4">
              <AuditCommandCenter
                phase={data.phase}
                quickCheckCount={data.quickCheckCount}
                opusCheckCount={data.opusCheckCount}
                findingsCount={data.findings.length}
                containerCount={containers?.length || 0}
                networkCount={0}
                volumeCount={0}
              />
              <ScanVisualization
                phase={data.phase}
                findingsCount={data.findings.length}
              />
            </div>
          )}

          {/* Opus Analysis Skipped Notice */}
          {!isLoading && data.findings.length > 0 && data.score === null && (
            <Card className="mb-6 bg-blue-500/10 border-blue-500/50">
              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Shield className="w-4 h-4 text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-blue-400 mb-1">Quick Checks Completed</div>
                    <div className="text-sm text-blue-300/90">
                      Basic security checks found {data.findings.length} issue{data.findings.length !== 1 ? 's' : ''}.
                      Set <code className="px-1.5 py-0.5 bg-blue-500/20 rounded text-xs">ANTHROPIC_API_KEY</code> for
                      full AI security analysis with Claude Opus and comprehensive security scoring.
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Tab Content */}
          {activeTab === 'dashboard' && (
            <div>
              <Dashboard
                score={data.score}
                findingsCount={data.findings.length}
              />
            </div>
          )}

          {activeTab === 'findings' && (
            <div>
              <div className="space-y-6">
                <FindingsList
                  findings={data.findings}
                  onFix={handleFix}
                  isLoading={isLoading && data.phase !== 'done'}
                />

                {/* Good Practices Section */}
                {data.goodPractices && data.goodPractices.length > 0 && (
                  <div className="mt-8">
                    <GoodPractices practices={data.goodPractices} />
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'containers' && (
            <ContainerGrid containers={containers} isLoading={containersLoading} />
          )}

          {activeTab === 'chat' && (
            <ChatPanel />
          )}
        </main>

        {/* Footer */}
        <footer className="border-t border-border mt-12">
          <div className="container mx-auto px-4 py-6">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div>Powered by Claude Opus 4.6</div>
              <div className="flex items-center gap-4">
                <span>ShieldAI v1.0</span>
                <span>•</span>
                <span>Homelab Security</span>
              </div>
            </div>
          </div>
        </footer>

        {/* Fix Preview Dialog */}
        {selectedFindingId && (
          <FixPreview
            findingId={selectedFindingId}
            open={fixDialogOpen}
            onOpenChange={setFixDialogOpen}
            onSuccess={handleFixSuccess}
          />
        )}
      </div>
    </DotGrid>
  );
}

export default App;

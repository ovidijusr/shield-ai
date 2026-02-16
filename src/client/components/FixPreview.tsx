/**
 * FixPreview Component
 *
 * Shows diff preview of configuration changes before applying fix.
 */

import { useState } from 'react';
import { useFix } from '../hooks/useFix';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Loader2, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';

interface FixPreviewProps {
  findingId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function FixPreview({ findingId, open, onOpenChange, onSuccess }: FixPreviewProps) {
  const [showSuccess, setShowSuccess] = useState(false);

  const { preview, isLoadingPreview, isApplying, error, previewFix, applyFix, reset, result } = useFix(
    findingId,
    {
      onSuccess: () => {
        setShowSuccess(true);
        setTimeout(() => {
          onSuccess?.();
          onOpenChange(false);
          reset();
          setShowSuccess(false);
        }, 2000);
      },
    }
  );

  // Load preview when dialog opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && !preview && !isLoadingPreview) {
      previewFix(findingId);
    }
    if (!newOpen) {
      reset();
      setShowSuccess(false);
    }
    onOpenChange(newOpen);
  };

  const handleApply = () => {
    applyFix(findingId);
  };

  // Render diff lines
  const renderDiff = () => {
    if (!preview) return null;

    return (
      <div className="font-mono text-sm">
        {preview.diff.map((line, index) => {
          const lines = line.value.split('\n').filter((l) => l !== '');
          return lines.map((textLine, lineIndex) => (
            <div
              key={`${index}-${lineIndex}`}
              className={cn(
                'px-4 py-0.5 whitespace-pre',
                line.added && 'bg-green-500/10 text-green-600 dark:text-green-400',
                line.removed && 'bg-red-500/10 text-red-600 dark:text-red-400',
                !line.added && !line.removed && 'text-muted-foreground'
              )}
            >
              <span className="select-none mr-4 text-muted-foreground/50">
                {line.added && '+ '}
                {line.removed && '- '}
                {!line.added && !line.removed && '  '}
              </span>
              {textLine}
            </div>
          ));
        })}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Fix Preview</DialogTitle>
          <DialogDescription>
            Review the changes before applying the fix to your infrastructure.
          </DialogDescription>
        </DialogHeader>

        {/* Loading state */}
        {isLoadingPreview && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-3 text-muted-foreground">Loading preview...</span>
          </div>
        )}

        {/* Error state */}
        {error && (
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center text-destructive">
                <AlertCircle className="h-5 w-5 mr-2" />
                Error
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Success state */}
        {showSuccess && result?.success && (
          <Card className="border-green-500">
            <CardHeader>
              <CardTitle className="flex items-center text-green-600">
                <CheckCircle className="h-5 w-5 mr-2" />
                Fix Applied Successfully
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm">
                <strong>Backup created:</strong> {result.backupPath}
              </p>
              {result.containerRestarted && (
                <p className="text-sm">
                  <strong>Container restarted:</strong> {result.containerRestarted}
                </p>
              )}
              {result.appliedAt && (
                <p className="text-sm text-muted-foreground">
                  Applied at {new Date(result.appliedAt).toLocaleString()}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Preview content */}
        {preview && !showSuccess && (
          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            {/* File path */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">File to modify:</p>
                <code className="text-xs text-muted-foreground">{preview.composePath}</code>
              </div>
              <Badge variant="outline">compose_replace</Badge>
            </div>

            {/* Side effects warning */}
            {preview.sideEffects && (
              <Card className="border-yellow-500/50">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center text-sm text-yellow-600 dark:text-yellow-500">
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Side Effects
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{preview.sideEffects}</p>
                </CardContent>
              </Card>
            )}

            {/* Diff view */}
            <Card className="flex-1 overflow-hidden flex flex-col">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Changes</CardTitle>
                <CardDescription className="text-xs">
                  <span className="text-red-600 dark:text-red-400">Red</span> lines will be removed,{' '}
                  <span className="text-green-600 dark:text-green-400">green</span> lines will be added
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden p-0">
                <ScrollArea className="h-full w-full">
                  <div className="border rounded-md bg-muted/30">{renderDiff()}</div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isApplying}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={!preview || isApplying || showSuccess}>
            {isApplying && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isApplying ? 'Applying...' : 'Apply Fix'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

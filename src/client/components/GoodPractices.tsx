/**
 * GoodPractices Component
 *
 * Shows positive security practices the user is doing right.
 * "Perimeter" theme: no transitions, green highlights for positive feedback.
 */

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2 } from 'lucide-react';
import type { GoodPractice } from '../../shared/types';

interface GoodPracticesProps {
  practices: GoodPractice[];
}

export function GoodPractices({ practices }: GoodPracticesProps) {
  if (practices.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="w-5 h-5 text-green-500" />
        <h2 className="text-xl font-semibold text-foreground">
          Good Security Practices
        </h2>
        <Badge variant="secondary" className="ml-auto">
          {practices.length}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {practices.map((practice) => (
          <Card
            key={practice.id}
            className="border-l-4 border-green-500 bg-green-500/5"
          >
            <CardContent className="py-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-foreground text-sm">
                      {practice.title}
                    </h3>
                    <Badge variant="ghost" className="text-xs">
                      {practice.category}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {practice.description}
                  </p>
                  {practice.appliesTo.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {practice.appliesTo.map((target, idx) => (
                        <Badge
                          key={idx}
                          variant="outline"
                          className="text-xs text-green-400 border-green-500/30"
                        >
                          {target}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

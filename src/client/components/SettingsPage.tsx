/**
 * Settings Page Component
 *
 * Configuration interface for scheduled scans and notifications.
 * Provides tabs for Schedule and Notification channel management.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Bell,
  Calendar,
  Check,
  Loader2,
  MessageSquare,
  Mail,
  Globe,
  AlertCircle,
} from 'lucide-react';

interface ScheduleConfig {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'manual';
  time: string;
  dayOfWeek?: number;
  notifyOnNewFindings: boolean;
  notifyOnScoreDrop: boolean;
  minimumScoreDrop: number;
}

// NotificationChannel interface (not used in component yet, but defined for future use)
// interface NotificationChannel {
//   type: 'ntfy' | 'discord' | 'slack' | 'email' | 'webhook';
//   enabled: boolean;
//   config: any;
// }

export function SettingsPage() {
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Configure scheduled scans and notification channels
        </p>
      </div>

      <Tabs defaultValue="schedule" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="schedule">
            <Calendar className="w-4 h-4 mr-2" />
            Schedule
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="w-4 h-4 mr-2" />
            Notifications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="schedule">
          <ScheduleSettings />
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * Schedule Settings Tab
 */
function ScheduleSettings() {
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ['schedule-config'],
    queryFn: async () => {
      const response = await fetch('/api/schedule/config');
      if (!response.ok) throw new Error('Failed to fetch schedule config');
      return response.json() as Promise<ScheduleConfig>;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (newConfig: ScheduleConfig) => {
      const response = await fetch('/api/schedule/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig),
      });
      if (!response.ok) throw new Error('Failed to save schedule config');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-config'] });
    },
  });

  const [formData, setFormData] = useState<ScheduleConfig | null>(null);

  // Initialize form data when config loads
  if (config && !formData) {
    setFormData(config);
  }

  const handleSave = () => {
    if (formData) {
      saveMutation.mutate(formData);
    }
  };

  if (isLoading || !formData) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Automatic Scans</CardTitle>
        <CardDescription>
          Schedule regular security scans to detect configuration drift
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Enable scheduled scans</Label>
            <p className="text-sm text-muted-foreground">
              Automatically run security audits on a schedule
            </p>
          </div>
          <Switch
            checked={formData.enabled}
            onCheckedChange={(enabled: boolean) => setFormData({ ...formData, enabled })}
          />
        </div>

        {/* Frequency */}
        <div className="space-y-2">
          <Label>Frequency</Label>
          <Select
            value={formData.frequency}
            onValueChange={(frequency: string) =>
              setFormData({ ...formData, frequency: frequency as 'daily' | 'weekly' | 'manual' })
            }
            disabled={!formData.enabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="manual">Manual only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Time */}
        <div className="space-y-2">
          <Label>Time (24-hour format)</Label>
          <Input
            type="time"
            value={formData.time}
            onChange={(e) => setFormData({ ...formData, time: e.target.value })}
            disabled={!formData.enabled || formData.frequency === 'manual'}
          />
          <p className="text-xs text-muted-foreground">
            Scans run in UTC timezone
          </p>
        </div>

        {/* Day of week (if weekly) */}
        {formData.frequency === 'weekly' && (
          <div className="space-y-2">
            <Label>Day of week</Label>
            <Select
              value={formData.dayOfWeek?.toString() ?? '0'}
              onValueChange={(day: string) =>
                setFormData({ ...formData, dayOfWeek: parseInt(day) })
              }
              disabled={!formData.enabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Sunday</SelectItem>
                <SelectItem value="1">Monday</SelectItem>
                <SelectItem value="2">Tuesday</SelectItem>
                <SelectItem value="3">Wednesday</SelectItem>
                <SelectItem value="4">Thursday</SelectItem>
                <SelectItem value="5">Friday</SelectItem>
                <SelectItem value="6">Saturday</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Notification triggers */}
        <div className="border-t border-border pt-4 space-y-4">
          <h3 className="font-medium">Notification Triggers</h3>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Notify on new findings</Label>
              <p className="text-sm text-muted-foreground">
                Alert when new security issues are detected
              </p>
            </div>
            <Switch
              checked={formData.notifyOnNewFindings}
              onCheckedChange={(notifyOnNewFindings: boolean) =>
                setFormData({ ...formData, notifyOnNewFindings })
              }
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Notify on score drop</Label>
              <p className="text-sm text-muted-foreground">
                Alert when security score decreases significantly
              </p>
            </div>
            <Switch
              checked={formData.notifyOnScoreDrop}
              onCheckedChange={(notifyOnScoreDrop: boolean) =>
                setFormData({ ...formData, notifyOnScoreDrop })
              }
            />
          </div>

          {formData.notifyOnScoreDrop && (
            <div className="space-y-2">
              <Label>Minimum score drop to alert</Label>
              <Input
                type="number"
                min="1"
                max="100"
                value={formData.minimumScoreDrop}
                onChange={(e) =>
                  setFormData({ ...formData, minimumScoreDrop: parseInt(e.target.value) })
                }
              />
              <p className="text-xs text-muted-foreground">
                Only notify if score drops by this many points or more
              </p>
            </div>
          )}
        </div>

        {/* Save button */}
        <div className="flex gap-2">
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            className="min-w-[100px]"
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Save
              </>
            )}
          </Button>

          {saveMutation.isSuccess && (
            <div className="flex items-center text-sm text-green-500">
              <Check className="w-4 h-4 mr-1" />
              Saved successfully
            </div>
          )}

          {saveMutation.isError && (
            <div className="flex items-center text-sm text-red-500">
              <AlertCircle className="w-4 h-4 mr-1" />
              Failed to save
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Notification Settings Tab
 */
function NotificationSettings() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Notification Channels</CardTitle>
          <CardDescription>
            Configure where you want to receive security alerts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Ntfy */}
          <NotificationChannelCard
            icon={<Bell className="w-5 h-5" />}
            title="Ntfy"
            description="Self-hosted push notifications"
          />

          {/* Discord */}
          <NotificationChannelCard
            icon={<MessageSquare className="w-5 h-5" />}
            title="Discord"
            description="Send alerts to Discord channel"
          />

          {/* Slack */}
          <NotificationChannelCard
            icon={<MessageSquare className="w-5 h-5" />}
            title="Slack"
            description="Send alerts to Slack channel"
          />

          {/* Email */}
          <NotificationChannelCard
            icon={<Mail className="w-5 h-5" />}
            title="Email"
            description="SMTP email notifications"
          />

          {/* Webhook */}
          <NotificationChannelCard
            icon={<Globe className="w-5 h-5" />}
            title="Custom Webhook"
            description="POST to any URL"
          />
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * Individual notification channel card
 */
function NotificationChannelCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  const [enabled, setEnabled] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="text-muted-foreground">{icon}</div>
          <div>
            <h3 className="font-semibold">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={(checked: boolean) => {
            setEnabled(checked);
            setShowConfig(checked);
          }}
        />
      </div>

      {enabled && showConfig && (
        <div className="mt-4 space-y-3 border-t border-border pt-4">
          <p className="text-sm text-muted-foreground">
            ⚠️ Notification channel configuration UI coming soon.
            For now, configure channels via API.
          </p>

          <Button variant="outline" size="sm">
            Test Notification
          </Button>
        </div>
      )}
    </div>
  );
}

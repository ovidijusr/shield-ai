/**
 * Notification Service
 *
 * Multi-channel notification system supporting:
 * - Ntfy (self-hosted push notifications)
 * - Discord (webhooks)
 * - Slack (webhooks)
 * - Email (SMTP)
 * - Generic Webhooks
 */

import type { ScanComparison } from './scheduler.js';

// Configuration types for each notification channel
export interface NtfyConfig {
  server: string; // e.g., "https://ntfy.sh"
  topic: string;
  priority?: 'min' | 'low' | 'default' | 'high' | 'urgent';
  token?: string; // For authenticated ntfy servers
}

export interface DiscordConfig {
  webhookUrl: string;
}

export interface SlackConfig {
  webhookUrl: string;
}

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean; // true for 465, false for other ports
  from: string;
  to: string;
  username?: string;
  password?: string;
}

export interface WebhookConfig {
  url: string;
  method: 'POST' | 'PUT';
  headers?: Record<string, string>;
}

export interface NotificationChannel {
  type: 'ntfy' | 'discord' | 'slack' | 'email' | 'webhook';
  enabled: boolean;
  config: NtfyConfig | DiscordConfig | SlackConfig | EmailConfig | WebhookConfig;
}

export interface NotificationMessage {
  title: string;
  body: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  tags?: string[];
  link?: string; // Link back to ShieldAI dashboard
}

/**
 * Notification Service
 */
export class NotificationService {
  /**
   * Send notification to all enabled channels
   */
  async sendNotification(
    channels: NotificationChannel[],
    message: NotificationMessage
  ): Promise<void> {
    const enabledChannels = channels.filter((c) => c.enabled);

    if (enabledChannels.length === 0) {
      console.log('[Notifications] No enabled channels');
      return;
    }

    console.log(`[Notifications] Sending to ${enabledChannels.length} channel(s)`);

    // Send to all channels in parallel
    const promises = enabledChannels.map((channel) =>
      this.sendToChannel(channel, message).catch((error) => {
        console.error(`[Notifications] Failed to send to ${channel.type}:`, error);
        // Don't throw - we want to continue sending to other channels
      })
    );

    await Promise.all(promises);
  }

  /**
   * Send notification to a specific channel
   */
  private async sendToChannel(
    channel: NotificationChannel,
    message: NotificationMessage
  ): Promise<void> {
    switch (channel.type) {
      case 'ntfy':
        await this.sendToNtfy(channel.config as NtfyConfig, message);
        break;
      case 'discord':
        await this.sendToDiscord(channel.config as DiscordConfig, message);
        break;
      case 'slack':
        await this.sendToSlack(channel.config as SlackConfig, message);
        break;
      case 'email':
        await this.sendToEmail(channel.config as EmailConfig, message);
        break;
      case 'webhook':
        await this.sendToWebhook(channel.config as WebhookConfig, message);
        break;
      default:
        console.warn(`[Notifications] Unknown channel type: ${channel.type}`);
    }
  }

  /**
   * Send to Ntfy
   */
  private async sendToNtfy(config: NtfyConfig, message: NotificationMessage): Promise<void> {
    const url = `${config.server}/${config.topic}`;
    const headers: Record<string, string> = {
      'Title': message.title,
      'Priority': this.mapPriorityToNtfy(message.priority),
    };

    if (config.token) {
      headers['Authorization'] = `Bearer ${config.token}`;
    }

    if (message.tags && message.tags.length > 0) {
      headers['Tags'] = message.tags.join(',');
    }

    if (message.link) {
      headers['Click'] = message.link;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: message.body,
    });

    if (!response.ok) {
      throw new Error(`Ntfy request failed: ${response.status} ${response.statusText}`);
    }

    console.log('[Notifications] Sent to Ntfy');
  }

  /**
   * Send to Discord
   */
  private async sendToDiscord(config: DiscordConfig, message: NotificationMessage): Promise<void> {
    const color = this.getColorForPriority(message.priority);

    const embed: Record<string, any> = {
      title: message.title,
      description: message.body,
      color,
      timestamp: new Date().toISOString(),
      footer: {
        text: 'ShieldAI Security Monitor',
      },
    };

    if (message.link) {
      embed.url = message.link;
    }

    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        embeds: [embed],
      }),
    });

    if (!response.ok) {
      throw new Error(`Discord webhook failed: ${response.status} ${response.statusText}`);
    }

    console.log('[Notifications] Sent to Discord');
  }

  /**
   * Send to Slack
   */
  private async sendToSlack(config: SlackConfig, message: NotificationMessage): Promise<void> {
    const color = this.getSlackColorForPriority(message.priority);

    const attachment: Record<string, any> = {
      color,
      title: message.title,
      text: message.body,
      footer: 'ShieldAI Security Monitor',
      ts: Math.floor(Date.now() / 1000),
    };

    if (message.link) {
      attachment.title_link = message.link;
    }

    const response = await fetch(config.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        attachments: [attachment],
      }),
    });

    if (!response.ok) {
      throw new Error(`Slack webhook failed: ${response.status} ${response.statusText}`);
    }

    console.log('[Notifications] Sent to Slack');
  }

  /**
   * Send to Email (SMTP)
   * Note: Requires nodemailer which we'll add if needed
   */
  private async sendToEmail(config: EmailConfig, message: NotificationMessage): Promise<void> {
    // For now, log that email is not implemented
    // In a real implementation, we'd use nodemailer here
    console.log('[Notifications] Email notifications not yet implemented');
    console.log('[Notifications] Would send email:', {
      from: config.from,
      to: config.to,
      subject: message.title,
      text: message.body,
    });

    // TODO: Implement with nodemailer
    // const transporter = nodemailer.createTransport({...})
    // await transporter.sendMail({...})
  }

  /**
   * Send to generic webhook
   */
  private async sendToWebhook(config: WebhookConfig, message: NotificationMessage): Promise<void> {
    const headers = {
      'Content-Type': 'application/json',
      ...config.headers,
    };

    const response = await fetch(config.url, {
      method: config.method,
      headers,
      body: JSON.stringify({
        title: message.title,
        body: message.body,
        priority: message.priority,
        tags: message.tags,
        link: message.link,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      throw new Error(`Webhook request failed: ${response.status} ${response.statusText}`);
    }

    console.log('[Notifications] Sent to custom webhook');
  }

  /**
   * Test a notification channel
   */
  async testNotification(channel: NotificationChannel): Promise<boolean> {
    const testMessage: NotificationMessage = {
      title: '🧪 ShieldAI Test Notification',
      body: 'This is a test notification from ShieldAI. If you receive this, your notification channel is configured correctly!',
      priority: 'low',
      tags: ['test'],
    };

    try {
      await this.sendToChannel(channel, testMessage);
      return true;
    } catch (error) {
      console.error('[Notifications] Test failed:', error);
      return false;
    }
  }

  /**
   * Build notification message from scan comparison
   */
  buildNotificationFromComparison(comparison: ScanComparison): NotificationMessage {
    const { newFindings, resolvedFindings, scoreDelta, summary } = comparison;

    // Determine priority and content based on scan results
    if (newFindings.length > 0) {
      const criticalCount = newFindings.filter((f) => f.severity === 'critical').length;
      const highCount = newFindings.filter((f) => f.severity === 'high').length;

      const priority = criticalCount > 0 ? 'urgent' : highCount > 0 ? 'high' : 'medium';

      let body = `Detected ${newFindings.length} new security issue${newFindings.length > 1 ? 's' : ''}:\n\n`;

      if (criticalCount > 0) {
        body += `🔴 ${criticalCount} critical\n`;
      }
      if (highCount > 0) {
        body += `🟠 ${highCount} high\n`;
      }

      body += `\n${summary}`;

      return {
        title: '🚨 ShieldAI: New Security Issues Detected',
        body,
        priority,
        tags: ['security', 'alert'],
      };
    } else if (scoreDelta < -5) {
      return {
        title: '⚠️ ShieldAI: Security Score Dropped',
        body: `Your security score decreased by ${Math.abs(scoreDelta)} points.\n\n${summary}\n\nReview your recent infrastructure changes.`,
        priority: 'high',
        tags: ['security', 'warning'],
      };
    } else if (resolvedFindings.length > 0) {
      return {
        title: '✅ ShieldAI: Security Improvements Detected',
        body: `Great work! ${resolvedFindings.length} issue${resolvedFindings.length > 1 ? 's' : ''} resolved.\n\n${summary}`,
        priority: 'low',
        tags: ['security', 'success'],
      };
    } else {
      return {
        title: '✅ ShieldAI: All Clear',
        body: `Scheduled scan completed. No new issues detected.\n\n${summary}`,
        priority: 'low',
        tags: ['security', 'success'],
      };
    }
  }

  // Helper methods

  private mapPriorityToNtfy(priority: string): string {
    const map: Record<string, string> = {
      low: '2',
      medium: '3',
      high: '4',
      urgent: '5',
    };
    return map[priority] || '3';
  }

  private getColorForPriority(priority: string): number {
    // Discord embed colors (decimal)
    const colors: Record<string, number> = {
      low: 0x3b82f6, // Blue
      medium: 0xeab308, // Yellow
      high: 0xf97316, // Orange
      urgent: 0xef4444, // Red
    };
    return colors[priority] || colors.medium;
  }

  private getSlackColorForPriority(priority: string): string {
    const colors: Record<string, string> = {
      low: '#3b82f6', // Blue
      medium: '#eab308', // Yellow
      high: '#f97316', // Orange
      urgent: '#ef4444', // Red
    };
    return colors[priority] || colors.medium;
  }
}

// Export singleton instance
let notificationServiceInstance: NotificationService | null = null;

export function getNotificationService(): NotificationService {
  if (!notificationServiceInstance) {
    notificationServiceInstance = new NotificationService();
  }
  return notificationServiceInstance;
}

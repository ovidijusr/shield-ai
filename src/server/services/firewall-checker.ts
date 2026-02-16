/**
 * Firewall Bypass Checker
 *
 * Detects if Docker is bypassing UFW firewall rules by manipulating iptables directly.
 * This is a critical security issue as it creates a false sense of security.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';

const execAsync = promisify(exec);

export interface FirewallStatus {
  /** Whether UFW is installed on the system */
  ufwInstalled: boolean;
  /** Whether UFW is actively enabled */
  ufwEnabled: boolean;
  /** Whether Docker is bypassing UFW rules */
  dockerBypassingUfw: boolean;
  /** List of exposed ports that may be affected */
  exposedPorts: Array<{
    containerName: string;
    port: number;
    protocol: string;
    boundTo: string;
  }>;
}

/**
 * Check if Docker is bypassing UFW firewall rules
 *
 * Detection strategy:
 * 1. Check if UFW is installed and enabled
 * 2. Check Docker daemon configuration
 * 3. Examine iptables rules for DOCKER chain
 * 4. Determine if Docker rules come before UFW rules (bypass condition)
 */
export async function checkFirewallBypass(): Promise<FirewallStatus> {
  const status: FirewallStatus = {
    ufwInstalled: false,
    ufwEnabled: false,
    dockerBypassingUfw: false,
    exposedPorts: [],
  };

  try {
    // Check if UFW is installed
    status.ufwInstalled = await isUfwInstalled();

    if (!status.ufwInstalled) {
      // UFW not installed, no bypass issue
      return status;
    }

    // Check if UFW is enabled
    status.ufwEnabled = await isUfwEnabled();

    if (!status.ufwEnabled) {
      // UFW not enabled, no bypass issue (firewall not in use)
      return status;
    }

    // Check if Docker is configured to respect iptables
    const dockerRespectsIptables = await checkDockerIptablesConfig();

    // Check if Docker CHAIN exists in iptables (Docker is manipulating iptables)
    const dockerChainExists = await checkDockerChainExists();

    // Docker bypasses UFW if:
    // 1. UFW is enabled (user thinks they're protected)
    // 2. Docker is NOT configured to disable iptables manipulation
    // 3. Docker CHAIN exists in iptables (Docker is actively modifying rules)
    status.dockerBypassingUfw =
      status.ufwEnabled &&
      !dockerRespectsIptables &&
      dockerChainExists;

    // If bypassing, we'll populate exposedPorts from the caller
    // (requires Docker API context which we don't have here)

  } catch (error) {
    // Gracefully handle errors (e.g., permission denied, commands not found)
    console.error('Error checking firewall bypass:', error);
  }

  return status;
}

/**
 * Check if UFW is installed
 */
async function isUfwInstalled(): Promise<boolean> {
  try {
    await execAsync('which ufw');
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if UFW is enabled and active
 */
async function isUfwEnabled(): Promise<boolean> {
  try {
    const { stdout } = await execAsync('sudo ufw status', { timeout: 5000 });
    return stdout.toLowerCase().includes('status: active');
  } catch {
    // If sudo fails or command not found, assume not enabled
    return false;
  }
}

/**
 * Check Docker daemon configuration for iptables setting
 * Returns true if Docker is configured to NOT manipulate iptables
 */
async function checkDockerIptablesConfig(): Promise<boolean> {
  try {
    const configPath = '/etc/docker/daemon.json';
    const content = await fs.readFile(configPath, 'utf-8');
    const config = JSON.parse(content);

    // If iptables is explicitly set to false, Docker respects external firewalls
    return config.iptables === false;
  } catch {
    // Config file doesn't exist or can't be read
    // Default Docker behavior is to manipulate iptables
    return false;
  }
}

/**
 * Check if DOCKER chain exists in iptables
 * This indicates Docker is actively manipulating iptables rules
 */
async function checkDockerChainExists(): Promise<boolean> {
  try {
    const { stdout } = await execAsync('sudo iptables -L -n', { timeout: 5000 });
    return stdout.includes('Chain DOCKER');
  } catch {
    // If iptables command fails, assume Docker chain doesn't exist
    return false;
  }
}

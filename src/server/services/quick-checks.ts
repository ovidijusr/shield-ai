/**
 * Quick Security Checks
 *
 * Fast rule-based security checks that run before Opus analysis.
 * These checks catch common security misconfigurations instantly.
 */

import { randomBytes } from 'crypto';
import type { DockerInfraContext, Finding } from '@shared/types.js';
import { checkFirewallBypass } from './firewall-checker.js';
import {
  identifyService,
  generateServiceRiskDescription,
  generateServiceFixRecommendation,
} from './service-identifier.js';

/**
 * Run all quick security checks on the infrastructure
 */
export async function runQuickChecks(context: DockerInfraContext): Promise<Finding[]> {
  const findings: Finding[] = [];

  // Run async checks first
  findings.push(...(await checkUfwBypass(context)));

  // Run all synchronous checks
  findings.push(...checkRootUser(context));
  findings.push(...checkPrivilegedMode(context));
  findings.push(...checkEnvSecrets(context));
  findings.push(...checkDangerousMounts(context));
  findings.push(...checkHostNetwork(context));
  findings.push(...checkExposedPorts(context));
  findings.push(...checkLatestTag(context));
  findings.push(...checkNoResourceLimits(context));
  findings.push(...checkDefaultNetwork(context));
  findings.push(...checkNoHealthcheck(context));

  return findings;
}

/**
 * Check for containers running as root user
 * Risk: Root access inside container can lead to privilege escalation
 */
function checkRootUser(context: DockerInfraContext): Finding[] {
  const findings: Finding[] = [];

  for (const container of context.containers) {
    // Check if user is root or empty (defaults to root)
    if (!container.user || container.user === 'root' || container.user === '0') {
      findings.push({
        id: generateId(),
        severity: 'high',
        category: 'root_user',
        title: `Container running as root: ${container.name}`,
        container: container.name,
        description: `Container "${container.name}" is running as root user. This is a security risk as any process that breaks out of the container would have root privileges on the host.`,
        risk: `If an attacker exploits a vulnerability in this container, they would gain root-level access, potentially allowing them to escape the container and compromise the host system or other containers.`,
        fix: {
          description: 'Configure the container to run as a non-root user',
          type: 'compose_replace',
          composePath: findComposeFileForContainer(context, container.name),
          newFileContent: null, // Will be filled by fix engine
          commands: null,
          sideEffects:
            'Container may fail to start if it requires root privileges for initialization. Test thoroughly.',
          requiresRestart: true,
        },
        source: 'quick_check',
      });
    }
  }

  return findings;
}

/**
 * Check for containers with privileged mode enabled
 * Risk: Privileged containers have unrestricted access to host resources
 */
function checkPrivilegedMode(context: DockerInfraContext): Finding[] {
  const findings: Finding[] = [];

  for (const container of context.containers) {
    if (container.privileged) {
      findings.push({
        id: generateId(),
        severity: 'critical',
        category: 'privileged_mode',
        title: `Privileged mode enabled: ${container.name}`,
        container: container.name,
        description: `Container "${container.name}" is running in privileged mode, granting it full access to the host system including all devices and kernel capabilities.`,
        risk: `This effectively removes all container isolation. An attacker gaining access to this container can control the entire host system, access all data, and compromise all other containers.`,
        fix: {
          description:
            'Remove privileged flag and grant only specific capabilities needed',
          type: 'compose_replace',
          composePath: findComposeFileForContainer(context, container.name),
          newFileContent: null,
          commands: null,
          sideEffects:
            'Container may lose access to host resources. Identify required capabilities (e.g., NET_ADMIN, SYS_ADMIN) and grant only those.',
          requiresRestart: true,
        },
        source: 'quick_check',
      });
    }
  }

  return findings;
}

/**
 * Check for secrets in environment variables
 * Risk: Secrets exposed in env vars can leak through logs and process listings
 */
function checkEnvSecrets(context: DockerInfraContext): Finding[] {
  const findings: Finding[] = [];

  // Patterns that indicate secrets
  const secretPatterns = [
    /PASSWORD/i,
    /SECRET/i,
    /API[_-]?KEY/i,
    /TOKEN/i,
    /PRIVATE[_-]?KEY/i,
    /CREDENTIAL/i,
    /AUTH/i,
  ];

  for (const container of context.containers) {
    const suspiciousVars: string[] = [];

    for (const envVar of container.env) {
      const [key] = envVar.split('=');
      if (secretPatterns.some((pattern) => pattern.test(key))) {
        suspiciousVars.push(key);
      }
    }

    if (suspiciousVars.length > 0) {
      findings.push({
        id: generateId(),
        severity: 'high',
        category: 'env_secrets',
        title: `Potential secrets in environment: ${container.name}`,
        container: container.name,
        description: `Container "${container.name}" has environment variables that may contain secrets: ${suspiciousVars.join(', ')}. Environment variables are visible in Docker inspect, logs, and process listings.`,
        risk: `Secrets in environment variables can be exposed through container inspection, process listings, error messages, and logs. This could allow unauthorized access to sensitive systems or data.`,
        fix: {
          description: 'Use Docker secrets or mounted secret files instead',
          type: 'manual',
          composePath: findComposeFileForContainer(context, container.name),
          newFileContent: null,
          commands: null,
          sideEffects:
            'Application must be updated to read secrets from files instead of environment variables. Common paths: /run/secrets/<name>',
          requiresRestart: true,
        },
        source: 'quick_check',
      });
    }
  }

  return findings;
}

/**
 * Check for dangerous host mounts
 * Risk: Mounting sensitive host paths gives container access to critical system files
 */
function checkDangerousMounts(context: DockerInfraContext): Finding[] {
  const findings: Finding[] = [];

  // Dangerous paths to mount from host
  const dangerousPaths = [
    { path: '/', severity: 'critical' as const, desc: 'entire root filesystem' },
    { path: '/etc', severity: 'critical' as const, desc: 'system configuration' },
    {
      path: '/var/run/docker.sock',
      severity: 'critical' as const,
      desc: 'Docker daemon socket',
    },
    { path: '/proc', severity: 'high' as const, desc: 'process information' },
    { path: '/sys', severity: 'high' as const, desc: 'kernel/system information' },
    { path: '/boot', severity: 'high' as const, desc: 'boot files' },
    { path: '/dev', severity: 'high' as const, desc: 'device files' },
  ];

  for (const container of context.containers) {
    // Whitelist ShieldAI itself from Docker socket mount warnings
    // ShieldAI needs Docker socket access to inspect containers for security auditing
    const isShieldAI = container.name.toLowerCase().includes('shieldai');

    for (const mount of container.mounts) {
      for (const dangerous of dangerousPaths) {
        if (mount.source === dangerous.path || mount.source.startsWith(dangerous.path + '/')) {
          // Skip Docker socket warning for ShieldAI - it's expected and required for functionality
          if (isShieldAI && dangerous.path === '/var/run/docker.sock') {
            continue;
          }

          findings.push({
            id: generateId(),
            severity: dangerous.severity,
            category: 'dangerous_mount',
            title: `Dangerous mount in ${container.name}: ${dangerous.path}`,
            container: container.name,
            description: `Container "${container.name}" mounts ${dangerous.desc} from host (${mount.source} -> ${mount.destination}). This grants the container${mount.readOnly ? ' read-only' : ''} access to sensitive host resources.`,
            risk: `This mount ${mount.readOnly ? 'exposes sensitive host data' : 'allows the container to modify critical host files'}. ${dangerous.path === '/var/run/docker.sock' ? 'With Docker socket access, the container can control the Docker daemon, create privileged containers, and fully compromise the host.' : 'An attacker could use this to escalate privileges, steal data, or compromise the host system.'}`,
            fix: {
              description: `Remove ${dangerous.path} mount or use a more specific, restricted path`,
              type: 'compose_replace',
              composePath: findComposeFileForContainer(context, container.name),
              newFileContent: null,
              commands: null,
              sideEffects: `Container will lose access to ${dangerous.desc}. Ensure this access is not required for functionality.`,
              requiresRestart: true,
            },
            source: 'quick_check',
          });
        }
      }
    }
  }

  return findings;
}

/**
 * Check for containers using host networking
 * Risk: Host networking bypasses network isolation
 */
function checkHostNetwork(context: DockerInfraContext): Finding[] {
  const findings: Finding[] = [];

  for (const container of context.containers) {
    if (container.networkMode === 'host') {
      findings.push({
        id: generateId(),
        severity: 'high',
        category: 'host_network',
        title: `Host networking mode: ${container.name}`,
        container: container.name,
        description: `Container "${container.name}" uses host networking mode, sharing the host's network stack directly. This removes network isolation between container and host.`,
        risk: `With host networking, the container can bind to any port on the host, intercept network traffic, and access any network service on the host. This significantly increases the attack surface.`,
        fix: {
          description: 'Use bridge networking with explicit port mappings',
          type: 'compose_replace',
          composePath: findComposeFileForContainer(context, container.name),
          newFileContent: null,
          commands: null,
          sideEffects:
            'Container will use bridge networking. Update port mappings to expose only necessary ports.',
          requiresRestart: true,
        },
        source: 'quick_check',
      });
    }
  }

  return findings;
}

/**
 * Check for exposed ports to public internet
 * Risk: Unnecessary exposed ports increase attack surface
 */
/**
 * Check for ports exposed to all interfaces (0.0.0.0)
 * ENHANCED: Now includes service identification and context-aware risk assessment
 * Risk: Services exposed without proper protection
 */
function checkExposedPorts(context: DockerInfraContext): Finding[] {
  const findings: Finding[] = [];

  for (const container of context.containers) {
    const publicPorts = container.ports.filter(
      (p) => p.hostPort !== null && (p.hostIp === '0.0.0.0' || p.hostIp === '::')
    );

    // Create separate findings for each exposed port (service-specific)
    for (const port of publicPorts) {
      // Identify what service is running on this port
      const service = identifyService(container, port.containerPort);

      // Determine severity based on service category
      let severity: 'critical' | 'high' | 'medium' | 'low';
      if (service.category === 'database' || service.category === 'management') {
        severity = 'critical';
      } else if (service.category === 'api') {
        severity = 'high';
      } else {
        severity = 'medium';
      }

      // Generate service-specific descriptions
      const serviceRiskDescription = generateServiceRiskDescription(service);
      const serviceFixRecommendation = generateServiceFixRecommendation(
        service,
        port.hostIp
      );

      findings.push({
        id: generateId(),
        severity,
        category: 'exposed_ports',
        title: `${service.serviceName} exposed on all interfaces: ${container.name}`,
        container: container.name,
        description: `Container "${container.name}" is running ${service.serviceName} and has port ${port.hostPort} bound to 0.0.0.0 (all network interfaces). This means the service is accessible from any network interface, including the public internet if no firewall is in place. ${
          service.category === 'database'
            ? 'Databases should NEVER be directly exposed.'
            : service.category === 'management'
            ? 'Management interfaces are prime targets for attackers.'
            : ''
        }`,
        risk: serviceRiskDescription,
        fix: {
          description: serviceFixRecommendation,
          type: 'compose_replace',
          composePath: findComposeFileForContainer(context, container.name),
          newFileContent: null,
          commands: [
            '# Example: Bind to localhost only',
            `# ports:`,
            `#   - "127.0.0.1:${port.hostPort}:${port.containerPort}"`,
            '',
            '# Or bind to specific LAN IP',
            `# ports:`,
            `#   - "192.168.1.10:${port.hostPort}:${port.containerPort}"`,
          ],
          sideEffects:
            service.category === 'database' || service.category === 'management'
              ? 'Service will only be accessible from localhost. Use SSH tunneling (ssh -L) or VPN for remote access.'
              : 'Service will no longer be accessible from the public internet. Configure reverse proxy if internet access is needed.',
          requiresRestart: true,
        },
        source: 'quick_check',
      });
    }
  }

  return findings;
}

/**
 * Check for images using :latest tag
 * Risk: Latest tag makes deployments unpredictable and unreproducible
 */
function checkLatestTag(context: DockerInfraContext): Finding[] {
  const findings: Finding[] = [];

  for (const container of context.containers) {
    if (container.image.endsWith(':latest') || !container.image.includes(':')) {
      findings.push({
        id: generateId(),
        severity: 'low',
        category: 'latest_tag',
        title: `Using :latest tag: ${container.name}`,
        container: container.name,
        description: `Container "${container.name}" uses image "${container.image}" with :latest tag or no tag (defaults to latest). This makes deployments unpredictable.`,
        risk: `The :latest tag can point to different image versions over time. This makes it impossible to reproduce deployments, complicates rollbacks, and can introduce unexpected breaking changes or security vulnerabilities.`,
        fix: {
          description: 'Pin image to a specific version tag',
          type: 'compose_replace',
          composePath: findComposeFileForContainer(context, container.name),
          newFileContent: null,
          commands: null,
          sideEffects:
            'Image version will be locked. You must manually update the tag to get newer versions.',
          requiresRestart: true,
        },
        source: 'quick_check',
      });
    }
  }

  return findings;
}

/**
 * Check for containers without resource limits
 * Risk: Unlimited containers can cause resource exhaustion
 */
function checkNoResourceLimits(context: DockerInfraContext): Finding[] {
  const findings: Finding[] = [];

  for (const container of context.containers) {
    // Check if container is running (only care about resource limits for running containers)
    if (container.status !== 'running') {
      continue;
    }

    const noMemoryLimit = container.memoryLimit === 0;
    const noCpuLimit = container.cpuLimit === 0;

    if (noMemoryLimit || noCpuLimit) {
      const missing = [];
      if (noMemoryLimit) missing.push('memory');
      if (noCpuLimit) missing.push('CPU');

      findings.push({
        id: generateId(),
        severity: 'medium',
        category: 'no_resource_limits',
        title: `Missing resource limits: ${container.name}`,
        container: container.name,
        description: `Container "${container.name}" has no ${missing.join(' or ')} limits configured. It can consume unlimited host resources.`,
        risk: `Without resource limits, a buggy or compromised container can consume all available ${missing.join(' and ')}, causing denial of service for other containers and the host system.`,
        fix: {
          description: `Set appropriate ${missing.join(' and ')} limits`,
          type: 'compose_replace',
          composePath: findComposeFileForContainer(context, container.name),
          newFileContent: null,
          commands: null,
          sideEffects: `Container will be constrained to specified ${missing.join(' and ')} limits. Monitor resource usage to set appropriate values.`,
          requiresRestart: true,
        },
        source: 'quick_check',
      });
    }
  }

  return findings;
}

/**
 * Check for containers using default bridge network
 * Risk: Default bridge network has weaker isolation and no service discovery
 */
function checkDefaultNetwork(context: DockerInfraContext): Finding[] {
  const findings: Finding[] = [];

  for (const container of context.containers) {
    // Check if using default bridge
    if (
      container.networkMode === 'bridge' &&
      container.networks.length === 1 &&
      container.networks[0] === 'bridge'
    ) {
      findings.push({
        id: generateId(),
        severity: 'low',
        category: 'default_network',
        title: `Using default bridge network: ${container.name}`,
        container: container.name,
        description: `Container "${container.name}" uses the default bridge network. Default bridge lacks user-defined network features like automatic DNS resolution and better isolation.`,
        risk: `Containers on default bridge must use IP addresses or --link (deprecated) for communication. This makes setup fragile and reduces isolation between unrelated containers.`,
        fix: {
          description: 'Create and use a custom bridge network',
          type: 'compose_replace',
          composePath: findComposeFileForContainer(context, container.name),
          newFileContent: null,
          commands: null,
          sideEffects:
            'Container will join custom network. Update other containers that need to communicate with it.',
          requiresRestart: true,
        },
        source: 'quick_check',
      });
    }
  }

  return findings;
}

/**
 * Check for containers without healthchecks
 * Risk: Without healthchecks, failed containers may stay running
 */
function checkNoHealthcheck(context: DockerInfraContext): Finding[] {
  const findings: Finding[] = [];

  for (const container of context.containers) {
    // Only check running containers
    if (container.status !== 'running') {
      continue;
    }

    if (!container.healthcheck) {
      findings.push({
        id: generateId(),
        severity: 'low',
        category: 'no_healthcheck',
        title: `Missing healthcheck: ${container.name}`,
        container: container.name,
        description: `Container "${container.name}" has no healthcheck configured. Docker cannot automatically detect if the service inside is healthy or failing.`,
        risk: `Without healthcheck, a container may appear running but have a crashed or unresponsive service inside. This can lead to silent failures and degraded user experience.`,
        fix: {
          description: 'Add healthcheck configuration',
          type: 'compose_replace',
          composePath: findComposeFileForContainer(context, container.name),
          newFileContent: null,
          commands: null,
          sideEffects:
            'Container will be monitored for health. Orchestrators can restart unhealthy containers.',
          requiresRestart: true,
        },
        source: 'quick_check',
      });
    }
  }

  return findings;
}

/**
 * Check if Docker is bypassing UFW firewall rules
 * Risk: Users believe UFW is protecting them, but Docker manipulates iptables directly
 */
async function checkUfwBypass(context: DockerInfraContext): Promise<Finding[]> {
  const findings: Finding[] = [];

  try {
    // Check firewall status
    const firewallStatus = await checkFirewallBypass();

    // Only create finding if UFW is enabled but being bypassed
    if (firewallStatus.dockerBypassingUfw) {
      // Collect all exposed ports from containers
      const exposedPorts: Array<{ containerName: string; port: number; protocol: string; boundTo: string }> = [];

      for (const container of context.containers) {
        for (const port of container.ports) {
          if (port.hostPort && port.hostIp) {
            exposedPorts.push({
              containerName: container.name,
              port: port.hostPort,
              protocol: port.protocol,
              boundTo: port.hostIp,
            });
          }
        }
      }

      const portsList = exposedPorts.length > 0
        ? exposedPorts
            .map((p) => `${p.containerName}: ${p.boundTo}:${p.port}/${p.protocol}`)
            .join(', ')
        : 'No ports currently exposed';

      findings.push({
        id: generateId(),
        severity: 'critical',
        category: 'firewall',
        title: 'Docker is bypassing UFW firewall rules',
        container: null, // System-wide issue
        description: `Docker is manipulating iptables directly, bypassing your UFW firewall configuration. Even though UFW is enabled and active, Docker creates its own iptables rules that take precedence. This means containers with published ports are exposed to the network (and potentially the internet) regardless of your UFW rules. Most Ubuntu/Debian users are unaware of this behavior, creating a false sense of security.`,
        risk: `Your firewall is effectively not protecting Docker containers. Any published container ports are accessible from the network despite UFW rules blocking them. If you have containers exposed on 0.0.0.0 (the default), they may be accessible from the internet. Exposed ports: ${portsList}`,
        fix: {
          description: 'Configure Docker to respect UFW rules using DOCKER-USER chain',
          type: 'manual',
          composePath: null,
          newFileContent: null,
          commands: [
            '# Stop Docker service',
            'sudo systemctl stop docker',
            '',
            '# Configure Docker to not manipulate iptables (Option 1)',
            'sudo sh -c \'echo "{\\"iptables\\": false}" > /etc/docker/daemon.json\'',
            'sudo systemctl start docker',
            '',
            '# OR configure UFW to work with Docker using DOCKER-USER chain (Option 2)',
            '# Add this rule to allow UFW to filter Docker traffic:',
            'sudo iptables -I DOCKER-USER -j RETURN',
            'sudo iptables -I DOCKER-USER -i eth0 ! -s 192.168.0.0/16 -j DROP',
            '',
            '# Make UFW rules persistent',
            'sudo ufw reload',
          ],
          sideEffects:
            'Option 1: Docker networking may be affected; containers may not be able to communicate. Option 2: More complex but preserves Docker networking. Test thoroughly after applying.',
          requiresRestart: true,
        },
        source: 'quick_check',
      });
    }
  } catch (error) {
    // Silently fail if we can't check firewall status
    console.error('Failed to check UFW bypass:', error);
  }

  return findings;
}

/**
 * Find compose file that likely defines this container
 */
function findComposeFileForContainer(
  context: DockerInfraContext,
  containerName: string
): string | null {
  // Try to find compose file with matching service name
  for (const composeFile of context.composeFiles) {
    // Check if service name matches container name
    // Container names often have project prefix: project_service_1
    for (const serviceName of composeFile.services) {
      if (
        containerName.includes(serviceName) ||
        containerName === serviceName ||
        containerName.endsWith(`_${serviceName}_1`)
      ) {
        return composeFile.path;
      }
    }
  }

  return null;
}

/**
 * Generate a random finding ID
 */
function generateId(): string {
  return randomBytes(8).toString('hex');
}

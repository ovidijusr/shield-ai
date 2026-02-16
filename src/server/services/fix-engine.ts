/**
 * Fix Engine
 *
 * Applies security fixes to Docker configurations.
 * Handles diff generation, backup creation, and container restarts.
 */

import type {
  Finding,
  DiffPreview,
  FixResult,
  ContainerInfo,
  DiffLine,
} from '@shared/types.js';
import Docker from 'dockerode';
import { promises as fs } from 'fs';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { createTwoFilesPatch } from 'diff';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';

// Initialize Docker client
const docker = new Docker();

// Initialize Anthropic client for compose generation
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Preview a fix before applying it
 * Reads the current compose file, applies fix, generates diff and identifies side effects
 */
export async function previewFix(finding: Finding): Promise<DiffPreview> {
  if (finding.fix.type !== 'compose_replace') {
    throw new Error(
      'Only compose_replace fixes support preview. Use docker_command or manual fixes directly.'
    );
  }

  if (!finding.fix.composePath) {
    throw new Error('Fix does not specify a compose file path');
  }

  if (!finding.fix.newFileContent) {
    throw new Error('Fix does not contain new file content');
  }

  try {
    // Read current compose file
    let currentContent: string;
    let composePath = finding.fix.composePath;

    try {
      currentContent = await fs.readFile(composePath, 'utf-8');
    } catch (error) {
      // Compose file doesn't exist - might be a no-compose scenario
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // Try to generate compose from container inspect
        if (finding.container) {
          console.log(
            `Compose file not found at ${composePath}, generating from container ${finding.container}`
          );
          currentContent = await generateComposeFromContainer(finding.container);
          // Update the compose path to generated location
          composePath = `/configs/generated/${finding.container}-generated.yml`;
          await fs.mkdir(path.dirname(composePath), { recursive: true });
          await fs.writeFile(composePath, currentContent, 'utf-8');
        } else {
          throw new Error('Compose file not found and no container specified');
        }
      } else {
        throw error;
      }
    }

    // Apply fix (in memory)
    const fixedContent = finding.fix.newFileContent;

    // Generate unified diff
    const diff = createTwoFilesPatch(
      composePath,
      composePath,
      currentContent,
      fixedContent,
      'Current',
      'Fixed'
    );

    // Parse diff into DiffLine format
    const diffLines = parseDiffToLines(diff);

    // Identify side effects
    const sideEffects = await identifySideEffects(
      currentContent,
      fixedContent,
      finding
    );

    return {
      before: currentContent,
      after: fixedContent,
      diff: diffLines,
      sideEffects: sideEffects,
      composePath: composePath,
    };
  } catch (error) {
    throw new Error(
      `Failed to preview fix: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Apply a fix to the infrastructure
 * Creates backup, writes fixed compose file, and restarts affected containers
 */
export async function applyFix(finding: Finding): Promise<FixResult> {
  if (finding.fix.type !== 'compose_replace') {
    throw new Error(
      'Only compose_replace fixes are supported. Use docker_command or manual fixes through the CLI.'
    );
  }

  if (!finding.fix.composePath) {
    throw new Error('Fix does not specify a compose file path');
  }

  if (!finding.fix.newFileContent) {
    throw new Error('Fix does not contain new file content');
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const composePath = finding.fix.composePath;

  try {
    // Ensure compose file exists (might be generated)
    let currentContent: string;
    try {
      currentContent = await fs.readFile(composePath, 'utf-8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT' && finding.container) {
        // Generate from container
        currentContent = await generateComposeFromContainer(finding.container);
        await fs.mkdir(path.dirname(composePath), { recursive: true });
        await fs.writeFile(composePath, currentContent, 'utf-8');
      } else {
        throw error;
      }
    }

    // Create backup directory if it doesn't exist
    const backupDir = '/backups';
    await fs.mkdir(backupDir, { recursive: true });

    // Create timestamped backup
    const backupFilename = `${path.basename(composePath, path.extname(composePath))}_${timestamp}_finding-${finding.id}${path.extname(composePath)}`;
    const backupPath = path.join(backupDir, backupFilename);

    await fs.writeFile(backupPath, currentContent, 'utf-8');
    console.log(`Created backup at ${backupPath}`);

    // Write fixed compose file (atomic operation)
    const tempPath = `${composePath}.tmp`;
    await fs.writeFile(tempPath, finding.fix.newFileContent, 'utf-8');
    await fs.rename(tempPath, composePath);
    console.log(`Applied fix to ${composePath}`);

    // Restart container if required
    let containerRestarted: string | undefined;
    if (finding.fix.requiresRestart && finding.container) {
      try {
        await restartContainer(finding.container);
        containerRestarted = finding.container;
        console.log(`Restarted container ${finding.container}`);
      } catch (error) {
        // Rollback on restart failure
        await fs.writeFile(composePath, currentContent, 'utf-8');
        throw new Error(
          `Container restart failed, rolled back changes: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    return {
      success: true,
      backupPath,
      containerRestarted,
      appliedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      success: false,
      backupPath: '',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Generate docker-compose.yml from container inspection data
 * Uses Claude Opus to intelligently convert docker inspect output to compose format
 */
export async function generateComposeFromContainer(
  containerName: string
): Promise<string> {
  try {
    // Get container list and find matching container
    const containers = await docker.listContainers({ all: true });
    const containerData = containers.find(
      (c) => c.Names.some((n) => n.replace(/^\//, '') === containerName)
    );

    if (!containerData) {
      throw new Error(`Container ${containerName} not found`);
    }

    // Inspect container for full details
    const container = docker.getContainer(containerData.Id);
    const inspect = await container.inspect();

    // Use Claude Opus to generate compose file
    const prompt = `You are a Docker expert. Generate a clean, well-structured docker-compose.yml file from the following container inspection data.

Include all relevant configuration:
- Image
- Container name
- Ports
- Volumes/Mounts
- Environment variables
- Networks
- Restart policy
- Resource limits (memory, CPU)
- Security settings (user, capabilities, privileged mode, read-only root filesystem)
- Healthcheck (if present)
- Labels

Use best practices:
- Use docker-compose version 3.8 format
- Use long-form syntax for clarity
- Add helpful comments
- Group related settings logically
- Use proper YAML indentation (2 spaces)

Container Inspect Data:
${JSON.stringify(inspect, null, 2)}

Respond with ONLY the docker-compose.yml content, no explanations or markdown code blocks.`;

    const message = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    // Extract the compose content
    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response format from Claude');
    }

    let composeContent = content.text.trim();

    // Remove markdown code blocks if present
    composeContent = composeContent.replace(/^```ya?ml\n/, '').replace(/\n```$/, '');

    // Validate YAML
    try {
      parseYaml(composeContent);
    } catch (yamlError) {
      throw new Error(
        `Generated compose file is not valid YAML: ${yamlError instanceof Error ? yamlError.message : String(yamlError)}`
      );
    }

    return composeContent;
  } catch (error) {
    throw new Error(
      `Failed to generate compose file: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Generate docker-compose.yml from ContainerInfo type
 * This is a simplified version that doesn't call Opus, for cases where we already have structured data
 */
export async function generateComposeFromInspect(
  containerInfo: ContainerInfo
): Promise<string> {
  try {
    // Build compose structure
    const service: any = {
      image: containerInfo.image,
      container_name: containerInfo.name,
    };

    // Add restart policy
    if (containerInfo.restartPolicy && containerInfo.restartPolicy !== 'no') {
      service.restart = containerInfo.restartPolicy;
    }

    // Add ports
    if (containerInfo.ports.length > 0) {
      service.ports = containerInfo.ports
        .filter((p) => p.hostPort !== null)
        .map((p) => `${p.hostPort}:${p.containerPort}/${p.protocol}`);
    }

    // Add volumes
    if (containerInfo.mounts.length > 0) {
      service.volumes = containerInfo.mounts.map((m) => {
        const mount = `${m.source}:${m.destination}`;
        return m.readOnly ? `${mount}:ro` : mount;
      });
    }

    // Add environment variables (filter sensitive ones)
    if (containerInfo.env.length > 0) {
      service.environment = containerInfo.env.filter(
        (e) => !e.includes('PASSWORD') && !e.includes('SECRET') && !e.includes('KEY')
      );
    }

    // Add networks
    if (containerInfo.networks.length > 0) {
      service.networks = containerInfo.networks;
    }

    // Add user
    if (containerInfo.user && containerInfo.user !== 'root') {
      service.user = containerInfo.user;
    }

    // Add security options
    if (containerInfo.privileged) {
      service.privileged = true;
    }

    if (containerInfo.readOnlyRootfs) {
      service.read_only = true;
    }

    if (containerInfo.capabilities.length > 0) {
      service.cap_add = containerInfo.capabilities;
    }

    // Add resource limits
    if (containerInfo.memoryLimit > 0 || containerInfo.cpuLimit > 0) {
      service.deploy = { resources: { limits: {} } };
      if (containerInfo.memoryLimit > 0) {
        service.deploy.resources.limits.memory = `${Math.floor(containerInfo.memoryLimit / 1024 / 1024)}M`;
      }
      if (containerInfo.cpuLimit > 0) {
        service.deploy.resources.limits.cpus = String(containerInfo.cpuLimit / 1e9);
      }
    }

    // Add healthcheck
    if (containerInfo.healthcheck) {
      service.healthcheck = {
        test: containerInfo.healthcheck.test,
        interval: `${containerInfo.healthcheck.interval}ns`,
        timeout: `${containerInfo.healthcheck.timeout}ns`,
        retries: containerInfo.healthcheck.retries,
        start_period: `${containerInfo.healthcheck.startPeriod}ns`,
      };
    }

    // Add labels
    if (Object.keys(containerInfo.labels).length > 0) {
      service.labels = containerInfo.labels;
    }

    // Build final compose structure
    const compose = {
      version: '3.8',
      services: {
        [containerInfo.name]: service,
      },
    };

    // Convert to YAML with nice formatting
    return stringifyYaml(compose, {
      lineWidth: 0, // Don't wrap lines
      indent: 2,
    });
  } catch (error) {
    throw new Error(
      `Failed to generate compose from inspect: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Restart a container using dockerode API
 */
async function restartContainer(containerName: string): Promise<void> {
  try {
    // Find container by name
    const containers = await docker.listContainers({ all: true });
    const containerData = containers.find(
      (c) => c.Names.some((n) => n.replace(/^\//, '') === containerName)
    );

    if (!containerData) {
      throw new Error(`Container ${containerName} not found`);
    }

    // Get container instance
    const container = docker.getContainer(containerData.Id);

    // Check if container is running
    const inspect = await container.inspect();
    const wasRunning = inspect.State.Running;

    if (wasRunning) {
      // Restart the container
      await container.restart();
      console.log(`Container ${containerName} restarted successfully`);
    } else {
      // If container wasn't running, start it
      await container.start();
      console.log(`Container ${containerName} started successfully`);
    }

    // Wait a moment and verify it's running
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const verifyInspect = await container.inspect();
    if (!verifyInspect.State.Running) {
      throw new Error('Container failed to start after restart');
    }
  } catch (error) {
    throw new Error(
      `Failed to restart container ${containerName}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Parse unified diff output to DiffLine array
 */
function parseDiffToLines(diff: string): DiffLine[] {
  const lines = diff.split('\n');
  const diffLines: DiffLine[] = [];

  for (const line of lines) {
    if (line.startsWith('+++') || line.startsWith('---')) {
      // Skip header lines
      continue;
    } else if (line.startsWith('@@')) {
      // Hunk header
      diffLines.push({
        value: line + '\n',
      });
    } else if (line.startsWith('+')) {
      diffLines.push({
        value: line.substring(1) + '\n',
        added: true,
      });
    } else if (line.startsWith('-')) {
      diffLines.push({
        value: line.substring(1) + '\n',
        removed: true,
      });
    } else if (line.startsWith(' ')) {
      diffLines.push({
        value: line.substring(1) + '\n',
      });
    } else if (line) {
      diffLines.push({
        value: line + '\n',
      });
    }
  }

  return diffLines;
}

/**
 * Identify side effects of applying a fix
 * Analyzes what will change and what containers/networks might be affected
 */
async function identifySideEffects(
  beforeContent: string,
  afterContent: string,
  finding: Finding
): Promise<string> {
  const sideEffects: string[] = [];

  // Parse both versions
  let beforeParsed: any;
  let afterParsed: any;

  try {
    beforeParsed = parseYaml(beforeContent);
    afterParsed = parseYaml(afterContent);
  } catch (error) {
    return 'Unable to parse compose files for side effect analysis';
  }

  // Check if container restart is required
  if (finding.fix.requiresRestart && finding.container) {
    sideEffects.push(`Container '${finding.container}' will be restarted`);
  }

  // Check for port changes
  const beforePorts = beforeParsed?.services?.[finding.container!]?.ports || [];
  const afterPorts = afterParsed?.services?.[finding.container!]?.ports || [];
  if (JSON.stringify(beforePorts) !== JSON.stringify(afterPorts)) {
    sideEffects.push('Port mappings will change - may affect external access');
  }

  // Check for volume changes
  const beforeVolumes = beforeParsed?.services?.[finding.container!]?.volumes || [];
  const afterVolumes = afterParsed?.services?.[finding.container!]?.volumes || [];
  if (JSON.stringify(beforeVolumes) !== JSON.stringify(afterVolumes)) {
    sideEffects.push('Volume mounts will change - ensure data is backed up');
  }

  // Check for network changes
  const beforeNetworks = beforeParsed?.services?.[finding.container!]?.networks || [];
  const afterNetworks = afterParsed?.services?.[finding.container!]?.networks || [];
  if (JSON.stringify(beforeNetworks) !== JSON.stringify(afterNetworks)) {
    sideEffects.push('Network configuration will change - may affect connectivity');
  }

  // Check for security setting changes
  const beforePrivileged = beforeParsed?.services?.[finding.container!]?.privileged;
  const afterPrivileged = afterParsed?.services?.[finding.container!]?.privileged;
  if (beforePrivileged && !afterPrivileged) {
    sideEffects.push(
      'Privileged mode will be disabled - container may lose access to host resources'
    );
  }

  // Check for user changes
  const beforeUser = beforeParsed?.services?.[finding.container!]?.user;
  const afterUser = afterParsed?.services?.[finding.container!]?.user;
  if (beforeUser !== afterUser) {
    sideEffects.push(
      'Container user will change - may affect file permissions and access'
    );
  }

  // Use the fix's side effects if no specific ones were detected
  if (sideEffects.length === 0) {
    return finding.fix.sideEffects || 'No significant side effects detected';
  }

  return sideEffects.join('; ');
}

/**
 * Docker Infrastructure Collector
 *
 * Collects complete Docker infrastructure context from Docker API.
 * Gathers information about containers, networks, volumes, and compose files.
 */

import Docker from 'dockerode';
import { parse as parseYaml } from 'yaml';
import { promises as fs } from 'fs';
import { join } from 'path';
import type {
  DockerInfraContext,
  ContainerInfo,
  NetworkInfo,
  VolumeInfo,
  ComposeFile,
  PortMapping,
  Mount,
  Volume,
  Healthcheck,
} from '@shared/types.js';

// Initialize Docker client
const docker = new Docker();

/**
 * Lightweight Docker daemon health check
 * Returns true if Docker daemon is reachable, false otherwise
 */
export async function dockerPing(): Promise<boolean> {
  try {
    await docker.ping();
    return true;
  } catch {
    return false;
  }
}

/**
 * Collects complete Docker infrastructure context
 */
export async function collectInfraContext(): Promise<DockerInfraContext> {
  try {
    // Collect all data in parallel
    const [
      dockerInfo,
      containersList,
      networksList,
      volumesList,
      composeFiles,
    ] = await Promise.all([
      docker.info(),
      docker.listContainers({ all: true }),
      docker.listNetworks(),
      docker.listVolumes(),
      scanComposeFiles(),
    ]);

    // Inspect all containers to get detailed information
    const containers = await Promise.all(
      containersList.map((container) => inspectContainer(container.Id))
    );

    // Map networks with container information
    const networks = networksList.map((network) =>
      mapNetworkInfo(network, containers)
    );

    // Map volumes with usage information
    const volumes = (volumesList.Volumes || []).map((volume) =>
      mapVolumeInfo(volume, containers)
    );

    return {
      containers,
      networks,
      volumes,
      dockerVersion: dockerInfo.ServerVersion || 'unknown',
      os: `${dockerInfo.OperatingSystem || 'unknown'} (${dockerInfo.OSType || 'unknown'})`,
      totalContainers: dockerInfo.Containers || 0,
      composeFiles,
      collectedAt: new Date().toISOString(),
    };
  } catch (error) {
    // Provide helpful error message if Docker daemon is not accessible
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      throw new Error(
        'Cannot connect to Docker daemon. Is Docker running and accessible?'
      );
    }
    throw new Error(
      `Failed to collect infrastructure context: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Inspect a single container and map to ContainerInfo type
 */
async function inspectContainer(containerId: string): Promise<ContainerInfo> {
  try {
    const container = docker.getContainer(containerId);
    const inspect = await container.inspect();

    // Extract port mappings
    const ports: PortMapping[] = [];
    if (inspect.NetworkSettings?.Ports) {
      for (const [containerPort, hostBindings] of Object.entries(
        inspect.NetworkSettings.Ports
      )) {
        const [port, protocol] = containerPort.split('/');
        if (hostBindings && hostBindings.length > 0) {
          for (const binding of hostBindings) {
            ports.push({
              containerPort: parseInt(port, 10),
              hostPort: binding.HostPort ? parseInt(binding.HostPort, 10) : null,
              protocol: protocol || 'tcp',
              hostIp: binding.HostIp || '0.0.0.0',
            });
          }
        } else {
          // Port exposed but not bound to host
          ports.push({
            containerPort: parseInt(port, 10),
            hostPort: null,
            protocol: protocol || 'tcp',
            hostIp: '0.0.0.0',
          });
        }
      }
    }

    // Extract mounts
    const mounts: Mount[] = (inspect.Mounts || []).map((mount) => ({
      source: mount.Source || '',
      destination: mount.Destination || '',
      type: mount.Type || 'bind',
      readOnly: mount.RW === false,
      propagation: mount.Propagation || '',
    }));

    // Extract volumes (legacy format)
    const volumes: Volume[] = [];
    if (inspect.Config?.Volumes) {
      for (const [dest, _] of Object.entries(inspect.Config.Volumes)) {
        const mount = mounts.find((m) => m.destination === dest);
        volumes.push({
          name: mount?.source.split('/').pop() || 'unknown',
          source: mount?.source || '',
          destination: dest,
          driver: 'local',
          readOnly: mount?.readOnly || false,
        });
      }
    }

    // Extract healthcheck
    let healthcheck: Healthcheck | null = null;
    if (inspect.Config?.Healthcheck) {
      const hc = inspect.Config.Healthcheck;
      healthcheck = {
        test: hc.Test || [],
        interval: hc.Interval || 0,
        timeout: hc.Timeout || 0,
        retries: hc.Retries || 0,
        startPeriod: hc.StartPeriod || 0,
      };
    }

    // Extract capabilities
    const capabilities: string[] = [];
    if (inspect.HostConfig?.CapAdd) {
      capabilities.push(...inspect.HostConfig.CapAdd);
    }

    // Extract network names
    const networks = Object.keys(inspect.NetworkSettings?.Networks || {});

    return {
      id: inspect.Id || '',
      name: inspect.Name?.replace(/^\//, '') || '',
      image: inspect.Config?.Image || '',
      status: inspect.State?.Status || 'unknown',
      created: inspect.Created || '',
      user: inspect.Config?.User || 'root',
      privileged: inspect.HostConfig?.Privileged || false,
      capabilities,
      readOnlyRootfs: inspect.HostConfig?.ReadonlyRootfs || false,
      ports,
      networks,
      networkMode: inspect.HostConfig?.NetworkMode || 'bridge',
      mounts,
      volumes,
      env: inspect.Config?.Env || [],
      memoryLimit: inspect.HostConfig?.Memory || 0,
      cpuLimit: inspect.HostConfig?.NanoCpus || 0,
      healthcheck,
      restartPolicy: inspect.HostConfig?.RestartPolicy?.Name || 'no',
      labels: inspect.Config?.Labels || {},
    };
  } catch (error) {
    throw new Error(
      `Failed to inspect container ${containerId}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Map Docker network to NetworkInfo type
 */
function mapNetworkInfo(
  network: Docker.NetworkInspectInfo,
  containers: ContainerInfo[]
): NetworkInfo {
  // Find containers connected to this network
  const connectedContainers = containers
    .filter((c) => c.networks.includes(network.Name || ''))
    .map((c) => c.id);

  return {
    name: network.Name || '',
    driver: network.Driver || 'bridge',
    containers: connectedContainers,
    internal: network.Internal || false,
    enableIPv6: network.EnableIPv6 || false,
    id: network.Id || '',
    scope: network.Scope || 'local',
  };
}

/**
 * Map Docker volume to VolumeInfo type
 */
function mapVolumeInfo(
  volume: Docker.VolumeInspectInfo,
  containers: ContainerInfo[]
): VolumeInfo {
  // Find containers using this volume
  const usedBy = containers
    .filter((c) =>
      c.mounts.some(
        (m) => m.source.includes(volume.Name) || m.source === volume.Mountpoint
      )
    )
    .map((c) => c.name);

  return {
    name: volume.Name,
    driver: volume.Driver,
    mountPoint: volume.Mountpoint,
    usedBy,
    scope: volume.Scope || 'local',
    labels: volume.Labels || {},
  };
}

/**
 * Scan /configs directory for docker-compose files
 */
async function scanComposeFiles(): Promise<ComposeFile[]> {
  const configsDir = '/configs';
  const composeFiles: ComposeFile[] = [];

  try {
    // Check if /configs directory exists
    await fs.access(configsDir);

    // Recursively find all docker-compose files
    const files = await findComposeFilesRecursive(configsDir);

    // Parse each compose file
    for (const filePath of files) {
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const stats = await fs.stat(filePath);

        // Parse YAML to extract service names
        const parsed = parseYaml(content);
        const services = parsed?.services ? Object.keys(parsed.services) : [];

        composeFiles.push({
          path: filePath,
          content,
          services,
          lastModified: stats.mtime.toISOString(),
        });
      } catch (error) {
        // Log error but continue with other files
        console.warn(
          `Failed to parse compose file ${filePath}: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }
  } catch (error) {
    // /configs directory doesn't exist or isn't accessible
    console.warn(
      `/configs directory not accessible: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return composeFiles;
}

/**
 * Recursively find all docker-compose files in a directory
 */
async function findComposeFilesRecursive(dir: string): Promise<string[]> {
  const files: string[] = [];

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        // Recursively search subdirectories
        const subFiles = await findComposeFilesRecursive(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        // Check if filename matches docker-compose pattern
        if (
          entry.name.startsWith('docker-compose') &&
          (entry.name.endsWith('.yml') || entry.name.endsWith('.yaml'))
        ) {
          files.push(fullPath);
        }
      }
    }
  } catch (error) {
    // Skip directories we can't read
    console.warn(
      `Cannot read directory ${dir}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return files;
}

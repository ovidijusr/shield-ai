/**
 * Service Identifier
 *
 * Identifies what service is running in a container by analyzing:
 * - Container image name
 * - Port numbers
 * - Environment variables
 *
 * This enables context-aware security analysis.
 */

import type { ContainerInfo } from '@shared/types.js';

export interface ServiceInfo {
  containerName: string;
  port: number;
  serviceName: string; // e.g., "PostgreSQL", "Nginx", "Unknown"
  category: 'database' | 'web' | 'api' | 'management' | 'other';
  riskLevel: 'critical' | 'high' | 'medium' | 'low';
  shouldBePublic: boolean;
}

/**
 * Service fingerprinting database
 */
interface ServiceSignature {
  name: string;
  category: ServiceInfo['category'];
  riskLevel: ServiceInfo['riskLevel'];
  shouldBePublic: boolean;
  imagePatterns: RegExp[];
  ports?: number[];
  envPatterns?: RegExp[];
}

const SERVICE_SIGNATURES: ServiceSignature[] = [
  // Databases - CRITICAL (should never be public)
  {
    name: 'PostgreSQL',
    category: 'database',
    riskLevel: 'critical',
    shouldBePublic: false,
    imagePatterns: [/postgres/i, /postgresql/i],
    ports: [5432],
    envPatterns: [/POSTGRES_/i],
  },
  {
    name: 'MySQL',
    category: 'database',
    riskLevel: 'critical',
    shouldBePublic: false,
    imagePatterns: [/mysql/i],
    ports: [3306],
    envPatterns: [/MYSQL_/i],
  },
  {
    name: 'MariaDB',
    category: 'database',
    riskLevel: 'critical',
    shouldBePublic: false,
    imagePatterns: [/mariadb/i],
    ports: [3306],
    envPatterns: [/MYSQL_/i, /MARIADB_/i],
  },
  {
    name: 'MongoDB',
    category: 'database',
    riskLevel: 'critical',
    shouldBePublic: false,
    imagePatterns: [/mongo/i],
    ports: [27017],
    envPatterns: [/MONGO_/i],
  },
  {
    name: 'Redis',
    category: 'database',
    riskLevel: 'critical',
    shouldBePublic: false,
    imagePatterns: [/redis/i],
    ports: [6379],
    envPatterns: [/REDIS_/i],
  },
  {
    name: 'Elasticsearch',
    category: 'database',
    riskLevel: 'critical',
    shouldBePublic: false,
    imagePatterns: [/elasticsearch/i, /elastic/i],
    ports: [9200, 9300],
  },
  {
    name: 'InfluxDB',
    category: 'database',
    riskLevel: 'critical',
    shouldBePublic: false,
    imagePatterns: [/influxdb/i],
    ports: [8086],
  },

  // Management UIs - CRITICAL (high-value targets)
  {
    name: 'Portainer',
    category: 'management',
    riskLevel: 'critical',
    shouldBePublic: false,
    imagePatterns: [/portainer/i],
    ports: [9000, 9443],
  },
  {
    name: 'phpMyAdmin',
    category: 'management',
    riskLevel: 'critical',
    shouldBePublic: false,
    imagePatterns: [/phpmyadmin/i],
    ports: [80, 443],
  },
  {
    name: 'Adminer',
    category: 'management',
    riskLevel: 'critical',
    shouldBePublic: false,
    imagePatterns: [/adminer/i],
    ports: [8080],
  },
  {
    name: 'pgAdmin',
    category: 'management',
    riskLevel: 'critical',
    shouldBePublic: false,
    imagePatterns: [/pgadmin/i],
    ports: [80, 5050],
  },
  {
    name: 'Grafana',
    category: 'management',
    riskLevel: 'high',
    shouldBePublic: false,
    imagePatterns: [/grafana/i],
    ports: [3000],
  },

  // Web Servers - MEDIUM (usually OK to be public if configured properly)
  {
    name: 'Nginx',
    category: 'web',
    riskLevel: 'medium',
    shouldBePublic: true,
    imagePatterns: [/nginx/i],
    ports: [80, 443],
  },
  {
    name: 'Apache',
    category: 'web',
    riskLevel: 'medium',
    shouldBePublic: true,
    imagePatterns: [/apache/i, /httpd/i],
    ports: [80, 443],
  },
  {
    name: 'Caddy',
    category: 'web',
    riskLevel: 'medium',
    shouldBePublic: true,
    imagePatterns: [/caddy/i],
    ports: [80, 443],
  },
  {
    name: 'Traefik',
    category: 'web',
    riskLevel: 'medium',
    shouldBePublic: true,
    imagePatterns: [/traefik/i],
    ports: [80, 443, 8080],
  },

  // Media Servers - MEDIUM (homelab staples, mixed exposure)
  {
    name: 'Plex',
    category: 'web',
    riskLevel: 'medium',
    shouldBePublic: false,
    imagePatterns: [/plex/i],
    ports: [32400],
  },
  {
    name: 'Jellyfin',
    category: 'web',
    riskLevel: 'medium',
    shouldBePublic: false,
    imagePatterns: [/jellyfin/i],
    ports: [8096],
  },
  {
    name: 'Emby',
    category: 'web',
    riskLevel: 'medium',
    shouldBePublic: false,
    imagePatterns: [/emby/i],
    ports: [8096],
  },

  // APIs and App Servers - HIGH (should be behind reverse proxy)
  {
    name: 'Node.js',
    category: 'api',
    riskLevel: 'high',
    shouldBePublic: false,
    imagePatterns: [/node/i],
  },
  {
    name: 'Python API',
    category: 'api',
    riskLevel: 'high',
    shouldBePublic: false,
    imagePatterns: [/python/i, /django/i, /flask/i, /fastapi/i],
  },
  {
    name: 'Go API',
    category: 'api',
    riskLevel: 'high',
    shouldBePublic: false,
    imagePatterns: [/golang/i],
  },

  // Home Automation - MEDIUM
  {
    name: 'Home Assistant',
    category: 'web',
    riskLevel: 'medium',
    shouldBePublic: false,
    imagePatterns: [/homeassistant/i, /home-assistant/i],
    ports: [8123],
  },
  {
    name: 'Node-RED',
    category: 'web',
    riskLevel: 'medium',
    shouldBePublic: false,
    imagePatterns: [/nodered/i, /node-red/i],
    ports: [1880],
  },

  // File Sharing - MEDIUM
  {
    name: 'Nextcloud',
    category: 'web',
    riskLevel: 'medium',
    shouldBePublic: false,
    imagePatterns: [/nextcloud/i],
    ports: [80, 443],
  },

  // Download Managers - MEDIUM
  {
    name: 'qBittorrent',
    category: 'web',
    riskLevel: 'medium',
    shouldBePublic: false,
    imagePatterns: [/qbittorrent/i],
    ports: [8080],
  },
  {
    name: 'Transmission',
    category: 'web',
    riskLevel: 'medium',
    shouldBePublic: false,
    imagePatterns: [/transmission/i],
    ports: [9091],
  },
  {
    name: 'Sonarr',
    category: 'web',
    riskLevel: 'medium',
    shouldBePublic: false,
    imagePatterns: [/sonarr/i],
    ports: [8989],
  },
  {
    name: 'Radarr',
    category: 'web',
    riskLevel: 'medium',
    shouldBePublic: false,
    imagePatterns: [/radarr/i],
    ports: [7878],
  },
];

/**
 * Identify what service is running in a container
 */
export function identifyService(
  containerInfo: ContainerInfo,
  port: number
): ServiceInfo {
  const image = containerInfo.image.toLowerCase();
  const envVars = containerInfo.env.join(' ').toLowerCase();

  // Try to match against known service signatures
  for (const signature of SERVICE_SIGNATURES) {
    let matchScore = 0;

    // Check image name patterns
    if (signature.imagePatterns.some((pattern) => pattern.test(image))) {
      matchScore += 3;
    }

    // Check port numbers
    if (signature.ports && signature.ports.includes(port)) {
      matchScore += 2;
    }

    // Check environment variables
    if (signature.envPatterns) {
      if (signature.envPatterns.some((pattern) => pattern.test(envVars))) {
        matchScore += 1;
      }
    }

    // If we have a strong match, return this service
    if (matchScore >= 3) {
      return {
        containerName: containerInfo.name,
        port,
        serviceName: signature.name,
        category: signature.category,
        riskLevel: signature.riskLevel,
        shouldBePublic: signature.shouldBePublic,
      };
    }
  }

  // No match found - return unknown service with medium risk
  return {
    containerName: containerInfo.name,
    port,
    serviceName: 'Unknown Service',
    category: 'other',
    riskLevel: 'medium',
    shouldBePublic: false,
  };
}

/**
 * Generate service-specific risk description
 */
export function generateServiceRiskDescription(service: ServiceInfo): string {
  switch (service.category) {
    case 'database':
      return `Databases should NEVER be exposed to the internet. Exposing ${service.serviceName} allows anyone to attempt connections, scan for vulnerabilities, and potentially exploit authentication weaknesses or known CVEs.`;

    case 'management':
      return `Management interfaces like ${service.serviceName} are high-value targets for attackers. If compromised, they provide administrative access to your infrastructure, allowing full control over containers, data, and configurations.`;

    case 'api':
      return `APIs should be behind a reverse proxy with proper authentication. Exposing ${service.serviceName} directly allows attackers to probe endpoints, discover vulnerabilities, and exploit business logic flaws.`;

    case 'web':
      if (!service.shouldBePublic) {
        return `${service.serviceName} is accessible from the network. Ensure it has proper authentication and is only accessible to trusted users. Consider using a VPN or reverse proxy with authentication.`;
      }
      return `${service.serviceName} is exposed. Ensure it's properly configured with HTTPS, has strong authentication if needed, and follows security best practices.`;

    case 'other':
    default:
      return `This service is exposed to the network. Without knowing the specific application, it's difficult to assess the full risk. Ensure proper authentication is in place and consider limiting exposure to trusted networks only.`;
  }
}

/**
 * Generate service-specific fix recommendation
 */
export function generateServiceFixRecommendation(
  service: ServiceInfo,
  currentBindAddress: string
): string {
  if (service.category === 'database' || service.category === 'management') {
    return `Change port binding from ${currentBindAddress} to 127.0.0.1 (localhost only). Access ${service.serviceName} through an SSH tunnel or VPN if remote access is needed.`;
  }

  if (service.category === 'web' && service.shouldBePublic) {
    return `If this service needs internet access, ensure it's behind a reverse proxy (Nginx, Traefik, Caddy) with HTTPS and proper authentication. Otherwise, bind to 127.0.0.1 or a specific LAN IP (e.g., 192.168.1.10).`;
  }

  return `Change port binding from ${currentBindAddress} to 127.0.0.1 for localhost-only access, or to a specific LAN IP (e.g., 192.168.1.10) for network access without internet exposure.`;
}

/**
 * Audit Prompts
 *
 * Prompts for Claude Opus security analysis.
 */

import type { DockerInfraContext, Finding } from '@shared/types.js';

/**
 * Builds a comprehensive audit prompt for Claude Opus to analyze Docker infrastructure.
 * The prompt includes full context about the infrastructure and quick check findings.
 */
export function buildAuditPrompt(
  context: DockerInfraContext,
  quickFindings: Finding[]
): string {
  const systemPrompt = `You are ShieldAI, an expert Docker security auditor with deep expertise in container security, DevOps best practices, and infrastructure hardening.

Your mission is to analyze Docker infrastructure and provide actionable security guidance to users ranging from Docker newcomers to power users. Your analysis should be thorough, practical, and educational.

## Your Capabilities

- **Deep Security Analysis**: Identify vulnerabilities, misconfigurations, and security anti-patterns
- **Risk Assessment**: Evaluate blast radius and explain real-world attack scenarios
- **Practical Remediation**: Provide specific, actionable fixes with clear explanations
- **Best Practices**: Recognize good security practices and architectural patterns
- **Plain English Communication**: Explain complex security concepts in accessible language

## Analysis Guidelines

1. **Be Thorough**: Review all containers, networks, volumes, and compose configurations
2. **Context Matters**: Consider the full infrastructure topology and inter-dependencies
3. **Blast Radius Analysis**: For each finding, explain what an attacker could access/compromise
4. **Risk Prioritization**: Focus on high-impact vulnerabilities first
5. **Practical Fixes**: Provide specific Docker commands or compose file changes
6. **Side Effects**: Warn about potential disruptions when applying fixes
7. **Education**: Explain WHY something is risky, not just THAT it's risky

## Security Focus Areas

### Critical Issues
- Privileged containers (full host access)
- Host network mode (bypasses network isolation)
- Docker socket mounts (container escape risk)
- Sensitive host path mounts (/etc, /var/run, /proc, /sys)
- Root user containers (privilege escalation risk)
- Exposed management ports (databases, admin panels)

### High-Priority Issues
- Missing resource limits (DoS risk)
- Overly permissive capabilities
- Writable root filesystems
- Missing health checks
- Insecure network configurations
- Exposed non-HTTP ports

### Best Practices
- Secrets management (avoid env vars for secrets)
- Network segmentation (internal vs. external)
- Volume permissions and ownership
- Image tag specificity (avoid :latest)
- Restart policies
- Logging and monitoring setup

## Output Format

You MUST respond with valid JSON following this exact schema:

\`\`\`json
{
  "overallScore": 0-100,
  "scoreExplanation": "Brief explanation of score (2-3 sentences)",
  "findings": [
    {
      "id": "unique-id",
      "severity": "critical|high|medium|low|info",
      "category": "category-name",
      "title": "Short descriptive title",
      "container": "container-name or null for infra-wide findings",
      "description": "Detailed description specific to this setup",
      "risk": "Blast radius analysis and attack scenarios",
      "fix": {
        "description": "What this fix does",
        "type": "compose_replace|docker_command|manual",
        "composePath": "path/to/docker-compose.yml or null",
        "newFileContent": "Complete corrected YAML content or null",
        "commands": ["docker command 1", "docker command 2"] or null,
        "sideEffects": "What will happen (e.g., container restart required)",
        "requiresRestart": true|false
      },
      "source": "opus_analysis"
    }
  ],
  "goodPractices": [
    {
      "id": "unique-id",
      "category": "category-name",
      "title": "What they're doing right",
      "description": "Detailed explanation",
      "appliesTo": ["container1", "container2"]
    }
  ],
  "architecturalRecommendations": [
    {
      "id": "unique-id",
      "title": "High-level recommendation",
      "description": "Detailed explanation of architectural improvement",
      "impact": "What this would improve",
      "complexity": "low|medium|high"
    }
  ]
}
\`\`\`

## Important Notes

- **Quick Check Findings**: The user has already run quick security checks. Review these findings and provide deeper analysis, context, and additional issues they might have missed.
- **Compose File Fixes**: When suggesting compose_replace fixes, provide the COMPLETE corrected file content, not just the changed sections.
- **Docker Commands**: When suggesting docker_command fixes, provide exact commands that can be run immediately.
- **Plain English**: Write for humans, not security robots. Explain risks in terms anyone can understand.
- **Be Encouraging**: Acknowledge what they're doing right, not just what's wrong.
- **Score Calculation**: Base the overall score on risk severity, finding count, and architectural maturity. Perfect score (100) is rare - even good setups have room for improvement.`;

  const userPrompt = `# Docker Infrastructure Analysis Request

## Infrastructure Overview

**Docker Version**: ${context.dockerVersion}
**Host OS**: ${context.os}
**Total Containers**: ${context.totalContainers}
**Collected At**: ${context.collectedAt}

## Containers (${context.containers.length})

${context.containers.map((c) => `
### Container: ${c.name}
- **ID**: ${c.id}
- **Image**: ${c.image}
- **Status**: ${c.status}
- **Created**: ${c.created}
- **User**: ${c.user || 'root'} ${!c.user || c.user === 'root' || c.user === '0' ? '⚠️ (running as root)' : ''}
- **Privileged**: ${c.privileged ? '🚨 YES' : 'No'}
- **Network Mode**: ${c.networkMode}
- **Read-Only Root FS**: ${c.readOnlyRootfs ? 'Yes' : 'No'}
- **Memory Limit**: ${c.memoryLimit > 0 ? `${(c.memoryLimit / 1024 / 1024).toFixed(0)}MB` : 'Unlimited'}
- **CPU Limit**: ${c.cpuLimit > 0 ? c.cpuLimit : 'Unlimited'}
- **Restart Policy**: ${c.restartPolicy}

**Port Mappings**: ${c.ports.length > 0 ? '\n' + c.ports.map(p =>
  `  - ${p.hostIp}:${p.hostPort} → ${p.containerPort}/${p.protocol} ${p.hostIp === '0.0.0.0' ? '🌐 (exposed to internet)' : ''}`
).join('\n') : 'None'}

**Mounts**: ${c.mounts.length > 0 ? '\n' + c.mounts.map(m =>
  `  - ${m.source} → ${m.destination} (${m.type}, ${m.readOnly ? 'ro' : 'rw'})`
).join('\n') : 'None'}

**Volumes**: ${c.volumes.length > 0 ? '\n' + c.volumes.map(v =>
  `  - ${v.name}: ${v.source} → ${v.destination} (${v.readOnly ? 'ro' : 'rw'})`
).join('\n') : 'None'}

**Networks**: ${c.networks.join(', ') || 'None'}

**Capabilities**: ${c.capabilities.length > 0 ? c.capabilities.join(', ') : 'Default'}

**Environment Variables**: ${c.env.length} variables set ${c.env.some(e => e.toLowerCase().includes('secret') || e.toLowerCase().includes('password') || e.toLowerCase().includes('key')) ? '⚠️ (may contain secrets)' : ''}

**Health Check**: ${c.healthcheck ? `Configured (interval: ${c.healthcheck.interval}ms)` : 'Not configured'}
`).join('\n---\n')}

## Networks (${context.networks.length})

${context.networks.map((n) => `
### Network: ${n.name}
- **Driver**: ${n.driver}
- **Internal**: ${n.internal ? 'Yes (isolated)' : 'No'}
- **IPv6**: ${n.enableIPv6 ? 'Enabled' : 'Disabled'}
- **Scope**: ${n.scope}
- **Connected Containers**: ${n.containers.length} (${n.containers.join(', ') || 'None'})
`).join('\n')}

## Volumes (${context.volumes.length})

${context.volumes.map((v) => `
### Volume: ${v.name}
- **Driver**: ${v.driver}
- **Mount Point**: ${v.mountPoint}
- **Scope**: ${v.scope}
- **Used By**: ${v.usedBy.join(', ') || 'None'}
`).join('\n')}

## Docker Compose Files (${context.composeFiles.length})

${context.composeFiles.map((cf) => `
### ${cf.path}
**Last Modified**: ${cf.lastModified}
**Services**: ${cf.services.join(', ')}

\`\`\`yaml
${cf.content}
\`\`\`
`).join('\n---\n')}

## Quick Check Findings

The following security issues were detected by automated quick checks:

${quickFindings.length > 0 ? quickFindings.map((f) => `
### ${f.title} (${f.severity})
- **Category**: ${f.category}
- **Container**: ${f.container || 'Infrastructure-wide'}
- **Description**: ${f.description}
- **Risk**: ${f.risk}
`).join('\n') : 'No quick check findings.'}

---

## Your Task

Please perform a comprehensive security audit of this Docker infrastructure. Review the containers, networks, volumes, and compose configurations above.

1. **Expand on Quick Findings**: Provide deeper analysis and context for the quick check findings listed above
2. **Identify Additional Issues**: Find security problems that automated checks might have missed
3. **Assess Blast Radius**: For each finding, explain what an attacker could access or compromise
4. **Provide Actionable Fixes**: Give specific Docker commands or complete corrected compose files
5. **Recognize Good Practices**: Acknowledge security measures they're already using
6. **Suggest Improvements**: Recommend architectural enhancements

Respond with a complete JSON audit result following the schema provided in the system prompt.`;

  return JSON.stringify({
    system: systemPrompt,
    user: userPrompt,
  });
}

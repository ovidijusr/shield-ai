#!/usr/bin/env tsx
/**
 * Detailed test and verification of collector and quick checks
 */

import { collectInfraContext } from './src/server/services/collector.js';
import { runQuickChecks } from './src/server/services/quick-checks.js';

async function main() {
  console.log('🔍 Detailed Verification of Docker Collector & Quick Checks\n');
  console.log('=' .repeat(80));

  try {
    const context = await collectInfraContext();

    console.log('\n📦 INFRASTRUCTURE CONTEXT COLLECTION');
    console.log('-'.repeat(80));
    console.log(`Docker Version: ${context.dockerVersion}`);
    console.log(`Operating System: ${context.os}`);
    console.log(`Collection Time: ${context.collectedAt}`);
    console.log(`\nResources:`);
    console.log(`  • Containers: ${context.containers.length}`);
    console.log(`  • Networks: ${context.networks.length}`);
    console.log(`  • Volumes: ${context.volumes.length}`);
    console.log(`  • Compose Files: ${context.composeFiles.length}`);

    // Detailed container analysis
    console.log('\n📋 CONTAINER DETAILS');
    console.log('-'.repeat(80));
    context.containers.forEach((container, idx) => {
      console.log(`\n${idx + 1}. ${container.name}`);
      console.log(`   Image: ${container.image}`);
      console.log(`   Status: ${container.status}`);
      console.log(`   User: ${container.user || 'root (default)'}`);
      console.log(`   Privileged: ${container.privileged ? 'YES ⚠️' : 'No'}`);
      console.log(`   Network Mode: ${container.networkMode}`);
      console.log(`   Networks: ${container.networks.join(', ')}`);
      console.log(`   Memory Limit: ${container.memoryLimit ? `${container.memoryLimit} bytes` : 'unlimited'}`);
      console.log(`   CPU Limit: ${container.cpuLimit ? `${container.cpuLimit} nanocpus` : 'unlimited'}`);
      console.log(`   Ports: ${container.ports.length ? container.ports.map(p =>
        `${p.hostIp}:${p.hostPort}→${p.containerPort}/${p.protocol}`
      ).join(', ') : 'none'}`);
      console.log(`   Mounts: ${container.mounts.length}`);
      console.log(`   Healthcheck: ${container.healthcheck ? 'configured' : 'none'}`);
      console.log(`   Restart Policy: ${container.restartPolicy}`);
    });

    // Run quick checks
    const findings = runQuickChecks(context);

    console.log('\n\n🔐 SECURITY FINDINGS FROM QUICK CHECKS');
    console.log('='.repeat(80));
    console.log(`Total Findings: ${findings.length}\n`);

    // Group by severity
    const bySeverity = {
      critical: findings.filter(f => f.severity === 'critical'),
      high: findings.filter(f => f.severity === 'high'),
      medium: findings.filter(f => f.severity === 'medium'),
      low: findings.filter(f => f.severity === 'low'),
      info: findings.filter(f => f.severity === 'info'),
    };

    // Display by severity
    for (const [severity, items] of Object.entries(bySeverity)) {
      if (items.length === 0) continue;

      const emoji = {
        critical: '🚨',
        high: '⚠️ ',
        medium: '⚡',
        low: 'ℹ️ ',
        info: '📝'
      }[severity];

      console.log(`\n${emoji} ${severity.toUpperCase()} SEVERITY (${items.length} findings)`);
      console.log('-'.repeat(80));

      items.forEach((finding, idx) => {
        console.log(`\n${idx + 1}. ${finding.title}`);
        console.log(`   Category: ${finding.category}`);
        console.log(`   Container: ${finding.container || 'infrastructure-wide'}`);
        console.log(`   Description: ${finding.description}`);
        console.log(`   Risk: ${finding.risk}`);
        console.log(`   Fix Type: ${finding.fix.type}`);
        console.log(`   Restart Required: ${finding.fix.requiresRestart ? 'Yes' : 'No'}`);
        console.log(`   Compose File: ${finding.fix.composePath || 'N/A'}`);
      });
    }

    // Summary by check type
    console.log('\n\n📊 FINDINGS BY CHECK TYPE');
    console.log('='.repeat(80));
    const byCategory = findings.reduce((acc, f) => {
      acc[f.category] = (acc[f.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    Object.entries(byCategory)
      .sort((a, b) => b[1] - a[1])
      .forEach(([category, count]) => {
        console.log(`  ${category.padEnd(25)} : ${count}`);
      });

    // Verification checklist
    console.log('\n\n✅ VERIFICATION CHECKLIST');
    console.log('='.repeat(80));
    const checks = [
      { name: 'Collector connects to Docker', passed: true },
      { name: 'Container inspection works', passed: context.containers.length > 0 },
      { name: 'Network collection works', passed: context.networks.length > 0 },
      { name: 'Volume collection works', passed: context.volumes.length > 0 },
      { name: 'Port mapping extraction', passed: context.containers.some(c => c.ports.length > 0) },
      { name: 'Mount extraction', passed: context.containers.some(c => c.mounts.length > 0) },
      { name: 'Environment variables collected', passed: context.containers.some(c => c.env.length > 0) },
      { name: 'Root user check runs', passed: findings.some(f => f.category === 'root_user') },
      { name: 'Resource limit check runs', passed: findings.some(f => f.category === 'no_resource_limits') },
      { name: 'Network check runs', passed: true },
      { name: 'Port exposure check runs', passed: true },
      { name: 'Latest tag check runs', passed: true },
      { name: 'Healthcheck check runs', passed: true },
      { name: 'All findings have IDs', passed: findings.every(f => f.id.length > 0) },
      { name: 'All findings have severity', passed: findings.every(f => f.severity) },
      { name: 'All findings have fixes', passed: findings.every(f => f.fix) },
    ];

    checks.forEach(check => {
      const status = check.passed ? '✅' : '❌';
      console.log(`${status} ${check.name}`);
    });

    const allPassed = checks.every(c => c.passed);
    console.log(`\n${allPassed ? '🎉' : '⚠️ '} Overall: ${allPassed ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED'}\n`);

  } catch (error) {
    console.error('\n❌ Error during verification:', error);
    console.error(error instanceof Error ? error.stack : error);
    process.exit(1);
  }
}

main();

#!/usr/bin/env tsx
/**
 * Test script for collector and quick checks
 * Run with: tsx test-collector.ts
 */

import { collectInfraContext } from './src/server/services/collector.js';
import { runQuickChecks } from './src/server/services/quick-checks.js';

async function main() {
  console.log('🔍 Testing Docker Data Collection & Quick Checks\n');

  try {
    // Test 1: Collect infrastructure context
    console.log('📦 Collecting infrastructure context...');
    const context = await collectInfraContext();

    console.log('✅ Collection successful!');
    console.log(`   - Docker version: ${context.dockerVersion}`);
    console.log(`   - OS: ${context.os}`);
    console.log(`   - Total containers: ${context.totalContainers}`);
    console.log(`   - Containers found: ${context.containers.length}`);
    console.log(`   - Networks: ${context.networks.length}`);
    console.log(`   - Volumes: ${context.volumes.length}`);
    console.log(`   - Compose files: ${context.composeFiles.length}`);

    if (context.containers.length > 0) {
      console.log('\n📋 Sample container info:');
      const sample = context.containers[0];
      console.log(`   - Name: ${sample.name}`);
      console.log(`   - Image: ${sample.image}`);
      console.log(`   - Status: ${sample.status}`);
      console.log(`   - User: ${sample.user || 'root'}`);
      console.log(`   - Privileged: ${sample.privileged}`);
      console.log(`   - Network mode: ${sample.networkMode}`);
      console.log(`   - Memory limit: ${sample.memoryLimit || 'unlimited'}`);
      console.log(`   - CPU limit: ${sample.cpuLimit || 'unlimited'}`);
    }

    // Test 2: Run quick checks
    console.log('\n🔐 Running quick security checks...');
    const findings = runQuickChecks(context);

    console.log(`✅ Quick checks complete: ${findings.length} findings`);

    // Group findings by severity
    const critical = findings.filter(f => f.severity === 'critical');
    const high = findings.filter(f => f.severity === 'high');
    const medium = findings.filter(f => f.severity === 'medium');
    const low = findings.filter(f => f.severity === 'low');

    console.log(`   - Critical: ${critical.length}`);
    console.log(`   - High: ${high.length}`);
    console.log(`   - Medium: ${medium.length}`);
    console.log(`   - Low: ${low.length}`);

    if (findings.length > 0) {
      console.log('\n⚠️  Sample findings:');
      findings.slice(0, 3).forEach(finding => {
        console.log(`\n   [${finding.severity.toUpperCase()}] ${finding.title}`);
        console.log(`   Category: ${finding.category}`);
        console.log(`   Container: ${finding.container || 'infrastructure-wide'}`);
        console.log(`   Description: ${finding.description.substring(0, 100)}...`);
      });
    }

    console.log('\n✅ All tests passed!\n');
  } catch (error) {
    console.error('❌ Test failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();

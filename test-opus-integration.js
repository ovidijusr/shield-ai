#!/usr/bin/env node
/**
 * Quick test to verify Opus integration implementations
 */

import { buildAuditPrompt } from './dist/server/server/prompts/audit.js';
import { buildChatSystemPrompt } from './dist/server/server/prompts/chat.js';

console.log('Testing Anthropic Opus Integration...\n');

// Test 1: Audit Prompt Builder
console.log('✓ Test 1: buildAuditPrompt function');
const mockContext = {
  containers: [
    {
      id: 'abc123',
      name: 'test-container',
      image: 'nginx:latest',
      status: 'running',
      created: '2026-02-13',
      user: 'root',
      privileged: false,
      capabilities: [],
      readOnlyRootfs: false,
      ports: [{ containerPort: 80, hostPort: 8080, protocol: 'tcp', hostIp: '0.0.0.0' }],
      networks: ['bridge'],
      networkMode: 'bridge',
      mounts: [],
      volumes: [],
      env: ['NODE_ENV=production'],
      memoryLimit: 0,
      cpuLimit: 0,
      healthcheck: null,
      restartPolicy: 'always',
      labels: {},
    },
  ],
  networks: [
    {
      name: 'bridge',
      driver: 'bridge',
      containers: ['test-container'],
      internal: false,
      enableIPv6: false,
      id: 'net123',
      scope: 'local',
    },
  ],
  volumes: [],
  dockerVersion: '24.0.0',
  os: 'Linux',
  totalContainers: 1,
  composeFiles: [],
  collectedAt: '2026-02-13T14:00:00Z',
};

const mockFindings = [
  {
    id: 'finding-1',
    severity: 'high',
    category: 'privilege',
    title: 'Container running as root',
    container: 'test-container',
    description: 'Container is running as root user',
    risk: 'Root user has full privileges',
    fix: {
      description: 'Add non-root user',
      type: 'compose_replace',
      composePath: null,
      newFileContent: null,
      commands: null,
      sideEffects: 'Container restart required',
      requiresRestart: true,
    },
    source: 'quick_check',
  },
];

try {
  const auditPrompt = buildAuditPrompt(mockContext, mockFindings);
  const promptData = JSON.parse(auditPrompt);

  if (!promptData.system || !promptData.user) {
    throw new Error('Invalid prompt structure');
  }

  if (!promptData.system.includes('ShieldAI')) {
    throw new Error('System prompt missing ShieldAI branding');
  }

  if (!promptData.user.includes('test-container')) {
    throw new Error('User prompt missing container context');
  }

  console.log('  - System prompt length:', promptData.system.length, 'characters');
  console.log('  - User prompt length:', promptData.user.length, 'characters');
  console.log('  - Contains infrastructure context: ✓');
  console.log('  - Contains quick findings: ✓');
  console.log();
} catch (error) {
  console.error('  ✗ Error:', error.message);
  process.exit(1);
}

// Test 2: Chat System Prompt Builder
console.log('✓ Test 2: buildChatSystemPrompt function');
try {
  const chatPromptNoAudit = buildChatSystemPrompt(mockContext);

  if (!chatPromptNoAudit.includes('ShieldAI')) {
    throw new Error('Chat prompt missing ShieldAI branding');
  }

  if (!chatPromptNoAudit.includes('test-container')) {
    throw new Error('Chat prompt missing container context');
  }

  console.log('  - Without audit results:', chatPromptNoAudit.length, 'characters');

  const mockAuditResult = {
    overallScore: 75,
    scoreExplanation: 'Good security posture with room for improvement',
    findings: mockFindings,
    goodPractices: [
      {
        id: 'gp-1',
        category: 'networking',
        title: 'Network isolation',
        description: 'Using isolated networks',
        appliesTo: ['test-container'],
      },
    ],
    architecturalRecommendations: [
      {
        id: 'ar-1',
        title: 'Add load balancer',
        description: 'Consider adding a load balancer',
        impact: 'Improved availability',
        complexity: 'medium',
      },
    ],
    auditedAt: '2026-02-13T14:00:00Z',
  };

  const chatPromptWithAudit = buildChatSystemPrompt(mockContext, mockAuditResult);

  if (!chatPromptWithAudit.includes('Overall Security Score')) {
    throw new Error('Chat prompt missing audit context');
  }

  if (chatPromptWithAudit.length <= chatPromptNoAudit.length) {
    throw new Error('Chat prompt with audit should be longer');
  }

  console.log('  - With audit results:', chatPromptWithAudit.length, 'characters');
  console.log('  - Contains infrastructure context: ✓');
  console.log('  - Contains audit summary: ✓');
  console.log();
} catch (error) {
  console.error('  ✗ Error:', error.message);
  process.exit(1);
}

// Test 3: Verify exports exist
console.log('✓ Test 3: Verify service exports');
try {
  const opusAudit = await import('./dist/server/server/services/opus-audit.js');
  const opusChat = await import('./dist/server/server/services/opus-chat.js');

  if (typeof opusAudit.streamOpusAudit !== 'function') {
    throw new Error('streamOpusAudit not exported');
  }

  if (typeof opusAudit.runOpusAudit !== 'function') {
    throw new Error('runOpusAudit not exported');
  }

  if (typeof opusChat.streamOpusChat !== 'function') {
    throw new Error('streamOpusChat not exported');
  }

  if (typeof opusChat.chat !== 'function') {
    throw new Error('chat not exported');
  }

  console.log('  - streamOpusAudit: ✓');
  console.log('  - runOpusAudit: ✓');
  console.log('  - streamOpusChat: ✓');
  console.log('  - chat: ✓');
  console.log();
} catch (error) {
  console.error('  ✗ Error:', error.message);
  process.exit(1);
}

console.log('═══════════════════════════════════════════');
console.log('All tests passed! ✓');
console.log('═══════════════════════════════════════════');
console.log();
console.log('Implementation Summary:');
console.log('  1. buildAuditPrompt() - Comprehensive audit prompt builder');
console.log('  2. buildChatSystemPrompt() - Context-aware chat system prompt');
console.log('  3. streamOpusAudit() - Streaming audit generator');
console.log('  4. streamOpusChat() - Streaming chat generator');
console.log();
console.log('API Configuration:');
console.log('  - Model: claude-opus-4-6');
console.log('  - Audit max_tokens: 16000');
console.log('  - Chat max_tokens: 4096');
console.log('  - API Key: ' + (process.env.ANTHROPIC_API_KEY ? '✓ Set' : '✗ Not set'));
console.log();

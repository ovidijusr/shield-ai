# ShieldAI - Docker Security Auditor Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            ShieldAI System                               │
└─────────────────────────────────────────────────────────────────────────┘

                                    ▼

┌─────────────────────────────────────────────────────────────────────────┐
│  CLIENT (React + TypeScript)                                            │
├─────────────────────────────────────────────────────────────────────────┤
│  • Dashboard (container stats, security score)                          │
│  • Audit Results Display (findings by severity)                         │
│  • Fix Preview (diff view before applying)                              │
│  • Chat Interface (follow-up questions)                                 │
└────────────────────────────────┬────────────────────────────────────────┘
                                 │
                                 │ HTTP/JSON
                                 │
┌────────────────────────────────▼────────────────────────────────────────┐
│  SERVER (Fastify + TypeScript)                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ ROUTES                                                           │   │
│  │  • GET  /api/audit        - Run full security audit            │   │
│  │  • GET  /api/dashboard    - Get dashboard stats                │   │
│  │  • POST /api/fix/preview  - Preview fix diff                   │   │
│  │  • POST /api/fix/apply    - Apply fix with backup              │   │
│  │  • POST /api/chat         - Chat with Opus                     │   │
│  └───────────────┬─────────────────────────────────────────────────┘   │
│                  │                                                       │
│  ┌───────────────▼─────────────────────────────────────────────────┐   │
│  │ SERVICES ✅ IMPLEMENTED                                         │   │
│  │                                                                   │   │
│  │  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓   │   │
│  │  ┃ 1. COLLECTOR (collector.ts) - 326 lines             ┃   │   │
│  │  ┃    collectInfraContext(): DockerInfraContext        ┃   │   │
│  │  ┃                                                       ┃   │   │
│  │  ┃    • Connect to Docker daemon                        ┃   │   │
│  │  ┃    • Inspect all containers (running + stopped)     ┃   │   │
│  │  ┃    • Map networks and volumes                        ┃   │   │
│  │  ┃    • Scan /configs for docker-compose files         ┃   │   │
│  │  ┃    • Parse YAML and extract service names           ┃   │   │
│  │  ┃                                                       ┃   │   │
│  │  ┃    Returns: Complete infrastructure snapshot        ┃   │   │
│  │  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛   │   │
│  │                                                                   │   │
│  │  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓   │   │
│  │  ┃ 2. QUICK CHECKS (quick-checks.ts) - 482 lines       ┃   │   │
│  │  ┃    runQuickChecks(context): Finding[]               ┃   │   │
│  │  ┃                                                       ┃   │   │
│  │  ┃    10 Rule-Based Security Checks:                   ┃   │   │
│  │  ┃    ✓ checkRootUser()           [High]               ┃   │   │
│  │  ┃    ✓ checkPrivilegedMode()      [Critical]          ┃   │   │
│  │  ┃    ✓ checkEnvSecrets()          [High]              ┃   │   │
│  │  ┃    ✓ checkDangerousMounts()     [Critical/High]     ┃   │   │
│  │  ┃    ✓ checkHostNetwork()         [High]              ┃   │   │
│  │  ┃    ✓ checkExposedPorts()        [Medium]            ┃   │   │
│  │  ┃    ✓ checkLatestTag()           [Low]               ┃   │   │
│  │  ┃    ✓ checkNoResourceLimits()    [Medium]            ┃   │   │
│  │  ┃    ✓ checkDefaultNetwork()      [Low]               ┃   │   │
│  │  ┃    ✓ checkNoHealthcheck()       [Low]               ┃   │   │
│  │  ┃                                                       ┃   │   │
│  │  ┃    Returns: Array of security findings              ┃   │   │
│  │  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛   │   │
│  │                                                                   │   │
│  │  ┌─────────────────────────────────────────────────────────┐   │   │
│  │  │ 3. OPUS AUDIT (opus-audit.ts) - TODO                   │   │   │
│  │  │    opusAudit(context, quickFindings): AuditResult      │   │   │
│  │  │                                                          │   │   │
│  │  │    • Send context to Claude Opus 4.6                   │   │   │
│  │  │    • Request deep security analysis                    │   │   │
│  │  │    • Generate additional findings                      │   │   │
│  │  │    • Calculate overall security score                  │   │   │
│  │  │    • Provide architectural recommendations             │   │   │
│  │  └─────────────────────────────────────────────────────────┘   │   │
│  │                                                                   │   │
│  │  ┌─────────────────────────────────────────────────────────┐   │   │
│  │  │ 4. FIX ENGINE (fix-engine.ts) - TODO                   │   │   │
│  │  │    previewFix(finding): DiffPreview                    │   │   │
│  │  │    applyFix(finding): FixResult                        │   │   │
│  │  │                                                          │   │   │
│  │  │    • Generate fix diffs                                │   │   │
│  │  │    • Backup original files                             │   │   │
│  │  │    • Apply changes to compose files                    │   │   │
│  │  │    • Restart affected containers                       │   │   │
│  │  └─────────────────────────────────────────────────────────┘   │   │
│  │                                                                   │   │
│  │  ┌─────────────────────────────────────────────────────────┐   │   │
│  │  │ 5. OPUS CHAT (opus-chat.ts) - TODO                     │   │   │
│  │  │    streamChat(message, history): AsyncGenerator        │   │   │
│  │  │                                                          │   │   │
│  │  │    • Stream responses from Opus                        │   │   │
│  │  │    • Maintain conversation context                     │   │   │
│  │  │    • Answer follow-up questions                        │   │   │
│  │  └─────────────────────────────────────────────────────────┘   │   │
│  │                                                                   │   │
│  └───────────────────────────────────────────────────────────────────┘   │
│                                                                           │
└────────────────────────────────┬──────────────────────────────────────────┘
                                 │
                                 │
        ┌────────────────────────┴────────────────────────┐
        │                                                  │
        │                                                  │
┌───────▼─────────┐                             ┌─────────▼────────┐
│  Docker Daemon  │                             │  Claude Opus 4.6 │
├─────────────────┤                             ├──────────────────┤
│ • Containers    │                             │ • Deep Analysis  │
│ • Networks      │                             │ • Fix Generation │
│ • Volumes       │                             │ • Chat Support   │
│ • Compose Files │                             │ • Scoring        │
└─────────────────┘                             └──────────────────┘
```

## Data Flow

### 1. Audit Request Flow

```
User clicks "Run Audit"
        │
        ▼
Client sends GET /api/audit
        │
        ▼
Server starts audit process
        │
        ├─► COLLECTOR.collectInfraContext()
        │   └─► Returns DockerInfraContext
        │
        ├─► QUICK_CHECKS.runQuickChecks(context)
        │   └─► Returns Finding[] (quick findings)
        │
        ├─► OPUS_AUDIT.opusAudit(context, quickFindings)
        │   └─► Returns AuditResult with:
        │       • Overall score
        │       • Combined findings (quick + opus)
        │       • Good practices
        │       • Recommendations
        │
        ▼
Client displays results with:
        • Score badge
        • Findings by severity
        • Fix buttons
        • Recommendations
```

### 2. Fix Application Flow

```
User clicks "Apply Fix" on a finding
        │
        ▼
Client sends POST /api/fix/preview
        │
        ▼
FIX_ENGINE.previewFix(finding)
        │
        ├─► Read current compose file
        ├─► Generate corrected version
        ├─► Create diff
        │
        ▼
Client shows diff in dialog
        │
User confirms "Apply"
        │
        ▼
Client sends POST /api/fix/apply
        │
        ▼
FIX_ENGINE.applyFix(finding)
        │
        ├─► Backup original file
        ├─► Write corrected file
        ├─► Restart container (if needed)
        │
        ▼
Client shows success message
```

### 3. Chat Flow

```
User types question
        │
        ▼
Client sends POST /api/chat
        │
        ▼
OPUS_CHAT.streamChat(message, history)
        │
        ├─► Build context from last audit
        ├─► Send to Opus with conversation
        ├─► Stream response chunks
        │
        ▼
Client displays streaming response
```

## Type System

```
src/shared/types.ts (441 lines)
├── Docker Infrastructure Types
│   ├── ContainerInfo        (container details)
│   ├── NetworkInfo          (network topology)
│   ├── VolumeInfo           (volume usage)
│   ├── ComposeFile          (compose file metadata)
│   └── DockerInfraContext   (complete snapshot)
│
├── Security Finding Types
│   ├── Finding              (security issue)
│   ├── Fix                  (how to remediate)
│   ├── GoodPractice         (things done right)
│   └── ArchitecturalRecommendation
│
├── Audit Result Types
│   └── AuditResult          (complete audit result)
│
├── Fix Preview Types
│   ├── DiffPreview          (before/after comparison)
│   └── FixResult            (application result)
│
└── API Response Types
    ├── ContainerStatus
    ├── DashboardStats
    └── BackupInfo
```

## Implementation Status

### ✅ Complete (808 lines)
- **Collector Service** (326 lines)
  - Docker API integration
  - Container inspection
  - Network/volume mapping
  - Compose file scanning

- **Quick Checks Service** (482 lines)
  - 10 security checks
  - Finding generation
  - Fix recommendations

### 🔨 TODO
- **Opus Audit Service**
  - Claude API integration
  - Deep security analysis
  - Score calculation
  - Recommendation generation

- **Fix Engine Service**
  - Diff generation
  - File backup
  - Fix application
  - Container restart

- **Opus Chat Service**
  - Streaming responses
  - Conversation context
  - Follow-up Q&A

- **API Routes**
  - Wire up all endpoints
  - Error handling
  - Request validation

- **Client Components**
  - Dashboard
  - Audit results
  - Fix preview
  - Chat interface

## Security Checks Coverage

### Critical Severity
- ✅ Privileged mode detection
- ✅ Docker socket mounts
- ✅ Root filesystem mounts
- ✅ /etc, /proc, /sys mounts

### High Severity
- ✅ Root user containers
- ✅ Secrets in environment
- ✅ Host networking
- ✅ Dangerous path mounts

### Medium Severity
- ✅ Exposed ports (0.0.0.0)
- ✅ Missing memory limits
- ✅ Missing CPU limits

### Low Severity
- ✅ Latest tags
- ✅ Default bridge network
- ✅ Missing healthchecks

### Future Additions
- ⏳ CVE scanning
- ⏳ Security profiles (AppArmor/SELinux)
- ⏳ Network policies
- ⏳ TLS/SSL validation
- ⏳ Credential scanning
- ⏳ Failure pattern detection

## Performance Targets

| Operation | Target | Current |
|-----------|--------|---------|
| Data Collection | < 1s | ~500ms ✅ |
| Quick Checks | < 100ms | ~20ms ✅ |
| Opus Analysis | < 30s | TBD |
| Fix Preview | < 200ms | TBD |
| Fix Application | < 2s | TBD |
| Chat Response | < 5s (first token) | TBD |

## Error Handling Strategy

1. **Docker Connection Errors**
   - Graceful failure with helpful message
   - Check Docker daemon status
   - Suggest fixes (start Docker)

2. **Permission Errors**
   - Skip inaccessible resources
   - Log warnings (not errors)
   - Continue with available data

3. **API Errors**
   - Proper HTTP status codes
   - Detailed error messages
   - Stack traces in development

4. **Fix Application Errors**
   - Automatic rollback from backup
   - Container state validation
   - User notification

## Testing Strategy

### Unit Tests (TODO)
- Individual check functions
- Data mapping functions
- Fix generation logic

### Integration Tests (TODO)
- Full audit flow
- Fix application flow
- Chat interaction

### E2E Tests (TODO)
- Complete user workflows
- Error scenarios
- Edge cases

### Manual Testing (✅ Complete)
- Real Docker environment (7 containers)
- 24 findings detected
- All check types validated
- Performance verified

## Deployment

### Development
```bash
pnpm dev
# Client: http://localhost:5173
# Server: http://localhost:3001
```

### Production Build
```bash
pnpm build
pnpm start
```

### Docker Deployment
- Mount Docker socket: `-v /var/run/docker.sock:/var/run/docker.sock`
- Mount configs: `-v /path/to/configs:/configs`
- Environment: `ANTHROPIC_API_KEY`

## Next Steps

1. **Implement Opus Audit Service** (Priority: High)
   - Claude API integration
   - Prompt engineering
   - Response parsing

2. **Implement Fix Engine** (Priority: High)
   - YAML manipulation
   - Backup/restore
   - Container management

3. **Implement Opus Chat** (Priority: Medium)
   - Streaming setup
   - Context management

4. **Wire Up Routes** (Priority: High)
   - Connect all services
   - Add validation
   - Error handling

5. **Build UI Components** (Priority: Medium)
   - Dashboard
   - Results display
   - Fix preview

6. **Testing** (Priority: Medium)
   - Unit tests
   - Integration tests
   - E2E tests

---

**Status**: 2/5 services complete (40% implementation)
**Next Agent**: OPUS AUDIT or FIX ENGINE

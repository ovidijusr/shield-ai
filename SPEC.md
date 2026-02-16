# 🛡️ ShieldAI — AI-Powered Security Auditor & Fixer for Your Homelab

## Hackathon Project Spec v2 (Revised)
**Anthropic Virtual Hackathon | Feb 13–16, 2026**
**Solo project by Ovi**

---

## 1. Project Overview

### Elevator Pitch
ShieldAI is a self-hosted Docker security auditor that connects to your running infrastructure, identifies misconfigurations, explains risks in plain English, and applies fixes — with you in the loop. Unlike traditional scanners (Trivy, Docker Bench) that dump CVE lists or cryptic pass/fail results, ShieldAI uses Claude Opus 4.6 to understand your *specific* setup: how your containers relate to each other, what's actually exposed, and what matters most. It doesn't just tell you "container running as root is bad" — it tells you "your Plex container is running as root, which means if someone exploits the known Plex media scanner vulnerability, they get root on your NAS where your family photos live." Click "Fix it" → see a diff preview → apply the change → config backed up automatically. ShieldAI turns Docker security from a weekend research project into a 5-minute guided experience.

### Problem Statement Fit

**PS1: Build a Tool That Should Exist** + **PS2: Break the Barriers**

Docker security knowledge is locked behind CIS Benchmark PDFs, years of sysadmin experience, and enterprise tools that cost $45+/dev/month. ShieldAI puts that expertise in every homelab operator's hands for free.

---

## 2. Why ShieldAI Wins (Judging Criteria Strategy)

### Impact (25%)
Every Docker user running containers at home or on a VPS benefits. Docker has 20M+ monthly active developers, the homelab subreddit has 1.5M+ members. Most homelabs have 5-15 security misconfigurations that the operator doesn't know about. Personal story: "I run 23+ containers on my Unraid NAS. I built this to audit my own setup — and found issues I didn't know I had."

### Opus 4.6 Use (25%) — KEY DIFFERENTIATOR
6 distinct, creative uses:

1. **Infrastructure-aware reasoning** — Opus receives the FULL topology and reasons about security holistically, not rule-by-rule
2. **Risk contextualization** — Explains the specific blast radius in YOUR setup: which volumes are exposed, what data is at risk
3. **Fix generation** — Generates complete corrected config files tailored to your exact setup
4. **Architectural analysis** — Understands container relationships and cross-service attack paths
5. **Conversational advisor** — Full-context chat about YOUR infrastructure with actionable answers
6. **Severity scoring with reasoning** — Explains WHY something is critical in your context, provides overall security score

### Depth & Execution (20%)
Not a wrapper. Engineering surface area includes: Docker API integration, compose file parsing, config diff generation, backup system, container restart, environment variable secret detection, real-time container status, streaming AI responses.

### Demo (30%)
Dramatic and authentic: Real NAS with 23 containers → real issues found → actually fixed live → before/after security score. Not fabricated data.

---

## 3. Technical Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        User's Browser                       │
│  ┌───────────────────────────────────────────────────────┐  │
│  │         ShieldAI Web UI (React + Vite + RQ)           │  │
│  │  ┌──────────┐ ┌──────────┐ ┌─────────┐ ┌──────────┐  │  │
│  │  │Dashboard │ │Findings  │ │Fix View │ │AI Chat   │  │  │
│  │  │& Score   │ │List      │ │& Diff   │ │Advisor   │  │  │
│  │  └──────────┘ └──────────┘ └─────────┘ └──────────┘  │  │
│  └────────────────────────┬──────────────────────────────┘  │
└───────────────────────────┼─────────────────────────────────┘
                            │ HTTP (REST + SSE streaming)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              ShieldAI Backend (Fastify + TypeScript)         │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Docker       │  │ Audit Engine │  │ Fix Engine        │  │
│  │ Collector    │  │              │  │ (Simplified)      │  │
│  │              │  │ - Quick checks│ │                   │  │
│  │ - Containers │  │ - Opus deep  │  │ - Opus generates  │  │
│  │ - Networks   │  │   analysis   │  │   full file       │  │
│  │ - Volumes    │  │ - Streaming  │  │ - Show diff       │  │
│  │ - Compose    │  │   response   │  │ - Backup + swap   │  │
│  │   files      │  │              │  │ - Restart          │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────────┘  │
│         ▼                 ▼                  ▼              │
│  ┌────────────┐   ┌─────────────┐   ┌────────────────┐     │
│  │Docker API  │   │Anthropic API│   │Filesystem      │     │
│  │docker.sock │   │(Opus 4.6)   │   │(compose, bkups)│     │
│  └────────────┘   └─────────────┘   └────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

### How It Runs

```yaml
# docker-compose.yml for ShieldAI
services:
  shieldai:
    image: shieldai:latest
    container_name: shieldai
    ports:
      - "8484:8484"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - /path/to/compose/files:/configs        # compose files (read + write for fixes)
      - ./backups:/backups
      - ./data:/data
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - SHIELDAI_PORT=8484
      - SHIELDAI_TOKEN=${SHIELDAI_TOKEN}       # basic auth token
    restart: unless-stopped
```

**Security notes:**
- Docker socket mounted READ-ONLY for audit phase
- Fix Engine writes to compose files in `/configs` (requires RW mount) and uses `docker restart` CLI commands
- Basic token auth protects the ShieldAI UI itself (ironic to ship an insecure security tool)

---

## 4. Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Frontend** | React 18 + Vite + TailwindCSS + React Query | Fast prototyping, great DX, type-safe data fetching |
| **Backend** | Fastify + TypeScript | Fast, TS-native, great plugin ecosystem |
| **Docker Integration** | dockerode | Battle-tested Node.js Docker API client |
| **AI** | Claude Opus 4.6 via Anthropic SDK | Hackathon requirement + best infrastructure reasoning |
| **Diff Display** | diff library + custom component | Show config changes before applying |
| **File Parsing** | yaml (npm) for compose files | Parse and display docker-compose.yml |
| **Deployment** | Docker container on user's NAS | Self-hosted by design |

**Deliberately NOT using:**
- Monorepo/pnpm workspaces (unnecessary for hackathon — single project)
- Shared type packages (duplicate types, it's fine)
- WebSockets (SSE for streaming, polling for status)
- Hono (Fastify is more battle-tested with better ecosystem)

---

## 5. Data Collection Layer (Docker Collector)

### What We Read From Docker API

```typescript
interface DockerInfraContext {
  containers: {
    id: string;
    name: string;
    image: string;
    status: string;
    created: string;
    user: string;              // Running as root?
    privileged: boolean;
    capabilities: string[];
    readOnlyRootfs: boolean;
    ports: PortMapping[];
    networks: string[];
    networkMode: string;
    mounts: Mount[];
    volumes: Volume[];
    env: string[];             // Hardcoded secrets?
    memoryLimit: number;
    cpuLimit: number;
    healthcheck: Healthcheck | null;
    restartPolicy: string;
  }[];

  networks: {
    name: string;
    driver: string;
    containers: string[];
    internal: boolean;
    enableIPv6: boolean;
  }[];

  volumes: {
    name: string;
    driver: string;
    mountPoint: string;
    usedBy: string[];
  }[];

  dockerVersion: string;
  os: string;
  totalContainers: number;

  // Compose files from mounted /configs directory
  composeFiles: {
    path: string;
    content: string;
    services: string[];
  }[];
}
```

### Collection Implementation

```typescript
import Docker from 'dockerode';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

export async function collectInfraContext(): Promise<DockerInfraContext> {
  const [containers, networks, volumes, info] = await Promise.all([
    docker.listContainers({ all: true }),
    docker.listNetworks(),
    docker.listVolumes(),
    docker.info(),
  ]);

  const containerDetails = await Promise.all(
    containers.map(async (c) => {
      const inspection = await docker.getContainer(c.Id).inspect();
      return mapToSecurityContext(inspection);
    })
  );

  const composeFiles = await scanComposeFiles('/configs');

  return {
    containers: containerDetails,
    networks: networks.map(mapNetworkToContext),
    volumes: volumes.Volumes?.map(mapVolumeToContext) ?? [],
    dockerVersion: info.ServerVersion,
    os: info.OperatingSystem,
    totalContainers: info.Containers,
    composeFiles,
  };
}
```

---

## 6. Audit Engine

### Pre-Audit: Rule-Based Quick Checks

Fast local checks before calling Opus. Reduces API cost and provides instant feedback.

```typescript
const quickChecks: QuickCheck[] = [
  { id: 'root-user',        category: 'critical', /* containers running as root */ },
  { id: 'privileged-mode',  category: 'critical', /* privileged: true */ },
  { id: 'env-secrets',      category: 'critical', /* password/key/token in env vars */ },
  { id: 'dangerous-mounts', category: 'critical', /* RW mounts of /, /etc, /proc, /sys, docker.sock */ },
  { id: 'host-network',     category: 'warning',  /* network_mode: host */ },
  { id: 'exposed-ports',    category: 'warning',  /* ports on 0.0.0.0 */ },
  { id: 'latest-tag',       category: 'warning',  /* :latest or no tag */ },
  { id: 'no-resource-limits', category: 'warning', /* no memory/CPU limits */ },
  { id: 'default-network',  category: 'warning',  /* many containers on default bridge */ },
  { id: 'no-healthcheck',   category: 'info',     /* missing healthcheck */ },
];
```

### Opus 4.6 Deep Analysis (Streamed)

After quick checks, send full context to Opus via **streaming** to avoid long wait times. Quick check results appear instantly, then Opus findings stream in progressively.

**Audit Prompt (key points):**
- Receives COMPLETE infrastructure context + quick check results
- Enhances pre-detected findings with specific risk explanations
- Identifies architectural-level issues rule-based checks can't detect
- Generates specific, actionable fixes for each finding
- Calculates overall security score (0-100)
- Credits good practices (positive reinforcement)

**Response Schema:**
```typescript
interface AuditResult {
  overallScore: number;           // 0-100
  scoreExplanation: string;
  findings: Finding[];
  goodPractices: GoodPractice[];
  architecturalRecommendations: ArchRecommendation[];
}

interface Finding {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  title: string;
  container: string | null;
  description: string;            // Specific to THIS setup
  risk: string;                   // Specific blast radius
  fix: {
    description: string;
    type: 'compose_replace' | 'docker_command' | 'manual';
    composePath: string | null;
    newFileContent: string | null; // FULL corrected file (simplified approach)
    commands: string[] | null;
    sideEffects: string;
    requiresRestart: boolean;
  };
}
```

**Key simplification vs v1:** Instead of generating granular YAML path changes, Opus generates the complete corrected compose file. This is more reliable, easier to diff, and eliminates brittle YAML manipulation code. The diff is computed by comparing original vs new file string.

### Conversational Advisor

Full infrastructure context + audit results + conversation history → Opus answers questions about YOUR specific setup. Can also generate fixes from chat (same schema as audit findings).

---

## 7. Fix Engine (Simplified)

### Key Design Decision
**v1 approach (cut):** Parse YAML → apply path-based changes → serialize back. Brittle with anchors, aliases, comments, multi-file setups.

**v2 approach:** Opus generates complete corrected file → compute string diff → show to user → backup original → overwrite with new file → restart container. Simple, reliable, same demo impact.

### Fix Workflow

```
User clicks "Fix it"
        │
        ▼
┌──────────────────────────────────┐
│ 1. Opus already generated the    │
│    corrected file in audit       │
│    response (or generate now)    │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│ 2. Compute & show diff           │
│    - Original vs corrected       │
│    - Syntax highlighted          │
│    - Side effects listed         │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│ 3. User reviews & confirms       │
│    [Apply Fix]  [Cancel]         │
└──────────────┬───────────────────┘
               │  User clicks Apply
               ▼
┌──────────────────────────────────┐
│ 4. Backup original file          │
│    → /backups/{timestamp}/       │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│ 5. Write corrected file          │
│    (overwrite original)          │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│ 6. Restart affected container    │
│    docker restart <name>         │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│ 7. Report result                 │
│    ✅ Container running          │
│    or ❌ Failed (backup at: ...) │
└──────────────────────────────────┘
```

### Implementation

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';
import { diffLines } from 'diff';

export async function previewFix(finding: Finding): Promise<DiffPreview> {
  const original = await fs.readFile(finding.fix.composePath!, 'utf-8');
  const corrected = finding.fix.newFileContent!;

  return {
    before: original,
    after: corrected,
    diff: diffLines(original, corrected),
    sideEffects: finding.fix.sideEffects,
  };
}

export async function applyFix(finding: Finding): Promise<FixResult> {
  const composePath = finding.fix.composePath!;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = `/backups/${timestamp}`;

  // 1. Backup
  await fs.mkdir(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, path.basename(composePath));
  await fs.copyFile(composePath, backupPath);

  // 2. Write corrected file
  await fs.writeFile(composePath, finding.fix.newFileContent!);

  // 3. Restart container (simple approach)
  if (finding.fix.requiresRestart && finding.container) {
    const { execSync } = require('child_process');
    try {
      execSync(`docker restart ${finding.container}`, { timeout: 30000 });
    } catch (e) {
      return {
        success: false,
        backupPath,
        error: `Container restart failed. Backup at: ${backupPath}`,
      };
    }
  }

  // 4. Run docker commands if specified
  if (finding.fix.commands) {
    for (const cmd of finding.fix.commands) {
      execSync(cmd, { timeout: 30000 });
    }
  }

  return { success: true, backupPath };
}
```

No rollback UI needed — if something breaks, the user has the backup path and can manually restore. For the hackathon, this is sufficient.

---

## 8. API Routes

```typescript
import Fastify from 'fastify';

const app = Fastify({ logger: true });

// ─── Auth middleware ───────────────────────────────────────
app.addHook('onRequest', async (req, reply) => {
  const token = req.headers['authorization']?.replace('Bearer ', '');
  if (process.env.SHIELDAI_TOKEN && token !== process.env.SHIELDAI_TOKEN) {
    reply.code(401).send({ error: 'Unauthorized' });
  }
});

// ─── Scan & Audit ─────────────────────────────────────────
app.get('/api/containers', async () => {
  // Real-time container status (for dashboard)
  return await getContainerStatus();
});

app.post('/api/audit', async (req, reply) => {
  // Full audit: quick checks + Opus deep analysis
  // Returns SSE stream: quick checks first, then Opus findings
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
  });

  const context = await collectInfraContext();

  // Send quick check results immediately
  const quickFindings = runQuickChecks(context);
  reply.raw.write(`data: ${JSON.stringify({ type: 'quick', findings: quickFindings })}\n\n`);

  // Stream Opus deep analysis
  const stream = await callOpusAuditStreaming(context, quickFindings);
  for await (const chunk of stream) {
    reply.raw.write(`data: ${JSON.stringify({ type: 'opus', chunk })}\n\n`);
  }

  reply.raw.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
  reply.raw.end();
});

// ─── Findings & Fixes ─────────────────────────────────────
app.get('/api/findings', async () => {
  return await getCachedAudit();
});

app.post('/api/fix/preview', async (req) => {
  const { findingId } = req.body as { findingId: string };
  const finding = await getFindingById(findingId);
  return await previewFix(finding);
});

app.post('/api/fix/apply', async (req) => {
  const { findingId } = req.body as { findingId: string };
  const finding = await getFindingById(findingId);
  return await applyFix(finding);
});

// ─── AI Chat ──────────────────────────────────────────────
app.post('/api/chat', async (req, reply) => {
  // Streamed response via SSE
  const { message, history } = req.body as { message: string; history: Message[] };
  reply.raw.writeHead(200, { 'Content-Type': 'text/event-stream' });

  const context = await collectInfraContext();
  const auditResults = await getCachedAudit();
  const stream = await callOpusChatStreaming(context, auditResults, history, message);

  for await (const chunk of stream) {
    reply.raw.write(`data: ${JSON.stringify(chunk)}\n\n`);
  }
  reply.raw.end();
});

// ─── Backups ──────────────────────────────────────────────
app.get('/api/backups', async () => {
  return await listBackups();
});
```

---

## 9. Frontend UI Design

### Aesthetic Direction
- Dark theme (security tool = dark mode)
- Clean, data-dense (inspired by Grafana but simpler)
- Colors: Red (critical), Orange (high), Yellow (medium), Blue (low), Green (good)
- Monospace for container names and config, Inter for UI text
- Smooth transitions between scan/audit/fix states

### Key Views

**Dashboard:** Security score gauge + findings summary + infrastructure overview (container count, networks, volumes, exposed ports) + findings list sorted by severity + good practices section.

**Finding Card:** Severity badge, container name, description, risk explanation. Buttons: "Explain Risk" / "Fix It" / "Skip"

**Fix Preview:** Side-by-side diff (before/after) with syntax highlighting. Side effects warning. Backup location. "Apply Fix" / "Copy Diff" / "Cancel" buttons.

**AI Chat Panel:** Slide-out panel or dedicated page. Full conversation with streaming responses. Suggested actions from chat ("Generate & Preview Fix" / "Explain More").

### Error States (important for demo resilience)
- **No Docker socket:** "ShieldAI can't connect to Docker. Make sure docker.sock is mounted."
- **Invalid API key:** "Anthropic API key is invalid. Check your ANTHROPIC_API_KEY environment variable."
- **Opus returns malformed JSON:** Fall back to displaying raw text findings with a "AI analysis partially failed" banner. Quick checks still show.
- **Container restart fails:** Show error with backup path, suggest manual restore.
- **No compose files found:** Still audit via Docker API, mark all fixes as "manual" type with copy-pasteable instructions.

---

## 10. Security Checks Covered

### Critical
- Root user (PUID=0 or no USER directive)
- Privileged mode (`privileged: true`)
- Docker socket mount (RW)
- Dangerous host mounts (RW of /, /etc, /proc, /sys)
- Hardcoded secrets (API keys, passwords in env vars)
- Host network mode

### High
- Exposed ports on 0.0.0.0
- No auth on known web UIs (qBit, Portainer, etc.)
- Excessive capabilities (CAP_SYS_ADMIN, CAP_NET_ADMIN)
- Cross-service network exposure

### Medium
- `:latest` tags (unpinned versions)
- No resource limits (memory/CPU)
- No healthchecks
- Read-write volumes that only need read-only
- No restart policy

### Architectural (Opus-driven)
- Network segmentation analysis
- Blast radius mapping (if X is compromised, what can attacker reach?)
- Secret management practices
- Container relationship risks

---

## 11. MVP Scope (Hackathon-Realistic)

### 🟢 Must Have (Day 1) — The Core Loop
- [ ] Docker Collector — read containers, networks, volumes via Docker API
- [ ] Quick Check Engine — 10 rule-based checks (instant results)
- [ ] Opus Deep Audit — streamed analysis with structured findings
- [ ] Findings UI — severity cards, descriptions, risk explanations
- [ ] Security Score — 0-100 gauge with color coding
- [ ] Good Practices — show what user does right

### 🟡 Should Have (Day 2) — The Differentiator
- [ ] Fix Preview — diff view comparing original vs corrected config
- [ ] Backup + Apply Fix — backup original, write new file, restart container
- [ ] AI Chat — conversational advisor with full infra context (streamed)
- [ ] Dashboard — container count, network overview, exposed ports summary

### 🔴 Cut Entirely (Do NOT build)
- ~~Rollback UI~~ (backup path in response is enough)
- ~~Container restart orchestration~~ (simple `docker restart` is fine)
- ~~Port scanning~~ (Docker API already tells us what's exposed)
- ~~Shared types package~~ (duplicate types)
- ~~WebSocket~~ (SSE + polling)
- ~~Monorepo structure~~ (single project)
- ~~Granular YAML path manipulation~~ (Opus generates full file)
- ~~Fix history/log UI~~ (backups directory is the log)
- ~~Export report~~ (not needed for demo)
- ~~Scheduled re-audit~~ (not needed for demo)

### Priority Ladder (if running out of time)
1. Docker collection + quick checks + basic findings UI → **minimum viable demo**
2. Add Opus streaming analysis → **becomes impressive**
3. Add diff preview → **shows engineering depth**
4. Add apply fix with backup → **the wow moment**
5. Add chat → **icing on the cake**

---

## 12. Day-by-Day Timeline

### Day 1 — Friday Feb 14 (Target: Working scan + audit + findings UI)

| Time | Task | Hours |
|------|------|-------|
| Morning | Project setup: Vite + React + Tailwind + Fastify + dockerode | 1h |
| Morning | Docker Collector: containers, networks, volumes | 2h |
| Late morning | Quick Check Engine: 10 rule-based checks | 1.5h |
| Afternoon | Opus integration: audit prompt + streaming + JSON parsing | 2h |
| Afternoon | Findings UI: severity cards, score gauge, good practices | 2.5h |
| Evening | Test against real Unraid NAS | 1h |

**Deliverable:** Scan real Docker environment → see findings with AI explanations and security score. ~10h.

### Day 2 — Saturday Feb 15 (Target: Fix workflow + chat + polish)

| Time | Task | Hours |
|------|------|-------|
| Morning | Diff generation + fix preview UI | 2h |
| Morning | Backup system + apply fix + container restart | 1.5h |
| Afternoon | AI Chat panel with streaming + infra context | 2h |
| Afternoon | Dashboard: container overview, network summary | 1.5h |
| Evening | UI polish: loading states, error states, dark theme tuning | 2h |
| Evening | Full flow test: scan → find → preview → fix → verify | 1h |

**Deliverable:** Complete fix workflow on real NAS. ~10h.

### Day 3 — Sunday Feb 16 (Target: Demo + submission)

| Time | Task | Hours |
|------|------|-------|
| Morning | Bug fixes, edge cases, error state handling | 1.5h |
| Morning | Prepare demo: identify best findings to showcase | 0.5h |
| Afternoon | Record 3-minute demo video on real NAS | 2h |
| Afternoon | README with screenshots + setup instructions | 1h |
| Evening | Dockerfile, docker-compose for ShieldAI itself, push to GitHub | 1.5h |

**Deliverable:** Submitted project. ~7h. Total: ~27h across 3 days.

---

## 13. Demo Video Script (3 Minutes)

**0:00–0:15 — Hook**
"I run 23 containers on my NAS — Plex, Sonarr, Home Assistant, and more. I've always assumed my setup was secure. Today I'm going to find out."

**0:15–0:40 — The Problem**
"Docker security tools give you 200-line reports full of CIS benchmark codes. Nobody reads them. I wanted something that understands MY setup, explains risks I care about, and fixes them."

**0:40–1:30 — Live Scan & Audit**
Click "Scan" → infrastructure discovered → quick checks appear instantly → Opus analysis streams in → Security Score: 54/100. Walk through findings with real container names and real risks. Show good practices too.

**1:30–2:20 — Fix It Live**
Click "Fix It" → diff preview → side effects warning → backup created → "Apply Fix" → container restarts → green check. "That took 10 seconds instead of 30 minutes of Googling."

**2:20–2:45 — AI Chat**
"Should I isolate my download containers from Home Assistant?" → ShieldAI responds with specific recommendation using actual container names.

**2:45–3:00 — Closing**
"ShieldAI is open source, self-hosted, powered by Claude Opus 4.6. Security shouldn't require a degree in cybersecurity."

---

## 14. Project Structure

```
shield-ai/
├── README.md
├── LICENSE                        # MIT
├── docker-compose.yml             # Run ShieldAI itself
├── Dockerfile                     # Multi-stage build
├── .env.example
├── package.json
├── tsconfig.json
├── vite.config.ts
│
├── src/
│   ├── client/                    # React frontend
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── components/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── FindingCard.tsx
│   │   │   ├── FindingsList.tsx
│   │   │   ├── FixPreview.tsx
│   │   │   ├── GoodPractices.tsx
│   │   │   ├── ChatPanel.tsx
│   │   │   ├── ContainerGrid.tsx
│   │   │   ├── ScoreGauge.tsx
│   │   │   └── ScanProgress.tsx
│   │   ├── hooks/
│   │   │   ├── useAudit.ts
│   │   │   ├── useChat.ts
│   │   │   └── useFix.ts
│   │   └── lib/
│   │       ├── api.ts
│   │       └── types.ts
│   │
│   └── server/                    # Fastify backend
│       ├── index.ts
│       ├── routes/
│       │   ├── audit.ts
│       │   ├── fix.ts
│       │   └── chat.ts
│       ├── services/
│       │   ├── collector.ts
│       │   ├── quick-checks.ts
│       │   ├── opus-audit.ts
│       │   ├── opus-chat.ts
│       │   ├── fix-engine.ts
│       │   ├── backup.ts
│       │   └── diff.ts
│       ├── prompts/
│       │   ├── audit.ts
│       │   └── chat.ts
│       └── types.ts
```

Single project. No monorepo. Types duplicated where needed.

---

## 15. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Docker socket is itself a security risk | Mount read-only. Document the irony. Fix engine uses CLI, not socket writes |
| Opus generates wrong fix | Always backup before fix. Show diff. User must confirm. Backup path provided on failure |
| Opus returns malformed JSON | try/catch. Show quick check results as fallback. Banner: "AI analysis partially failed" |
| Slow Opus response | Streaming via SSE. Quick checks appear instantly. Opus findings stream in progressively |
| No compose files (containers created via Unraid UI) | Still audit via Docker API. Fixes shown as manual instructions with copy-paste commands |
| ShieldAI itself has no auth | Add basic bearer token auth. Configurable via env var |
| Container breaks after fix | Backup created before every fix. Error message includes backup path for manual restore |
| Compose files with YAML anchors/aliases | Opus generates full corrected file, preserving structure. No programmatic YAML manipulation |

---

## 16. Token Budget

| Call | Input (est.) | Output (est.) | Cost (est.) |
|------|-------------|---------------|-------------|
| Full audit (23 containers) | ~8,000 | ~4,000 | ~$0.18 |
| Chat message | ~6,000 | ~500 | ~$0.10 |
| **Typical session (1 audit + 3 chats)** | | | **~$0.48** |

---

## 17. What Makes This Win

1. **Not a wrapper** — Docker API integration, compose parsing, diff generation, backup system, container restart. Claude cannot do any of this alone.
2. **Demo is dramatic** — Real NAS, real issues, actually fixed live.
3. **Opus usage is creative** — 6 distinct uses beyond "summarize text."
4. **Streaming UX** — Quick checks instant, Opus findings stream in. No staring at a spinner.
5. **Personal story** — "I built this for my own NAS and found issues I didn't know about."
6. **Actually useful** — Tool you'd keep running permanently, not a demo-only project.
7. **Problem statement fit** — Security expertise democratized.

---

*Built with Claude Opus 4.6 | Anthropic Virtual Hackathon 2026 | MIT License*

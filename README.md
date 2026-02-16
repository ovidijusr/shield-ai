# 🛡️ ShieldAI

AI-Powered Security Auditor & Fixer for Your Docker Homelab

## Overview

ShieldAI is a self-hosted Docker security auditor that connects to your running infrastructure, identifies misconfigurations, explains risks in plain English, and applies fixes — with you in the loop. Unlike traditional scanners that dump CVE lists or cryptic pass/fail results, ShieldAI uses Claude Opus 4.6 to understand your specific setup.

## Features

- **Infrastructure-aware reasoning** — Analyzes your complete Docker topology
- **Risk contextualization** — Explains specific blast radius in YOUR setup
- **Automated fixes** — Generates corrected configs tailored to your infrastructure
- **Conversational advisor** — Full-context chat about YOUR infrastructure
- **Quick checks + Deep analysis** — Fast rule-based checks + comprehensive AI analysis
- **Backup system** — All fixes backed up automatically before applying

## Project Status

🚧 **In Development** - This project is being built for the Anthropic Virtual Hackathon (Feb 13-16, 2026).

### Current Structure

```
shieldai/
├── src/
│   ├── client/           # React frontend (Vite + TailwindCSS)
│   │   ├── components/   # UI components (placeholder)
│   │   ├── hooks/        # React Query hooks (placeholder)
│   │   └── lib/          # API client and utils
│   ├── server/           # Fastify backend
│   │   ├── routes/       # API routes (placeholder)
│   │   ├── services/     # Core services (placeholder)
│   │   └── prompts/      # AI prompts (placeholder)
│   └── shared/           # Shared types (✅ COMPLETE)
├── backups/              # Config backups
├── data/                 # Application data
└── public/               # Static assets
```

## Setup

### Prerequisites

- Node.js 20+ (recommended: 24+)
- pnpm 9+
- Docker (for running the auditor)
- Anthropic API key

### Installation

1. Clone the repository:
```bash
git clone <repo-url>
cd shieldai
```

2. Install dependencies:
```bash
pnpm install
```

3. Configure environment:
```bash
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
```

4. Run development servers:
```bash
pnpm dev
```

This will start:
- Vite dev server on http://localhost:5173
- Fastify backend on http://localhost:8484

## Development Scripts

- `pnpm dev` - Start both client and server in watch mode
- `pnpm dev:client` - Start only the client (Vite)
- `pnpm dev:server` - Start only the server (Fastify)
- `pnpm build` - Build for production
- `pnpm typecheck` - Run TypeScript type checking

## Tech Stack

### Frontend
- React 18 + Vite
- TailwindCSS v4
- React Query
- shadcn/ui components

### Backend
- Fastify
- TypeScript
- dockerode (Docker API client)
- Anthropic SDK (Claude Opus 4.6)

### Deployment
- Docker container (self-hosted)

## Architecture

ShieldAI follows a client-server architecture:

1. **Docker Collector** - Reads infrastructure via Docker API
2. **Quick Checks** - Fast rule-based security checks
3. **Opus Analysis** - Deep AI-powered analysis with streaming
4. **Fix Engine** - Generates and applies configuration fixes
5. **Chat Advisor** - Conversational interface for security questions

## Swarm Implementation

This project is being built using a multi-agent swarm approach:

- **FOUNDATION** (✅ COMPLETE) - Project setup, types, dependencies
- **COLLECTOR** - Docker API integration
- **AUDIT** - Security analysis engine
- **FIX** - Fix generation and application
- **UI** - React components and hooks
- **CHAT** - AI chat advisor

## License

MIT License - See LICENSE file for details

## Acknowledgments

Built with Claude Opus 4.6 for the Anthropic Virtual Hackathon 2026.

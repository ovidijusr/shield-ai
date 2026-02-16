# ShieldAI

**AI-Powered Security Auditor & Fixer for Docker Infrastructure**

[![Docker Image](https://img.shields.io/badge/docker-ghcr.io-blue?logo=docker)](https://github.com/ovidijusr/shield-ai/pkgs/container/shield-ai)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

ShieldAI is a self-hosted security auditor for Docker environments that combines automated rule-based checks, CVE vulnerability scanning, and AI-powered infrastructure analysis to help you secure your containers.

## ✨ Features

- 🔍 **Three-Phase Security Pipeline**
  - Instant quick checks (11 automated security rules)
  - CVE vulnerability scanning powered by Trivy
  - AI-powered infrastructure analysis with Claude Opus

- 🛡️ **Comprehensive Security Analysis**
  - Exposed port detection
  - Privileged container identification
  - Secret leakage detection in environment variables
  - Dangerous host mounts and volume analysis
  - Network isolation validation
  - Resource limit checks

- 🤖 **AI-Powered Insights**
  - Context-aware security recommendations
  - Infrastructure topology analysis
  - Service identification (PostgreSQL, Redis, etc.)
  - Risk prioritization with 0-100 security scores

- 🔧 **One-Click Fixes**
  - Automated fix generation for compose files
  - Diff preview before applying changes
  - Automatic backups and rollback on failure
  - Safe, reviewed modifications

- 📊 **Tracking & Monitoring**
  - Security score trends over time
  - Scheduled scans (daily/weekly)
  - Multi-platform notifications (Discord, Slack, Ntfy, Webhooks)
  - Achievement system for security milestones

- 🖥️ **Flexible Interfaces**
  - Modern web dashboard with retro-futuristic UI
  - CLI for automation and CI/CD integration
  - AI chat advisor for security questions

## 🚀 Quick Start

### Using Docker (Recommended)

The easiest way to run ShieldAI is using the pre-built Docker image from GitHub Container Registry:

```bash
docker run -d \
  --name shieldai \
  -p 8484:8484 \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v shieldai-data:/app/data \
  -e ANTHROPIC_API_KEY=your_api_key_here \
  ghcr.io/ovidijusr/shield-ai:latest
```

Then open your browser to [http://localhost:8484](http://localhost:8484)

### Using Docker Compose

Create a `docker-compose.yml`:

```yaml
version: '3.8'

services:
  shieldai:
    image: ghcr.io/ovidijusr/shield-ai:latest
    container_name: shieldai
    ports:
      - "8484:8484"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - shieldai-data:/app/data
      - ./docker-compose-files:/app/compose-files:ro  # Optional: for fix applications
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - NODE_ENV=production
    restart: unless-stopped

volumes:
  shieldai-data:
```

Start with:

```bash
docker compose up -d
```

### From Source

```bash
# Clone the repository
git clone https://github.com/ovidijusr/shield-ai.git
cd shield-ai

# Install dependencies
pnpm install

# Create .env file
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY

# Build the application
pnpm build

# Start the server
pnpm start
```

Server will be available at [http://localhost:8484](http://localhost:8484)

## 🔑 Configuration

### Required

- **ANTHROPIC_API_KEY**: Your Anthropic API key for Claude Opus analysis
  - Get one at: https://console.anthropic.com/

### Optional

```bash
# Server configuration
PORT=8484                    # Server port (default: 8484)
HOST=0.0.0.0                # Bind address (default: 0.0.0.0)

# Database
DATABASE_PATH=./data/shieldai.db  # SQLite database path

# Docker
DOCKER_SOCKET=/var/run/docker.sock  # Docker socket path

# Notifications
DISCORD_WEBHOOK_URL=         # Discord webhook for alerts
SLACK_WEBHOOK_URL=           # Slack webhook for alerts
NTFY_TOPIC=                  # Ntfy.sh topic for alerts
CUSTOM_WEBHOOK_URL=          # Custom webhook endpoint

# Scanning
SCAN_SCHEDULE=0 2 * * *      # Cron schedule (default: 2 AM daily)
SECURITY_THRESHOLD=70        # Minimum acceptable score
```

## 📖 Usage

### Web Dashboard

1. Navigate to `http://localhost:8484`
2. Click **"Start Security Scan"**
3. Watch the three-phase pipeline execute:
   - Quick checks (seconds)
   - CVE scanning (1-2 minutes)
   - AI analysis (2-3 minutes)
4. Review findings with severity badges
5. Apply fixes with one click
6. Ask the AI advisor for guidance

### CLI

ShieldAI includes a powerful CLI for automation:

```bash
# Install globally (if running from source)
pnpm link --global

# Run a security audit
shieldai audit

# Run with score threshold (exits non-zero if below)
shieldai audit --threshold 80

# Output JSON for parsing
shieldai audit --format json

# List all findings
shieldai findings

# Show infrastructure status
shieldai status

# Generate a security report
shieldai report --output report.md
```

### CI/CD Integration

Add ShieldAI to your CI pipeline:

```yaml
# .github/workflows/security.yml
name: Docker Security Audit

on:
  push:
    branches: [main]
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM

jobs:
  security-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run ShieldAI Security Audit
        run: |
          docker run --rm \
            -v /var/run/docker.sock:/var/run/docker.sock \
            -e ANTHROPIC_API_KEY=${{ secrets.ANTHROPIC_API_KEY }} \
            ghcr.io/ovidijusr/shield-ai:latest \
            shieldai audit --threshold 70 --format json
```

## 🔒 Security Considerations

### Docker Socket Access

ShieldAI requires access to the Docker socket (`/var/run/docker.sock`) to inspect containers. This grants significant privileges. Best practices:

- Run ShieldAI in a dedicated container
- Mount the socket as read-only when possible: `:ro`
- Use Docker contexts for remote Docker hosts instead of exposing the socket over TCP
- Review the [Docker socket security guide](https://docs.docker.com/engine/security/)

### API Key Protection

- Never commit your `ANTHROPIC_API_KEY` to version control
- Use environment variables or secrets management
- Rotate keys regularly
- Monitor API usage in the Anthropic console

### Network Security

- ShieldAI's web interface is unauthenticated by default
- Deploy behind a reverse proxy with authentication (Traefik, Nginx, Caddy)
- Use HTTPS in production
- Consider network isolation if running on a public server

## 🎯 What ShieldAI Checks

### Quick Checks (Automated Rules)

1. **Privileged Containers** - Containers running with `--privileged` flag
2. **Exposed Ports** - Publicly accessible ports (0.0.0.0)
3. **Secret Leakage** - Sensitive data in environment variables
4. **Root User** - Containers running as root
5. **Host Mounts** - Dangerous volume mounts (`/`, `/etc`, `/root`)
6. **Latest Tags** - Use of `:latest` instead of pinned versions
7. **No Resource Limits** - Missing CPU/memory limits
8. **No Health Checks** - Containers without health check definitions
9. **Writable Root Filesystem** - Missing `read_only: true`
10. **Default Networks** - Containers on default bridge network
11. **UFW Bypass** - Docker bypassing firewall rules

### CVE Vulnerability Scanning

- Powered by Trivy
- Scans all unique container images
- Reports CVSS scores and severity
- Identifies affected packages
- Suggests available fixes

### AI Analysis (Claude Opus)

- Complete infrastructure topology mapping
- Service identification and classification
- Risk prioritization and scoring
- Context-aware recommendations
- Attack surface analysis
- Security best practices validation

## 🏆 Achievements

Unlock achievements as you secure your infrastructure:

- 🛡️ **Security Conscious** - Run your first scan
- 🔧 **Fixer** - Apply your first fix
- 📈 **Improving** - Increase your security score
- 🎯 **Secure** - Reach a score of 80+
- 💎 **Hardened** - Reach a score of 90+
- 🔐 **Fort Knox** - Reach a perfect score of 100

## 🤝 Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Anthropic** - Claude Opus AI for security analysis
- **Aqua Security** - Trivy CVE scanner
- **Docker** - Container runtime
- The open-source security community

## 🔗 Links

- [Documentation](docs/)
- [GitHub Issues](https://github.com/ovidijusr/shield-ai/issues)
- [Anthropic Console](https://console.anthropic.com/)
- [Trivy Documentation](https://aquasecurity.github.io/trivy/)

---

**Built with ❤️ for the self-hosted and homelab community**

*Ask the question that matters: **Am I Safe?***

# ShieldAI Testing Guide

## Overview

Comprehensive testing guide for ShieldAI Docker security auditor.

---

## 🔧 Build & Type Checking

### TypeScript Compilation

```bash
pnpm typecheck
```

**Expected:** No type errors
**What it checks:** Type safety across client, server, and shared code

### Production Build

```bash
# Build everything
pnpm build

# Or build individually
pnpm build:client  # Vite frontend bundle
pnpm build:server  # TypeScript server compilation
```

**Expected:**
- Client: ~515KB bundle in `dist/client/`
- Server: Compiled JS in `dist/server/server/`
- No build errors or warnings (chunk size warning is informational only)

---

## 🚀 Server Testing

### Development Server

```bash
pnpm dev
```

**Starts:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:8484

**Environment Variables (Optional in dev):**
- `ANTHROPIC_API_KEY` - Claude API key (shows warning if missing)
- `PORT` - Server port (default: 8484)
- `HOST` - Bind address (default: 0.0.0.0)
- `AUTH_ENABLED` - Enable bearer token auth (default: false)
- `AUTH_TOKEN` - Bearer token if auth enabled
- `DOCKER_SOCKET` - Docker socket path (default: /var/run/docker.sock)
- `LOG_LEVEL` - Logging level (default: info)

### Production Server

```bash
pnpm start
```

**Requires:**
- `ANTHROPIC_API_KEY` (mandatory in production)
- Built artifacts in `dist/` directory

### Health Check

```bash
curl http://localhost:8484/
```

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-02-13T...",
  "version": "1.0.0"
}
```

---

## 🎨 Frontend Testing

### Visual Regression Testing

**Dashboard Skeleton Loaders:**
1. Open http://localhost:5173
2. Throttle network in DevTools (Slow 3G)
3. Refresh page
4. **Expected:** Skeleton cards appear instantly with correct layout

**Tab Navigation:**
1. Click different tabs (Dashboard, Findings, Containers, Chat)
2. **Expected:**
   - Active tab shows emerald text + underline
   - URL updates to `#tab-name`
   - Hover shows subtle emerald border (20% opacity)

**Hash Navigation:**
1. Visit http://localhost:5173/#findings
2. **Expected:** Findings tab is active on load
3. Press browser Back button
4. **Expected:** Returns to previous tab

### Design System Verification

**Color Palette:**
- Background: #0a0f0c (green-tinted dark)
- Primary: #22c55e (emerald green)
- Text: #e2ebe5 (green-tinted off-white)
- Borders: #1e2e22 (green-tinted)

**Typography:**
- Body: Plus Jakarta Sans (should load from Google Fonts)
- Code/Technical: JetBrains Mono (container names, ports)

**Dot Grid Background:**
- Subtle 24px grid visible on dark background
- Green-tinted dots at 6% opacity

---

## 🐳 Docker Integration Testing

### Container Discovery

```bash
# Ensure Docker is running
docker ps

# Test containers endpoint
curl http://localhost:8484/api/containers
```

**Expected:** JSON array of Docker containers with details

### Security Audit (Manual Test)

1. Start the dev server: `pnpm dev`
2. Open http://localhost:5173
3. Click "Run Audit" button
4. **Expected:**
   - ScanProgress component shows phases
   - Quick checks complete instantly (emerald phase)
   - AI analysis starts (teal phase)
   - Findings appear progressively
   - Score gauge updates

**Without ANTHROPIC_API_KEY:**
- Quick checks work
- AI phase shows error or warning
- Application continues to function

**With ANTHROPIC_API_KEY:**
- Full AI analysis runs
- Streaming findings appear
- Good practices suggestions

---

## 🔒 Authentication Testing

### Without Auth (Default)

```bash
# All requests work without token
curl http://localhost:8484/api/containers
```

### With Auth Enabled

```bash
export AUTH_ENABLED=true
export AUTH_TOKEN=your-secret-token
pnpm dev
```

**Test authorized request:**
```bash
curl -H "Authorization: Bearer your-secret-token" \
  http://localhost:8484/api/containers
```

**Test unauthorized request:**
```bash
curl http://localhost:8484/api/containers
# Expected: 401 Unauthorized
```

---

## ⚠️ Environment Variable Warnings

### Startup Validation

The server validates environment variables on startup and displays:

**Warnings** (non-fatal):
```
⚠️  Configuration Warnings:
  1. ANTHROPIC_API_KEY not set - AI features will be disabled
```

**Errors** (fatal, exits):
```
❌ Configuration Errors:
  1. ANTHROPIC_API_KEY is required in production mode
  2. AUTH_TOKEN is required when AUTH_ENABLED=true

Please set the required environment variables and try again.
```

### Configuration Display

On successful start, see:
```
📋 Configuration:
  Port:            8484
  Host:            0.0.0.0
  Node Env:        development
  Docker Socket:   /var/run/docker.sock
  Auth Enabled:    false
  Anthropic API:   ✓ Set
```

---

## 📝 Test Checklist

### Pre-Deployment

- [ ] `pnpm typecheck` passes
- [ ] `pnpm build` completes without errors
- [ ] `pnpm start` runs production build
- [ ] Health check endpoint responds
- [ ] Frontend loads at http://localhost:8484/ (production)
- [ ] All tabs navigate correctly
- [ ] Skeleton loaders appear on slow network
- [ ] Environment validation shows appropriate warnings

### Feature Testing

- [ ] Dashboard displays Docker stats
- [ ] Container grid shows running containers
- [ ] "Run Audit" triggers scan
- [ ] Quick checks complete instantly
- [ ] AI analysis streams findings (if API key set)
- [ ] Security score calculates correctly
- [ ] Severity badges use correct colors
- [ ] Fix preview shows diffs
- [ ] Apply fix creates backups
- [ ] Chat panel responds to queries (if API key set)

### UI/UX Testing

- [ ] No blue/purple gradients visible
- [ ] Emerald green primary color throughout
- [ ] Green-tinted background (#0a0f0c)
- [ ] Dot grid background visible
- [ ] Plus Jakarta Sans font loads
- [ ] Active tab clearly indicated
- [ ] Hover effects show 20% opacity border
- [ ] No transitions or animations (except skeleton pulse)
- [ ] URL hash updates on tab change

---

## 🐛 Common Issues

### "Cannot find module" error
**Cause:** Outdated build or missing dependencies
**Fix:** `pnpm install && pnpm build`

### "EADDRINUSE" error
**Cause:** Port 8484 or 5173 already in use
**Fix:** `pkill -f "vite|tsx|node.*dist"` then restart

### Fonts not loading
**Cause:** Network issue with Google Fonts
**Fix:** Check browser DevTools Network tab, verify CDN access

### Skeletons not showing
**Cause:** Data loads too fast to see skeletons
**Fix:** Use Chrome DevTools → Network → Throttling → Slow 3G

### AI analysis not working
**Cause:** Missing ANTHROPIC_API_KEY
**Fix:** Set environment variable: `export ANTHROPIC_API_KEY=sk-ant-...`

---

## 📊 Performance Benchmarks

**Build Times:**
- Client: ~2.5s
- Server: ~1.5s
- Total: ~4s

**Bundle Sizes:**
- Client JS: 515KB (146KB gzipped)
- Client CSS: 44KB (8.3KB gzipped)
- Total: 2.9MB in dist/

**Runtime:**
- Server startup: <1s
- Frontend HMR: <300ms
- Quick checks: <500ms
- AI analysis: 3-10s (depends on infrastructure size)

---

## 🔄 Continuous Integration

**Recommended GitHub Actions workflow:**

```yaml
name: Test & Build
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install
      - run: pnpm typecheck
      - run: pnpm build
```

---

## 📈 Next Steps

- Add unit tests for server services
- Add E2E tests with Playwright
- Add integration tests for Docker API
- Add snapshot tests for UI components
- Set up automated visual regression testing

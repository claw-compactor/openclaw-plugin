#!/usr/bin/env bash
# OpenCompress installer for OpenClaw
# Usage: curl -fsSL https://www.opencompress.ai/install | bash
#
# Environment variables:
#   OPENCOMPRESS_API_KEY  — Skip provisioning, use this key directly

_opencompress_install() {
set -e

API_BASE="https://www.opencompress.ai/api"

echo ""
echo "  🦞 OpenCompress — compress every LLM call, save 40-70%"
echo "  ───────────────────────────────────────────────────────"
echo ""

# ── Step 1: Ensure Node.js >= 20 ──
if ! command -v node &>/dev/null; then
  echo "  Node.js not found."
  echo "  Install Node.js 20+: https://nodejs.org/"
  return 1
fi

NODE_MAJOR=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 20 ] 2>/dev/null; then
  echo "  Node.js v$NODE_MAJOR detected, but >= 20 required."
  return 1
fi
echo "  ✓ Node.js $(node -v)"

# ── Step 2: Ensure OpenClaw ──
if command -v openclaw &>/dev/null; then
  echo "  ✓ OpenClaw detected"
else
  echo "  Installing OpenClaw..."
  npm install -g openclaw@latest 2>&1 | tail -2

  if ! command -v openclaw &>/dev/null; then
    NPM_PREFIX="$(npm prefix -g 2>/dev/null)"
    if [ -n "$NPM_PREFIX" ] && [ -x "$NPM_PREFIX/bin/openclaw" ]; then
      export PATH="$NPM_PREFIX/bin:$PATH"
    fi
  fi

  if ! command -v openclaw &>/dev/null; then
    echo "  ✗ OpenClaw install failed. Try: npm install -g openclaw@latest"
    return 1
  fi

  mkdir -p "$HOME/.openclaw/agents/main/agent"
  [ ! -f "$HOME/.openclaw/openclaw.json" ] && echo '{}' > "$HOME/.openclaw/openclaw.json"
  echo "  ✓ OpenClaw installed"
fi

# ── Step 3: Install OpenCompress plugin ──
echo ""
echo "  Installing OpenCompress plugin..."

# Remove old version if present
if [ -d "$HOME/.openclaw/extensions/opencompress" ]; then
  rm -rf "$HOME/.openclaw/extensions/opencompress"
fi

# Direct npm pack + extract (avoids `openclaw plugins install` hanging in non-interactive envs)
TMPDIR=$(mktemp -d)
cd "$TMPDIR"
npm pack @opencompress/opencompress@latest 2>/dev/null | tail -1
TARBALL=$(ls opencompress-opencompress-*.tgz 2>/dev/null | head -1)

if [ -z "$TARBALL" ]; then
  echo "  ✗ Failed to download plugin from npm"
  rm -rf "$TMPDIR"
  return 1
fi

mkdir -p "$HOME/.openclaw/extensions/opencompress"
tar xzf "$TARBALL" --strip-components=1 -C "$HOME/.openclaw/extensions/opencompress"
rm -rf "$TMPDIR"
echo "  ✓ Plugin installed ($(cat "$HOME/.openclaw/extensions/opencompress/package.json" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log('v'+JSON.parse(d).version))"))"

# ── Step 4: Provision account ──
echo ""
API_KEY="${OPENCOMPRESS_API_KEY:-}"

if [ -z "$API_KEY" ]; then
  echo "  Creating your account..."
  RESPONSE=$(curl -s "$API_BASE/v1/provision" \
    -H "Content-Type: application/json" \
    -d "{}")

  API_KEY=$(echo "$RESPONSE" | node -e "
    let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{
      try { console.log(JSON.parse(d).apiKey || ''); } catch { console.log(''); }
    })
  ")

  if [ -n "$API_KEY" ]; then
    echo "  ✓ Account created — \$1.00 free credit!"
  else
    echo "  ✗ Account creation failed."
    echo "    Set OPENCOMPRESS_API_KEY and re-run, or visit opencompress.ai/dashboard"
    return 1
  fi
fi

# ── Step 5: Inject auth profile ──
echo ""
echo "  Configuring auth..."

node -e "
  const fs = require('fs'), os = require('os'), path = require('path');
  const apiKey = '$API_KEY';
  const agentsDir = path.join(os.homedir(), '.openclaw', 'agents');
  if (!fs.existsSync(agentsDir)) {
    fs.mkdirSync(path.join(agentsDir, 'main', 'agent'), { recursive: true });
  }
  for (const agent of fs.readdirSync(agentsDir)) {
    const authDir = path.join(agentsDir, agent, 'agent');
    const authPath = path.join(authDir, 'auth-profiles.json');
    if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });
    let profiles = { version: 1, profiles: {} };
    if (fs.existsSync(authPath)) {
      try { profiles = JSON.parse(fs.readFileSync(authPath, 'utf-8')); } catch {}
    }
    profiles.profiles['opencompress:default'] = {
      type: 'api_key', provider: 'opencompress', key: apiKey
    };
    fs.writeFileSync(authPath, JSON.stringify(profiles, null, 2) + '\n');
  }
  console.log('  ✓ Auth configured');
" 2>/dev/null || echo "  ⚠ Could not write auth profile"

# Save key to shell profile
SHELL_RC="$HOME/.zshrc"
[ -f "$HOME/.bashrc" ] && [ ! -f "$HOME/.zshrc" ] && SHELL_RC="$HOME/.bashrc"
if ! grep -qF "OPENCOMPRESS_API_KEY" "$SHELL_RC" 2>/dev/null; then
  echo "" >> "$SHELL_RC"
  echo "# OpenCompress" >> "$SHELL_RC"
  echo "export OPENCOMPRESS_API_KEY=\"$API_KEY\"" >> "$SHELL_RC"
fi

# ── Step 6: Add to plugins.allow (suppress agent security warnings) ──
node -e "
  const fs = require('fs'), path = require('path');
  const p = path.join(require('os').homedir(), '.openclaw', 'openclaw.json');
  if (!fs.existsSync(p)) return;
  const cfg = JSON.parse(fs.readFileSync(p, 'utf-8'));
  if (!cfg.plugins) cfg.plugins = {};
  const allow = cfg.plugins.allow || [];
  if (!allow.includes('opencompress')) {
    cfg.plugins.allow = [...allow, 'opencompress'];
    fs.writeFileSync(p, JSON.stringify(cfg, null, 2) + '\n');
    console.log('  ✓ Added opencompress to plugins.allow');
  } else {
    console.log('  ✓ Already in plugins.allow');
  }
" 2>/dev/null || echo "  ⚠ Could not update plugins.allow"

# ── Step 7: Tighten permissions ──
chmod 700 "$HOME/.openclaw" 2>/dev/null || true
find "$HOME/.openclaw" -type f -name "auth-profiles.json" -exec chmod 600 {} \; 2>/dev/null || true

# ── Step 8: Restart gateway ──
echo ""
if pgrep -f "openclaw.*gateway" &>/dev/null; then
  openclaw gateway restart 2>/dev/null && echo "  ✓ Gateway restarted" || true
else
  openclaw gateway start 2>/dev/null && echo "  ✓ Gateway started" || true
fi

# ── Done ──
echo ""
echo "  ────────────────────────────────────────"
echo "  🦞 OpenCompress installed!"
echo ""
echo "  Your existing LLM providers stay the same."
echo "  Select opencompress/auto as your model to save tokens"
echo "  and improve output quality."
echo ""
echo "  Next steps:"
echo "    Select 'opencompress/auto' as your model to enable compression"
echo "    /compress-stats       Check your savings"
echo "    /compress             Show status and available models"
echo ""
if [ -n "$API_KEY" ]; then
  echo "  API key: $API_KEY"
  echo "  Dashboard: https://www.opencompress.ai/dashboard"
  echo ""
  echo "  💰 Link your account for \$10 bonus credit:"
  echo "  https://www.opencompress.ai/dashboard?link=$API_KEY"
fi
echo ""
}

_opencompress_install

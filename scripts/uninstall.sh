#!/usr/bin/env bash
# OpenCompress uninstaller for OpenClaw

set -e

echo ""
echo "  Removing OpenCompress..."

# Remove plugin directory
rm -rf "$HOME/.openclaw/extensions/opencompress"

# Clean openclaw.json
node -e "
  const fs = require('fs'), p = require('os').homedir() + '/.openclaw/openclaw.json';
  if (!fs.existsSync(p)) process.exit(0);
  try {
    const c = JSON.parse(fs.readFileSync(p, 'utf-8'));
    if (c.plugins?.entries?.opencompress) delete c.plugins.entries.opencompress;
    if (c.plugins?.allow) c.plugins.allow = c.plugins.allow.filter(x => x !== 'opencompress');
    if (c.plugins?.installs?.opencompress) delete c.plugins.installs.opencompress;
    if (c.models?.providers?.opencompress) delete c.models.providers.opencompress;
    fs.writeFileSync(p, JSON.stringify(c, null, 2) + '\n');
  } catch {}
" 2>/dev/null || true

# Clean auth profiles
node -e "
  const fs = require('fs'), os = require('os'), path = require('path');
  const agentsDir = path.join(os.homedir(), '.openclaw', 'agents');
  if (!fs.existsSync(agentsDir)) process.exit(0);
  for (const agent of fs.readdirSync(agentsDir)) {
    const authPath = path.join(agentsDir, agent, 'agent', 'auth-profiles.json');
    if (!fs.existsSync(authPath)) continue;
    try {
      const d = JSON.parse(fs.readFileSync(authPath, 'utf-8'));
      delete d.profiles['opencompress:default'];
      if (d.lastGood?.opencompress) delete d.lastGood.opencompress;
      if (d.usageStats?.['opencompress:default']) delete d.usageStats['opencompress:default'];
      fs.writeFileSync(authPath, JSON.stringify(d, null, 2) + '\n');
    } catch {}
  }
" 2>/dev/null || true

# Restart gateway
if pgrep -f "openclaw.*gateway" &>/dev/null; then
  openclaw gateway restart 2>/dev/null || true
fi

echo "  OpenCompress removed."
echo ""

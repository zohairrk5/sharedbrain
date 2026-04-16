import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { execSync } from 'node:child_process';
import { claudeDesktopConfigPath } from './paths.js';

function log(msg: string): void {
  console.log(`[sharedbrain] ${msg}`);
}

function findNodeBin(): string {
  return process.execPath;
}

function findServeScript(): string {
  const fromDist = resolve(new URL('.', import.meta.url).pathname, 'cli.js');
  if (existsSync(fromDist)) return fromDist;
  return resolve(process.cwd(), 'dist', 'cli.js');
}

function wireClaudeCode(node: string, script: string): void {
  try {
    execSync('claude --version', { stdio: 'ignore' });
  } catch {
    log('claude CLI not found — skipping Claude Code wiring. Install Claude Code, then run: sharedbrain install');
    return;
  }
  try {
    execSync('claude mcp list', { stdio: 'ignore' });
    const listOut = execSync('claude mcp list').toString();
    if (listOut.includes('sharedbrain')) {
      log('Claude Code already has sharedbrain registered — skipping.');
      return;
    }
  } catch {
    // ignore; proceed to add
  }
  try {
    execSync(`claude mcp add sharedbrain -s user -- "${node}" "${script}" serve`, {
      stdio: 'inherit',
    });
    log('Wired into Claude Code (user scope).');
  } catch (err) {
    log(`Failed to wire Claude Code: ${(err as Error).message}`);
  }
}

function wireClaudeDesktop(node: string, script: string): void {
  const cfgPath = claudeDesktopConfigPath();
  if (!existsSync(dirname(cfgPath))) {
    mkdirSync(dirname(cfgPath), { recursive: true });
  }
  let cfg: Record<string, unknown> = {};
  if (existsSync(cfgPath)) {
    try {
      cfg = JSON.parse(readFileSync(cfgPath, 'utf8'));
    } catch {
      log(`Could not parse existing ${cfgPath}. Backing up and rewriting.`);
      writeFileSync(`${cfgPath}.bak.${Date.now()}`, readFileSync(cfgPath, 'utf8'));
      cfg = {};
    }
  }
  const servers = (cfg.mcpServers as Record<string, unknown> | undefined) ?? {};
  if (servers.sharedbrain) {
    log('Claude Desktop already has sharedbrain configured — skipping.');
    return;
  }
  servers.sharedbrain = {
    command: node,
    args: [script, 'serve'],
  };
  cfg.mcpServers = servers;
  writeFileSync(cfgPath, JSON.stringify(cfg, null, 2));
  log(`Wired into Claude Desktop (${cfgPath}). Restart Claude Desktop for it to load.`);
}

export function runInstall(): void {
  const node = findNodeBin();
  const script = findServeScript();
  log(`Using node: ${node}`);
  log(`Using server script: ${script}`);

  wireClaudeCode(node, script);
  wireClaudeDesktop(node, script);

  log('Done. Your shared brain is live in Claude Code + Claude Desktop.');
  log('');
  log('Next: in any Claude surface, try:');
  log('  "Remember that I prefer tabs over spaces"');
  log('  "Search the brain for anything about fratOS"');
  log('');
  log('To also expose your brain to claude.ai web / mobile, run:');
  log('  sharedbrain serve-http --port 3000');
  log('Then tunnel it with `cloudflared tunnel --url http://localhost:3000` and add the URL as a Custom Connector.');
}

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { execSync } from 'node:child_process';
import { homedir } from 'node:os';
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
    const listOut = execSync('claude mcp list').toString();
    if (listOut.includes('sharedbrain')) {
      log('Claude Code MCP already registered — skipping MCP.');
    } else {
      execSync(`claude mcp add sharedbrain -s user -- "${node}" "${script}" serve`, {
        stdio: 'inherit',
      });
      log('Wired MCP server into Claude Code (user scope).');
    }
  } catch {
    try {
      execSync(`claude mcp add sharedbrain -s user -- "${node}" "${script}" serve`, {
        stdio: 'inherit',
      });
      log('Wired MCP server into Claude Code (user scope).');
    } catch (err) {
      log(`Failed to wire Claude Code MCP: ${(err as Error).message}`);
    }
  }
}

function wireClaudeCodeHooks(node: string, script: string): void {
  const settingsPath = join(homedir(), '.claude', 'settings.json');
  const settingsDir = dirname(settingsPath);

  if (!existsSync(settingsDir)) {
    mkdirSync(settingsDir, { recursive: true });
  }

  let settings: Record<string, unknown> = {};
  if (existsSync(settingsPath)) {
    try {
      settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
    } catch {
      log(`Could not parse ${settingsPath}. Backing up.`);
      writeFileSync(`${settingsPath}.bak.${Date.now()}`, readFileSync(settingsPath, 'utf8'));
      settings = {};
    }
  }

  const hooks = (settings.hooks as Record<string, unknown[]> | undefined) ?? {};
  const cmd = (hookType: string) => `${node} ${script} hook ${hookType}`;
  let changed = false;

  // SessionStart hook — loads memories at session start
  const sessionStartHooks = (hooks.SessionStart as Array<Record<string, unknown>> | undefined) ?? [];
  if (!sessionStartHooks.some((h) => String(h.command ?? '').includes('sharedbrain'))) {
    sessionStartHooks.push({
      command: cmd('session-start'),
      timeout: 10000,
    });
    hooks.SessionStart = sessionStartHooks;
    changed = true;
  }

  // UserPromptSubmit hook — searches brain with user's prompt for relevant context
  const promptHooks = (hooks.UserPromptSubmit as Array<Record<string, unknown>> | undefined) ?? [];
  if (!promptHooks.some((h) => String(h.command ?? '').includes('sharedbrain'))) {
    promptHooks.push({
      command: cmd('prompt'),
      timeout: 5000,
    });
    hooks.UserPromptSubmit = promptHooks;
    changed = true;
  }

  if (changed) {
    settings.hooks = hooks;
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    log(`Registered hooks in ${settingsPath} (SessionStart + UserPromptSubmit).`);
  } else {
    log('Claude Code hooks already registered — skipping.');
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
  wireClaudeCodeHooks(node, script);
  wireClaudeDesktop(node, script);

  log('');
  log('Done. Your shared brain is live.');
  log('');
  log('What happens now:');
  log('  - Claude Code: memories auto-load at session start, auto-search on every message');
  log('  - Claude Desktop (Chat + Cowork): MCP tools available for memory');
  log('  - All surfaces share the same ~/.sharedbrain/brain.db');
  log('');
  log('Restart Claude Desktop to pick up the MCP server.');
  log('Claude Code picks it up on the next session.');
}

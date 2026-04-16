import { homedir, platform } from 'node:os';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';

export function brainDir(): string {
  const dir = join(homedir(), '.sharedbrain');
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function brainDbPath(): string {
  return join(brainDir(), 'brain.db');
}

export function claudeDesktopConfigPath(): string {
  const home = homedir();
  if (platform() === 'darwin') {
    return join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  }
  if (platform() === 'win32') {
    return join(process.env.APPDATA ?? join(home, 'AppData', 'Roaming'), 'Claude', 'claude_desktop_config.json');
  }
  return join(home, '.config', 'Claude', 'claude_desktop_config.json');
}

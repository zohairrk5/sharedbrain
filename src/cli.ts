#!/usr/bin/env node
import { runStdioServer } from './server.js';
import { runHttpServer } from './server-http.js';
import { runInstall } from './install.js';
import { createToken, listTokens, revokeToken } from './tokens.js';
import { search, stats } from './store.js';

type Args = Record<string, string | boolean>;

function parseArgs(argv: string[]): { cmd: string; args: Args; positionals: string[] } {
  const [cmd = 'help', ...rawRest] = argv;
  const parsed: Args = {};
  const positionals: string[] = [];
  for (let i = 0; i < rawRest.length; i++) {
    const a = rawRest[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = rawRest[i + 1];
      if (next && !next.startsWith('--')) {
        parsed[key] = next;
        i++;
      } else {
        parsed[key] = true;
      }
    } else {
      positionals.push(a);
    }
  }
  return { cmd, args: parsed, positionals };
}

function printHelp(): void {
  console.log(`sharedbrain — a shared memory brain for Claude across surfaces.

Usage:
  sharedbrain install
      Auto-wire the brain into Claude Code and Claude Desktop.

  sharedbrain serve
      Run the MCP server over stdio (used by Claude Code / Desktop).

  sharedbrain serve-http [--port 3000] [--host 0.0.0.0] [--public-url https://...]
      Run the MCP server over HTTPS-capable HTTP for claude.ai web / mobile.
      Auth: uses SHAREDBRAIN_TOKEN env var or tokens created via 'sharedbrain token create'.

  sharedbrain token create <label>
  sharedbrain token list
  sharedbrain token revoke <id>
      Manage bearer tokens for the HTTP server.

  sharedbrain search "<query>" [--limit 10]
  sharedbrain stats
      Inspect the brain from the command line.

Storage:  ~/.sharedbrain/brain.db
`);
}

async function main(): Promise<void> {
  const { cmd, args, positionals } = parseArgs(process.argv.slice(2));

  switch (cmd) {
    case 'install':
      runInstall();
      return;

    case 'serve':
      await runStdioServer();
      return;

    case 'serve-http': {
      const port = Number(args.port ?? 3000);
      const host = String(args.host ?? '0.0.0.0');
      const publicUrl = (args['public-url'] as string | undefined) ?? process.env.SHAREDBRAIN_PUBLIC_URL ?? null;
      const envToken = process.env.SHAREDBRAIN_TOKEN ?? null;
      if (!envToken) {
        const tokens = listTokens();
        if (tokens.length === 0) {
          console.error('[sharedbrain] WARNING: no tokens found and SHAREDBRAIN_TOKEN not set.');
          console.error('[sharedbrain] Create one first: sharedbrain token create "my-laptop"');
        }
      }
      await runHttpServer({ port, host, envToken, publicUrl });
      return;
    }

    case 'token': {
      const sub = positionals[0];
      if (sub === 'create') {
        const label = positionals[1] ?? 'default';
        const t = createToken(label);
        console.log(`Created token #${t.id} (${t.label}):`);
        console.log(`  ${t.token}`);
        console.log('\nStore this now — it will not be shown again.');
        console.log('Use it as:  Authorization: Bearer ' + t.token);
        return;
      }
      if (sub === 'list') {
        const ts = listTokens();
        if (ts.length === 0) {
          console.log('No tokens.');
          return;
        }
        for (const t of ts) {
          console.log(
            `#${t.id}  ${t.label.padEnd(20)}  created ${t.created_at}  last_used ${t.last_used_at ?? '(never)'}`
          );
        }
        return;
      }
      if (sub === 'revoke') {
        const id = Number(positionals[1]);
        if (!id) {
          console.error('Usage: sharedbrain token revoke <id>');
          process.exit(1);
        }
        const ok = revokeToken(id);
        console.log(ok ? `Revoked token #${id}.` : `No token #${id}.`);
        return;
      }
      console.error('Usage: sharedbrain token <create|list|revoke>');
      process.exit(1);
      return;
    }

    case 'search': {
      const query = positionals[0];
      if (!query) {
        console.error('Usage: sharedbrain search "<query>"');
        process.exit(1);
      }
      const limit = Number(args.limit ?? 10);
      const hits = search({ query, limit });
      if (hits.length === 0) {
        console.log(`No matches for "${query}".`);
        return;
      }
      for (const h of hits) {
        console.log(`#${h.id} [${h.source ?? '-'}] ${h.created_at}`);
        console.log(`  ${h.snippet}`);
        console.log();
      }
      return;
    }

    case 'stats': {
      const s = stats();
      console.log(`Total memories: ${s.total}`);
      console.log('By source:');
      for (const [src, n] of Object.entries(s.sources)) {
        console.log(`  ${src}: ${n}`);
      }
      return;
    }

    case 'help':
    case '--help':
    case '-h':
    default:
      printHelp();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

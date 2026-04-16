# sharedbrain

**One memory for every Claude surface.** Claude Code, Claude Desktop (Chat + Cowork), claude.ai web — same brain, same memories.

Tell Claude something in Desktop Chat. Ask about it in Code. It just knows. No "remember this" needed — Claude saves everything important automatically.

## Install

```bash
npx sharedbrain install
```

Done. Wires into Claude Code and Claude Desktop automatically. Restart Desktop to pick it up.

## What it does

An MCP server with five tools that Claude calls automatically:

| Tool | Purpose |
|---|---|
| `remember` | Save a fact, preference, decision, or context |
| `recall` | Get a specific memory or list recent ones |
| `search` | Full-text search across everything Claude has remembered |
| `forget` | Delete a memory |
| `brain_stats` | See what's in the brain |

Claude doesn't wait for you to say "remember." It just saves things as you talk — opinions, preferences, project decisions, personal facts, everything. Next conversation, different surface, it searches the brain first and picks up where you left off.

Storage: `~/.sharedbrain/brain.db` (SQLite). Fully local, no API keys, no network.

## Remote access (claude.ai web + mobile)

For surfaces that can't run local processes:

```bash
sharedbrain token create my-token    # get a bearer token
sharedbrain serve-http --port 3000   # start HTTP server
cloudflared tunnel --url http://localhost:3000  # expose it
```

Add the tunnel URL + token as a Connector in claude.ai Settings.

## CLI

```bash
sharedbrain install                  # wire into Claude Code + Desktop
sharedbrain serve                    # stdio MCP server
sharedbrain serve-http [--port 3000] # HTTP MCP server
sharedbrain token create|list|revoke # manage auth tokens
sharedbrain search "<query>"         # search from the terminal
sharedbrain stats                    # memory counts
```

## Security

- Local mode: no network, no auth, inherits your OS user.
- HTTP mode: bearer tokens, SHA-256 hashed at rest, revocable.
- `brain.db` contains everything Claude remembers about you. Treat it accordingly.

## License

MIT

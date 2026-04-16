# sharedbrain

**One memory for every Claude surface.** Claude Code, Claude Desktop (Chat + Cowork), claude.ai — same brain, same memories.

Tell Claude something in Desktop Chat. Ask about it in Code. It just knows. No "remember this" needed — Claude saves everything important automatically.

## Install

```bash
npx sharedbrain install
```

That's it. Wires into Claude Code and Claude Desktop automatically. Restart Desktop to pick it up.

## What it does

Claude gets five memory tools it calls on its own — no prompting needed:

| Tool | What it does |
|---|---|
| `remember` | Saves facts, preferences, decisions, context |
| `recall` | Pulls up a specific memory or lists recent ones |
| `search` | Full-text search across everything it's remembered |
| `forget` | Deletes a memory |
| `brain_stats` | Shows what's in the brain |

As you talk, Claude automatically saves things — opinions, personal details, project decisions, preferences. Next conversation, different surface, it loads what it knows and picks up where you left off.

All memories live in one local SQLite file: `~/.sharedbrain/brain.db`. No cloud, no API keys, no network required.

## Extend to claude.ai web + mobile

Claude Code and Desktop work out of the box. To also connect claude.ai web or mobile:

```bash
sharedbrain token create my-token
sharedbrain serve-http --port 3000
cloudflared tunnel --url http://localhost:3000
```

Add the tunnel URL + token as a Connector in your claude.ai settings.

## CLI

```bash
sharedbrain install                  # set up Claude Code + Desktop
sharedbrain search "<query>"         # search memories from terminal
sharedbrain stats                    # see memory counts
sharedbrain token create|list|revoke # manage HTTP auth tokens
```

## Security

Local mode has no network and no auth — it runs as your OS user. HTTP mode uses bearer tokens hashed with SHA-256 and stored in the same `brain.db`. Tokens are revocable and shown only once at creation.

`brain.db` holds everything Claude remembers about you. Back it up. Don't commit it.

## License

MIT

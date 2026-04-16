# sharedbrain

**A shared memory brain for Claude across every surface.** One store, every Claude app sees it.

Today, Claude Code, Claude Desktop, and Claude.ai each have their own isolated memory. Teach Claude something in your terminal and it has no idea the next morning on your phone. `sharedbrain` fixes that: one SQLite memory store, four tools, one install command, and every Claude surface you wire it into shares the same brain.

- **v1 (stdio MCP):** Claude Code + Claude Desktop, 100% local, zero config, no API keys.
- **v2 (HTTP MCP):** Claude.ai web + mobile via remote connector, bearer-token auth, self-hostable.

Both ship in this package. Use one, use both.

---

## Install

```bash
npx sharedbrain install
```

That's it. The installer:

1. Adds `sharedbrain` to your Claude Code MCP servers (user scope) via `claude mcp add`.
2. Edits your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS) to register `sharedbrain`.
3. Creates `~/.sharedbrain/brain.db` — your local memory store.

Restart Claude Desktop after installing. Claude Code picks it up immediately.

> Heads up: the first time you run `npx sharedbrain install`, npm will build `better-sqlite3`. Prebuilt binaries are published for macOS, Linux, and Windows on Node 20/22, so it's usually instant.

Once wired, try it in any Claude surface:

> *Remember that I always use pnpm for this project.*
>
> *Search the brain for anything about database migrations.*

Same memories, every surface.

---

## How it works

`sharedbrain` is an MCP server exposing five tools:

| Tool | What it does |
|---|---|
| `remember` | Save a new memory. Optional `source` tag and `tags`. |
| `recall` | Fetch a specific memory by id, or list the N most recent. |
| `search` | Full-text search (SQLite FTS5) over all memories. |
| `forget` | Delete a memory by id. |
| `brain_stats` | Counts of memories overall and per source. |

Storage is a single SQLite file at `~/.sharedbrain/brain.db`. No external services, no API keys, no network required for v1.

The skill file at `skill/SKILL.md` teaches Claude **when** to call these tools — that's the important half. The MCP tools are the plumbing, the skill is the behavior.

---

## v2 — Expose your brain to claude.ai web + mobile

The stdio MCP works great for Claude Code and Claude Desktop because they can launch a local process. Claude.ai web and mobile can't — they talk to remote HTTPS endpoints only. So `sharedbrain` also ships an HTTP mode.

### 1. Create a bearer token

```bash
sharedbrain token create my-phone
```

You'll get a token like `sb_abc123…`. Save it — it's shown once.

### 2. Run the HTTP server

```bash
sharedbrain serve-http --port 3000
```

It listens on `http://localhost:3000/mcp` and exposes the same five tools, gated by the bearer token.

### 3. Make it publicly reachable

Pick one:

**Option A — Cloudflare Tunnel (easiest, free, no public IP needed):**

```bash
cloudflared tunnel --url http://localhost:3000
```

Cloudflare gives you a URL like `https://long-name-here.trycloudflare.com`. That's your public endpoint.

**Option B — Deploy the Docker image to Fly / Railway / your own box:**

```bash
docker build -t sharedbrain .
docker run -p 3000:3000 -v $HOME/.sharedbrain:/data sharedbrain
```

The `Dockerfile` is in the repo root. Point your DNS + TLS (Caddy, nginx, Cloudflare, etc.) at the container.

### 4. Wire it into Claude

In Claude Desktop → Settings → Connectors → Add Custom Connector:

- **URL:** `https://<your-public-url>/mcp`
- **Authentication:** Bearer token → paste `sb_abc123…`

In claude.ai → Settings → Connectors → Add Connector (same flow). Custom remote MCP connectors are available on Pro and above as of early 2026.

Once wired, `remember`, `recall`, `search`, `forget`, `brain_stats` show up as tools on every surface and they all read/write the same `brain.db`.

---

## CLI reference

```bash
sharedbrain install             # wire into Claude Code + Claude Desktop
sharedbrain serve               # run stdio MCP (what the installer configures)
sharedbrain serve-http [--port 3000] [--host 0.0.0.0] [--public-url <url>]

sharedbrain token create <label>
sharedbrain token list
sharedbrain token revoke <id>

sharedbrain search "<query>" [--limit 10]
sharedbrain stats
```

You can also poke the brain directly from the shell — `sharedbrain search "whatever"` is handy for sanity checks.

---

## Security model

- v1 (stdio) is fully local. No network. No auth needed — it inherits your OS user.
- v2 (HTTP) uses bearer tokens stored as SHA-256 hashes in `brain.db`. The plaintext token is shown once at creation time. Revocation is immediate.
- You can also set `SHAREDBRAIN_TOKEN` as an env var for a quick single-token deploy, but creating tokens via the CLI is preferred because you get per-token last-used tracking and clean revocation.
- CORS is permissive by default so browser-based clients work. For production, put this behind a reverse proxy and restrict origins there.
- `brain.db` contains everything Claude has been told to remember. Treat it like the sensitive file it is. Back it up, encrypt your disk, don't commit it.

---

## What it doesn't do (yet)

- **No vector / semantic search.** v1 is SQLite FTS5. Works great for keyword-style recall; will miss on pure paraphrase. Semantic embeddings are planned — see roadmap.
- **No multi-user isolation.** One brain per deployment. Run separate instances if you need per-user memory.
- **No automatic conflict resolution** when two Claudes write simultaneously. SQLite WAL handles it, but semantic deduping is manual (or ask Claude to search before remembering).

---

## Roadmap

- [ ] Semantic search via local embeddings (Xenova / MiniLM) as an optional upgrade.
- [ ] Memory auto-expiry / TTL for ephemeral notes.
- [ ] Per-source views / filtered search in the CLI.
- [ ] Minimal web UI to browse / edit memories.
- [ ] Full OAuth 2.1 Authorization Server mode for spec-compliant claude.ai connection.
- [ ] Export / import to portable JSON.

---

## License

MIT. Do whatever, just don't sue.

---

## A note from the author

Built as a weekend project because the "Claude doesn't know what other Claude already knows" problem kept biting. If it's useful to you, star the repo and open issues — especially if you hit a Claude surface quirk the install flow doesn't handle.

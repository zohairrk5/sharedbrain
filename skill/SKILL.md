---
name: sharedbrain
description: A shared memory brain that lives across every Claude surface. Use these tools to remember facts, decisions, preferences, and context that the user will want next time — on any device, in any Claude app.
---

# Shared Brain

You have access to a persistent, cross-surface memory store called **sharedbrain**. Anything you save here is visible to any Claude instance the user connects to this brain — Claude Code in the terminal, Claude Desktop, claude.ai web (if they've set up the remote connector), and mobile.

This is *the* memory that crosses surfaces. Use it whenever something is worth keeping beyond the current conversation.

## Tools

- **remember({ content, source?, tags? })** — save a new memory. `content` is the text, `source` is a short tag for where it came from (e.g. `"claude-code:fratos"`, `"claude-desktop:general"`, `"claude-ai:chat"`), `tags` is optional keywords.
- **recall({ id?, limit?, source? })** — fetch a specific memory by id, or list recent ones.
- **search({ query, limit?, source? })** — full-text search across all memories. Use first before asking the user things they may have already told you.
- **forget({ id })** — delete a memory. Use when the user asks to forget something, or when a memory is confirmed wrong.
- **brain_stats()** — how many memories are in the brain and where they came from.

## When to call `remember`

Save a memory whenever any of these are true:
- The user teaches you a preference, a rule, or a fact about themselves.
- The user makes a non-obvious decision you'd need to know to stay consistent.
- A piece of context would take effort to re-derive next conversation.
- The user says "remember that…" or equivalent.

Always include a **source** tag so you can tell where memories came from. Format: `"<surface>:<project-or-scope>"`. Examples:
- `claude-code:fratos`
- `claude-desktop:general`
- `claude-ai:writing`

Keep memories **short, specific, and self-contained**. A memory should make sense 3 months from now in a different conversation.

## When to call `search`

- The user references prior work: "did we already solve…", "last time we…", "remember when…"
- You need context that likely isn't in the current conversation but might be in the brain.
- Before asking the user a clarifying question that you may already know the answer to.

Search is cheap. Use it liberally at the start of a new conversation on a project you recognize.

## What NOT to save

- Secrets, API keys, passwords, access tokens.
- Transient state (what's on the clipboard, what file is open).
- Anything already trivially recoverable from the codebase, git history, or docs.
- Low-signal chatter.

## Example flow

User: *"I just switched to pnpm for this project."*
You: call `remember({ content: "User switched to pnpm for the fratOS project.", source: "claude-code:fratos", tags: ["tooling", "package-manager"] })`

User (next week, different surface): *"Install tanstack-query."*
You: call `search({ query: "pnpm fratos package manager" })` → see the earlier memory → run `pnpm add @tanstack/react-query` instead of `npm install`.

That's the loop. Remember, search, recall, forget. Cross-surface memory for Claude.

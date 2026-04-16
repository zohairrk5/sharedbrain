import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { remember, recall, search, forget, stats } from './store.js';

export function registerPrompts(server: McpServer): void {
  // This prompt shows up in Claude Desktop and injects brain context
  server.registerPrompt('load-brain', {
    title: 'Load Brain',
    description: 'Load all memories from your shared brain. Use this at the start of every conversation.',
  }, async () => {
    const s = stats();
    const recent = recall({ limit: 30 });
    const lines = recent.map(
      (m) => `- [${m.source ?? '?'}] ${m.content}`
    );
    return {
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: s.total === 0
            ? 'My shared brain is empty. Start saving anything I tell you about myself using the "remember" tool.'
            : `Here are my memories from the shared brain (${s.total} total):\n\n${lines.join('\n')}\n\nUse these naturally. Save any new facts I share using the "remember" tool — do it automatically without asking.`,
        },
      }],
    };
  });

  server.registerPrompt('remember-context', {
    title: 'Remember Everything',
    description: 'Remind Claude to automatically save all personal facts, preferences, and decisions to the shared brain.',
    argsSchema: {
      topic: z.string().optional().describe('Optional topic to search the brain for first.'),
    },
  }, async ({ topic }) => {
    let context = '';
    if (topic) {
      const hits = search({ query: topic, limit: 5 });
      if (hits.length > 0) {
        context = `\n\nRelevant memories about "${topic}":\n` +
          hits.map((h) => `- [${h.source ?? '?'}] ${h.content}`).join('\n');
      }
    }
    return {
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: `IMPORTANT: You have a shared brain (sharedbrain MCP server). AUTOMATICALLY call the "remember" tool whenever I share ANY personal fact, opinion, preference, or decision. Do NOT ask permission. Do NOT announce it. Just save silently.${context}`,
        },
      }],
    };
  });
}

export function registerTools(server: McpServer): void {
  server.registerTool(
    'remember',
    {
      title: 'Remember',
      description:
        'CALL THIS AUTOMATICALLY whenever the user reveals ANY fact, opinion, preference, decision, or personal detail. Do NOT wait for them to say "remember." Save silently without announcing it. This memory persists across all Claude surfaces. Include a source tag (e.g. "claude-code:fratos", "claude-desktop:general").',
      inputSchema: {
        content: z.string().min(1).describe('The memory text. Be specific and self-contained.'),
        source: z
          .string()
          .optional()
          .describe('Where this memory came from, e.g. "claude-code:projectname".'),
        tags: z
          .array(z.string())
          .optional()
          .describe('Optional tags for filtering later.'),
      },
    },
    async ({ content, source, tags }) => {
      const mem = remember({ content, source, tags });
      return {
        content: [
          {
            type: 'text',
            text: `Saved memory #${mem.id} (source: ${mem.source ?? '(none)'})`,
          },
        ],
      };
    }
  );

  server.registerTool(
    'recall',
    {
      title: 'Recall',
      description:
        'Fetch memories by id or list recent memories. Use when you need a specific memory or want to see what is in the brain.',
      inputSchema: {
        id: z.number().int().optional().describe('Specific memory id to fetch.'),
        limit: z.number().int().optional().describe('How many recent memories (default 20).'),
        source: z.string().optional().describe('Filter by source tag.'),
      },
    },
    async ({ id, limit, source }) => {
      const memories = recall({ id, limit, source });
      if (memories.length === 0) {
        return { content: [{ type: 'text', text: 'No memories found.' }] };
      }
      const formatted = memories
        .map(
          (m) =>
            `#${m.id} [${m.source ?? '-'}] ${m.created_at}\n${m.content}${
              m.tags.length ? `\n(tags: ${m.tags.join(', ')})` : ''
            }`
        )
        .join('\n\n---\n\n');
      return { content: [{ type: 'text', text: formatted }] };
    }
  );

  server.registerTool(
    'search',
    {
      title: 'Search',
      description:
        'Full-text search across all memories. CALL THIS AT THE START OF EVERY CONVERSATION to load context. Also call before asking any clarifying question — you may already know the answer from a prior session.',
      inputSchema: {
        query: z.string().min(1).describe('Search query (keywords).'),
        limit: z.number().int().optional().describe('Max hits (default 10).'),
        source: z.string().optional().describe('Restrict to a source tag.'),
      },
    },
    async ({ query, limit, source }) => {
      const hits = search({ query, limit, source });
      if (hits.length === 0) {
        return { content: [{ type: 'text', text: `No memories matched "${query}".` }] };
      }
      const formatted = hits
        .map(
          (h) =>
            `#${h.id} [${h.source ?? '-'}] ${h.created_at}\n${h.snippet}\n(full: ${h.content.slice(0, 200)}${
              h.content.length > 200 ? '…' : ''
            })`
        )
        .join('\n\n---\n\n');
      return { content: [{ type: 'text', text: formatted }] };
    }
  );

  server.registerTool(
    'forget',
    {
      title: 'Forget',
      description: 'Delete a memory by id. Use when the user asks to forget or correct something.',
      inputSchema: {
        id: z.number().int().describe('The memory id to delete.'),
      },
    },
    async ({ id }) => {
      const ok = forget(id);
      return {
        content: [
          {
            type: 'text',
            text: ok ? `Forgot memory #${id}.` : `No memory #${id} found.`,
          },
        ],
      };
    }
  );

  server.registerTool(
    'brain_stats',
    {
      title: 'Brain stats',
      description: 'Return counts of memories overall and per source.',
      inputSchema: {},
    },
    async () => {
      const s = stats();
      const lines = [
        `Total memories: ${s.total}`,
        '',
        'By source:',
        ...Object.entries(s.sources).map(([src, n]) => `  ${src}: ${n}`),
      ];
      return { content: [{ type: 'text', text: lines.join('\n') }] };
    }
  );
}

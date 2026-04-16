import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { remember, recall, search, forget, stats } from './store.js';

export function registerTools(server: McpServer): void {
  server.registerTool(
    'remember',
    {
      title: 'Remember',
      description:
        'Save a new memory to the shared brain. Use when the user teaches a fact, preference, decision, or context worth keeping across conversations and surfaces. Include a short, specific source tag (e.g. "claude-code:fratos", "claude-desktop:general", "claude-ai:chat").',
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
        'Full-text search across all memories. Use when the user references prior work, asks "did we already", or you need context that might live in the brain.',
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

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerTools } from './tools-registry.js';
import { BRAIN_INSTRUCTIONS } from './instructions.js';

export async function runStdioServer(): Promise<void> {
  const server = new McpServer({
    name: 'sharedbrain',
    version: '0.1.1',
    description: BRAIN_INSTRUCTIONS,
  });
  registerTools(server);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

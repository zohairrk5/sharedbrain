import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { registerTools } from './tools-registry.js';
import { requireAuth } from './auth.js';
import { BRAIN_INSTRUCTIONS } from './instructions.js';

interface HttpServerOptions {
  port: number;
  host: string;
  envToken: string | null;
  publicUrl: string | null;
}

const transports = new Map<string, StreamableHTTPServerTransport>();

function corsHeaders(origin: string | undefined): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin ?? '*',
    'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Mcp-Session-Id',
    'Access-Control-Expose-Headers': 'Mcp-Session-Id',
    'Access-Control-Max-Age': '86400',
  };
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(json).toString(),
  });
  res.end(json);
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      if (chunks.length === 0) return resolve(undefined);
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function buildOAuthMetadata(publicUrl: string): Record<string, unknown> {
  return {
    issuer: publicUrl,
    authorization_endpoint: `${publicUrl}/authorize`,
    token_endpoint: `${publicUrl}/token`,
    registration_endpoint: `${publicUrl}/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    token_endpoint_auth_methods_supported: ['none'],
    code_challenge_methods_supported: ['S256'],
    scopes_supported: ['brain.read', 'brain.write'],
  };
}

async function handleMcpRequest(
  req: IncomingMessage,
  res: ServerResponse,
  envToken: string | null
): Promise<void> {
  if (!requireAuth(req, res, envToken)) return;

  const sessionId = (req.headers['mcp-session-id'] as string | undefined) ?? undefined;
  let transport = sessionId ? transports.get(sessionId) : undefined;

  if (!transport) {
    if (req.method !== 'POST') {
      writeJson(res, 400, { error: 'bad_request', message: 'No active session for this request.' });
      return;
    }
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (newId) => {
        if (transport) transports.set(newId, transport);
      },
    });
    transport.onclose = () => {
      if (transport && transport.sessionId) transports.delete(transport.sessionId);
    };
    const mcp = new McpServer({ name: 'sharedbrain', version: '0.1.1', description: BRAIN_INSTRUCTIONS });
    registerTools(mcp);
    await mcp.connect(transport);
  }

  const body = req.method === 'POST' ? await readBody(req) : undefined;
  await transport.handleRequest(req, res, body);
}

export async function runHttpServer(opts: HttpServerOptions): Promise<void> {
  const server = createServer(async (req, res) => {
    const cors = corsHeaders(req.headers.origin as string | undefined);
    for (const [k, v] of Object.entries(cors)) res.setHeader(k, v);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);

    if (url.pathname === '/health') {
      writeJson(res, 200, { ok: true, name: 'sharedbrain', version: '0.1.0' });
      return;
    }

    if (url.pathname === '/.well-known/oauth-authorization-server') {
      const publicUrl = opts.publicUrl ?? `http://${opts.host}:${opts.port}`;
      writeJson(res, 200, buildOAuthMetadata(publicUrl));
      return;
    }

    if (url.pathname === '/mcp') {
      try {
        await handleMcpRequest(req, res, opts.envToken);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        writeJson(res, 500, { error: 'internal_error', message });
      }
      return;
    }

    writeJson(res, 404, { error: 'not_found', path: url.pathname });
  });

  await new Promise<void>((resolve) => server.listen(opts.port, opts.host, resolve));
  const displayHost = opts.host === '0.0.0.0' ? 'localhost' : opts.host;
  console.error(`[sharedbrain] HTTP MCP listening on http://${displayHost}:${opts.port}/mcp`);
  if (opts.publicUrl) {
    console.error(`[sharedbrain] public URL: ${opts.publicUrl}/mcp`);
  }
  console.error('[sharedbrain] health check: /health');
  console.error('[sharedbrain] OAuth metadata: /.well-known/oauth-authorization-server');
}

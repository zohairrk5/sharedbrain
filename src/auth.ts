import type { IncomingMessage, ServerResponse } from 'node:http';
import { verifyToken } from './tokens.js';

export function extractBearerToken(req: IncomingMessage): string | null {
  const auth = req.headers.authorization;
  if (!auth) return null;
  const match = /^Bearer\s+(.+)$/i.exec(auth);
  return match ? match[1].trim() : null;
}

export function requireAuth(
  req: IncomingMessage,
  res: ServerResponse,
  allowEnvToken: string | null
): boolean {
  const token = extractBearerToken(req);
  if (!token) {
    send401(res, 'Missing Authorization: Bearer <token>');
    return false;
  }
  if (allowEnvToken && token === allowEnvToken) return true;
  if (verifyToken(token)) return true;
  send401(res, 'Invalid or revoked token');
  return false;
}

function send401(res: ServerResponse, message: string): void {
  res.writeHead(401, {
    'Content-Type': 'application/json',
    'WWW-Authenticate': 'Bearer realm="sharedbrain"',
  });
  res.end(JSON.stringify({ error: 'unauthorized', message }));
}

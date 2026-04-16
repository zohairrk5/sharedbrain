import { search, recall, remember, stats } from './store.js';

interface HookResponse {
  continue: boolean;
  suppressOutput?: boolean;
  message?: string;
}

function readStdin(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk: string) => (data += chunk));
    process.stdin.on('end', () => resolve(data));
    // If stdin is a TTY (not piped), resolve immediately
    if (process.stdin.isTTY) resolve('{}');
  });
}

function respond(r: HookResponse): void {
  console.log(JSON.stringify(r));
}

export async function hookSessionStart(): Promise<void> {
  const s = stats();
  if (s.total === 0) {
    respond({ continue: true, suppressOutput: true });
    return;
  }

  // Pull recent memories to prime Claude with context
  const recent = recall({ limit: 20 });
  if (recent.length === 0) {
    respond({ continue: true, suppressOutput: true });
    return;
  }

  const lines = recent.map(
    (m) => `- [${m.source ?? '?'}] ${m.content}`
  );
  const message = `[sharedbrain] Loaded ${s.total} memories. Here's what you know about this user from prior sessions across all Claude surfaces:\n\n${lines.join('\n')}\n\nUse this context naturally. Don't announce that you loaded memories — just know these things. Call the "remember" tool to save new facts as the conversation progresses. Call "search" if you need more specific recall.`;

  respond({ continue: true, suppressOutput: true, message });
}

export async function hookUserPrompt(): Promise<void> {
  const raw = await readStdin();
  let prompt = '';
  try {
    const parsed = JSON.parse(raw);
    prompt = parsed.prompt ?? parsed.message ?? '';
  } catch {
    respond({ continue: true, suppressOutput: true });
    return;
  }

  if (!prompt.trim()) {
    respond({ continue: true, suppressOutput: true });
    return;
  }

  // Extract keywords from the prompt for search (take first 200 chars)
  const queryText = prompt.slice(0, 200).trim();
  const hits = search({ query: queryText, limit: 5 });

  if (hits.length === 0) {
    respond({ continue: true, suppressOutput: true });
    return;
  }

  const lines = hits.map(
    (h) => `- [${h.source ?? '?'}] ${h.content}`
  );
  const message = `[sharedbrain] Relevant memories for this message:\n${lines.join('\n')}\n\nUse these naturally. Don't mention that you searched memory.`;

  respond({ continue: true, suppressOutput: true, message });
}

export async function hookPostTool(): Promise<void> {
  const raw = await readStdin();
  let toolName = '';
  let toolInput: Record<string, unknown> = {};
  let toolOutput = '';
  try {
    const parsed = JSON.parse(raw);
    toolName = parsed.tool_name ?? '';
    toolInput = parsed.tool_input ?? {};
    toolOutput = typeof parsed.tool_output === 'string'
      ? parsed.tool_output
      : JSON.stringify(parsed.tool_output ?? '');
  } catch {
    respond({ continue: true, suppressOutput: true });
    return;
  }

  // Don't capture sharedbrain's own tool calls (avoid loops)
  if (['remember', 'recall', 'search', 'forget', 'brain_stats'].includes(toolName)) {
    respond({ continue: true, suppressOutput: true });
    return;
  }

  // Skip noisy/low-value tools
  const skipTools = ['Glob', 'Read', 'Grep', 'Bash', 'Write', 'Edit', 'ToolSearch', 'TaskCreate', 'TaskUpdate', 'TaskGet', 'TaskList'];
  if (skipTools.includes(toolName)) {
    respond({ continue: true, suppressOutput: true });
    return;
  }

  // For high-signal tools, capture a brief observation
  const summary = `Tool "${toolName}" called with: ${JSON.stringify(toolInput).slice(0, 300)}. Result: ${toolOutput.slice(0, 500)}`;
  remember({
    content: summary,
    source: 'claude-code:auto-capture',
    tags: ['auto', toolName],
  });

  respond({ continue: true, suppressOutput: true });
}

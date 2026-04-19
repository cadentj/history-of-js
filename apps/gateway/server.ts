/**
 * Workshop agent: PTY shell, FS WebSocket, exec streaming, server-ready events,
 * preview reverse-proxy. Auth: shared secret header (injected by Cloudflare Worker).
 */
import * as childProcess from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as http from 'node:http';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import type { Context } from 'hono';
import { spawn as ptySpawn, type IPty } from 'node-pty';
import { WebSocketServer } from 'ws';

const PORT = parseInt(process.env.PORT || '8080', 10);
/** Bind all interfaces so container runtimes (Docker, Cloudflare) can reach the process — not only loopback. */
const LISTEN_HOST = process.env.LISTEN_HOST || '0.0.0.0';
const WORKSPACE = '/workspace';
const AGENT_SHARED_SECRET = process.env.AGENT_SHARED_SECRET || '';

function requireAgentSecretHono(c: Context): Response | null {
  if (!AGENT_SHARED_SECRET) return c.text('Server misconfigured', 503);
  if (c.req.header('x-agent-secret') !== AGENT_SHARED_SECRET) {
    return c.text('Unauthorized', 401);
  }
  return null;
}

function requireAgentSecretHttp(req: http.IncomingMessage): { ok: true } | { ok: false; status: number; body: string } {
  if (!AGENT_SHARED_SECRET) return { ok: false, status: 503, body: 'Server misconfigured' };
  if (req.headers['x-agent-secret'] !== AGENT_SHARED_SECRET) {
    return { ok: false, status: 401, body: 'Unauthorized' };
  }
  return { ok: true };
}

function resolveWorkspacePath(relOrAbs: string): string {
  const normalized = relOrAbs.replace(/^\/+/, '');
  const full = path.resolve(WORKSPACE, normalized);
  const ws = path.resolve(WORKSPACE);
  if (!full.startsWith(ws + path.sep) && full !== ws) {
    throw new Error('Path escapes workspace');
  }
  return full;
}

async function ensureWorkspace(): Promise<void> {
  await fs.mkdir(WORKSPACE, { recursive: true });
}

function parseListenPorts(ssOut: string): Set<number> {
  const ports = new Set<number>();
  for (const line of ssOut.split('\n')) {
    const m = line.match(/:(\d+)\s/);
    if (m) ports.add(parseInt(m[1], 10));
  }
  return ports;
}

function pollListenPorts(): Set<number> {
  try {
    const out = childProcess.execFileSync('ss', ['-ltn'], {
      encoding: 'utf8',
      maxBuffer: 2 * 1024 * 1024,
    });
    return parseListenPorts(out);
  } catch {
    return new Set();
  }
}

const app = new Hono();

app.get('/healthz', (c) => c.text('ok', 200));

app.post('/exec', async (c) => {
  const denied = requireAgentSecretHono(c);
  if (denied) return denied;

  let body: { cmd?: string; args?: string[] };
  try {
    body = await c.req.json();
  } catch {
    return c.text('Invalid JSON', 400);
  }
  if (!body.cmd || !Array.isArray(body.args)) {
    return c.text('Expected { cmd: string, args: string[] }', 400);
  }

  const cmd = body.cmd;
  const args = body.args;

  return new Response(
    new ReadableStream({
      start(controller) {
        const enc = new TextEncoder();
        const send = (obj: object) => {
          controller.enqueue(enc.encode(JSON.stringify(obj) + '\n'));
        };
        const proc = childProcess.spawn(cmd, args, {
          cwd: WORKSPACE,
          env: { ...process.env, FORCE_COLOR: '0' },
        });
        proc.stdout?.on('data', (d: Buffer) => {
          send({ type: 'chunk', stream: 'stdout', data: d.toString('utf8') });
        });
        proc.stderr?.on('data', (d: Buffer) => {
          send({ type: 'chunk', stream: 'stderr', data: d.toString('utf8') });
        });
        proc.on('error', (e) => {
          send({ type: 'error', message: String(e) });
          controller.close();
        });
        proc.on('close', (code) => {
          send({ type: 'exit', code: code ?? 0 });
          controller.close();
        });
      },
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8' },
    },
  );
});

async function handlePreviewGet(c: Context) {
  const denied = requireAgentSecretHono(c);
  if (denied) return denied;

  const pathname = c.req.path;
  let port: number;
  let pathAfter: string;

  // Prefer /preview/<port>/… so subresources (state.js, …) carry the port in the path.
  // Query-only ?port= breaks relative URLs: they resolve to /s/.../preview/foo.js with no port.
  const pathStyle = pathname.match(/^\/preview\/(\d+)(\/.*)?$/);
  if (pathStyle) {
    port = parseInt(pathStyle[1], 10);
    const rest = pathStyle[2];
    pathAfter = rest && rest.length > 0 ? rest : '/';
  } else {
    const portStr = c.req.query('port');
    if (!portStr) {
      return c.text('Missing port (use /preview/<port>/… or ?port=)', 400);
    }
    port = parseInt(portStr, 10);
    pathAfter = pathname.replace(/^\/preview\/?/, '/') || '/';
  }

  if (Number.isNaN(port) || port < 1 || port > 65535) return c.text('Bad port', 400);

  const targetUrl = new URL(pathAfter, `http://127.0.0.1:${port}`);

  let r: Response;
  try {
    // Prefer uncompressed: Node's fetch may decompress the body but leave Content-Encoding:
    // gzip, which breaks the next hop (Worker/browser) with "Gzip decompression failed".
    r = await fetch(targetUrl, {
      method: 'GET',
      headers: { 'Accept-Encoding': 'identity' },
    });
  } catch {
    return c.text('Upstream error', 502);
  }

  const headers = new Headers(r.headers);
  headers.delete('transfer-encoding');
  headers.delete('content-encoding');
  headers.delete('content-length');
  // Upstream (e.g. serve) may send these; they break embedding in the workshop preview iframe.
  headers.delete('x-frame-options');
  headers.delete('content-security-policy');
  return new Response(r.body, { status: r.status, headers });
}

app.get('/preview', handlePreviewGet);
app.get('/preview/', handlePreviewGet);
app.get('/preview/*', handlePreviewGet);

const server = serve(
  {
    fetch: app.fetch,
    port: PORT,
    hostname: LISTEN_HOST,
  },
  (info) => {
    console.log(`agent listening on ${LISTEN_HOST}:${info.port}`);
    if (!AGENT_SHARED_SECRET) {
      console.error(
        'AGENT_SHARED_SECRET is unset: /exec, /preview, and WebSockets will respond with 503 until it is set (e.g. Worker .dev.vars or container env).',
      );
    }
  },
);

void ensureWorkspace();

const wssShell = new WebSocketServer({ noServer: true });
const wssFs = new WebSocketServer({ noServer: true });
const wssEvents = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  if (pathname === '/shell') {
    const auth = requireAgentSecretHttp(req);
    if (!auth.ok) {
      socket.write(`HTTP/1.1 ${auth.status}\r\n\r\n${auth.body}`);
      socket.destroy();
      return;
    }
    wssShell.handleUpgrade(req, socket, head, (ws) => {
      const cols = parseInt(url.searchParams.get('cols') || '80', 10);
      const rows = parseInt(url.searchParams.get('rows') || '24', 10);
      let pty: IPty;
      try {
        pty = ptySpawn('/bin/bash', [], {
          name: 'xterm-color',
          cols,
          rows,
          cwd: WORKSPACE,
          env: process.env as Record<string, string>,
        });
      } catch (e) {
        ws.send(JSON.stringify({ error: String(e) }));
        ws.close();
        return;
      }

      pty.onData((data) => {
        if (ws.readyState === ws.OPEN) ws.send(data);
      });
      pty.onExit(() => {
        ws.close();
      });

      ws.on('message', (data, isBinary) => {
        if (isBinary) {
          pty.write(Buffer.from(data as Buffer));
          return;
        }
        const text = Buffer.from(data as Buffer).toString('utf8');
        try {
          const j = JSON.parse(text) as { type?: string; cols?: number; rows?: number };
          if (j.type === 'resize' && j.cols && j.rows) {
            pty.resize(j.cols, j.rows);
          }
        } catch {
          pty.write(text);
        }
      });
      ws.on('close', () => {
        pty.kill();
      });
    });
    return;
  }

  if (pathname === '/fs') {
    const auth = requireAgentSecretHttp(req);
    if (!auth.ok) {
      socket.write(`HTTP/1.1 ${auth.status}\r\n\r\n${auth.body}`);
      socket.destroy();
      return;
    }
    wssFs.handleUpgrade(req, socket, head, (ws) => {
      ws.on('message', async (raw) => {
        let msg: { op?: string; path?: string; contents?: string };
        try {
          msg = JSON.parse(Buffer.from(raw as Buffer).toString('utf8'));
        } catch {
          ws.send(JSON.stringify({ ok: false, error: 'Invalid JSON' }));
          return;
        }
        try {
          if (msg.op === 'write' && msg.path != null && msg.contents != null) {
            const full = resolveWorkspacePath(msg.path);
            await fs.mkdir(path.dirname(full), { recursive: true });
            await fs.writeFile(full, msg.contents, 'utf8');
            ws.send(JSON.stringify({ ok: true }));
          } else if (msg.op === 'delete' && msg.path != null) {
            const full = resolveWorkspacePath(msg.path);
            await fs.rm(full, { recursive: true, force: true });
            ws.send(JSON.stringify({ ok: true }));
          } else if (msg.op === 'mkdir' && msg.path != null) {
            const full = resolveWorkspacePath(msg.path);
            await fs.mkdir(full, { recursive: true });
            ws.send(JSON.stringify({ ok: true }));
          } else {
            ws.send(JSON.stringify({ ok: false, error: 'Unknown op' }));
          }
        } catch (e) {
          ws.send(JSON.stringify({ ok: false, error: String(e) }));
        }
      });
    });
    return;
  }

  if (pathname === '/events') {
    const auth = requireAgentSecretHttp(req);
    if (!auth.ok) {
      socket.write(`HTTP/1.1 ${auth.status}\r\n\r\n${auth.body}`);
      socket.destroy();
      return;
    }
    wssEvents.handleUpgrade(req, socket, head, (ws) => {
      let seen = pollListenPorts();
      const iv = setInterval(() => {
        if (ws.readyState !== ws.OPEN) return;
        const now = pollListenPorts();
        for (const p of now) {
          if (p === PORT) continue;
          if (!seen.has(p)) {
            ws.send(JSON.stringify({ type: 'server-ready', port: p }));
          }
        }
        seen = new Set([...seen, ...now]);
      }, 500);
      ws.on('close', () => clearInterval(iv));
    });
    return;
  }

  socket.destroy();
});

import { Container } from '@cloudflare/containers';

const INTERNAL_STOP_PATH = '/__hoj_stop';

export interface Env {
  STUDENT_SESSION: DurableObjectNamespace<StudentSession>;
  AGENT_SHARED_SECRET: string;
  /** Comma-separated list of allowed browser origins for CORS (optional; default *). */
  ALLOWED_ORIGINS?: string;
}

export class StudentSession extends Container<Env> {
  defaultPort = 8080;
  sleepAfter = '5m';
  pingEndpoint = '127.0.0.1/healthz';

  constructor(ctx: DurableObjectState<Env>, env: Env) {
    // Note: @cloudflare/containers only reads defaultPort/sleepAfter from the 3rd ctor arg;
    // envVars there are ignored. Set `this.envVars` so the container process receives them.
    super(ctx, env);
    this.envVars = {
      AGENT_SHARED_SECRET: env.AGENT_SHARED_SECRET ?? '',
      PORT: '8080',
      NODE_ENV: 'production',
    };
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === INTERNAL_STOP_PATH && request.method === 'POST') {
      await this.stop();
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return super.fetch(request);
  }
}

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get('Origin') ?? '';
  const allow = env.ALLOWED_ORIGINS?.split(',').map((s) => s.trim()).filter(Boolean) ?? [];
  const accessControlAllowOrigin =
    allow.length === 0 ? '*' : allow.includes(origin) ? origin : '*';
  return {
    'Access-Control-Allow-Origin': accessControlAllowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, X-Agent-Secret, Upgrade, Connection, Sec-WebSocket-Key, Sec-WebSocket-Version, Sec-WebSocket-Extensions, Sec-WebSocket-Protocol',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * HTTP responses get CORS headers. WebSocket upgrades must not be rebuilt from `res.body` only —
 * that drops `Response.webSocket` and breaks status 101 (miniflare: "did not return 101").
 */
function withCors(res: Response, request: Request, env: Env): Response {
  if (res.webSocket) {
    const h = new Headers(res.headers);
    for (const [k, v] of Object.entries(corsHeaders(request, env))) {
      h.set(k, v);
    }
    return new Response(null, { status: res.status, webSocket: res.webSocket, headers: h });
  }
  // Passthrough other upgrades without cloning body-only (preserves non-standard 101 handling).
  if (request.headers.get('Upgrade')?.toLowerCase() === 'websocket') {
    return res;
  }
  const h = new Headers(res.headers);
  for (const [k, v] of Object.entries(corsHeaders(request, env))) {
    h.set(k, v);
  }
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

function json(data: unknown, status: number, request: Request, env: Env): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(request, env),
    },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    }

    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/session') {
      if (!env.AGENT_SHARED_SECRET) {
        return json({ error: 'Server misconfigured (missing AGENT_SHARED_SECRET)' }, 500, request, env);
      }
      const sessionId = crypto.randomUUID();
      const baseUrl = `${url.origin}/s/${sessionId}`;
      return json({ sessionId, baseUrl }, 200, request, env);
    }

    const stopMatch = url.pathname.match(/^\/s\/([^/]+)\/stop\/?$/);
    if (request.method === 'POST' && stopMatch) {
      const sessionId = stopMatch[1]!;
      const stub = env.STUDENT_SESSION.getByName(sessionId);
      const r = await stub.fetch(new Request(`https://do${INTERNAL_STOP_PATH}`, { method: 'POST' }));
      return withCors(r, request, env);
    }

    const sessionMatch = url.pathname.match(/^\/s\/([^/]+)(\/.*)?$/);
    if (!sessionMatch) {
      return new Response('Not found', { status: 404, headers: corsHeaders(request, env) });
    }

    const sessionId = sessionMatch[1]!;
    const restPath = sessionMatch[2] && sessionMatch[2].length > 0 ? sessionMatch[2] : '/';

    const target = new URL(url);
    target.pathname = restPath;

    const proxied = new Request(target.toString(), request);
    const headers = new Headers(proxied.headers);
    headers.set('X-Agent-Secret', env.AGENT_SHARED_SECRET ?? '');
    const signed = new Request(proxied, { headers });

    const stub = env.STUDENT_SESSION.getByName(sessionId);
    const res = await stub.fetch(signed);
    return withCors(res, request, env);
  },
};

import type { Terminal as XTerm } from 'xterm';
import type { LessonFile } from '@/lesson-types';

const WORKER = import.meta.env.VITE_WORKER_URL;

export type WorkshopSession = {
  sessionId: string;
  /** Worker-routed base URL: `${worker}/s/${sessionId}` — use for HTTP and for building WS URLs under this path. */
  baseUrl: string;
  /** Fires when a new listen port is detected in the session container. */
  onServerReady(cb: (port: number, previewUrl: string) => void): () => void;
  /** Stop the session container (best-effort). */
  kill(): void;
};

let instance: WorkshopSession | null = null;
let booting: Promise<WorkshopSession> | null = null;

function joinBasePath(baseUrl: string, pathAndQuery: string): string {
  const b = baseUrl.replace(/\/+$/, '');
  if (pathAndQuery.startsWith('/')) return b + pathAndQuery;
  return `${b}/${pathAndQuery}`;
}

function httpToWs(url: string): string {
  return url.replace(/^http(?=:)/i, 'ws');
}

function requireWorkerUrl(): string {
  if (!WORKER) {
    throw new Error('VITE_WORKER_URL is not set (Cloudflare Worker base URL)');
  }
  return WORKER.replace(/\/+$/, '');
}

export function getWebContainer(): WorkshopSession | null {
  return instance;
}

export function absWorkspacePath(_session: WorkshopSession, rel: string): string {
  const r = rel.replace(/^\/+/, '');
  return `/workspace/${r}`;
}

export async function bootOnce(): Promise<WorkshopSession> {
  if (instance) return instance;
  if (booting) return booting;

  const workerBase = requireWorkerUrl();

  booting = (async () => {
    const res = await fetch(`${workerBase}/session`, { method: 'POST' });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Session start failed (${res.status}): ${t}`);
    }
    const data = (await res.json()) as {
      sessionId: string;
      baseUrl: string;
    };

    const serverReadyListeners = new Set<(port: number, previewUrl: string) => void>();
    let killed = false;

    const eventsUrl = httpToWs(joinBasePath(data.baseUrl, '/events'));
    const eventsWs = new WebSocket(eventsUrl);

    eventsWs.addEventListener('message', (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as { type?: string; port?: number };
        if (msg.type === 'server-ready' && typeof msg.port === 'number') {
          // Port in path so every asset URL is /preview/<port>/… (query-only ?port= is not on script requests).
          const previewUrl = joinBasePath(data.baseUrl, `/preview/${msg.port}/`);
          for (const cb of serverReadyListeners) {
            cb(msg.port, previewUrl);
          }
        }
      } catch {
        /* ignore */
      }
    });

    let fsWs: WebSocket | null = null;
    let fsConnectPromise: Promise<WebSocket> | null = null;

    function connectFs(): Promise<WebSocket> {
      if (fsWs?.readyState === WebSocket.OPEN) return Promise.resolve(fsWs);
      if (fsConnectPromise) return fsConnectPromise;
      fsConnectPromise = new Promise<WebSocket>((resolve, reject) => {
        const ws = new WebSocket(httpToWs(joinBasePath(data.baseUrl, '/fs')));
        ws.addEventListener('open', () => {
          fsWs = ws;
          fsConnectPromise = null;
          resolve(ws);
        });
        ws.addEventListener('error', () => {
          fsConnectPromise = null;
          reject(new Error('FS WebSocket failed'));
        });
      });
      return fsConnectPromise;
    }

    async function fsRequest(op: { op: string; path?: string; contents?: string }): Promise<void> {
      const ws = await connectFs();
      await new Promise<void>((resolve, reject) => {
        const onMsg = (ev: MessageEvent) => {
          try {
            const r = JSON.parse(String(ev.data)) as { ok?: boolean; error?: string };
            ws.removeEventListener('message', onMsg);
            if (r.ok) resolve();
            else reject(new Error(r.error || 'FS op failed'));
          } catch (e) {
            ws.removeEventListener('message', onMsg);
            reject(e);
          }
        };
        ws.addEventListener('message', onMsg);
        ws.send(JSON.stringify(op));
      });
    }

    const session: WorkshopSession = {
      sessionId: data.sessionId,
      baseUrl: data.baseUrl,
      onServerReady(cb) {
        serverReadyListeners.add(cb);
        return () => serverReadyListeners.delete(cb);
      },
      kill() {
        if (killed) return;
        killed = true;
        window.removeEventListener('beforeunload', onBeforeUnload);
        window.removeEventListener('pagehide', onBeforeUnload);
        try {
          eventsWs.close();
        } catch {
          /* ignore */
        }
        try {
          fsWs?.close();
        } catch {
          /* ignore */
        }
        void fetch(`${workerBase}/s/${encodeURIComponent(data.sessionId)}/stop`, {
          method: 'POST',
        }).catch(() => {});
        if (instance === session) instance = null;
        booting = null;
      },
    };

    (session as WorkshopSession & { _fsRequest: typeof fsRequest })._fsRequest = fsRequest;

    const onBeforeUnload = () => {
      session.kill();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    window.addEventListener('pagehide', onBeforeUnload);

    instance = session;
    booting = null;
    return session;
  })().catch((err) => {
    booting = null;
    throw err;
  });

  return booting;
}

function getFsRequest(session: WorkshopSession): (
  op: { op: string; path?: string; contents?: string },
) => Promise<void> {
  const s = session as WorkshopSession & {
    _fsRequest?: (op: { op: string; path?: string; contents?: string }) => Promise<void>;
  };
  if (!s._fsRequest) throw new Error('Session FS not ready');
  return s._fsRequest.bind(session);
}

export async function mountLesson(session: WorkshopSession, files: LessonFile[]): Promise<void> {
  const fsRequest = getFsRequest(session);
  for (const f of files) {
    await fsRequest({ op: 'write', path: f.path, contents: f.contents });
  }
}

export async function writeFile(
  session: WorkshopSession,
  absPath: string,
  contents: string,
): Promise<void> {
  const fsRequest = getFsRequest(session);
  const rel = absPath.replace(/^\/workspace\/?/, '');
  await fsRequest({ op: 'write', path: rel, contents });
}

export function packageJsonNeedsInstall(contents: string): boolean {
  try {
    const j = JSON.parse(contents) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const d = j.dependencies ? Object.keys(j.dependencies).length : 0;
    const dd = j.devDependencies ? Object.keys(j.devDependencies).length : 0;
    return d + dd > 0;
  } catch {
    return false;
  }
}

export async function spawnWithOutput(
  session: WorkshopSession,
  command: string,
  args: string[],
  onChunk: (chunk: string) => void,
): Promise<{ exitCode: number }> {
  const base = session.baseUrl.replace(/\/+$/, '');
  const res = await fetch(`${base}/exec`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ cmd: command, args }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`exec failed (${res.status}): ${t}`);
  }
  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error('exec: no response body');
  }
  const dec = new TextDecoder();
  let buf = '';
  let exitCode = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const obj = JSON.parse(line) as {
            type?: string;
            data?: string;
            stream?: string;
            code?: number;
          };
          if (obj.type === 'chunk' && obj.data) onChunk(obj.data);
          if (obj.type === 'exit' && typeof obj.code === 'number') exitCode = obj.code;
        } catch {
          /* ignore bad line */
        }
      }
    }
    if (buf.trim()) {
      try {
        const obj = JSON.parse(buf) as { type?: string; code?: number };
        if (obj.type === 'exit' && typeof obj.code === 'number') exitCode = obj.code;
      } catch {
        /* ignore */
      }
    }
  } finally {
    reader.releaseLock();
  }
  return { exitCode };
}

export type ShellHandle = {
  writeCommand: (cmd: string) => void;
  sendSignal: (ctrl: 'c' | 'd') => void;
  resize: (cols: number, rows: number) => void;
  kill: () => void;
};

export async function attachShell(session: WorkshopSession, term: XTerm): Promise<ShellHandle> {
  const qs = new URLSearchParams({
    cols: String(term.cols),
    rows: String(term.rows),
  });
  const ws = new WebSocket(httpToWs(joinBasePath(session.baseUrl, `/shell?${qs.toString()}`)));

  await new Promise<void>((resolve, reject) => {
    ws.addEventListener('open', () => resolve());
    ws.addEventListener('error', () => reject(new Error('Shell WebSocket failed')));
  });

  const onMessage = (ev: MessageEvent) => {
    if (typeof ev.data === 'string') {
      term.write(ev.data);
    } else {
      term.write(new Uint8Array(ev.data as ArrayBuffer));
    }
  };
  ws.addEventListener('message', onMessage);

  const onDataDisposable = term.onData((data) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  });

  return {
    writeCommand(cmd: string) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(`${cmd}\n`);
      }
    },
    sendSignal(ctrl: 'c' | 'd') {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(ctrl === 'c' ? '\x03' : '\x04');
      }
    },
    resize(cols: number, rows: number) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols, rows }));
      }
    },
    kill() {
      try {
        onDataDisposable.dispose();
      } catch {
        /* ignore */
      }
      try {
        ws.removeEventListener('message', onMessage);
        ws.close();
      } catch {
        /* ignore */
      }
    },
  };
}

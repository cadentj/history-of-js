import Editor from '@monaco-editor/react';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { ChevronRight, FileCode, Folder, FolderOpen, X } from 'lucide-react';

type TreeNode =
  | { kind: 'file'; name: string; path: string }
  | { kind: 'dir'; name: string; path: string; children: TreeNode[] };

type MutableDir = {
  kind: 'dir';
  name: string;
  path: string;
  children: Map<string, MutableDir | { kind: 'file'; name: string; path: string }>;
};

function pathsToTree(paths: string[]): TreeNode[] {
  const root = new Map<string, MutableDir | { kind: 'file'; name: string; path: string }>();

  for (const fullPath of paths) {
    const segments = fullPath.split('/').filter(Boolean);
    let level = root;
    for (let i = 0; i < segments.length; i++) {
      const name = segments[i];
      const isLast = i === segments.length - 1;
      const pathSoFar = segments.slice(0, i + 1).join('/');
      if (isLast) {
        level.set(name, { kind: 'file', name, path: fullPath });
      } else {
        let node = level.get(name);
        if (!node || node.kind === 'file') {
          node = { kind: 'dir', name, path: pathSoFar, children: new Map() };
          level.set(name, node);
        }
        level = (node as MutableDir).children;
      }
    }
  }

  function sortTree(map: Map<string, MutableDir | { kind: 'file'; name: string; path: string }>): TreeNode[] {
    const entries = [...map.entries()];
    const dirs = entries
      .filter(([, n]) => n.kind === 'dir')
      .sort(([a], [b]) => a.localeCompare(b));
    const files = entries
      .filter(([, n]) => n.kind === 'file')
      .sort(([a], [b]) => a.localeCompare(b));
    const out: TreeNode[] = [];
    for (const [, n] of dirs) {
      const d = n as MutableDir;
      out.push({
        kind: 'dir',
        name: d.name,
        path: d.path,
        children: sortTree(d.children),
      });
    }
    for (const [, n] of files) {
      out.push({ kind: 'file', name: n.name, path: n.path });
    }
    return out;
  }

  return sortTree(root);
}

function languageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    html: 'html',
    css: 'css',
    md: 'markdown',
    sh: 'shell',
  };
  return map[ext] ?? 'plaintext';
}

type Props = {
  paths: string[];
  openTabs: string[];
  activePath: string | null;
  getContents: (path: string) => string;
  onOpenTab: (path: string) => void;
  onCloseTab: (path: string) => void;
  onSelectTab: (path: string) => void;
  onChangeContents: (path: string, value: string) => void;
  toolbarExtras?: ReactNode;
};

function TreeView({
  nodes,
  depth,
  activePath,
  openDirs,
  onToggleDir,
  onOpenTab,
}: {
  nodes: TreeNode[];
  depth: number;
  activePath: string | null;
  openDirs: Set<string>;
  onToggleDir: (dirPath: string) => void;
  onOpenTab: (path: string) => void;
}) {
  return (
    <ul className="space-y-0.5">
      {nodes.map((node) =>
        node.kind === 'file' ? (
          <li key={node.path}>
            <Button
              type="button"
              variant={node.path === activePath ? 'secondary' : 'ghost'}
              size="sm"
              className={cn(
                'h-auto w-full justify-start gap-1.5 px-2 py-1.5 text-left font-mono text-[11px] leading-tight',
                node.path === activePath && 'bg-secondary',
              )}
              style={{ paddingLeft: `${depth * 0.75}rem` }}
              onClick={() => onOpenTab(node.path)}
            >
              <FileCode className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              {node.name}
            </Button>
          </li>
        ) : (
          <li key={node.path}>
            <button
              type="button"
              className="text-muted-foreground hover:bg-accent/50 flex w-full items-center gap-1 rounded-md py-1.5 pr-2 text-left font-mono text-[11px] leading-tight"
              style={{ paddingLeft: `${depth * 0.75}rem` }}
              onClick={() => onToggleDir(node.path)}
            >
              <ChevronRight
                className={cn(
                  'size-3.5 shrink-0 transition-transform',
                  openDirs.has(node.path) && 'rotate-90',
                )}
                aria-hidden
              />
              {openDirs.has(node.path) ? (
                <FolderOpen className="size-3.5 shrink-0" aria-hidden />
              ) : (
                <Folder className="size-3.5 shrink-0" aria-hidden />
              )}
              <span className="text-foreground">{node.name}</span>
            </button>
            {openDirs.has(node.path) ? (
              <TreeView
                nodes={node.children}
                depth={depth + 1}
                activePath={activePath}
                openDirs={openDirs}
                onToggleDir={onToggleDir}
                onOpenTab={onOpenTab}
              />
            ) : null}
          </li>
        ),
      )}
    </ul>
  );
}

export function EditorPane({
  paths,
  openTabs,
  activePath,
  getContents,
  onOpenTab,
  onCloseTab,
  onSelectTab,
  onChangeContents,
  toolbarExtras,
}: Props) {
  const fileTree = useMemo(() => pathsToTree(paths), [paths]);
  const [openDirs, setOpenDirs] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!activePath) return;
    setOpenDirs((prev) => {
      const next = new Set(prev);
      const segments = activePath.split('/').filter(Boolean);
      for (let i = 0; i < segments.length - 1; i++) {
        next.add(segments.slice(0, i + 1).join('/'));
      }
      return next;
    });
  }, [activePath]);

  const toggleDir = useCallback((dirPath: string) => {
    setOpenDirs((prev) => {
      const next = new Set(prev);
      if (next.has(dirPath)) next.delete(dirPath);
      else next.add(dirPath);
      return next;
    });
  }, []);

  const value = activePath ? getContents(activePath) : '';
  const editorLanguage = useMemo(
    () => (activePath ? languageFromPath(activePath) : 'plaintext'),
    [activePath],
  );
  const editorOptions = useMemo(
    () => ({
      fontSize: 14,
      minimap: { enabled: false },
      automaticLayout: true,
      tabSize: 2,
    }),
    [],
  );

  return (
    <div className="flex h-full min-h-0">
      <div className="flex w-44 shrink-0 flex-col border-r border-border bg-card">
        <div className="border-b border-border px-3 py-2">
          <span className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">
            Files
          </span>
        </div>
        <ScrollArea className="min-h-0 flex-1">
          <div className="p-1">
            <TreeView
              nodes={fileTree}
              depth={0}
              activePath={activePath}
              openDirs={openDirs}
              onToggleDir={toggleDir}
              onOpenTab={onOpenTab}
            />
          </div>
        </ScrollArea>
      </div>
      <div className="flex min-w-0 min-h-0 flex-1 flex-col bg-background">
        <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/30 px-1 py-1">
          <div className="flex min-w-0 flex-1 flex-wrap gap-0.5">
            {openTabs.map((p) => (
              <div
                key={p}
                className={cn(
                  'flex items-center gap-0.5 rounded-md border border-transparent text-[11px]',
                  p === activePath ? 'border-border bg-background' : 'bg-transparent',
                )}
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="max-w-[10rem] truncate rounded-r-none font-mono"
                  onClick={() => onSelectTab(p)}
                >
                  {p.split('/').pop()}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="rounded-l-none text-muted-foreground"
                  aria-label={`Close ${p}`}
                  onClick={() => onCloseTab(p)}
                >
                  <X className="size-3" />
                </Button>
              </div>
            ))}
          </div>
          {toolbarExtras ? <div className="shrink-0 pr-1">{toolbarExtras}</div> : null}
        </div>
        <Separator />
        <div className="min-h-0 flex-1">
          {activePath ? (
            <Editor
              key={activePath}
              path={activePath}
              theme="vs-dark"
              defaultLanguage={editorLanguage}
              language={editorLanguage}
              value={value}
              onChange={(v) => onChangeContents(activePath, v ?? '')}
              options={editorOptions}
            />
          ) : (
            <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
              Select a file
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

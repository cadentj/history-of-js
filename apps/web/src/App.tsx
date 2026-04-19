import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Terminal as XTerm } from 'xterm';
import { lessons } from '@/lessons';
import type { Lesson, LessonFile } from '@/lesson-types';
import {
  absWorkspacePath,
  attachShell,
  bootOnce,
  getWebContainer,
  mountLesson,
  packageJsonNeedsInstall,
  spawnWithOutput,
  writeFile,
  type ShellHandle,
  type WorkshopSession,
} from '@/container';
import {
  clearChapter,
  clearExerciseSnapshot,
  loadExerciseSnapshot,
  loadOverlay,
  saveFile,
  snapshotExercises,
} from '@/persistence';
import { Markdown } from '@/components/Markdown';
import { EditorPane } from '@/components/Editor';
import { Terminal } from '@/components/Terminal';
import { PreviewPane } from '@/components/Preview';
import { ViewToggle } from '@/components/ViewToggle';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { BookOpen, Check, Copy, Play, Square, TerminalIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

function parsePainFromUrl(): number {
  const q = new URLSearchParams(window.location.search).get('pain');
  if (!q) return lessons[0]?.pain ?? 1;
  const n = parseInt(q.replace(/^0+/, '') || '0', 10);
  return Number.isNaN(n) ? (lessons[0]?.pain ?? 1) : n;
}

function isDirtyVsBase(map: Map<string, string>, base: LessonFile[]): boolean {
  for (const f of base) {
    if (map.get(f.path) !== f.contents) return true;
  }
  return false;
}

function mapToLessonFiles(map: Map<string, string>): LessonFile[] {
  return Array.from(map.entries()).map(([path, contents]) => ({ path, contents }));
}

export function App() {
  const sortedLessons = useMemo(() => [...lessons].sort((a, b) => a.order - b.order), []);

  const [pain, setPain] = useState(parsePainFromUrl);
  const lesson: Lesson | undefined = useMemo(
    () => sortedLessons.find((l) => l.pain === pain) ?? sortedLessons[0],
    [sortedLessons, pain],
  );

  const [showSolution, setShowSolution] = useState(false);
  const mode: 'exercises' | 'solutions' = showSolution ? 'solutions' : 'exercises';

  const [fileMap, setFileMap] = useState<Map<string, string>>(() => new Map());
  const [activePath, setActivePath] = useState<string | null>(null);
  const [openTabs, setOpenTabs] = useState<string[]>([]);

  const [bootError, setBootError] = useState<string | null>(null);
  const [installDone, setInstallDone] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewNonce, setPreviewNonce] = useState(0);
  const [running, setRunning] = useState(false);
  const [view, setView] = useState<'editor' | 'preview'>('editor');

  const [solutionDialogOpen, setSolutionDialogOpen] = useState(false);

  const xtermRef = useRef<XTerm | null>(null);
  const shellRef = useRef<ShellHandle | null>(null);
  const pendingShellRef = useRef<{ session: WorkshopSession; token: number } | null>(null);
  const shellTokenRef = useRef(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const serverUnsubRef = useRef<(() => void) | null>(null);
  /** Once we pick a preview URL for this lesson run, ignore further server-ready ports. */
  const previewChosenRef = useRef(false);
  /** Latest lesson for async session callbacks (avoids stale preview port). */
  const lessonRef = useRef(lesson);
  lessonRef.current = lesson;

  const hasPreview = !!lesson?.previewPort;

  const appendTerm = useCallback((chunk: string) => {
    xtermRef.current?.write(chunk);
  }, []);

  const writeTermLine = useCallback(
    (line: string) => {
      appendTerm(`${line}\r\n`);
    },
    [appendTerm],
  );

  useEffect(() => {
    const u = new URL(window.location.href);
    u.searchParams.set('pain', String(pain).padStart(2, '0'));
    window.history.replaceState({}, '', u);
  }, [pain]);

  useEffect(() => {
    const onPop = () => setPain(parsePainFromUrl());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (!lesson) return;
    const myToken = shellTokenRef.current;
    let cancelled = false;
    setBootError(null);
    setPreviewUrl(null);
    previewChosenRef.current = false;
    setView('editor');
    setInstallDone(false);
    shellRef.current?.kill();
    shellRef.current = null;
    pendingShellRef.current = null;

    const base = mode === 'exercises' ? lesson.exercises : lesson.solutions;
    let map = loadOverlay(lesson.pain, mode, base);
    if (mode === 'exercises') {
      const snap = loadExerciseSnapshot(lesson.pain);
      if (snap) {
        map = new Map(map);
        for (const [p, c] of snap) map.set(p, c);
      }
    }
    setFileMap(map);
    const keys = Array.from(map.keys());
    const entry = keys.includes(lesson.entry) ? lesson.entry : keys[0] ?? null;
    setActivePath(entry);
    setOpenTabs(entry ? [entry] : []);

    void (async () => {
      try {
        const session = await bootOnce();
        if (cancelled) return;
        await mountLesson(session, mapToLessonFiles(map));
        if (cancelled) return;
        const pkg = map.get('package.json');
        if (pkg && packageJsonNeedsInstall(pkg)) {
          writeTermLine('$ npm install');
          await spawnWithOutput(session, 'npm', ['install'], appendTerm);
          writeTermLine('');
        }
        if (cancelled) return;
        const term = xtermRef.current;
        if (!term) {
          pendingShellRef.current = { session, token: myToken };
          return;
        }
        pendingShellRef.current = null;
        term.clear();
        shellRef.current?.kill();
        shellRef.current = null;
        const handle = await attachShell(session, term);
        if (cancelled || myToken !== shellTokenRef.current) {
          handle.kill();
          return;
        }
        shellRef.current = handle;
        setInstallDone(true);
      } catch (e) {
        if (!cancelled) setBootError(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      cancelled = true;
      shellTokenRef.current += 1;
      shellRef.current?.kill();
      shellRef.current = null;
      pendingShellRef.current = null;
    };
  }, [lesson, mode, appendTerm, writeTermLine]);

  useEffect(() => {
    if (!lesson) return;
    let cancelled = false;
    previewChosenRef.current = false;
    serverUnsubRef.current?.();
    serverUnsubRef.current = null;
    let unsub: (() => void) | undefined;
    void bootOnce()
      .then((session) => {
        if (cancelled) return;
        unsub = session.onServerReady((port, url) => {
          const want = lessonRef.current?.previewPort;
          if (!want) return;
          if (previewChosenRef.current) return;
          // Agent HTTP port — never treat as the lesson static server.
          if (port === 8080) return;
          // First new listen port wins. `serve` may use an ephemeral port if -l 3000 fails
          // or flags differ, so we no longer require port === lesson.previewPort.
          previewChosenRef.current = true;
          setPreviewUrl(url);
          setPreviewNonce((n) => n + 1);
        });
        serverUnsubRef.current = unsub;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      unsub?.();
      serverUnsubRef.current = null;
    };
  }, [lesson?.id, lesson?.previewPort]);

  const paths = useMemo(() => Array.from(fileMap.keys()), [fileMap]);

  const schedulePersist = useCallback(
    (relPath: string, contents: string) => {
      if (!lesson) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        saveFile(lesson.pain, mode, relPath, contents);
        const session = getWebContainer();
        if (session) {
          try {
            await writeFile(session, absWorkspacePath(session, relPath), contents);
          } catch {
            /* ignore */
          }
        }
      }, 150);
    },
    [lesson, mode],
  );

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    },
    [],
  );

  const handleChangeContents = useCallback(
    (relPath: string, value: string) => {
      setFileMap((prev) => {
        const next = new Map(prev);
        next.set(relPath, value);
        return next;
      });
      schedulePersist(relPath, value);
    },
    [schedulePersist],
  );

  const getContents = useCallback(
    (p: string) => fileMap.get(p) ?? '',
    [fileMap],
  );

  const handleOpenTab = useCallback((p: string) => {
    setActivePath(p);
    setOpenTabs((tabs) => (tabs.includes(p) ? tabs : [...tabs, p]));
  }, []);

  const handleCloseTab = useCallback((p: string) => {
    setOpenTabs((tabs) => {
      const next = tabs.filter((t) => t !== p);
      setActivePath((cur) => (cur === p ? next[next.length - 1] ?? null : cur));
      return next;
    });
  }, []);

  const handleSelectTab = useCallback((p: string) => setActivePath(p), []);

  const handleReset = useCallback(() => {
    if (!lesson) return;
    const token = shellTokenRef.current;
    setShowSolution(false);
    clearChapter(lesson.pain);
    clearExerciseSnapshot(lesson.pain);
    const base = mode === 'exercises' ? lesson.exercises : lesson.solutions;
    const map = loadOverlay(lesson.pain, mode, base);
    setFileMap(map);
    const entry = map.has(lesson.entry) ? lesson.entry : Array.from(map.keys())[0] ?? null;
    setActivePath(entry);
    setOpenTabs(entry ? [entry] : []);
    setPreviewUrl(null);
    previewChosenRef.current = false;
    setView('editor');
    setInstallDone(false);
    shellRef.current?.kill();
    shellRef.current = null;
    pendingShellRef.current = null;
    void (async () => {
      try {
        const session = await bootOnce();
        await mountLesson(session, mapToLessonFiles(map));
        const pkg = map.get('package.json');
        if (pkg && packageJsonNeedsInstall(pkg)) {
          writeTermLine('$ npm install');
          await spawnWithOutput(session, 'npm', ['install'], appendTerm);
          writeTermLine('');
        }
        const term = xtermRef.current;
        if (!term) {
          pendingShellRef.current = { session, token };
          return;
        }
        pendingShellRef.current = null;
        term.clear();
        shellRef.current?.kill();
        shellRef.current = null;
        const handle = await attachShell(session, term);
        if (token !== shellTokenRef.current) {
          handle.kill();
          return;
        }
        shellRef.current = handle;
        setInstallDone(true);
      } catch {
        /* ignore */
      }
    })();
  }, [lesson, mode, appendTerm, writeTermLine]);

  const confirmSwitchToSolution = useCallback(() => {
    if (!lesson) return;
    snapshotExercises(lesson.pain, fileMap);
    setShowSolution(true);
    setSolutionDialogOpen(false);
  }, [lesson, fileMap]);

  const onShowSolutionChange = useCallback(
    (next: boolean) => {
      if (!lesson) return;
      if (next) {
        const dirty = isDirtyVsBase(fileMap, lesson.exercises);
        if (dirty) setSolutionDialogOpen(true);
        else {
          snapshotExercises(lesson.pain, fileMap);
          setShowSolution(true);
        }
      } else {
        setShowSolution(false);
      }
    },
    [lesson, fileMap],
  );

  const handleRun = useCallback(() => {
    if (!lesson) return;
    setRunning(true);
    setPreviewUrl(null);
    previewChosenRef.current = false;
    if (lesson.previewPort) setView('preview');
    shellRef.current?.writeCommand(lesson.run);
  }, [lesson]);

  const handleStop = useCallback(() => {
    shellRef.current?.sendSignal('c');
    setRunning(false);
    setPreviewUrl(null);
    previewChosenRef.current = false;
    setView('editor');
  }, []);

  const [copiedUrl, setCopiedUrl] = useState(false);
  const handleCopyPreviewUrl = useCallback(() => {
    if (!previewUrl) return;
    void navigator.clipboard.writeText(previewUrl).then(() => {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 1500);
    });
  }, [previewUrl]);

  const handleTerminalReady = useCallback((t: XTerm | null) => {
    xtermRef.current = t;
    if (!t) return;
    const pending = pendingShellRef.current;
    if (!pending) return;
    pendingShellRef.current = null;
    const { session, token } = pending;
    void (async () => {
      t.clear();
      shellRef.current?.kill();
      shellRef.current = null;
      try {
        const handle = await attachShell(session, t);
        if (token !== shellTokenRef.current) {
          handle.kill();
          return;
        }
        shellRef.current = handle;
        setInstallDone(true);
      } catch (e) {
        setBootError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  const handleTerminalResize = useCallback((cols: number, rows: number) => {
    shellRef.current?.resize(cols, rows);
  }, []);

  if (!lesson) {
    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <p className="text-muted-foreground">No lessons found in the manifest.</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex h-svh min-h-0 flex-col">
        <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-card px-4 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <BookOpen className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            <h1 className="truncate text-base font-semibold tracking-tight">{lesson.title}</h1>
            <Badge variant="secondary" className="shrink-0 font-mono text-xs">
              {lesson.id}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Label htmlFor="chapter" className="text-muted-foreground text-xs">
                Chapter
              </Label>
              <Select
                value={String(lesson.pain)}
                onValueChange={(v) => setPain(Number(v))}
              >
                <SelectTrigger id="chapter" size="sm" className="min-w-[14rem]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sortedLessons.map((l) => (
                    <SelectItem key={l.id} value={String(l.pain)}>
                      {l.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator orientation="vertical" className="hidden h-6 sm:block" />

            <div className="flex items-center gap-2">
              <Switch id="solution" checked={showSolution} onCheckedChange={onShowSolutionChange} />
              <Label htmlFor="solution" className="text-sm">
                Show solution
              </Label>
            </div>

            <Button type="button" variant="outline" size="sm" onClick={handleReset}>
              Reset
            </Button>

            <div className="flex items-center gap-1.5">
              <Button type="button" size="sm" onClick={handleRun} disabled={!installDone}>
                <Play className="size-3.5" />
                Run
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={handleStop} disabled={!running}>
                <Square className="size-3.5" />
                Stop
              </Button>
              {previewUrl ? (
                <Button type="button" size="sm" variant="outline" onClick={handleCopyPreviewUrl}>
                  {copiedUrl ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  {copiedUrl ? 'Copied!' : 'Copy preview URL'}
                </Button>
              ) : null}
            </div>
          </div>
        </header>

        {bootError ? (
          <div className="border-b border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            Runtime: {bootError}
          </div>
        ) : null}

        <div className="min-h-0 flex-1">
          <ResizablePanelGroup orientation="horizontal" className="h-full">
            <ResizablePanel defaultSize={33} minSize={18} className="min-w-0">
              <div className="flex h-full flex-col border-r border-border bg-muted/20">
                <div className="border-b border-border px-3 py-2">
                  <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                    Narrative
                  </span>
                </div>
                <div className="min-h-0 flex-1 overflow-auto p-4">
                  <Markdown markdown={lesson.markdown} />
                </div>
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={67} minSize={35} className="min-w-0">
              <ResizablePanelGroup orientation="vertical" className="h-full">
                <ResizablePanel defaultSize={72} minSize={30} className="min-h-0">
                  <div className="relative h-full min-h-0">
                    <div
                      className={cn(
                        'absolute inset-0 min-h-0',
                        hasPreview && view === 'preview' ? 'hidden' : 'block',
                      )}
                    >
                      <EditorPane
                        paths={paths}
                        openTabs={openTabs}
                        activePath={activePath}
                        getContents={getContents}
                        onOpenTab={handleOpenTab}
                        onCloseTab={handleCloseTab}
                        onSelectTab={handleSelectTab}
                        onChangeContents={handleChangeContents}
                        toolbarExtras={
                          hasPreview ? (
                            <ViewToggle
                              value={view}
                              onChange={setView}
                              disabled={!previewUrl}
                            />
                          ) : undefined
                        }
                      />
                    </div>
                    {hasPreview && (previewUrl != null || view === 'preview') ? (
                      <div
                        className={cn(
                          'absolute inset-0 min-h-0',
                          view === 'preview' ? 'block' : 'hidden',
                        )}
                      >
                        <PreviewPane
                          url={previewUrl}
                          nonce={previewNonce}
                          onCopyUrl={handleCopyPreviewUrl}
                          copied={copiedUrl}
                          toolbarExtras={
                            <ViewToggle
                              value={view}
                              onChange={setView}
                              disabled={!previewUrl}
                            />
                          }
                        />
                      </div>
                    ) : null}
                  </div>
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={36} minSize={12} className="min-h-0 border-t border-border bg-card">
                  <div className="flex h-full min-h-0 flex-col">
                    <div className="flex items-center gap-2 border-b border-border px-3 py-2">
                      <TerminalIcon className="size-4 text-muted-foreground" />
                      <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
                        Terminal
                      </span>
                      {!installDone ? (
                        <Badge variant="outline" className="text-[10px]">
                          Preparing…
                        </Badge>
                      ) : null}
                    </div>
                    <div className="min-h-0 flex-1">
                      <Terminal onTerminal={handleTerminalReady} onResize={handleTerminalResize} />
                    </div>
                  </div>
                </ResizablePanel>
              </ResizablePanelGroup>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>

      <AlertDialog open={solutionDialogOpen} onOpenChange={setSolutionDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Overwrite exercises with solutions?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved edits relative to the exercise stubs. Your current exercise files will be
              snapshotted so you can restore them when you turn off “Show solution”.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSwitchToSolution}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

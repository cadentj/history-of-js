import type { Plugin } from 'vite';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Lesson, LessonFile } from '../src/lesson-types';

const SKIP_DIR = new Set(['node_modules', '.git']);

function isChapterMetaFile(filePath: string): boolean {
  const b = basename(filePath);
  return b === 'README.md' || b === 'lesson.json';
}

interface LessonJson {
  title?: string;
  entry?: string;
  run?: string;
  previewUrl?: string;
  previewPort?: number;
  order?: number;
}

const PLUGIN_DIR = fileURLToPath(new URL('.', import.meta.url));
/** vite-plugins/ lives under apps/web → repo root is three levels up. */
const REPO_ROOT = join(PLUGIN_DIR, '..', '..', '..');

function walkChapterFiles(root: string): string[] {
  const out: string[] = [];
  if (!existsSync(root)) return out;
  function walk(dir: string): void {
    for (const entry of readdirSync(dir)) {
      if (SKIP_DIR.has(entry)) continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (!isChapterMetaFile(full)) {
        out.push(full);
      }
    }
  }
  walk(root);
  return out;
}

function readTree(root: string): LessonFile[] {
  const files = walkChapterFiles(root);
  return files.map((full) => ({
    path: relative(root, full).replace(/\\/g, '/'),
    contents: readFileSync(full, 'utf8'),
  }));
}

function stripFrontmatter(markdown: string): string {
  if (!markdown.startsWith('---')) return markdown;
  const end = markdown.indexOf('\n---', 3);
  if (end === -1) return markdown;
  return markdown.slice(end + 4).replace(/^\s*\n/, '');
}

function parseYamlTitle(markdown: string): string | undefined {
  if (!markdown.startsWith('---')) return undefined;
  const end = markdown.indexOf('\n---', 3);
  if (end === -1) return undefined;
  const fm = markdown.slice(3, end);
  const m = fm.match(/^title:\s*(?:"([^"]*)"|'([^']*)'|(.+))$/m);
  if (m) return (m[1] ?? m[2] ?? m[3])?.trim();
  return undefined;
}

function parseFirstHeading(markdown: string): string | undefined {
  const body = stripFrontmatter(markdown);
  const m = body.match(/^#\s+(.+)$/m);
  return m?.[1]?.trim();
}

function hasFile(files: LessonFile[], name: string): boolean {
  return files.some((f) => f.path === name);
}

function inferEntry(files: LessonFile[], override?: string): string {
  if (override) return override;
  if (hasFile(files, 'index.html')) return 'index.html';
  if (hasFile(files, 'index.js')) return 'index.js';
  const sorted = [...files].map((f) => f.path).sort();
  return sorted[0] ?? 'index.html';
}

function inferRun(files: LessonFile[]): string {
  const hasHtml = hasFile(files, 'index.html');
  const hasJs = hasFile(files, 'index.js');
  if (hasJs && !hasHtml) return 'node index.js';
  if (hasHtml) return 'npx serve -l 8080 .';
  return 'node index.js';
}

function inferPreviewPort(json: LessonJson): number {
  if (json.previewPort != null) return json.previewPort;
  if (json.previewUrl) {
    const m = json.previewUrl.match(/:(\d+)/);
    if (m) return parseInt(m[1], 10);
  }
  return 8080;
}

function discoverPains(chaptersRoot: string): number[] {
  const out: number[] = [];
  if (!existsSync(chaptersRoot)) return out;
  for (const name of readdirSync(chaptersRoot)) {
    const m = /^pain-(\d+)$/.exec(name);
    if (m) out.push(parseInt(m[1], 10));
  }
  return out.sort((a, b) => a - b);
}

function readLessonJson(chapterDir: string): LessonJson {
  const p = join(chapterDir, 'lesson.json');
  if (!existsSync(p)) return {};
  try {
    return JSON.parse(readFileSync(p, 'utf8')) as LessonJson;
  } catch {
    return {};
  }
}

function buildLesson(pain: number): Lesson {
  const nn = String(pain).padStart(2, '0');
  const id = `pain-${nn}`;
  const chapterDir = join(REPO_ROOT, 'chapters', id);
  const exercisesRoot = join(REPO_ROOT, 'exercises', id);
  const solutionsRoot = chapterDir;
  const docPath = join(chapterDir, 'README.md');

  const exercises = readTree(exercisesRoot);
  const solutions = readTree(solutionsRoot);
  const lessonJson = readLessonJson(chapterDir);

  let markdown = '';
  if (existsSync(docPath)) {
    markdown = readFileSync(docPath, 'utf8');
  }

  const titleFromYaml = parseYamlTitle(markdown);
  const titleFromHeading = parseFirstHeading(markdown);
  const title =
    lessonJson.title?.trim() ||
    titleFromYaml?.trim() ||
    titleFromHeading?.trim() ||
    `Pain ${nn}`;

  const entry = inferEntry(exercises, lessonJson.entry);
  const run = lessonJson.run?.trim() || inferRun(exercises);
  const previewPort = inferPreviewPort(lessonJson);
  const order = lessonJson.order ?? pain;

  return {
    id,
    pain,
    markdown: stripFrontmatter(markdown),
    title,
    order,
    exercises,
    solutions,
    entry,
    run,
    previewPort,
  };
}

const VIRTUAL_ID = 'virtual:lessons';
const RESOLVED = '\0' + VIRTUAL_ID;

export function lessonsPlugin(): Plugin {
  return {
    name: 'history-of-js-lessons',
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED;
    },
    load(id) {
      if (id !== RESOLVED) return null;
      const pains = discoverPains(join(REPO_ROOT, 'chapters'));
      const lessons = pains.map(buildLesson);
      lessons.sort((a, b) => a.order - b.order);
      const serialized = JSON.stringify(lessons);
      return `export const lessons = ${serialized};
export default lessons;`;
    },
    configureServer(server) {
      server.watcher.add(join(REPO_ROOT, 'chapters'));
      server.watcher.add(join(REPO_ROOT, 'exercises'));
    },
  };
}

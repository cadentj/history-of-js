/**
 * Generate exercises/pain-NN/* from chapters/pain-NN/* (canonical solution tree).
 * Strips regions delimited by BEGIN:SOLUTION / END:SOLUTION (JS or HTML comments).
 * Hand-authored TODO comments outside those markers flow through untouched.
 * Skips README.md and lesson.json (chapter metadata, not workspace files).
 *
 * Run: pnpm run generate:exercise
 */
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TEXT_SUFFIXES = new Set(['.html', '.htm', '.js', '.css', '.md', '.json', '.txt', '.svg']);

const JS_PATTERN = /^[ \t]*\/\/ BEGIN:SOLUTION[ \t]*\r?\n[\s\S]*?^[ \t]*\/\/ END:SOLUTION[ \t]*\r?\n?/gm;
const HTML_PATTERN = /^[ \t]*<!--[ \t]*BEGIN:SOLUTION[ \t]*-->[ \t]*\r?\n[\s\S]*?^[ \t]*<!--[ \t]*END:SOLUTION[ \t]*-->[ \t]*\r?\n?/gm;

function strip(path: string, text: string): string {
  const suf = extname(path).toLowerCase();
  if (suf === '.html' || suf === '.htm') return text.replace(HTML_PATTERN, '');
  if (suf === '.js') return text.replace(JS_PATTERN, '');
  return text;
}

const SKIP_DIRS = new Set(['node_modules', '.git']);

function isChapterMetaFile(fullPath: string): boolean {
  const b = basename(fullPath);
  return b === 'README.md' || b === 'lesson.json';
}

function walkChapterFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walkChapterFiles(full));
    else if (!isChapterMetaFile(full)) out.push(full);
  }
  return out;
}

function generate(pain: number): number {
  const nn = String(pain).padStart(2, '0');
  const src = join(ROOT, 'chapters', `pain-${nn}`);
  const dst = join(ROOT, 'exercises', `pain-${nn}`);

  let count = 0;
  if (!existsSync(src)) return 0;
  for (const file of walkChapterFiles(src)) {
    const rel = relative(src, file);
    const target = join(dst, rel);
    mkdirSync(dirname(target), { recursive: true });

    if (TEXT_SUFFIXES.has(extname(file).toLowerCase())) {
      const raw = readFileSync(file, 'utf8');
      writeFileSync(target, strip(file, raw));
    } else {
      copyFileSync(file, target);
    }
    count++;
  }
  return count;
}

function discoverPains(): number[] {
  const chapters = join(ROOT, 'chapters');
  if (!existsSync(chapters)) return [];
  const pains: number[] = [];
  for (const name of readdirSync(chapters)) {
    const m = name.match(/^pain-(\d+)$/);
    if (!m) continue;
    const dir = join(chapters, name);
    try {
      if (statSync(dir).isDirectory()) pains.push(parseInt(m[1], 10));
    } catch {}
  }
  return pains.sort((a, b) => a - b);
}

for (const n of discoverPains()) {
  const c = generate(n);
  console.log(`pain-${String(n).padStart(2, '0')}: ${c} file(s)`);
}

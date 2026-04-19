import type { LessonFile } from '@/lesson-types';

const NS = 'history-of-js';

function key(pain: number, mode: 'exercises' | 'solutions', relPath: string): string {
  const nn = String(pain).padStart(2, '0');
  return `${NS}/pain-${nn}/${mode}/${relPath}`;
}

function snapshotKey(pain: number): string {
  const nn = String(pain).padStart(2, '0');
  return `${NS}/snapshot/pain-${nn}-exercises`;
}

export function loadOverlay(
  pain: number,
  mode: 'exercises' | 'solutions',
  base: LessonFile[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const f of base) {
    const k = key(pain, mode, f.path);
    const stored = localStorage.getItem(k);
    map.set(f.path, stored ?? f.contents);
  }
  return map;
}

export function saveFile(
  pain: number,
  mode: 'exercises' | 'solutions',
  relPath: string,
  contents: string,
): void {
  localStorage.setItem(key(pain, mode, relPath), contents);
}

export function clearChapter(pain: number): void {
  const prefix = `${NS}/pain-${String(pain).padStart(2, '0')}/`;
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k?.startsWith(prefix)) toRemove.push(k);
  }
  for (const k of toRemove) localStorage.removeItem(k);
}

export function snapshotExercises(pain: number, files: Map<string, string>): void {
  const nn = String(pain).padStart(2, '0');
  const obj: Record<string, string> = {};
  for (const [p, c] of files) obj[p] = c;
  localStorage.setItem(snapshotKey(pain), JSON.stringify({ pain: nn, files: obj }));
}

export function loadExerciseSnapshot(pain: number): Map<string, string> | null {
  const raw = localStorage.getItem(snapshotKey(pain));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { files?: Record<string, string> };
    if (!parsed.files) return null;
    return new Map(Object.entries(parsed.files));
  } catch {
    return null;
  }
}

export function clearExerciseSnapshot(pain: number): void {
  localStorage.removeItem(snapshotKey(pain));
}

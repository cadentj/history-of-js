export interface LessonFile {
  path: string;
  contents: string;
}

export interface Lesson {
  id: string;
  pain: number;
  markdown: string;
  title: string;
  order: number;
  exercises: LessonFile[];
  solutions: LessonFile[];
  entry: string;
  run: string;
  /** Resolved preview port for static servers (default 8080). */
  previewPort: number;
}

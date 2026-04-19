import type { Lesson } from '@/lesson-types';
import { lessons as _lessons } from 'virtual:lessons';

export type { Lesson, LessonFile } from '@/lesson-types';

export const lessons: Lesson[] = _lessons;

import { TaskCategory } from './types';

const STORAGE_KEY = 'sako:new-task-prefill';

export interface NewTaskPrefillPayload {
  title: string;
  description: string;
  category: TaskCategory;
  brandId?: string;
  useAI?: boolean;
  sourceTaskId?: string;
  sourceTaskTitle?: string;
}

export function setNewTaskPrefill(payload: NewTaskPrefillPayload) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('Failed to cache new task prefill payload', error);
  }
}

export function consumeNewTaskPrefill(): NewTaskPrefillPayload | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(STORAGE_KEY);
    return JSON.parse(raw) as NewTaskPrefillPayload;
  } catch (error) {
    console.warn('Failed to read cached new task prefill payload', error);
    return null;
  }
}

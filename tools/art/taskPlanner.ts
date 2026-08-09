import fs from 'node:fs/promises';
import path from 'node:path';
import type { ArtCategory, ArtTask } from './types';

const TASK_FILES: Record<ArtCategory, string> = {
  character: 'characters.json',
  zone: 'zones.json',
  item: 'items.json',
  world_event: 'world-events.json',
};

function assertTask(value: unknown, source: string): ArtTask {
  if (!value || typeof value !== 'object') throw new Error(`${source}: task must be an object`);
  const task = value as Partial<ArtTask>;
  if (
    typeof task.id !== 'string' ||
    !task.id ||
    !['character', 'zone', 'item', 'world_event'].includes(task.category ?? '') ||
    typeof task.entityId !== 'string' ||
    typeof task.variant !== 'string' ||
    !Number.isInteger(task.width) ||
    !Number.isInteger(task.height) ||
    typeof task.promptTemplate !== 'string' ||
    typeof task.styleProfile !== 'string' ||
    !Number.isInteger(task.revision) ||
    task.status !== 'planned'
  ) {
    throw new Error(`${source}: invalid task definition`);
  }
  return task as ArtTask;
}

export async function loadTasks(rootDir: string): Promise<ArtTask[]> {
  const taskDir = path.join(rootDir, 'art', 'tasks');
  const tasks: ArtTask[] = [];
  for (const [category, filename] of Object.entries(TASK_FILES) as [ArtCategory, string][]) {
    const file = path.join(taskDir, filename);
    const parsed: unknown = JSON.parse(await fs.readFile(file, 'utf8'));
    if (!Array.isArray(parsed)) throw new Error(`${file}: expected an array`);
    parsed.forEach((value, index) => tasks.push(assertTask(value, `${file}[${index}]`)));
    for (const task of tasks.filter((item) => item.category === category)) {
      if (!task.id.startsWith(`${category}/`)) throw new Error(`${file}: ${task.id} has wrong category prefix`);
    }
  }
  const ids = new Set<string>();
  for (const task of tasks) {
    if (ids.has(task.id)) throw new Error(`duplicate art task: ${task.id}`);
    ids.add(task.id);
  }
  return tasks;
}

export function selectTasks(
  tasks: ArtTask[],
  options: { taskId?: string; category?: string; status?: string },
): ArtTask[] {
  let selected = tasks;
  if (options.taskId) selected = selected.filter((task) => task.id === options.taskId);
  if (options.category) {
    const category = options.category.replace(/s$/, '') as ArtCategory;
    selected = selected.filter((task) => task.category === category);
  }
  if (options.status === 'missing') return selected;
  return selected;
}

export function taskForId(tasks: ArtTask[], taskId: string): ArtTask {
  const task = tasks.find((item) => item.id === taskId);
  if (!task) throw new Error(`unknown art task: ${taskId}`);
  return task;
}

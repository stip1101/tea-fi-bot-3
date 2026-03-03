import { eq, and, inArray } from 'drizzle-orm';
import { db, tasks, type Task } from '../db';
import { generateId } from '../utils/id';

export async function createTask(
  name: string,
  description: string | undefined,
  xpReward: number,
  createdBy: string
): Promise<Task> {
  const id = generateId();

  const result = await db
    .insert(tasks)
    .values({ id, name, description, xpReward, createdBy })
    .returning();

  if (!result[0]) throw new Error('Failed to create task');
  return result[0];
}

export async function getActiveTasks(): Promise<Task[]> {
  return db
    .select()
    .from(tasks)
    .where(eq(tasks.isActive, true))
    .orderBy(tasks.name);
}

export async function getTaskById(id: string): Promise<Task | null> {
  const result = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  return result[0] ?? null;
}

export async function getAllTasks(): Promise<Task[]> {
  return db.select().from(tasks).orderBy(tasks.createdAt);
}

export async function updateTask(
  id: string,
  data: Partial<Pick<Task, 'name' | 'description' | 'xpReward' | 'isActive'>>
): Promise<Task | null> {
  const result = await db
    .update(tasks)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(tasks.id, id))
    .returning();

  return result[0] ?? null;
}

export async function deactivateTask(id: string): Promise<Task | null> {
  return updateTask(id, { isActive: false });
}

export async function getTasksByIds(ids: string[]): Promise<Map<string, Task>> {
  if (ids.length === 0) return new Map();
  const result = await db.select().from(tasks).where(inArray(tasks.id, ids));
  return new Map(result.map((t) => [t.id, t]));
}

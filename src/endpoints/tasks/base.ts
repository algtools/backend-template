import { z } from "zod";
import type { Task } from "../../generated/prisma/client";

export const task = z.object({
	id: z.number().int(),
	name: z.string(),
	slug: z.string(),
	description: z.string(),
	completed: z.boolean(),
	due_date: z.string().datetime(),
});

export type TaskApiShape = z.infer<typeof task>;

/** Convert a Prisma Task row to the API shape (snake_case, ISO date string). */
export function serializeTask(row: Task): TaskApiShape {
	return {
		id: row.id,
		name: row.name,
		slug: row.slug,
		description: row.description,
		completed: row.completed,
		due_date: row.dueDate.toISOString(),
	};
}

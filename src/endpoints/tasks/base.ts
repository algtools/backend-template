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

export const TaskModel = {
	tableName: "tasks",
	primaryKeys: ["id"],
	schema: task,
	serializer: (obj: object) => {
		const record = obj as Record<string, unknown>;
		return {
			...record,
			completed: Boolean(record.completed),
		};
	},
	serializerObject: task,
};

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

/** Build a Prisma `where` clause from chanfana filter conditions. */
export function buildPrismaWhere(
	conditions: Array<{ field: string; operator: string; value: unknown }>,
): Record<string, unknown> {
	if (conditions.length === 0) return {};

	const clauses = conditions.map((c) => {
		// Map API snake_case field names to Prisma camelCase where needed.
		const field = c.field === "due_date" ? "dueDate" : c.field;
		if (c.operator === "LIKE") {
			const val = (c.value as string).replace(/%/g, "");
			return { [field]: { contains: val } };
		}
		return { [field]: c.value };
	});

	return clauses.length === 1 ? clauses[0] : { OR: clauses };
}

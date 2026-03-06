import { OpenAPIRoute, contentJson } from "chanfana";
import { z } from "zod";
import { createPrismaClient } from "../../lib/prisma";
import { TasksRepository } from "../../domain/tasks/repository";
import { HandleArgs } from "../../types";
import { task } from "./base";
import { invalidateTasksCacheAfterWrite } from "./invalidation";

export class TaskUpdate extends OpenAPIRoute<HandleArgs> {
	schema = {
		tags: ["Tasks"],
		summary: "Update a task",
		operationId: "tasks-update",
		request: {
			params: z.object({ id: z.coerce.number().int() }),
			body: contentJson(task.omit({ id: true })),
		},
		responses: {
			"200": {
				description: "Task updated successfully",
				...contentJson(z.object({ success: z.boolean(), result: task })),
			},
			"400": {
				description: "Validation error",
				...contentJson(
					z.object({
						success: z.boolean(),
						errors: z.array(z.object({ message: z.string() })),
					}),
				),
			},
			"404": {
				description: "Task not found",
				...contentJson(
					z.object({
						success: z.boolean(),
						errors: z.array(z.object({ message: z.string() })),
					}),
				),
			},
		},
	};

	async handle(...args: HandleArgs): Promise<Response> {
		const [c] = args;
		const data = await this.getValidatedData<typeof this.schema>();

		const repo = new TasksRepository(createPrismaClient(c.env.DB));
		const updated = await repo.update(data.params.id, data.body);

		if (!updated) {
			return Response.json(
				{ success: false, errors: [{ message: "Not Found" }] },
				{ status: 404 },
			);
		}

		await invalidateTasksCacheAfterWrite(c, "tasks.update");

		return Response.json({ success: true, result: updated });
	}
}

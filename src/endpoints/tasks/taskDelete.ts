import { OpenAPIRoute, contentJson } from "chanfana";
import { z } from "zod";
import { createPrismaClient } from "../../lib/prisma";
import { TasksRepository } from "../../domain/tasks/repository";
import { HandleArgs } from "../../types";
import { task } from "./base";
import { invalidateTasksCacheAfterWrite } from "./invalidation";

export class TaskDelete extends OpenAPIRoute<HandleArgs> {
	schema = {
		tags: ["Tasks"],
		summary: "Delete a task",
		operationId: "tasks-delete",
		request: {
			params: z.object({ id: z.coerce.number().int() }),
		},
		responses: {
			"200": {
				description: "Task deleted successfully",
				...contentJson(z.object({ success: z.boolean(), result: task })),
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
		const deleted = await repo.delete(data.params.id);

		if (!deleted) {
			return Response.json(
				{ success: false, errors: [{ message: "Not Found" }] },
				{ status: 404 },
			);
		}

		await invalidateTasksCacheAfterWrite(c, "tasks.delete");

		return Response.json({ success: true, result: deleted });
	}
}

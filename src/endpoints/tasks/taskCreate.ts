import { OpenAPIRoute, contentJson } from "chanfana";
import { z } from "zod";
import { createPrismaClient } from "../../lib/prisma";
import { TasksRepository } from "../../domain/tasks/repository";
import { HandleArgs } from "../../types";
import { task } from "./base";
import { invalidateTasksCacheAfterWrite } from "./invalidation";

export class TaskCreate extends OpenAPIRoute<HandleArgs> {
	schema = {
		tags: ["Tasks"],
		summary: "Create a task",
		operationId: "tasks-create",
		request: {
			body: contentJson(task.omit({ id: true })),
		},
		responses: {
			"201": {
				description: "Task created successfully",
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
		},
	};

	async handle(...args: HandleArgs): Promise<Response> {
		const [c] = args;
		const data = await this.getValidatedData<typeof this.schema>();

		const repo = new TasksRepository(createPrismaClient(c.env.DB));
		const created = await repo.create(data.body);

		await invalidateTasksCacheAfterWrite(c, "tasks.create");

		return Response.json({ success: true, result: created }, { status: 201 });
	}
}

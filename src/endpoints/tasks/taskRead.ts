import { OpenAPIRoute, contentJson } from "chanfana";
import { z } from "zod";
import { createPrismaClient } from "../../lib/prisma";
import { TasksRepository } from "../../domain/tasks/repository";
import { HandleArgs } from "../../types";
import { task } from "./base";
import {
	buildTasksReadCacheKey,
	getTasksCacheTtlSeconds,
	getTasksCacheVersion,
	kvGetJson,
	kvPutJson,
} from "./kvCache";
import { logError } from "./logging";

const readResponseSchema = z.object({ success: z.boolean(), result: task });
type ReadResponse = z.infer<typeof readResponseSchema>;

const notFoundSchema = z.object({
	success: z.boolean(),
	errors: z.array(z.object({ message: z.string() })),
});

export class TaskRead extends OpenAPIRoute<HandleArgs> {
	schema = {
		tags: ["Tasks"],
		summary: "Get a task by ID",
		operationId: "tasks-read",
		request: {
			params: z.object({ id: z.coerce.number().int() }),
		},
		responses: {
			"200": {
				description: "Task found",
				...contentJson(readResponseSchema),
			},
			"404": {
				description: "Task not found",
				...contentJson(notFoundSchema),
			},
		},
	};

	async handle(...args: HandleArgs): Promise<Response> {
		const [c] = args;
		const kv = c.env.KV;

		const idParam = c.req.param("id");
		let version: string | null = null;
		let cacheKey: string | null = null;
		try {
			version = await getTasksCacheVersion(kv);
			cacheKey = buildTasksReadCacheKey(version, idParam);

			const cached = await kvGetJson<ReadResponse>(kv, cacheKey, {
				validate: (value) => {
					if (!value || typeof value !== "object") {
						throw new Error("Invalid cached read payload");
					}
					const v = value as Record<string, unknown>;
					if (typeof v.success !== "boolean") {
						throw new Error("Invalid cached read payload: success");
					}
					if (!("result" in v)) {
						throw new Error("Invalid cached read payload: result");
					}
					return value as ReadResponse;
				},
			});
			if (cached !== null) return Response.json(cached);
		} catch (error) {
			logError(
				c,
				"Tasks KV cache read failed (read). Returning fresh.",
				{ url: c.req.url, id: idParam, version, cacheKey },
				error,
			);
		}

		const data = await this.getValidatedData<typeof this.schema>();
		const repo = new TasksRepository(createPrismaClient(c.env.DB));
		const found = await repo.findById(data.params.id);

		if (!found) {
			return Response.json(
				{ success: false, errors: [{ message: "Not Found" }] },
				{ status: 404 },
			);
		}

		const fresh: ReadResponse = { success: true, result: found };

		if (version !== null && cacheKey !== null) {
			try {
				await kvPutJson(kv, cacheKey, fresh, {
					expirationTtl: getTasksCacheTtlSeconds(c.env),
				});
			} catch (error) {
				logError(
					c,
					"Tasks KV cache write failed (read). Returning fresh.",
					{ url: c.req.url, id: idParam, version, cacheKey },
					error,
				);
			}
		}

		return Response.json(fresh);
	}
}

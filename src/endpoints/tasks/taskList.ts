import { OpenAPIRoute, contentJson } from "chanfana";
import { z } from "zod";
import { createPrismaClient } from "../../lib/prisma";
import { TasksRepository } from "../../domain/tasks/repository";
import { HandleArgs } from "../../types";
import { task } from "./base";
import {
	buildTasksListCacheKey,
	getTasksCacheTtlSeconds,
	getTasksCacheVersion,
	kvGetJson,
	kvPutJson,
} from "./kvCache";
import { logError } from "./logging";

const listResponseSchema = z.object({
	success: z.boolean(),
	result: z.array(task),
	result_info: z.object({
		count: z.number().int(),
		page: z.number().int(),
		per_page: z.number().int(),
		total_count: z.number().int(),
	}),
});

type ListResponse = z.infer<typeof listResponseSchema>;

export class TaskList extends OpenAPIRoute<HandleArgs> {
	schema = {
		tags: ["Tasks"],
		summary: "List tasks",
		operationId: "tasks-list",
		request: {
			query: z.object({
				page: z.coerce.number().int().min(1).default(1),
				per_page: z.coerce.number().int().min(1).max(100).default(20),
				search: z.string().optional(),
				order_by: z.string().optional().default("id"),
				order_by_direction: z.enum(["asc", "desc"]).optional().default("desc"),
			}),
		},
		responses: {
			"200": {
				description: "Paginated list of tasks",
				...contentJson(listResponseSchema),
			},
		},
	};

	async handle(...args: HandleArgs): Promise<Response> {
		const [c] = args;
		const kv = c.env.KV;

		let version: string | null = null;
		let cacheKey: string | null = null;
		try {
			version = await getTasksCacheVersion(kv);
			cacheKey = buildTasksListCacheKey(version, c.req.url);

			const cached = await kvGetJson<ListResponse>(kv, cacheKey, {
				validate: (value) => {
					if (!value || typeof value !== "object") {
						throw new Error("Invalid cached list payload");
					}
					const v = value as Record<string, unknown>;
					if (typeof v.success !== "boolean") {
						throw new Error("Invalid cached list payload: success");
					}
					if (!Array.isArray(v.result)) {
						throw new Error("Invalid cached list payload: result");
					}
					return value as ListResponse;
				},
			});
			if (cached !== null) return Response.json(cached);
		} catch (error) {
			logError(
				c,
				"Tasks KV cache read failed (list). Returning fresh.",
				{ url: c.req.url, version, cacheKey },
				error,
			);
		}

		const data = await this.getValidatedData<typeof this.schema>();
		const { page, per_page, search, order_by, order_by_direction } = data.query;

		const repo = new TasksRepository(createPrismaClient(c.env.DB));
		const { items, totalCount } = await repo.list({
			page,
			perPage: per_page,
			search,
			orderBy: order_by ?? "id",
			orderByDir: order_by_direction ?? "desc",
		});

		const fresh: ListResponse = {
			success: true,
			result: items,
			result_info: {
				count: items.length,
				page,
				per_page,
				total_count: totalCount,
			},
		};

		if (version !== null && cacheKey !== null) {
			try {
				await kvPutJson(kv, cacheKey, fresh, {
					expirationTtl: getTasksCacheTtlSeconds(c.env),
				});
			} catch (error) {
				logError(
					c,
					"Tasks KV cache write failed (list). Returning fresh.",
					{ url: c.req.url, version, cacheKey },
					error,
				);
			}
		}

		return Response.json(fresh);
	}
}

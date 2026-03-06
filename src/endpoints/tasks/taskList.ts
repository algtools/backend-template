import { D1ListEndpoint } from "chanfana";
import type { ListFilters } from "chanfana";
import { createPrismaClient, type PrismaClient } from "../../lib/prisma";
import { HandleArgs } from "../../types";
import { TaskModel, serializeTask, buildPrismaWhere } from "./base";
import {
	buildTasksListCacheKey,
	getTasksCacheTtlSeconds,
	getTasksCacheVersion,
	kvGetJson,
	kvPutJson,
} from "./kvCache";
import { logError } from "./logging";

type BaseHandleReturn = Awaited<
	ReturnType<D1ListEndpoint<HandleArgs>["handle"]>
>;

export class TaskList extends D1ListEndpoint<HandleArgs> {
	_meta = {
		model: TaskModel,
	};

	searchFields = ["name", "slug", "description"];
	defaultOrderBy = "id DESC";

	private prisma?: PrismaClient;

	public override async handle(...args: HandleArgs): Promise<BaseHandleReturn> {
		const [c] = args;
		this.prisma = createPrismaClient(c.env.DB);

		const kv = c.env.KV;
		let version: string | null = null;
		let cacheKey: string | null = null;
		try {
			version = await getTasksCacheVersion(kv);
			cacheKey = buildTasksListCacheKey(version, c.req.url);

			const cached = await kvGetJson<BaseHandleReturn>(kv, cacheKey, {
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
					return value as BaseHandleReturn;
				},
			});
			if (cached !== null) return cached;
		} catch (error) {
			logError(
				c,
				"Tasks KV cache read failed (list). Returning fresh.",
				{ url: c.req.url, version, cacheKey },
				error,
			);
		}

		const fresh = await super.handle(...args);
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

		return fresh;
	}

	public override async list(filters: ListFilters) {
		const { page = 1, per_page = 20 } = filters.options;
		const orderByDir = (
			(filters.options.order_by_direction ?? "desc") as string
		).toLowerCase() as "asc" | "desc";
		// Map any snake_case order field to the Prisma camelCase name.
		const rawOrderBy = filters.options.order_by ?? "id";
		const orderByField =
			rawOrderBy === "due_date" ? "dueDate" : (rawOrderBy as string);

		const skip = (page - 1) * per_page;

		// chanfana encodes full-text search as a single pseudo-filter
		// { field: "search", operator: "LIKE", value: "%term%" }.
		// We expand it into an OR clause across all searchable fields.
		const searchFilter = filters.filters.find((f) => f.field === "search");
		const fieldFilters = filters.filters.filter((f) => f.field !== "search");
		const baseWhere = buildPrismaWhere(fieldFilters);

		const where =
			searchFilter !== undefined
				? {
						...baseWhere,
						OR: this.searchFields.map((f) => ({
							[f]: {
								contains: (searchFilter.value as string).replace(/%/g, ""),
							},
						})),
					}
				: baseWhere;

		const [rows, totalCount] = await Promise.all([
			this.prisma!.task.findMany({
				where,
				orderBy: { [orderByField]: orderByDir },
				skip,
				take: per_page,
			}),
			this.prisma!.task.count({ where }),
		]);

		return {
			result: rows.map(serializeTask),
			result_info: {
				count: rows.length,
				page,
				per_page,
				total_count: totalCount,
			},
		};
	}
}

import { D1ListEndpoint } from "chanfana";
import { HandleArgs } from "../../types";
import { TaskModel } from "./base";
import {
	buildTasksListCacheKey,
	getTasksCacheTtlSeconds,
	getTasksCacheVersion,
	kvGetJson,
	kvPutJson,
} from "./kvCache";

type BaseHandleReturn = Awaited<
	ReturnType<D1ListEndpoint<HandleArgs>["handle"]>
>;

export class TaskList extends D1ListEndpoint<HandleArgs> {
	_meta = {
		model: TaskModel,
	};

	searchFields = ["name", "slug", "description"];
	defaultOrderBy = "id DESC";

	public override async handle(...args: HandleArgs): Promise<BaseHandleReturn> {
		const [c] = args;
		const kv = c.env.TASKS_KV;

		try {
			const version = await getTasksCacheVersion(kv);
			const cacheKey = buildTasksListCacheKey(version, c.req.url);

			const cached = await kvGetJson<BaseHandleReturn>(kv, cacheKey);
			if (cached) return cached;
		} catch (error) {
			console.error(
				"Tasks KV cache read failed (list). Returning fresh.",
				error,
			);
		}

		const fresh = await super.handle(...args);
		try {
			const version = await getTasksCacheVersion(kv);
			const cacheKey = buildTasksListCacheKey(version, c.req.url);
			await kvPutJson(kv, cacheKey, fresh, {
				expirationTtl: getTasksCacheTtlSeconds(c.env),
			});
		} catch (error) {
			console.error(
				"Tasks KV cache write failed (list). Returning fresh.",
				error,
			);
		}

		return fresh;
	}
}

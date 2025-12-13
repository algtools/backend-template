import { D1ListEndpoint } from "chanfana";
import { HandleArgs } from "../../types";
import { TaskModel } from "./base";
import {
	buildTasksListCacheKey,
	TASKS_CACHE_TTL_SECONDS,
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

		// If KV isn't bound for some reason, fall back to the normal D1 behavior.
		if (!kv) return await super.handle(...args);

		const version = await getTasksCacheVersion(kv);
		const cacheKey = buildTasksListCacheKey(version, c.req.url);

		const cached = await kvGetJson<BaseHandleReturn>(kv, cacheKey);
		if (cached) return cached;

		const fresh = await super.handle(...args);
		// Cache only successful responses.
		if ((fresh as { success?: unknown }).success === true) {
			await kvPutJson(kv, cacheKey, fresh, {
				expirationTtl: TASKS_CACHE_TTL_SECONDS,
			});
		}

		return fresh;
	}
}

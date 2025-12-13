import { D1ReadEndpoint } from "chanfana";
import { HandleArgs } from "../../types";
import { TaskModel } from "./base";
import {
	buildTasksReadCacheKey,
	TASKS_CACHE_TTL_SECONDS,
	getTasksCacheVersion,
	kvGetJson,
	kvPutJson,
} from "./kvCache";

type BaseHandleReturn = Awaited<
	ReturnType<D1ReadEndpoint<HandleArgs>["handle"]>
>;

export class TaskRead extends D1ReadEndpoint<HandleArgs> {
	_meta = {
		model: TaskModel,
	};

	public override async handle(...args: HandleArgs): Promise<BaseHandleReturn> {
		const [c] = args;
		const kv = c.env.TASKS_KV;

		const id = c.req.param("id");
		const version = await getTasksCacheVersion(kv);
		const cacheKey = buildTasksReadCacheKey(version, id);

		const cached = await kvGetJson<BaseHandleReturn>(kv, cacheKey);
		if (cached) return cached;

		const fresh = await super.handle(...args);
		await kvPutJson(kv, cacheKey, fresh, {
			expirationTtl: TASKS_CACHE_TTL_SECONDS,
		});
		return fresh;
	}
}

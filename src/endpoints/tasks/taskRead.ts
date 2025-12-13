import { D1ReadEndpoint } from "chanfana";
import { HandleArgs } from "../../types";
import { TaskModel } from "./base";
import {
	buildTasksReadCacheKey,
	getTasksCacheTtlSeconds,
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
		try {
			const version = await getTasksCacheVersion(kv);
			const cacheKey = buildTasksReadCacheKey(version, id);

			const cached = await kvGetJson<BaseHandleReturn>(kv, cacheKey);
			if (cached) return cached;
		} catch (error) {
			console.error(
				"Tasks KV cache read failed (read). Returning fresh.",
				error,
			);
		}

		const fresh = await super.handle(...args);
		try {
			const version = await getTasksCacheVersion(kv);
			const cacheKey = buildTasksReadCacheKey(version, id);
			await kvPutJson(kv, cacheKey, fresh, {
				expirationTtl: getTasksCacheTtlSeconds(c.env),
			});
		} catch (error) {
			console.error(
				"Tasks KV cache write failed (read). Returning fresh.",
				error,
			);
		}
		return fresh;
	}
}

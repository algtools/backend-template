import { D1DeleteEndpoint } from "chanfana";
import { HandleArgs } from "../../types";
import { TaskModel } from "./base";
import { invalidateTasksCache } from "./kvCache";

export class TaskDelete extends D1DeleteEndpoint<HandleArgs> {
	_meta = {
		model: TaskModel,
	};

	public override async handle(...args: HandleArgs) {
		const [c] = args;
		const res = await super.handle(...args);
		await invalidateTasksCache(c.env.TASKS_KV);
		return res;
	}
}

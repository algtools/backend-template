import { D1UpdateEndpoint } from "chanfana";
import { HandleArgs } from "../../types";
import { TaskModel } from "./base";
import { invalidateTasksCache } from "./kvCache";

export class TaskUpdate extends D1UpdateEndpoint<HandleArgs> {
	_meta = {
		model: TaskModel,
		fields: TaskModel.schema.pick({
			name: true,
			slug: true,
			description: true,
			completed: true,
			due_date: true,
		}),
	};

	public override async handle(...args: HandleArgs) {
		const [c] = args;
		const res = await super.handle(...args);
		if (c.env.TASKS_KV) await invalidateTasksCache(c.env.TASKS_KV);
		return res;
	}
}

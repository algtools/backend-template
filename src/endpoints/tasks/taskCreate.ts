import { D1CreateEndpoint } from "chanfana";
import { HandleArgs } from "../../types";
import { TaskModel } from "./base";
import { invalidateTasksCache } from "./kvCache";

export class TaskCreate extends D1CreateEndpoint<HandleArgs> {
	_meta = {
		model: TaskModel,
		fields: TaskModel.schema.pick({
			// this is purposely missing the id, because users shouldn't be able to define it
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

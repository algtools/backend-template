import { D1UpdateEndpoint } from "chanfana";
import type { UpdateFilters } from "chanfana";
import { createPrismaClient, type PrismaClient } from "../../lib/prisma";
import { HandleArgs } from "../../types";
import { TaskModel, serializeTask, type TaskApiShape } from "./base";
import { invalidateTasksCacheAfterWrite } from "./invalidation";

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

	private prisma?: PrismaClient;

	public override async handle(...args: HandleArgs) {
		const [c] = args;
		this.prisma = createPrismaClient(c.env.DB);
		const res = await super.handle(...args);
		await invalidateTasksCacheAfterWrite(c, "tasks.update");
		return res;
	}

	public override async getObject(
		filters: UpdateFilters,
	): Promise<object | null> {
		const id = filters.filters[0]?.value as number;
		const row = await this.prisma!.task.findUnique({ where: { id } });
		return row ? serializeTask(row) : null;
	}

	public override async update(
		_oldObj: TaskApiShape,
		filters: UpdateFilters,
	): Promise<TaskApiShape> {
		const id = filters.filters[0]?.value as number;
		const data = filters.updatedData as TaskApiShape;
		const row = await this.prisma!.task.update({
			where: { id },
			data: {
				name: data.name,
				slug: data.slug,
				description: data.description,
				completed: data.completed,
				dueDate: new Date(data.due_date),
			},
		});
		return serializeTask(row);
	}
}

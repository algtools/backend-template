import { D1DeleteEndpoint } from "chanfana";
import type { Filters } from "chanfana";
import { createPrismaClient, type PrismaClient } from "../../lib/prisma";
import { HandleArgs } from "../../types";
import { TaskModel, serializeTask, type TaskApiShape } from "./base";
import { invalidateTasksCacheAfterWrite } from "./invalidation";

export class TaskDelete extends D1DeleteEndpoint<HandleArgs> {
	_meta = {
		model: TaskModel,
	};

	private prisma?: PrismaClient;

	public override async handle(...args: HandleArgs) {
		const [c] = args;
		this.prisma = createPrismaClient(c.env.DB);
		const res = await super.handle(...args);
		await invalidateTasksCacheAfterWrite(c, "tasks.delete");
		return res;
	}

	public override async getObject(
		filters: Filters,
	): Promise<TaskApiShape | null> {
		const id = filters.filters[0]?.value as number;
		const row = await this.prisma!.task.findUnique({ where: { id } });
		return row ? serializeTask(row) : null;
	}

	public override async delete(
		oldObj: TaskApiShape,
		_filters: Filters,
	): Promise<TaskApiShape | null> {
		await this.prisma!.task.delete({ where: { id: oldObj.id } });
		return oldObj;
	}
}

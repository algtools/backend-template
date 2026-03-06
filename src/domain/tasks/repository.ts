import type { PrismaClient } from "../../lib/prisma";
import { serializeTask, type TaskApiShape } from "../../endpoints/tasks/base";

export type TaskListOptions = {
	page: number;
	perPage: number;
	search?: string;
	orderBy: string;
	orderByDir: "asc" | "desc";
};

export type TaskListResult = {
	items: TaskApiShape[];
	totalCount: number;
};

export type TaskWriteData = Omit<TaskApiShape, "id">;

export class TasksRepository {
	constructor(private prisma: PrismaClient) {}

	async list(opts: TaskListOptions): Promise<TaskListResult> {
		const skip = (opts.page - 1) * opts.perPage;
		const orderByField = opts.orderBy === "due_date" ? "dueDate" : opts.orderBy;

		const where = opts.search
			? {
					OR: [
						{ name: { contains: opts.search } },
						{ slug: { contains: opts.search } },
						{ description: { contains: opts.search } },
					],
				}
			: {};

		const [rows, totalCount] = await Promise.all([
			this.prisma.task.findMany({
				where,
				orderBy: { [orderByField]: opts.orderByDir },
				skip,
				take: opts.perPage,
			}),
			this.prisma.task.count({ where }),
		]);

		return { items: rows.map(serializeTask), totalCount };
	}

	async findById(id: number): Promise<TaskApiShape | null> {
		const row = await this.prisma.task.findUnique({ where: { id } });
		return row ? serializeTask(row) : null;
	}

	async create(data: TaskWriteData): Promise<TaskApiShape> {
		const row = await this.prisma.task.create({
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

	async update(id: number, data: TaskWriteData): Promise<TaskApiShape | null> {
		const existing = await this.prisma.task.findUnique({ where: { id } });
		if (!existing) return null;

		const row = await this.prisma.task.update({
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

	async delete(id: number): Promise<TaskApiShape | null> {
		const existing = await this.prisma.task.findUnique({ where: { id } });
		if (!existing) return null;

		await this.prisma.task.delete({ where: { id } });
		return serializeTask(existing);
	}
}

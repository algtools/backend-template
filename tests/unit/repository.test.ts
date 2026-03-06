import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../../src/lib/prisma";
import { TasksRepository } from "../../src/domain/tasks/repository";

const dueDate = new Date("2025-06-01T00:00:00.000Z");
const dueDateIso = dueDate.toISOString();

function makeRow(
	overrides: Partial<{
		id: number;
		name: string;
		slug: string;
		description: string;
		completed: boolean;
		dueDate: Date;
	}> = {},
) {
	return {
		id: 1,
		name: "Test Task",
		slug: "test-task",
		description: "A test task",
		completed: false,
		dueDate,
		...overrides,
	};
}

function makePrisma(
	overrides: Partial<{
		findMany: ReturnType<typeof vi.fn>;
		count: ReturnType<typeof vi.fn>;
		findUnique: ReturnType<typeof vi.fn>;
		create: ReturnType<typeof vi.fn>;
		update: ReturnType<typeof vi.fn>;
		delete: ReturnType<typeof vi.fn>;
	}> = {},
): PrismaClient {
	return {
		task: {
			findMany: vi.fn().mockResolvedValue([makeRow()]),
			count: vi.fn().mockResolvedValue(1),
			findUnique: vi.fn().mockResolvedValue(makeRow()),
			create: vi.fn().mockResolvedValue(makeRow()),
			update: vi.fn().mockResolvedValue(makeRow()),
			delete: vi.fn().mockResolvedValue(makeRow()),
			...overrides,
		},
	} as unknown as PrismaClient;
}

describe("TasksRepository.list", () => {
	it("returns serialized items and totalCount", async () => {
		const prisma = makePrisma();
		const repo = new TasksRepository(prisma);

		const result = await repo.list({
			page: 1,
			perPage: 20,
			orderBy: "id",
			orderByDir: "desc",
		});

		expect(result.items).toHaveLength(1);
		expect(result.items[0].due_date).toBe(dueDateIso);
		expect(result.totalCount).toBe(1);
	});

	it("applies search OR clause across name/slug/description", async () => {
		const findMany = vi.fn().mockResolvedValue([]);
		const count = vi.fn().mockResolvedValue(0);
		const prisma = makePrisma({ findMany, count });
		const repo = new TasksRepository(prisma);

		await repo.list({
			page: 1,
			perPage: 20,
			search: "hello",
			orderBy: "id",
			orderByDir: "asc",
		});

		const { where } = (findMany as ReturnType<typeof vi.fn>).mock
			.calls[0][0] as {
			where: { OR: { name?: { contains: string } }[] };
		};
		expect(where.OR).toHaveLength(3);
		expect(where.OR[0]).toEqual({ name: { contains: "hello" } });
	});

	it("maps due_date orderBy to dueDate for Prisma", async () => {
		const findMany = vi.fn().mockResolvedValue([]);
		const count = vi.fn().mockResolvedValue(0);
		const prisma = makePrisma({ findMany, count });
		const repo = new TasksRepository(prisma);

		await repo.list({
			page: 1,
			perPage: 20,
			orderBy: "due_date",
			orderByDir: "asc",
		});

		const { orderBy } = (findMany as ReturnType<typeof vi.fn>).mock
			.calls[0][0] as {
			orderBy: Record<string, string>;
		};
		expect(orderBy).toEqual({ dueDate: "asc" });
	});
});

describe("TasksRepository.findById", () => {
	it("returns serialized task when found", async () => {
		const repo = new TasksRepository(makePrisma());
		const result = await repo.findById(1);
		expect(result).not.toBeNull();
		expect(result!.due_date).toBe(dueDateIso);
	});

	it("returns null when not found", async () => {
		const prisma = makePrisma({ findUnique: vi.fn().mockResolvedValue(null) });
		const repo = new TasksRepository(prisma);
		expect(await repo.findById(999)).toBeNull();
	});
});

describe("TasksRepository.create", () => {
	it("converts due_date string to Date for Prisma and returns serialized task", async () => {
		const create = vi.fn().mockResolvedValue(makeRow());
		const repo = new TasksRepository(makePrisma({ create }));

		const result = await repo.create({
			name: "Test",
			slug: "test",
			description: "Desc",
			completed: false,
			due_date: dueDateIso,
		});

		const { data } = (create as ReturnType<typeof vi.fn>).mock.calls[0][0] as {
			data: { dueDate: Date };
		};
		expect(data.dueDate).toBeInstanceOf(Date);
		expect(result.due_date).toBe(dueDateIso);
	});
});

describe("TasksRepository.update", () => {
	it("returns null when task does not exist", async () => {
		const prisma = makePrisma({ findUnique: vi.fn().mockResolvedValue(null) });
		const repo = new TasksRepository(prisma);
		const result = await repo.update(999, {
			name: "x",
			slug: "x",
			description: "x",
			completed: false,
			due_date: dueDateIso,
		});
		expect(result).toBeNull();
	});

	it("returns updated serialized task when found", async () => {
		const repo = new TasksRepository(makePrisma());
		const result = await repo.update(1, {
			name: "Updated",
			slug: "updated",
			description: "Updated desc",
			completed: true,
			due_date: dueDateIso,
		});
		expect(result).not.toBeNull();
	});
});

describe("TasksRepository.delete", () => {
	it("returns null when task does not exist", async () => {
		const prisma = makePrisma({ findUnique: vi.fn().mockResolvedValue(null) });
		const repo = new TasksRepository(prisma);
		expect(await repo.delete(999)).toBeNull();
	});

	it("returns the deleted task shape when found", async () => {
		const repo = new TasksRepository(makePrisma());
		const result = await repo.delete(1);
		expect(result).not.toBeNull();
		expect(result!.id).toBe(1);
	});
});

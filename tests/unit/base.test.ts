import { describe, expect, it } from "vitest";
import {
	TaskModel,
	buildPrismaWhere,
	serializeTask,
} from "../../src/endpoints/tasks/base";

describe("buildPrismaWhere", () => {
	it("returns {} for empty conditions", () => {
		expect(buildPrismaWhere([])).toEqual({});
	});

	it("returns exact-match object for a single = condition", () => {
		expect(
			buildPrismaWhere([{ field: "id", operator: "=", value: 1 }]),
		).toEqual({ id: 1 });
	});

	it("returns contains object for a single LIKE condition", () => {
		expect(
			buildPrismaWhere([{ field: "name", operator: "LIKE", value: "%hello%" }]),
		).toEqual({ name: { contains: "hello" } });
	});

	it("maps due_date field to dueDate for Prisma", () => {
		expect(
			buildPrismaWhere([
				{ field: "due_date", operator: "=", value: "2025-01-01" },
			]),
		).toEqual({ dueDate: "2025-01-01" });
	});

	it("returns OR clause for multiple conditions", () => {
		expect(
			buildPrismaWhere([
				{ field: "name", operator: "LIKE", value: "%foo%" },
				{ field: "slug", operator: "LIKE", value: "%foo%" },
			]),
		).toEqual({
			OR: [{ name: { contains: "foo" } }, { slug: { contains: "foo" } }],
		});
	});
});

describe("TaskModel.serializer", () => {
	it("converts truthy completed integer to boolean true", () => {
		const result = TaskModel.serializer({ id: 1, completed: 1 }) as Record<
			string,
			unknown
		>;
		expect(result.completed).toBe(true);
	});

	it("converts falsy completed integer to boolean false", () => {
		const result = TaskModel.serializer({ id: 1, completed: 0 }) as Record<
			string,
			unknown
		>;
		expect(result.completed).toBe(false);
	});
});

describe("serializeTask", () => {
	it("maps dueDate Date to due_date ISO string", () => {
		const date = new Date("2025-06-01T12:00:00.000Z");
		const result = serializeTask({
			id: 7,
			name: "Test",
			slug: "test",
			description: "Desc",
			completed: true,
			dueDate: date,
		});

		expect(result).toEqual({
			id: 7,
			name: "Test",
			slug: "test",
			description: "Desc",
			completed: true,
			due_date: "2025-06-01T12:00:00.000Z",
		});
	});
});

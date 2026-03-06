import { describe, expect, it } from "vitest";
import { serializeTask } from "../../src/endpoints/tasks/base";

describe("serializeTask", () => {
	it("maps dueDate Date to due_date ISO string", () => {
		const date = new Date("2025-06-01T12:00:00.000Z");
		expect(
			serializeTask({
				id: 7,
				name: "Test",
				slug: "test",
				description: "Desc",
				completed: true,
				dueDate: date,
			}),
		).toEqual({
			id: 7,
			name: "Test",
			slug: "test",
			description: "Desc",
			completed: true,
			due_date: "2025-06-01T12:00:00.000Z",
		});
	});

	it("preserves boolean completed as-is", () => {
		const result = serializeTask({
			id: 1,
			name: "x",
			slug: "x",
			description: "x",
			completed: false,
			dueDate: new Date("2025-01-01T00:00:00.000Z"),
		});
		expect(result.completed).toBe(false);
	});
});

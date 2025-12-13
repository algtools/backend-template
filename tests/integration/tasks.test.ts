import { env, SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	buildTasksListCacheKey,
	buildTasksReadCacheKey,
	TASKS_CACHE_VERSION_KEY,
} from "../../src/endpoints/tasks/kvCache";

// Helper function to create a task and return its ID
async function createTask(taskData: any) {
	const response = await SELF.fetch(`http://local.test/tasks`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(taskData),
	});
	const body = await response.json<{
		success: boolean;
		result: { id: number };
	}>();
	return body.result.id;
}

describe("Task API Integration Tests", () => {
	beforeEach(async () => {
		// This is a good place to clear any test data if your test runner doesn't do it automatically.
		// Since the prompt mentions rows are deleted after each test, we can rely on that.
		vi.clearAllMocks();
	});

	// Tests for GET /tasks
	describe("GET /tasks", () => {
		it("should get an empty list of tasks", async () => {
			const response = await SELF.fetch(`http://local.test/tasks`);
			const body = await response.json<{ success: boolean; result: any[] }>();

			expect(response.status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.result).toEqual([]);
		});

		it("should get a list with one task", async () => {
			await createTask({
				name: "Test Task",
				slug: "test-task",
				description: "A task for testing",
				completed: false,
				due_date: "2025-01-01T00:00:00.000Z",
			});

			const response = await SELF.fetch(`http://local.test/tasks`);
			const body = await response.json<{ success: boolean; result: any[] }>();

			expect(response.status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.result.length).toBe(1);
			expect(body.result[0]).toEqual(
				expect.objectContaining({
					name: "Test Task",
					slug: "test-task",
				}),
			);
		});
	});

	describe("KV cache integration", () => {
		it("caches GET /tasks responses in KV", async () => {
			await env.TASKS_KV.delete(TASKS_CACHE_VERSION_KEY);

			const res1 = await SELF.fetch("http://local.test/tasks");
			expect(res1.status).toBe(200);

			const version = await env.TASKS_KV.get(TASKS_CACHE_VERSION_KEY);
			expect(version).toBeTruthy();

			const key = buildTasksListCacheKey(version!, "http://local.test/tasks");
			const cached = await env.TASKS_KV.get(key);
			expect(cached).toBeTruthy();

			// Second request should hit the KV cache branch.
			const res2 = await SELF.fetch("http://local.test/tasks");
			expect(res2.status).toBe(200);
		});

		it("caches GET /tasks/:id responses in KV", async () => {
			await env.TASKS_KV.delete(TASKS_CACHE_VERSION_KEY);

			const taskId = await createTask({
				name: "Cache Read Task",
				slug: "cache-read-task",
				description: "A task for read caching test",
				completed: false,
				due_date: "2025-01-01T00:00:00.000Z",
			});

			const res1 = await SELF.fetch(`http://local.test/tasks/${taskId}`);
			expect(res1.status).toBe(200);

			const version = await env.TASKS_KV.get(TASKS_CACHE_VERSION_KEY);
			expect(version).toBeTruthy();

			const key = buildTasksReadCacheKey(version!, taskId);
			const cached = await env.TASKS_KV.get(key);
			expect(cached).toBeTruthy();

			// Second request should hit the KV cache branch.
			const res2 = await SELF.fetch(`http://local.test/tasks/${taskId}`);
			expect(res2.status).toBe(200);
		});

		it("invalidates cache version on task writes", async () => {
			await env.TASKS_KV.delete(TASKS_CACHE_VERSION_KEY);

			await SELF.fetch("http://local.test/tasks");
			const v1 = await env.TASKS_KV.get(TASKS_CACHE_VERSION_KEY);
			expect(v1).toBeTruthy();

			await createTask({
				name: "Invalidate Cache Task",
				slug: "invalidate-cache-task",
				description: "A task that should invalidate cache",
				completed: false,
				due_date: "2025-01-01T00:00:00.000Z",
			});

			const v2 = await env.TASKS_KV.get(TASKS_CACHE_VERSION_KEY);
			expect(v2).toBeTruthy();
			expect(v2).not.toBe(v1);
		});

		it("returns fresh data when KV get fails", async () => {
			const originalGet = env.TASKS_KV.get.bind(env.TASKS_KV);
			(env.TASKS_KV as any).get = () => {
				throw new Error("forced kv get failure");
			};
			try {
				const res = await SELF.fetch("http://local.test/tasks");
				const body = await res.json<{ success: boolean }>();
				expect(res.status).toBe(200);
				expect(body.success).toBe(true);
			} finally {
				(env.TASKS_KV as any).get = originalGet;
			}
		});

		it("returns fresh data when KV put fails", async () => {
			const originalPut = env.TASKS_KV.put.bind(env.TASKS_KV);
			(env.TASKS_KV as any).put = () => {
				throw new Error("forced kv put failure");
			};
			try {
				const res = await SELF.fetch("http://local.test/tasks");
				const body = await res.json<{ success: boolean }>();
				expect(res.status).toBe(200);
				expect(body.success).toBe(true);
			} finally {
				(env.TASKS_KV as any).put = originalPut;
			}
		});
	});

	// Tests for POST /tasks
	describe("POST /tasks", () => {
		it("should create a new task successfully", async () => {
			const taskData = {
				name: "New Task",
				slug: "new-task",
				description: "A brand new task",
				completed: false,
				due_date: "2025-12-31T23:59:59.000Z",
			};
			const response = await SELF.fetch(`http://local.test/tasks`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(taskData),
			});

			const body = await response.json<{ success: boolean; result: any }>();

			expect(response.status).toBe(201);
			expect(body.success).toBe(true);
			expect(body.result).toEqual(
				expect.objectContaining({
					id: expect.any(Number),
					...taskData,
				}),
			);
		});

		it("should return a 400 error for invalid input", async () => {
			const invalidTaskData = {
				// Missing required fields 'name', 'slug', etc.
				description: "This is an invalid task",
			};
			const response = await SELF.fetch(`http://local.test/tasks`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(invalidTaskData),
			});
			const body = await response.json<{
				success: boolean;
				errors: unknown[];
			}>();

			expect(response.status).toBe(400);
			expect(body.success).toBe(false);
			expect(body.errors).toBeInstanceOf(Array);
		});

		it("still returns success if cache invalidation fails", async () => {
			const originalPut = env.TASKS_KV.put.bind(env.TASKS_KV);
			(env.TASKS_KV as any).put = (key: string) => {
				if (key === TASKS_CACHE_VERSION_KEY) {
					throw new Error("forced invalidate failure");
				}
				return originalPut(key, crypto.randomUUID());
			};
			try {
				const response = await SELF.fetch(`http://local.test/tasks`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						name: "KV Failure Create Task",
						slug: "kv-failure-create-task",
						description: "Create should succeed even if KV fails",
						completed: false,
						due_date: "2025-12-31T23:59:59.000Z",
					}),
				});
				expect(response.status).toBe(201);
			} finally {
				(env.TASKS_KV as any).put = originalPut;
			}
		});
	});

	// Tests for GET /tasks/{id}
	describe("GET /tasks/{id}", () => {
		it("should get a single task by its ID", async () => {
			const taskData = {
				name: "Specific Task",
				slug: "specific-task",
				description: "A task to be fetched by ID",
				completed: false,
				due_date: "2025-06-01T12:00:00.000Z",
			};
			const taskId = await createTask(taskData);

			const response = await SELF.fetch(`http://local.test/tasks/${taskId}`);
			const body = await response.json<{ success: boolean; result: any }>();

			expect(response.status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.result).toEqual(
				expect.objectContaining({
					id: taskId,
					...taskData,
				}),
			);
		});

		it("should return a 404 error if task is not found", async () => {
			const nonExistentId = 9999;
			const response = await SELF.fetch(
				`http://local.test/tasks/${nonExistentId}`,
			);
			const body = await response.json<{
				success: boolean;
				errors: Array<{ message: string }>;
			}>();

			expect(response.status).toBe(404);
			expect(body.success).toBe(false);
			expect(body.errors[0].message).toBe("Not Found");
		});
	});

	// Tests for PUT /tasks/{id}
	describe("PUT /tasks/{id}", () => {
		it("should update a task successfully", async () => {
			const taskData = {
				name: "Task to Update",
				slug: "task-to-update",
				description: "This task will be updated",
				completed: false,
				due_date: "2025-07-01T00:00:00.000Z",
			};
			const taskId = await createTask(taskData);

			const updatedData = {
				name: "Updated Task",
				slug: "updated-task",
				description: "This task has been updated",
				completed: true,
				due_date: "2025-07-15T10:00:00.000Z",
			};

			const response = await SELF.fetch(`http://local.test/tasks/${taskId}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(updatedData),
			});
			const body = await response.json<{ success: boolean; result: any }>();

			expect(response.status).toBe(200);
			expect(body.success).toBe(true);
			expect(body.result).toEqual(
				expect.objectContaining({
					id: taskId,
					...updatedData,
				}),
			);
		});

		it("still returns success if cache invalidation fails", async () => {
			const taskId = await createTask({
				name: "KV Failure Update Task",
				slug: "kv-failure-update-task",
				description: "Update should succeed even if KV fails",
				completed: false,
				due_date: "2025-07-01T00:00:00.000Z",
			});

			const originalPut = env.TASKS_KV.put.bind(env.TASKS_KV);
			(env.TASKS_KV as any).put = (key: string) => {
				if (key === TASKS_CACHE_VERSION_KEY) {
					throw new Error("forced invalidate failure");
				}
				return originalPut(key, crypto.randomUUID());
			};
			try {
				const response = await SELF.fetch(`http://local.test/tasks/${taskId}`, {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						name: "KV Failure Update Task (updated)",
						slug: "kv-failure-update-task-updated",
						description: "Updated with KV failure",
						completed: true,
						due_date: "2025-07-15T10:00:00.000Z",
					}),
				});
				expect(response.status).toBe(200);
			} finally {
				(env.TASKS_KV as any).put = originalPut;
			}
		});

		it("should return 404 when trying to update a non-existent task", async () => {
			const nonExistentId = 9999;
			const updatedData = {
				name: "Updated Task",
				slug: "updated-task",
				description: "This task has been updated",
				completed: true,
				due_date: "2025-07-15T10:00:00.000Z",
			};
			const response = await SELF.fetch(
				`http://local.test/tasks/${nonExistentId}`,
				{
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(updatedData),
				},
			);

			expect(response.status).toBe(404);
		});

		it("should return 400 for invalid update data", async () => {
			const taskId = await createTask({
				name: "Task",
				slug: "task",
				description: "...",
				completed: false,
				due_date: "2025-01-01T00:00:00.000Z",
			});
			const invalidUpdateData = { name: "" }; // Invalid name
			const response = await SELF.fetch(`http://local.test/tasks/${taskId}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(invalidUpdateData),
			});

			expect(response.status).toBe(400);
		});
	});

	// Tests for DELETE /tasks/{id}
	describe("DELETE /tasks/{id}", () => {
		it("should delete a task successfully", async () => {
			const taskData = {
				name: "Task to Delete",
				slug: "task-to-delete",
				description: "This task will be deleted",
				completed: false,
				due_date: "2025-08-01T00:00:00.000Z",
			};
			const taskId = await createTask(taskData);

			const deleteResponse = await SELF.fetch(
				`http://local.test/tasks/${taskId}`,
				{
					method: "DELETE",
				},
			);
			const deleteBody = await deleteResponse.json<{
				success: boolean;
				result: any;
			}>();

			expect(deleteResponse.status).toBe(200);
			expect(deleteBody.success).toBe(true);
			expect(deleteBody.result.id).toBe(taskId);

			// Verify the task is actually deleted
			const getResponse = await SELF.fetch(`http://local.test/tasks/${taskId}`);
			expect(getResponse.status).toBe(404);
		});

		it("should return 404 when trying to delete a non-existent task", async () => {
			const nonExistentId = 9999;
			const response = await SELF.fetch(
				`http://local.test/tasks/${nonExistentId}`,
				{
					method: "DELETE",
				},
			);
			const body = await response.json<{
				success: boolean;
				errors: Array<{ message: string }>;
			}>();

			expect(response.status).toBe(404);
			expect(body.success).toBe(false);
			expect(body.errors[0].message).toBe("Not Found");
		});

		it("still returns success if cache invalidation fails", async () => {
			const taskId = await createTask({
				name: "KV Failure Delete Task",
				slug: "kv-failure-delete-task",
				description: "Delete should succeed even if KV fails",
				completed: false,
				due_date: "2025-08-01T00:00:00.000Z",
			});

			const originalPut = env.TASKS_KV.put.bind(env.TASKS_KV);
			(env.TASKS_KV as any).put = (key: string) => {
				if (key === TASKS_CACHE_VERSION_KEY) {
					throw new Error("forced invalidate failure");
				}
				return originalPut(key, crypto.randomUUID());
			};
			try {
				const response = await SELF.fetch(`http://local.test/tasks/${taskId}`, {
					method: "DELETE",
				});
				expect(response.status).toBe(200);
			} finally {
				(env.TASKS_KV as any).put = originalPut;
			}
		});
	});
});

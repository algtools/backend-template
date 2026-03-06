import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { kvPutJson } from "../../src/endpoints/tasks/kvCache";

describe("kvPutJson", () => {
	it("throws a descriptive error when the value is not JSON-serializable", async () => {
		// Circular reference causes JSON.stringify to throw.
		const circular: Record<string, unknown> = {};
		circular.self = circular;

		await expect(
			kvPutJson(env.KV, "test-key", circular, { expirationTtl: 60 }),
		).rejects.toThrow("Failed to serialize KV value");
	});
});

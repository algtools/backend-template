import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("API docs", () => {
	it("serves Scalar API reference at /", async () => {
		const res = await SELF.fetch("http://local.test/");
		const html = await res.text();

		expect(res.status).toBe(200);
		expect(res.headers.get("content-type") ?? "").toMatch(/text\/html/i);
		// High-signal markers that we are serving Scalar (not the old viewer).
		expect(html).toContain("@scalar/api-reference");
		expect(html).toContain("api-reference");
	});

	it("serves OpenAPI schema JSON", async () => {
		const res = await SELF.fetch("http://local.test/openapi.json");
		const body = (await res.json()) as { openapi?: string; info?: unknown };

		expect(res.status).toBe(200);
		expect(body).toHaveProperty("openapi");
		expect(body).toHaveProperty("info");
	});
});


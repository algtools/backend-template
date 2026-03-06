import { existsSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import path from "node:path";
import {
	defineWorkersConfig,
	readD1Migrations,
} from "@cloudflare/vitest-pool-workers/config";

const migrationsPath = path.join(__dirname, "..", "migrations");
const migrations = await readD1Migrations(migrationsPath);

/**
 * Vite plugin to fix Prisma v7 WASM imports inside vitest-pool-workers.
 *
 * Prisma v7 (`runtime = "cloudflare"`) generates:
 *   await import("./query_compiler_fast_bg.wasm?module")
 *
 * The `?module` query param is handled natively by Wrangler at build time.
 * Inside vitest-pool-workers the vite-node fallback server needs to serve the
 * raw WASM binary. Our resolveId hook strips the query params and returns the
 * clean absolute path so the fallback server's native WASM handling kicks in
 * (301 redirect → binary response → workerd compiles to WebAssembly.Module).
 */
const cfWorkersWasmPlugin = {
	name: "cf-workers-wasm",
	enforce: "pre" as const,
	resolveId(id: string, importer?: string) {
		const baseId = id.split("?")[0];
		if (!baseId.endsWith(".wasm")) return null;

		let absPath: string;
		if (isAbsolute(baseId)) {
			absPath = baseId;
		} else if (importer) {
			absPath = resolve(dirname(importer.split("?")[0]), baseId);
		} else {
			return null;
		}

		if (!existsSync(absPath)) return null;

		return absPath;
	},
};

export default defineWorkersConfig({
	plugins: [cfWorkersWasmPlugin],
	esbuild: {
		target: "esnext",
	},
	test: {
		coverage: {
			provider: "istanbul",
			reporter: ["text", "lcov"],
			all: true,
			include: ["src/**/*.ts"],
			exclude: [
				"**/*.d.ts",
				"**/node_modules/**",
				"**/tests/**",
				"**/dist/**",
				"**/coverage/**",
				"src/generated/**",
			],
			thresholds: {
				lines: 85,
				functions: 85,
				branches: 85,
				statements: 85,
			},
		},
		setupFiles: ["./tests/apply-migrations.ts"],
		poolOptions: {
			workers: {
				singleWorker: true,
				wrangler: {
					configPath: "../wrangler.jsonc",
				},
				miniflare: {
					compatibilityFlags: ["experimental", "nodejs_compat"],
					bindings: {
						MIGRATIONS: migrations,
					},
				},
			},
		},
	},
});

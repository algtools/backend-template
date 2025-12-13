/**
 * KV namespace used to cache Tasks reads.
 * Bound via `wrangler*.jsonc` as `TASKS_KV`.
 */
declare namespace Cloudflare {
	interface Env {
		TASKS_KV: KVNamespace;
	}
}

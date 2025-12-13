export const TASKS_CACHE_VERSION_KEY = "tasks:cache:version";
export const TASKS_CACHE_TTL_SECONDS = 60;

export function canonicalizeUrlForCache(url: string): string {
	const u = new URL(url);
	const entries = Array.from(u.searchParams.entries()).sort((a, b) => {
		const byKey = a[0].localeCompare(b[0]);
		if (byKey !== 0) return byKey;
		return a[1].localeCompare(b[1]);
	});

	const sp = new URLSearchParams();
	for (const [k, v] of entries) sp.append(k, v);
	const qs = sp.toString();
	return qs ? `${u.pathname}?${qs}` : u.pathname;
}

export function buildTasksListCacheKey(version: string, url: string): string {
	return `tasks:cache:${version}:list:${canonicalizeUrlForCache(url)}`;
}

export function buildTasksReadCacheKey(
	version: string,
	id: number | string,
): string {
	return `tasks:cache:${version}:read:${id}`;
}

export async function getTasksCacheVersion(kv: KVNamespace): Promise<string> {
	const existing = await kv.get(TASKS_CACHE_VERSION_KEY);
	if (existing) return existing;

	const created = crypto.randomUUID();
	await kv.put(TASKS_CACHE_VERSION_KEY, created);
	return created;
}

export async function invalidateTasksCache(kv: KVNamespace): Promise<void> {
	await kv.put(TASKS_CACHE_VERSION_KEY, crypto.randomUUID());
}

export async function kvGetJson<T>(
	kv: KVNamespace,
	key: string,
): Promise<T | null> {
	return (await kv.get(key, { type: "json" })) as T | null;
}

export async function kvPutJson(
	kv: KVNamespace,
	key: string,
	value: unknown,
	{ expirationTtl }: { expirationTtl: number },
): Promise<void> {
	await kv.put(key, JSON.stringify(value), { expirationTtl });
}

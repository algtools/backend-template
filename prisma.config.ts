import { defineConfig } from "prisma/config";

// datasource url is omitted intentionally: this project uses Cloudflare D1 via
// @prisma/adapter-d1. The D1 binding is injected at runtime by Wrangler and
// there is no static DATABASE_URL at development time.
export default defineConfig({
	schema: "prisma/schema.prisma",
});

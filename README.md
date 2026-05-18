# Backend Template

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/algtools/backend-template)

<!-- dash-content-start -->

A production-ready Cloudflare Worker template for building type-safe REST APIs. It combines [Hono](https://hono.dev/) as the HTTP framework, [chanfana](https://chanfana.com/) for automatic OpenAPI 3.1 schema generation and request validation, [Prisma v7](https://www.prisma.io/) with the [D1 adapter](https://developers.cloudflare.com/d1/) for database access, and [Cloudflare KV](https://developers.cloudflare.com/kv/) for response caching.

**Deploy with one click.** Use the button above — the Cloudflare wizard provisions the Worker, D1 database, KV namespace, and applies migrations automatically. No manual setup required.

## Features

- **OpenAPI 3.1** — Schemas and request/response validation are generated automatically from your Zod definitions via `chanfana`. Interactive docs are served at `/docsz` (Scalar UI) and the raw schema at `/openapi.json`.
- **Hono** — Lightweight, edge-first HTTP router with full TypeScript support.
- **Prisma v7 + D1** — Type-safe ORM with a Cloudflare D1 adapter. Schema is defined in `prisma/schema.prisma`; migrations live in the `migrations/` directory and are applied with Wrangler.
- **Repository pattern** — Database logic is isolated in `src/domain/*/repository.ts`, keeping endpoints thin and testable.
- **KV response cache** — List and read endpoints cache responses in Cloudflare KV. Write operations (create, update, delete) invalidate the cache by bumping a version key. TTL is configurable via the `TASKS_CACHE_TTL_SECONDS` environment variable.
- **Sentry error tracking** — Optional. Set `SENTRY_DSN` in each Wrangler config under `vars` (same value is fine for every environment). Leave it empty and nothing is sent. Source maps upload after `deploy:dev` / `deploy:prod` when Sentry CLI credentials are configured (see below).
- **Structured error handling** — A global `app.onError` handler returns consistent `{ success, errors }` payloads for both validation errors (400) and uncaught exceptions (500).
- **CI/CD** — GitHub Actions workflow runs typecheck, lint, and tests on every push. Prisma client is generated automatically via the `postinstall` script.
- **Test suite** — Integration tests run against a real Miniflare D1 + KV environment using `vitest-pool-workers`. Unit tests cover pure domain logic without Workers overhead.

## Project structure

```
src/
  index.ts                     # Hono app + OpenAPI registry + Sentry wrapper
  types.ts                     # Shared Bindings / AppContext types
  app-meta.ts                  # OpenAPI info and Scalar HTML helper
  lib/
    prisma.ts                  # PrismaClient factory (D1 adapter)
  domain/
    tasks/
      repository.ts            # TasksRepository — all DB operations via Prisma
  endpoints/
    tasks/
      base.ts                  # Zod schema (TaskApiShape) and serializer
      router.ts                # Hono sub-router for /tasks
      taskList.ts              # GET  /tasks
      taskCreate.ts            # POST /tasks
      taskRead.ts              # GET  /tasks/:id
      taskUpdate.ts            # PUT  /tasks/:id
      taskDelete.ts            # DELETE /tasks/:id
      kvCache.ts               # KV cache helpers (get, put, invalidate)
      invalidation.ts          # Cache invalidation after writes
      logging.ts               # Structured error logging
    dummyEndpoint.ts           # Example minimal endpoint
prisma/
  schema.prisma                # Prisma schema (Task model)
migrations/
  0001_initial_schema.sql      # D1 migration
tests/
  integration/                 # End-to-end tests (Miniflare Workers runtime)
  unit/                        # Pure unit tests (repository, serializers)
```

<!-- dash-content-end -->

## API Endpoints

| Method   | Path            | Description                                |
| -------- | --------------- | ------------------------------------------ |
| `GET`    | `/`             | Service info (name, version)               |
| `GET`    | `/healthz`      | Health check                               |
| `GET`    | `/docsz`        | Interactive API docs (Scalar UI)           |
| `GET`    | `/openapi.json` | Raw OpenAPI 3.1 schema                     |
| `GET`    | `/tasks`        | List tasks (paginated, searchable, cached) |
| `POST`   | `/tasks`        | Create a task                              |
| `GET`    | `/tasks/:id`    | Get a task by ID (cached)                  |
| `PUT`    | `/tasks/:id`    | Update a task                              |
| `DELETE` | `/tasks/:id`    | Delete a task                              |

## Environment Variables

| Variable                  | Required | Description                                                                                                    |
| ------------------------- | -------- | -------------------------------------------------------------------------------------------------------------- |
| `ENVIRONMENT`             | Yes      | Runtime environment (`development`, `production`, …)                                                           |
| `SENTRY_DSN`              | No       | Sentry DSN — set in `wrangler*.jsonc` `vars` (or `.dev.vars` for local); empty string disables the SDK         |
| `SENTRY_RELEASE`          | No       | Set automatically on deploy (`deploy:dev` / `deploy:prod`); must match the release used for source map uploads |
| `TASKS_CACHE_TTL_SECONDS` | No       | KV cache TTL for task responses (default: `60`, minimum: `60`)                                                 |

## Sentry source maps

[Sentry’s Wrangler guide](https://docs.sentry.io/platforms/javascript/guides/cloudflare/sourcemaps/uploading/wrangler/) is wired up via `deploy:dev` and `deploy:prod`: Wrangler builds with `--outdir dist --upload-source-maps`, injects `SENTRY_RELEASE` from `sentry-cli releases propose-version`, then `postdeploy:dev` / `postdeploy:prod` run `sentry:sourcemaps` to upload maps.

**Local CLI configuration**

1. Copy [`.env.example`](.env.example) to `.env.local` (gitignored).
2. Set `SENTRY_ORG`, `SENTRY_PROJECT`, and `SENTRY_AUTH_TOKEN`. Create an auth token under Sentry **Settings → Auth Tokens** with at least `project:releases` and `org:read`.
3. Run `pnpm deploy:dev` or `pnpm deploy:prod` (applies remote migrations, deploys, then uploads source maps using `.env.local`).

For CI or hosts without `.env.local`, export the same three variables (for example as repository secrets) before the deploy and post-deploy steps.

**DSN** — Set `SENTRY_DSN` in the `vars` section of [`wrangler.jsonc`](wrangler.jsonc), [`wrangler.prod.jsonc`](wrangler.prod.jsonc), and [`wrangler.preview.jsonc`](wrangler.preview.jsonc) (same URL for every environment is normal). For local `wrangler dev`, you can use [`.dev.vars`](https://developers.cloudflare.com/workers/wrangler/configuration/#environment-variables) instead of committing the value.

**Verify**

1. In Sentry: **Project Settings → Source Maps** — confirm the release appears under artifact bundles.
2. Trigger an error (for example `GET /` with header `x-force-error: 1` when `SENTRY_DSN` is set) and confirm the stack trace resolves to your TypeScript sources.

## References

- [Hono documentation](https://hono.dev/docs)
- [chanfana documentation](https://chanfana.com/)
- [Prisma Cloudflare D1 guide](https://www.prisma.io/docs/orm/prisma-client/deployment/edge/deploy-to-cloudflare-workers)
- [Cloudflare D1 documentation](https://developers.cloudflare.com/d1/)
- [Cloudflare KV documentation](https://developers.cloudflare.com/kv/)
- [Vitest documentation](https://vitest.dev/guide/)

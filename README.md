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
- **Sentry error tracking** — Optional. Set the `SENTRY_DSN` secret and the SDK is activated automatically; leave it unset and nothing is sent.
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

| Variable                  | Required | Description                                                    |
| ------------------------- | -------- | -------------------------------------------------------------- |
| `ENVIRONMENT`             | Yes      | Runtime environment (`development`, `production`, …)           |
| `SENTRY_DSN`              | No       | Sentry DSN — SDK is disabled when unset                        |
| `TASKS_CACHE_TTL_SECONDS` | No       | KV cache TTL for task responses (default: `60`, minimum: `60`) |

## References

- [Hono documentation](https://hono.dev/docs)
- [chanfana documentation](https://chanfana.com/)
- [Prisma Cloudflare D1 guide](https://www.prisma.io/docs/orm/prisma-client/deployment/edge/deploy-to-cloudflare-workers)
- [Cloudflare D1 documentation](https://developers.cloudflare.com/d1/)
- [Cloudflare KV documentation](https://developers.cloudflare.com/kv/)
- [Vitest documentation](https://vitest.dev/guide/)

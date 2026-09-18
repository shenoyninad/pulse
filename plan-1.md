# Pulse — API Testing Framework: Base Structure

## Context

Greenfield project in an empty repo (`pulse`). The goal is a locally-run, Postman-like API testing web app. Everything runs via Docker Compose: a Postgres database (with a named volume so saved requests persist), a backend API, and a web frontend. This plan sets up the base structure only — scaffolding, DB schema for saved requests, a minimal working UI, and the compose wiring — so features can be layered on later.

**Stack (user-confirmed):** Node.js + Express (TypeScript) backend, React + Vite frontend, Prisma ORM with migrations, Postgres 16.

## Repository layout

```
pulse/
├── docker-compose.yml
├── .env.example
├── .gitignore
├── README.md
├── server/                  # Express + TypeScript backend
│   ├── Dockerfile           # dev-oriented (tsx watch)
│   ├── package.json
│   ├── tsconfig.json
│   ├── prisma/
│   │   └── schema.prisma
│   └── src/
│       ├── index.ts         # app bootstrap, listens on 4000
│       ├── db.ts            # Prisma client singleton
│       └── routes/
│           ├── health.ts    # GET /api/health
│           ├── collections.ts  # CRUD for collections
│           └── requests.ts     # CRUD for saved requests + POST /api/requests/:id/execute
└── web/                     # React + Vite frontend
    ├── Dockerfile           # dev-oriented (vite dev server)
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts       # dev server on 5173, proxy /api -> server:4000
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx          # basic request-builder UI
        ├── api.ts           # fetch client for the backend
        └── styles.css
```

## Docker Compose

Three services:

- **db**: `postgres:16-alpine`, env `POSTGRES_USER/PASSWORD/DB=pulse`, named volume `pulse_pgdata:/var/lib/postgresql/data`, healthcheck via `pg_isready`, port 5432 exposed for local inspection.
- **server**: built from `server/Dockerfile`; depends on db (healthy); runs `prisma migrate deploy` then `tsx watch src/index.ts`; bind-mounts `./server` for hot reload (anonymous volume for `node_modules`); port 4000; `DATABASE_URL=postgresql://pulse:pulse@db:5432/pulse`.
- **web**: built from `web/Dockerfile`; runs Vite dev server with `--host`; bind-mounts `./web`; port 5173. Vite proxies `/api` to `http://server:4000` so the browser only talks to one origin.

User opens **http://localhost:5173**.

## Database schema (Prisma)

- `Collection`: id (cuid), name, createdAt, updatedAt; has many requests.
- `SavedRequest`: id, name, method (string), url, headers (Json), body (String?), collectionId (FK, optional to allow uncategorized requests), timestamps.
- `ExecutionResult`: id, requestId (FK), status, responseHeaders (Json), responseBody (String), durationMs, executedAt — history of runs.

One initial migration checked into `server/prisma/migrations/` (generated with `prisma migrate dev --name init` against the compose db).

## Backend endpoints (base set)

- `GET /api/health` — liveness + DB check.
- `GET/POST /api/collections`, `PUT/DELETE /api/collections/:id`
- `GET/POST /api/requests`, `GET/PUT/DELETE /api/requests/:id`
- `POST /api/requests/:id/execute` — server executes the saved HTTP request with `fetch`, stores an `ExecutionResult`, returns status/headers/body/duration.

JSON body parsing, CORS enabled (harmless behind the proxy), basic error handler middleware.

## Frontend (minimal but functional)

Single-page UI in `App.tsx`:
- Sidebar listing collections and saved requests (fetched from the API).
- Request builder: method dropdown, URL input, headers editor (key/value rows), body textarea, Save and Send buttons.
- Response panel: status, duration, headers, pretty-printed body.

Plain CSS, no component library — kept minimal since this is base structure.

## Supporting files

- `.env.example` with `POSTGRES_*` and `DATABASE_URL`.
- `.gitignore`: node_modules, dist, .env.
- `README.md`: prerequisites (Docker), `docker compose up`, URLs, project layout.

## Implementation steps

1. Root files: `.gitignore`, `.env.example`, `docker-compose.yml`, `README.md`.
2. `server/`: package.json (express, cors, prisma, @prisma/client, tsx, typescript), tsconfig, Prisma schema, Dockerfile, src (db, routes, index).
3. `web/`: package.json (react, react-dom, vite, @vitejs/plugin-react, typescript), vite config with proxy, index.html, src files, Dockerfile.
4. `docker compose up --build`; once db is healthy, generate the initial migration inside the server container (`prisma migrate dev --name init`) so the migration files land in the bind-mounted `server/prisma/migrations/`.

## Verification

1. `docker compose up --build` — all three services start; server waits for db health.
2. `curl http://localhost:4000/api/health` returns ok with DB connected.
3. Open http://localhost:5173 in the built-in browser: create a collection, save a request (e.g. GET https://httpbin.org/get), hit Send, see the response panel populate.
4. `docker compose down && docker compose up` — saved request still there (volume persistence).
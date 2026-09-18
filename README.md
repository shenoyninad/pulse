# Pulse

A locally-run API testing web app (think lightweight Postman) built with Docker Compose. Save HTTP requests into collections, execute them, and inspect responses — everything is stored in a local Postgres database backed by a Docker volume, so your requests persist across restarts.

## Stack

- **db** — Postgres 16 with a named volume (`pulse_pgdata`)
- **server** — Express + TypeScript API (Prisma ORM), port 4000
- **web** — React + Vite UI, host port 5174 (proxies `/api` to the server)

## Getting started

Prerequisites: Docker Desktop (or Docker Engine + Compose).

```bash
docker compose up --build
```

Then open **http://localhost:5174**.

The server applies Prisma migrations automatically on startup. Both `server/` and `web/` are bind-mounted with hot reload, so code changes apply without rebuilding.

## Project layout

```
docker-compose.yml
server/            # Express API
  prisma/          # schema + migrations
  src/
    index.ts       # bootstrap
    routes/        # health, collections, requests (+ execute)
web/               # React UI
  src/
    App.tsx        # request builder, sidebar, response panel
    api.ts         # backend client
```

## API

- `GET /api/health`
- `GET|POST /api/collections`, `PUT|DELETE /api/collections/:id`
- `GET|POST /api/requests`, `GET|PUT|DELETE /api/requests/:id`
- `POST /api/requests/:id/execute` — runs the saved request server-side and stores the result
- `GET /api/requests/:id/scenarios` — list a request's edge-case scenarios
- `POST /api/requests/:id/scenarios/generate` — regenerate scenarios from rule-based heuristics (varies query params, headers, and JSON body)
- `DELETE /api/scenarios/:id`, `POST /api/scenarios/:id/execute` — remove or individually run one scenario

## Database

Connect locally with `postgresql://pulse:pulse@localhost:5432/pulse`. Data lives in the `pulse_pgdata` volume; `docker compose down` keeps it, `docker compose down -v` wipes it.

## Adding schema changes

```bash
docker compose exec server npx prisma migrate dev --name your_change
```

Migration files land in `server/prisma/migrations/` (bind-mounted) — commit them.

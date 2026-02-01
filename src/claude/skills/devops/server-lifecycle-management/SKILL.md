---
name: server-lifecycle-management
description: Start, health-check, and stop application processes for testing
skill_id: OPS-016
owner: environment-builder
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Starting app for E2E testing, stopping app after testing completes
dependencies: [OPS-015]
---

## Process

1. **Start dependent services**: if `docker-compose.yml` or `compose.yaml` exists, run `docker compose up -d`
2. **Wait for dependencies**: poll dependent service ports (database, cache) until ready, max 30s
3. **Determine start command**: use lookup table below, check `package.json` scripts, or `state.json` config
4. **Launch background process**: start application in background, capture PID
5. **Determine port**: check `.env` / `.env.local` for `PORT=`, then framework config, then default
6. **Health-check poll**: `GET http://localhost:{port}` or `/health` with exponential backoff (1s, 2s, 4s, 8s, 16s, 32s), max 60s total
7. **Write state.json**: record `testing_environment.local` with `base_url`, `server_pid`, `started_at`, `start_command`, `dependent_services`

## Start Command Lookup Table

| Framework | Start Command | Default Port |
|-----------|--------------|-------------|
| Next.js | `npm run start` or `npm run dev` | 3000 |
| NestJS | `npm run start:dev` | 3000 |
| Express | `npm start` | 3000 |
| Spring Boot | `java -jar target/*.jar` | 8080 |
| Django | `python manage.py runserver 0.0.0.0:8000` | 8000 |
| FastAPI | `uvicorn main:app --host 0.0.0.0 --port 8000` | 8000 |
| Go | `./app` | 8080 |
| Rust | `cargo run` | 8080 |

## Port Detection Priority

1. `.env` or `.env.local` → `PORT=` variable
2. Framework-specific config (e.g., `next.config.js`, `application.properties`)
3. Default port from lookup table

## Cleanup Protocol

When stopping the application (post-testing):
1. Send `SIGTERM` to recorded `server_pid`
2. Wait up to 10 seconds for graceful shutdown
3. If still running, send `SIGKILL`
4. Run `docker compose down` if dependent services were started
5. Update state.json: set `testing_environment.local.stopped_at` and `status: "stopped"`

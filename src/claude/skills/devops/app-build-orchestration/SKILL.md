---
name: app-build-orchestration
description: Determine and execute build commands based on project tech stack
skill_id: OPS-015
owner: environment-builder
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Before test execution, when application must be compiled/bundled
dependencies: [OPS-007]
---

## Process

1. **Read tech stack** from `.isdlc/state.json` → `project.tech_stack` (language, framework, build_tool)
2. **Fallback detection** if `tech_stack` is missing: scan project root for `package.json`, `pom.xml`, `build.gradle`, `go.mod`, `Cargo.toml`, `pyproject.toml`, `manage.py`
3. **Map to build command** using the lookup table below
4. **Execute build** and capture stdout/stderr
5. **Retry on failure**: read error output, attempt fix (install deps, clear cache), retry once

## Build Command Lookup Table

| Framework | Detect Via | Build Command |
|-----------|-----------|---------------|
| Next.js | `next` in package.json dependencies | `npm run build` |
| NestJS | `@nestjs/core` in package.json dependencies | `npm run build` |
| Express / generic Node | `package.json` exists | `npm run build` (if `build` script exists) |
| Spring Boot (Maven) | `pom.xml` exists | `mvn package -DskipTests` |
| Spring Boot (Gradle) | `build.gradle` exists | `./gradlew build -x test` |
| Django / FastAPI | `manage.py` or `pyproject.toml` | `pip install -r requirements.txt` |
| Go | `go.mod` exists | `go build -o ./app ./cmd/...` |
| Rust | `Cargo.toml` exists | `cargo build` |

## Output

- Build success/failure status
- Build output log written to `docs/devops/build-log.md`
- Build command recorded in `testing_environment.local.build_command` in state.json

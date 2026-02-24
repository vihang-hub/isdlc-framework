# Bug Report: BUG-0022-GH-1

**Bug ID:** BUG-0022-GH-1
**External Link:** Gitea Issue #1
**External ID:** GH-1
**Reported By:** bimsara.gunarathna
**Date:** 2026-02-17
**Severity:** High
**Status:** Open

---

## Summary

`/isdlc test generate` declares QA APPROVED while project build is broken by generated test files -- no post-generation build integrity check exists.

---

## Expected Behavior

1. After test generation, the framework runs a full build/compile check (language-aware: `mvn compile`, `npm run build`, `gradle build`, etc.)
2. If build fails due to **MECHANICAL issues** (missing/incorrect imports, wrong dependency paths, incorrect package names, missing test dependencies in build config) -- auto-fix them within the iteration loop
3. If build fails due to **LOGICAL code issues** (wrong types, missing method signatures, incorrect API usage) -- stop and report failure honestly (no QA APPROVED), surface specific compilation errors, suggest the user runs a proper fix workflow
4. The framework **NEVER** declares QA APPROVED while the build is broken

## Actual Behavior

The test-generate workflow reports 100% pass rate (59/59) and QA APPROVED with Status: COMPLETED and 5/5 phases PASSED. However, running `mvn compile` after completion reveals compilation errors in the generated test files. The quality loop validated individual test execution but missed overall build integrity.

## Reproduction Steps

1. Run `/isdlc test generate` on a Java project (e.g., DeploymentApp service)
2. Workflow completes all 5 phases with QA APPROVED
3. Run `mvn compile` -- build fails with compilation errors in generated test files
4. Framework reported success when the project is broken

## Environment

- **Project type:** Java project with Maven build system
- **Affects:** All language-aware build systems (Maven, npm, Gradle, Cargo, Go, etc.)
- **Framework version:** 0.1.0-alpha

## Root Cause Analysis (Preliminary)

The test-generate workflow's quality loop (`16-quality-loop` or `07-testing` phase) validates individual test execution (running tests in isolation) but does not perform a full project build/compile check after test files are added. This means:

- Generated test files with incorrect imports pass individual execution (if the test runner can resolve them)
- Generated test files with wrong package names may pass if the test runner uses classpath scanning
- Missing test dependencies in `pom.xml`/`build.gradle` are not caught because the test runner may already have them on the classpath
- The overall project build integrity is never validated before declaring QA APPROVED

## Impact

- **Trust:** Framework declares false positive QA approval, undermining user confidence
- **Correctness:** Users believe their project is healthy when it is broken
- **Scope:** Affects any project using `/isdlc test generate` with a compiled language (Java, TypeScript, Go, Rust, etc.)

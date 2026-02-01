---
name: test-framework-detection
description: Detect installed test frameworks and their configuration
skill_id: DISC-201
owner: test-evaluator
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: At the start of test evaluation to inventory testing tools
dependencies: [DISC-001]
---

# Test Framework Detection

## Purpose
Identify all testing frameworks, test runners, and testing utilities installed in the project. This creates a complete inventory of the testing infrastructure available to the development team.

## When to Use
- As the first step when the test-evaluator agent begins execution
- When determining what types of tests the project can currently run
- When assessing whether the testing toolchain is complete

## Prerequisites
- Project detection (DISC-001) has confirmed the project type
- Package manifests and configuration files are accessible
- Project root directory is known

## Process

### Step 1: Check Test Configuration Files
Search for framework-specific config files: `jest.config.js/ts/json`, `pytest.ini`, `pyproject.toml` (pytest section), `.mocharc.yml`, `vitest.config.ts`, `playwright.config.ts`, `cypress.config.js`, `karma.conf.js`, `phpunit.xml`, `_test.go` files, `.rspec`. Record each config file path and its framework.

### Step 2: Scan Package Dependencies
Check `devDependencies` in `package.json` for test packages: jest, mocha, vitest, playwright, cypress, testing-library, supertest, nock. Check `requirements.txt`/`Pipfile` for pytest, unittest, coverage. Check `go.mod` for testify. Map each dependency to its test framework family.

### Step 3: Catalog Test Infrastructure
Build a comprehensive list of detected frameworks with their versions, configuration file paths, and capabilities (unit, integration, e2e, component). Identify test runners, assertion libraries, mocking utilities, and coverage tools as separate entries.

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| project_root | string | Yes | Absolute path to the project root |
| package_manifests | list | No | Paths to package manifest files |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| frameworks | list | Test frameworks with versions and config paths |
| test_types | list | Types of testing supported (unit, integration, e2e) |
| coverage_tools | list | Code coverage tools detected |
| runner_config | object | Test runner configuration details |

## Integration Points
- **coverage-analysis**: Uses framework info to locate coverage outputs
- **gap-identification**: Compares detected test types against expected coverage
- **test-report-generation**: Framework inventory feeds the test evaluation report
- **dependency-analysis**: Test dependencies overlap with dev dependency catalog

## Validation
- At least one test framework is detected or absence is explicitly noted
- Each detected framework has a version number from the manifest
- Configuration file paths are verified to exist on disk
- Test types are inferred from framework capabilities, not just names

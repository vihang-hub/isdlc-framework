---
name: tech-detection
description: Detect programming languages, frameworks, and runtime environments
skill_id: DISC-102
owner: architecture-analyzer
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: During architecture analysis to catalog the technology stack
dependencies: [DISC-101]
---

# Tech Detection

## Purpose
Identify all programming languages, frameworks, and runtime environments used in the project by analyzing manifest files, file extensions, imports, and configuration. This forms the core of the project's technology profile.

## When to Use
- After directory scan provides the structural map of the project
- When populating the tech_stack field in state.json
- When verifying user-reported technology choices against actual usage

## Prerequisites
- Directory scan (DISC-101) has completed with a directory tree
- Package manifest files are accessible (package.json, requirements.txt, etc.)
- Source files are readable for import analysis

## Process

### Step 1: Analyze Package Manifests
Read all package manifest files found during directory scan: `package.json`, `requirements.txt`, `Pipfile`, `go.mod`, `Cargo.toml`, `pom.xml`, `build.gradle`, `Gemfile`, `composer.json`. Extract the primary language and framework from each manifest's dependencies and metadata.

### Step 2: Detect Languages from File Extensions
Glob for source files and tally extensions: `.ts/.tsx` (TypeScript), `.js/.jsx` (JavaScript), `.py` (Python), `.go` (Go), `.rs` (Rust), `.java` (Java), `.rb` (Ruby), `.php` (PHP), `.cs` (C#). Rank languages by file count and lines of code to determine primary vs secondary languages.

### Step 3: Identify Frameworks and Runtimes
Cross-reference manifest dependencies with known framework signatures. Detect React, Next.js, Express, Django, Flask, FastAPI, Spring Boot, Rails, Laravel, and others. Identify runtime versions from `.nvmrc`, `.python-version`, `go.mod`, `rust-toolchain.toml`, or engine fields in manifests.

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| project_root | string | Yes | Absolute path to the project root |
| directory_tree | object | Yes | Output from directory-scan |
| manifest_paths | list | No | Override list of manifest file paths |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| languages | list | Detected languages ranked by prevalence |
| frameworks | list | Detected frameworks with version info |
| runtimes | list | Runtime environments and their versions |
| build_tools | list | Build systems detected (webpack, vite, gradle, etc.) |

## Integration Points
- **directory-scan**: Provides the file structure for extension analysis
- **dependency-analysis**: Shares manifest data for deeper dependency cataloging
- **architecture-documentation**: Languages and frameworks feed the architecture overview
- **state-initialization**: Results populate the tech_stack field in state.json

## Validation
- At least one programming language is detected
- Framework detection is supported by manifest evidence, not just file presence
- Runtime versions are extracted where version files exist
- Results distinguish primary language from secondary/support languages

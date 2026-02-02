---
name: version-detection
description: Detect ecosystem and current version from project manifests
skill_id: UPG-001
owner: upgrade-engineer
collaborators: [environment-builder]
project: sdlc-framework
version: 1.0.0
when_to_use: Beginning of any upgrade workflow to identify what is installed
dependencies: []
---

# Version Detection

## Purpose
Detect the project's ecosystem (npm, PyPI, Maven, crates.io, Go modules, etc.) and extract the current version of a named dependency, runtime, framework, or tool from manifest files.

## When to Use
- Starting an upgrade workflow
- Auditing current dependency versions
- Verifying a dependency exists in the project
- Pre-upgrade baseline capture

## Prerequisites
- Project has at least one manifest file (package.json, requirements.txt, etc.)
- The named target exists as a dependency in the project

## Process

### Step 1: Identify Ecosystem
```
Scan for manifest files in priority order:
- package.json          → npm / Node.js
- requirements.txt      → PyPI / Python
- pyproject.toml        → PyPI / Python
- Pipfile               → PyPI / Python
- pom.xml               → Maven / Java
- build.gradle(.kts)    → Gradle / Java
- Cargo.toml            → crates.io / Rust
- go.mod                → Go modules
- Gemfile               → RubyGems / Ruby
- composer.json         → Packagist / PHP
- pubspec.yaml          → pub.dev / Dart
- Package.swift         → SwiftPM / Swift
- *.csproj              → NuGet / .NET
```

### Step 2: Extract Current Version
```
For each ecosystem, parse the manifest:
- npm: package.json → dependencies/devDependencies[name]
  - Strip range operators (^, ~, >=)
  - Also check package-lock.json for resolved version
- PyPI: requirements.txt → name==version
  - Also check pyproject.toml [project.dependencies]
- Maven: pom.xml → <dependency><version>
- Gradle: build.gradle → implementation 'group:artifact:version'
- crates.io: Cargo.toml → [dependencies].name = "version"
- Go: go.mod → require name vX.Y.Z
- Ruby: Gemfile.lock → name (version)
- PHP: composer.lock → packages[].version
- NuGet: *.csproj → <PackageReference Version="">
```

### Step 3: Detect Runtime Versions
```
For runtime/tool upgrades (not dependency):
- Node.js: node --version, .nvmrc, .node-version, engines in package.json
- Python: python --version, .python-version, pyproject.toml requires-python
- Java: java --version, .java-version, pom.xml maven.compiler.source
- Go: go version, go.mod go directive
- Rust: rustc --version, rust-toolchain.toml
- Ruby: ruby --version, .ruby-version
```

### Step 4: Record Baseline
```
Write to state.json under phases.14-upgrade:
{
  "target": "<name>",
  "ecosystem": "<detected ecosystem>",
  "manifest_file": "<path to manifest>",
  "current_version": "<extracted version>",
  "is_runtime": true/false,
  "detected_at": "<ISO-8601>"
}
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Name of dependency/runtime/tool to upgrade |
| project_root | string | No | Project root path (defaults to cwd) |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| ecosystem | string | Detected ecosystem (npm, pypi, maven, etc.) |
| current_version | string | Extracted current version |
| manifest_file | string | Path to the manifest file |
| is_runtime | boolean | Whether target is a runtime vs dependency |

## Project-Specific Considerations
- Monorepo projects may have multiple manifests at different levels
- Lock files provide more accurate resolved versions than manifests
- Some projects use version catalogs (Gradle) or BOM files (Maven)

## Integration Points
- **Upgrade Engineer**: Provides baseline for upgrade analysis
- **Environment Builder**: Shares ecosystem detection logic
- **Orchestrator**: Version info feeds into state.json

## Validation
- Ecosystem correctly identified
- Version string extracted and parseable as semver (or ecosystem equivalent)
- Manifest file path is valid and readable
- Baseline recorded in state.json

---
name: registry-lookup
description: Query package registries for available versions newer than current
skill_id: UPG-002
owner: upgrade-engineer
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: After version detection to find available upgrade targets
dependencies: [UPG-001]
---

# Registry Lookup

## Purpose
Query the appropriate package registry or release channel to find all available versions newer than the currently installed version, and present upgrade options to the user.

## When to Use
- After current version is detected (UPG-001)
- When user needs to choose a target version
- When evaluating upgrade path options

## Prerequisites
- Ecosystem and current version detected (UPG-001 complete)
- Network access to query registries
- CLI tools available for the ecosystem (npm, pip, cargo, etc.)

## Process

### Step 1: Query Registry
```
By ecosystem:

npm:
  npm view <name> versions --json
  → Returns JSON array of all published versions

PyPI:
  pip index versions <name> 2>/dev/null
  OR: WebSearch "pypi.org/project/<name>/#history"
  → Extract version list

Maven Central:
  WebSearch "search.maven.org/artifact/<group>/<artifact>"
  OR: curl "https://search.maven.org/solrsearch/select?q=g:<group>+AND+a:<artifact>&rows=50&wt=json"

crates.io:
  cargo search <name> --limit 1
  WebSearch "crates.io/crates/<name>/versions"

Go:
  go list -m -versions <module>
  → Space-separated version list

RubyGems:
  gem search <name> --versions --all
  OR: WebSearch "rubygems.org/gems/<name>/versions"

NuGet:
  dotnet package search <name> --exact-match
  OR: WebSearch "nuget.org/packages/<name>"

Runtime/tools:
  WebSearch "<runtime> releases" or check official channels
  - Node.js: https://nodejs.org/en/about/releases/
  - Python: https://www.python.org/downloads/
  - Java: https://adoptium.net/temurin/releases/
  - Go: https://go.dev/dl/
  - Rust: https://releases.rs/
```

### Step 2: Filter and Sort
```
Filter criteria:
- Version > current_version
- Exclude pre-release unless user opts in
- Exclude yanked/retracted versions

Sort by:
- Semantic version descending (latest first)
- Group by major version
```

### Step 3: Identify Key Versions
```
Highlight:
- Latest stable (recommended default)
- Latest within current major (safe upgrade)
- Latest LTS (if applicable: Node.js, Java)
- Each major version boundary
```

### Step 4: Present Options
```
Present upgrade options to user via AskUserQuestion:

Available versions for <name> (current: v2.1.0):

[1] v3.2.1 (Latest stable)        — 2 major versions ahead
[2] v3.0.0 (Major boundary)       — Breaking changes
[3] v2.9.0 (Latest in current major) — Safe upgrade
[4] Specific version              — Enter manually
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Package/runtime name |
| ecosystem | string | Yes | Detected ecosystem from UPG-001 |
| current_version | string | Yes | Current installed version |
| include_prerelease | boolean | No | Include pre-release versions (default: false) |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| available_versions | array | All versions newer than current |
| recommended_version | string | Suggested target version |
| target_version | string | User-selected target version |
| version_gap | object | Major/minor/patch distance from current |

## Project-Specific Considerations
- Some registries rate-limit queries; use caching when available
- Private registries may require authentication
- Monorepo packages may not be on public registries

## Integration Points
- **Version Detection (UPG-001)**: Provides current version and ecosystem
- **Impact Analysis (UPG-003)**: Receives target version for changelog analysis
- **Upgrade Engineer**: Feeds upgrade path decision

## Validation
- Registry query returned results
- At least one version newer than current exists
- Target version is a valid, published version
- User has selected or confirmed target version

# Security Architecture: Custom Skill Management (REQ-0022)

**Version**: 1.0
**Created**: 2026-02-18
**Phase**: 03-architecture
**Status**: Accepted
**Traces to**: NFR-003, NFR-005, CON-004, Article III, Article X

---

## 1. Overview

Custom skill management introduces user-provided content (`.md` files) into the framework's prompt construction pipeline. This creates a trust boundary: user-authored content is injected into LLM prompts that guide agent behavior. The security architecture ensures this injection is safe, bounded, and fail-open.

**Key principle**: External skills are local files authored by the developer who owns the project. There is no remote/untrusted content. The threat model focuses on accidental misconfiguration, not adversarial attack.

---

## 2. Threat Model (STRIDE)

| Threat | Category | Risk | Mitigation |
|--------|----------|------|------------|
| T1: Path traversal in skill file path | Tampering | Medium | Validate `skill.file` contains no path separators (`/`, `\`, `..`). Only filename is stored in manifest. File is resolved relative to the external skills directory only. |
| T2: Skill file with prompt injection | Elevation of Privilege | Low | Skill content is authored by the project owner (same trust level as CLAUDE.md). No additional mitigation needed beyond delivery type formatting. |
| T3: Oversized skill file bloats context | Denial of Service | Medium | 10,000 character truncation per skill. Reference delivery fallback for large files. |
| T4: Malformed manifest causes crash | Denial of Service | Low | `loadExternalManifest()` returns null on parse error. Outer try/catch in STEP 3d ensures fail-open. |
| T5: Skill file missing at injection time | Denial of Service | Low | Inner try/catch per skill. Missing file is skipped with warning. |
| T6: Manifest write corrupts existing data | Integrity | Low | `writeExternalManifest()` writes full JSON atomically. Validate JSON after write. |
| T7: Concurrent manifest writes | Integrity | Very Low | Single-user CLI tool. No concurrent access expected. |
| T8: Skill content contains secrets | Information Disclosure | Low | User responsibility. Framework does not scan skill content for secrets (skill files are user-authored local configuration, like CLAUDE.md). |

---

## 3. Authentication Flow

**Not applicable.** Skill management is a local CLI operation. No authentication is required. The developer who runs `isdlc skill add` has full filesystem access to the project.

---

## 4. Authorization Model

**Not applicable.** There are no user roles or permissions. The single developer/user has full control over skill registration, wiring, and removal. This is consistent with the framework's single-user CLI model.

---

## 5. Data Protection

### 5.1 Data at Rest

| Data | Location | Protection | Classification |
|------|----------|------------|----------------|
| Skill `.md` files | `.claude/skills/external/` | Filesystem permissions (0644) | User-authored, non-sensitive |
| `external-skills-manifest.json` | `docs/isdlc/` | Filesystem permissions (0644) | Configuration, non-sensitive |
| Manifest in monorepo | `docs/isdlc/projects/{id}/` | Filesystem permissions (0644) | Configuration, non-sensitive |

**Encryption at rest**: Not required. Skill files contain domain knowledge (coding conventions, framework patterns), not secrets. If a user stores secrets in skill files, that is a user error -- the framework explicitly does not support secret storage in skill files (ASM-001 assumes standard skill content).

### 5.2 Data in Transit

**Not applicable.** All operations are local filesystem I/O. No network communication occurs during skill management or injection.

### 5.3 Key Management

**Not applicable.** No encryption keys are involved.

---

## 6. Input Validation

### 6.1 Skill File Validation (`validateSkillFrontmatter`)

| Check | Rule | Error Message |
|-------|------|---------------|
| File exists | `fs.existsSync(filePath)` returns true | "File not found: {filePath}" |
| File extension | Path ends with `.md` | "Only .md files are supported. Got: {ext}" |
| Frontmatter present | Content matches `/^---\n[\s\S]*?\n---/` | "No YAML frontmatter found. Expected file to start with '---'" |
| `name` field | Non-empty string after trim | "Missing required frontmatter field: name" |
| `description` field | Non-empty string after trim | "Missing required frontmatter field: description" |
| `name` format | Matches `/^[a-z0-9][a-z0-9-]*[a-z0-9]$/` (lowercase, hyphens, 2+ chars) | "Skill name must be lowercase alphanumeric with hyphens (e.g., 'nestjs-conventions')" |

### 6.2 Manifest Validation

| Check | Rule | Error Message |
|-------|------|---------------|
| JSON valid | `JSON.parse()` does not throw | "Manifest is not valid JSON" |
| `version` present | `typeof manifest.version === 'string'` | "Manifest missing version field" |
| `skills` is array | `Array.isArray(manifest.skills)` | "Manifest skills field must be an array" |
| Skill name unique | No duplicates in `skills[].name` | "Duplicate skill name: {name}" |

### 6.3 Path Traversal Prevention

The `file` field in manifest entries stores only a filename (e.g., `"nestjs-conventions.md"`), never a path. The full path is always constructed by combining `resolveExternalSkillsPath()` + filename.

**Validation in `validateSkillFrontmatter` and `writeExternalManifest`**:
```
IF skill.file contains '/' OR skill.file contains '\\' OR skill.file contains '..':
    REJECT with "Skill filename must not contain path separators or '..' sequences"
```

This prevents any attempt to reference files outside the external skills directory.

---

## 7. Fail-Open Design (Article X, NFR-003)

The entire skill injection pipeline is designed to fail open. At every level, errors result in skipping the problematic component and continuing with the unmodified delegation prompt.

### Failure Hierarchy

```
Level 1: loadExternalManifest() returns null
  --> Skip all injection (no-op)

Level 2: manifest.skills is empty or undefined
  --> Skip all injection (no-op)

Level 3: Individual skill has no bindings object
  --> Skip this skill (backward compat)

Level 4: Skill file not found on disk
  --> Log warning, skip this skill, continue with next

Level 5: Skill file read error
  --> Log warning, skip this skill, continue with next

Level 6: formatSkillInjectionBlock() error
  --> Log warning, skip this skill, continue with next

Level 7: Any unexpected error in outer try/catch
  --> Log warning, continue with unmodified delegation prompt
```

**Invariant**: No error in the external skill system will ever prevent a workflow phase from executing. The worst case is that skill injection is silently skipped.

---

## 8. Secrets Management

**Not applicable.** The custom skill management feature does not handle secrets. Skill files contain domain knowledge, not credentials. The framework's existing secrets management (Article III requirement 1: "No secrets/credentials in code or version control") applies to skill files as well, but enforcement is the user's responsibility.

---

## 9. API Security

**Not applicable.** There are no APIs. All operations are local CLI commands processed by Claude Code's Task tool. No HTTP endpoints, no network listeners.

---

## 10. Compliance Requirements

| Requirement | Status | Notes |
|-------------|--------|-------|
| Article III (Security by Design) | Compliant | Input validation for all user-provided data; path traversal prevention; fail-open design |
| Article X (Fail-Safe Defaults) | Compliant | Seven-level fail-open hierarchy; no workflow blockage from skill errors |
| Article XII (Cross-Platform) | Compliant | Path resolution uses `path.join()` via existing common.cjs functions |
| Article XIII (Module System) | Compliant | New functions in CJS (common.cjs); no ESM/CJS boundary violations |
| Article XIV (State Management) | Compliant | Skills manifest is separate from state.json; no state corruption risk |
| GDPR/HIPAA/PCI-DSS | N/A | Local CLI tool, no personal data, no network, no payment processing |

---

## 11. Security Review Checklist

- [x] All user input validated (file path, frontmatter fields, manifest entries)
- [x] Path traversal prevention (filename-only storage, no path components in manifest)
- [x] Fail-open design at every level (NFR-003, Article X)
- [x] No secrets in skill files (user responsibility, documented in ASM-001)
- [x] Content size limits (10,000 char truncation)
- [x] No network operations (all local filesystem)
- [x] No privilege escalation (same user, same filesystem permissions)
- [x] Backward compatibility (entries without bindings silently skipped)
- [x] Atomic manifest writes (full JSON, not partial updates)

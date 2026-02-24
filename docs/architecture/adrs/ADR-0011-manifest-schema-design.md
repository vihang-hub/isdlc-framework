# ADR-0011: External Skills Manifest Schema Design

## Status

Accepted

## Context

The custom skill management feature (REQ-0022) needs a data schema to store registered external skills and their bindings. Key requirements:

- Support up to 50 skills (NFR-002)
- Backward compatible with existing manifest files (NFR-005)
- Support three delivery types: context, instruction, reference
- Support one injection mode: "always" (extensible to future modes)
- Store agent and phase bindings
- Use existing path resolution functions (CON-002)

## Decision

Use a JSON manifest file (`external-skills-manifest.json`) with the following schema:

```json
{
  "version": "1.0.0",
  "skills": [
    {
      "name": "skill-name",
      "description": "Description",
      "file": "filename.md",
      "added_at": "ISO-8601",
      "bindings": {
        "agents": ["agent-name"],
        "phases": ["phase-key"],
        "injection_mode": "always",
        "delivery_type": "context"
      }
    }
  ]
}
```

Key schema decisions:

1. **`bindings` is optional** (not required on skill entries). This ensures backward compatibility with any pre-existing manifest entries that lack binding configuration.

2. **`file` stores filename only** (not a path). The full path is constructed by `resolveExternalSkillsPath() + "/" + file`. This prevents path traversal and makes the manifest portable across directory moves.

3. **`agents` and `phases` are both arrays** in bindings. A skill can match by either agent name OR phase key. This gives users flexibility: bind to a specific agent regardless of phase, or bind to a phase regardless of which agent runs it.

4. **`injection_mode` is currently fixed to `"always"`**. The field exists for future extensibility (e.g., `"on_demand"`, `"first_run"`). The injection logic checks this field, so adding new modes in the future requires only new conditional logic, not schema changes.

5. **`delivery_type` is per-skill** (not per-binding). A skill has one delivery type that applies to all its bound agents/phases. This simplifies the schema and UX. If users need different delivery types for the same content in different phases, they should create separate skill entries.

## Consequences

**Positive:**
- Simple, flat schema that is easy to read, write, and debug
- Backward compatible: old entries without `bindings` are silently skipped at injection time
- Extensible: `injection_mode` field supports future modes without schema migration
- Portable: filename-only `file` field works across directory relocations
- Validated by existing `loadExternalManifest()` and new `writeExternalManifest()` functions

**Negative:**
- No per-phase delivery type override (users must create separate entries)
- No skill dependencies or ordering (skills are independent)
- No versioning per skill (entire manifest has one version)

## Alternatives Considered

### Store bindings in state.json (Rejected)
- state.json is runtime state (Article XIV)
- External skills are project configuration that persists across workflows
- Would violate the separation of concerns established by the existing manifest design

### Nested bindings per agent/phase (Rejected)
```json
"bindings": {
  "06-implementation": { "delivery_type": "instruction" },
  "03-architecture": { "delivery_type": "context" }
}
```
- More flexible but significantly more complex
- Complicates the wiring session UX (user must set delivery type per phase)
- Violates Article V (simplicity first)
- Can be added in a future version if needed

## Requirement Traceability

- FR-004 (Manifest Registration)
- FR-005 (Runtime Injection)
- NFR-002 (Manifest Size Limit)
- NFR-005 (Backward Compatibility)
- CON-002 (Existing Infrastructure)
- Article V (Simplicity First)
- Article XIV (State Management Integrity)

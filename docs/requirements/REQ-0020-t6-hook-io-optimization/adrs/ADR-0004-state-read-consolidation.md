# ADR-0004: State Read Consolidation in state-write-validator

## Status
Accepted

## Context
The `state-write-validator.cjs` hook validates writes to `state.json` by comparing incoming content against the current disk state. Three validation rules each independently read the disk file:

1. **V7 (checkVersionLock)**: Reads disk to compare `state_version` (optimistic locking)
2. **V8 (checkPhaseFieldProtection)**: Reads disk to compare `active_workflow` fields (regression detection)
3. **V1-V3 (validatePhase)**: Reads disk to scan phase data for suspicious patterns

This results in 3 `readFileSync` + 3 `JSON.parse` calls for the same file within a single `check()` invocation. The file does not change between these reads (the hook runs after the write is complete, and no other process modifies state.json during hook execution).

Traces to: FR-003, AC-003a, AC-003b, AC-003c, AC-003d, NFR-001

## Decision
Read the disk state file **once** at the top of the `check()` function, and pass the parsed `diskState` object to `checkVersionLock()` and `checkPhaseFieldProtection()` as a parameter:

```javascript
function check(ctx) {
    // ... existing guards ...

    // Read disk state ONCE
    let diskState = null;
    try {
        if (fs.existsSync(filePath)) {
            diskState = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            if (!diskState || typeof diskState !== 'object') {
                diskState = null;
            }
        }
    } catch (e) {
        diskState = null; // fail-open
    }

    // V7: version lock (uses diskState)
    const v7Result = checkVersionLock(filePath, toolInput, toolName, diskState);
    if (v7Result) return v7Result;

    // V8: phase protection (uses diskState)
    const v8Result = checkPhaseFieldProtection(filePath, toolInput, toolName, diskState);
    if (v8Result) return v8Result;

    // V1-V3: validate incoming content (uses incomingState, not disk)
    // ... existing logic using parsed toolInput.content ...
}
```

Key design decisions:
- `diskState` is `null` when the file does not exist or cannot be parsed (AC-003d)
- V7 and V8 handle `diskState === null` with fail-open (return null, allowing the write)
- V1-V3 validate the INCOMING content from `toolInput.content`, not the disk state (AC-003c)

## Consequences

**Positive:**
- Reduces disk reads from 3 to 1 per invocation (67% reduction)
- Reduces JSON.parse calls from 3 to 1 (CPU savings)
- Self-contained change: no impact on other hooks or dispatchers
- Fail-open behavior preserved for all error paths

**Negative:**
- `checkVersionLock` and `checkPhaseFieldProtection` function signatures change (additional parameter). These are internal functions with no external callers, so this is a non-breaking change.
- If disk state is corrupt (unparseable JSON), all three rules get `diskState = null` instead of each independently attempting to parse. This is actually better behavior (consistent failure handling).

## Alternatives Considered

| Alternative | Reason for Rejection |
|-------------|---------------------|
| Lazy loading (read on first access, cache for subsequent) | More complex than read-once-upfront; the file is always needed by at least V7 |
| Pass disk state from dispatcher | state-write-validator runs in post-write-edit-dispatcher, which reads state for its own ctx. But the state-write-validator needs the DISK state (what was just written), not the dispatcher's cached state (which was read BEFORE the write). Reading from disk is correct here. |
| Remove V8's independent read only | Partial optimization; V1-V3 also re-read. Better to consolidate all three. |

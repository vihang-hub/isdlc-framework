# Test Cases: Elaboration Mode -- Multi-Persona Roundtable Discussions

**Feature**: REQ-0028 / GH-21 -- Elaboration Mode
**Phase**: 05-test-strategy
**Test File**: `src/claude/hooks/tests/test-three-verb-utils-elaboration.test.cjs`

---

## Implementation Blueprint

The test file follows the exact structure of `test-three-verb-utils-steps.test.cjs`:
- CommonJS module (`'use strict'`)
- Uses `node:test` (describe, it, beforeEach, afterEach)
- Uses `node:assert/strict`
- Creates temp directories for each test (createTestDir/cleanupTestDir pattern)
- Imports `readMetaJson` and `writeMetaJson` from `../lib/three-verb-utils.cjs`

---

## Test Case Specifications

### Suite A: Defensive Defaults -- elaborations[]

**TC-E01**: readMetaJson defaults elaborations to [] when field absent
```javascript
it('TC-E01: readMetaJson defaults elaborations to [] when field absent (FR-009 AC-009-02)', () => {
    writeMeta(legacyMeta());
    const meta = readMetaJson(testDir);
    assert.ok(meta !== null, 'readMetaJson should not return null');
    assert.deepStrictEqual(meta.elaborations, []);
});
```

**TC-E02**: readMetaJson preserves existing elaborations array
```javascript
it('TC-E02: readMetaJson preserves existing elaborations array (FR-009 AC-009-04)', () => {
    const record = {
        step_id: '01-03',
        turn_count: 7,
        personas_active: ['business-analyst', 'solutions-architect', 'system-designer'],
        timestamp: '2026-02-20T14:30:00.000Z',
        synthesis_summary: 'Identified 3 additional acceptance criteria'
    };
    writeMeta({ ...legacyMeta(), elaborations: [record] });
    const meta = readMetaJson(testDir);
    assert.deepStrictEqual(meta.elaborations, [record]);
});
```

**TC-E03**: readMetaJson corrects elaborations when it is null
```javascript
it('TC-E03: readMetaJson corrects elaborations when null (FR-009 AC-009-02)', () => {
    writeMeta({ ...legacyMeta(), elaborations: null });
    const meta = readMetaJson(testDir);
    assert.deepStrictEqual(meta.elaborations, []);
});
```

**TC-E04**: readMetaJson corrects elaborations when it is a string
```javascript
it('TC-E04: readMetaJson corrects elaborations when string (FR-009 AC-009-02)', () => {
    writeMeta({ ...legacyMeta(), elaborations: '01-03' });
    const meta = readMetaJson(testDir);
    assert.deepStrictEqual(meta.elaborations, []);
});
```

**TC-E05**: readMetaJson corrects elaborations when it is a number
```javascript
it('TC-E05: readMetaJson corrects elaborations when number (FR-009 AC-009-02)', () => {
    writeMeta({ ...legacyMeta(), elaborations: 42 });
    const meta = readMetaJson(testDir);
    assert.deepStrictEqual(meta.elaborations, []);
});
```

**TC-E06**: readMetaJson corrects elaborations when it is an object
```javascript
it('TC-E06: readMetaJson corrects elaborations when object (FR-009 AC-009-02)', () => {
    writeMeta({ ...legacyMeta(), elaborations: { step_id: '01-03' } });
    const meta = readMetaJson(testDir);
    assert.deepStrictEqual(meta.elaborations, []);
});
```

### Suite B: Defensive Defaults -- elaboration_config

**TC-E07**: readMetaJson defaults elaboration_config to {} when absent
```javascript
it('TC-E07: readMetaJson defaults elaboration_config to {} when absent (FR-007 AC-007-03)', () => {
    writeMeta(legacyMeta());
    const meta = readMetaJson(testDir);
    assert.deepStrictEqual(meta.elaboration_config, {});
});
```

**TC-E08**: readMetaJson preserves existing elaboration_config
```javascript
it('TC-E08: readMetaJson preserves existing elaboration_config (FR-007 AC-007-03)', () => {
    writeMeta({ ...legacyMeta(), elaboration_config: { max_turns: 15 } });
    const meta = readMetaJson(testDir);
    assert.deepStrictEqual(meta.elaboration_config, { max_turns: 15 });
});
```

**TC-E09**: readMetaJson corrects elaboration_config when null
```javascript
it('TC-E09: readMetaJson corrects elaboration_config when null (FR-007 AC-007-03)', () => {
    writeMeta({ ...legacyMeta(), elaboration_config: null });
    const meta = readMetaJson(testDir);
    assert.deepStrictEqual(meta.elaboration_config, {});
});
```

**TC-E10**: readMetaJson corrects elaboration_config when an array
```javascript
it('TC-E10: readMetaJson corrects elaboration_config when array (FR-007 AC-007-03)', () => {
    writeMeta({ ...legacyMeta(), elaboration_config: [10] });
    const meta = readMetaJson(testDir);
    assert.deepStrictEqual(meta.elaboration_config, {});
});
```

### Suite C: Field Preservation

**TC-E11**: readMetaJson preserves all existing fields alongside elaboration defaults
```javascript
it('TC-E11: readMetaJson preserves all fields alongside elaboration defaults (NFR-005, NFR-007)', () => {
    const data = {
        description: 'full item',
        source: 'github',
        source_id: 'GH-21',
        created_at: '2026-02-20T10:00:00.000Z',
        analysis_status: 'partial',
        phases_completed: ['00-quick-scan', '01-requirements'],
        codebase_hash: 'abc1234',
        steps_completed: ['00-01', '00-02'],
        depth_overrides: { '01-requirements': 'deep' }
    };
    writeMeta(data);
    const meta = readMetaJson(testDir);
    // All original fields preserved
    assert.equal(meta.description, 'full item');
    assert.equal(meta.source, 'github');
    assert.equal(meta.source_id, 'GH-21');
    assert.equal(meta.analysis_status, 'partial');
    assert.deepStrictEqual(meta.phases_completed, ['00-quick-scan', '01-requirements']);
    assert.deepStrictEqual(meta.steps_completed, ['00-01', '00-02']);
    assert.deepStrictEqual(meta.depth_overrides, { '01-requirements': 'deep' });
    // Elaboration defaults added
    assert.deepStrictEqual(meta.elaborations, []);
    assert.deepStrictEqual(meta.elaboration_config, {});
});
```

**TC-E12**: readMetaJson preserves elaboration fields alongside steps/depth fields
```javascript
it('TC-E12: readMetaJson preserves elaboration alongside steps and depth (NFR-005, NFR-007)', () => {
    const record = {
        step_id: '01-03',
        turn_count: 5,
        personas_active: ['business-analyst', 'solutions-architect', 'system-designer'],
        timestamp: '2026-02-20T14:30:00.000Z',
        synthesis_summary: 'Discussed offline mode sync'
    };
    const data = {
        ...legacyMeta(),
        steps_completed: ['01-01', '01-02', '01-03'],
        depth_overrides: { '01-03': 'deep' },
        elaborations: [record],
        elaboration_config: { max_turns: 12 }
    };
    writeMeta(data);
    const meta = readMetaJson(testDir);
    assert.deepStrictEqual(meta.steps_completed, ['01-01', '01-02', '01-03']);
    assert.deepStrictEqual(meta.depth_overrides, { '01-03': 'deep' });
    assert.deepStrictEqual(meta.elaborations, [record]);
    assert.deepStrictEqual(meta.elaboration_config, { max_turns: 12 });
});
```

### Suite D: Write Cycle Round-Trips

**TC-E13**: writeMetaJson preserves elaborations array through write cycle
```javascript
it('TC-E13: writeMetaJson preserves elaborations through write cycle (FR-009 AC-009-01)', () => {
    const record = {
        step_id: '01-03',
        turn_count: 7,
        personas_active: ['business-analyst', 'solutions-architect', 'system-designer'],
        timestamp: '2026-02-20T14:30:00.000Z',
        synthesis_summary: 'Key sync insights'
    };
    const meta = { ...legacyMeta(), elaborations: [record] };
    writeMetaJson(testDir, meta);
    const written = readMetaRaw();
    assert.deepStrictEqual(written.elaborations, [record]);
});
```

**TC-E14**: writeMetaJson preserves elaboration_config through write cycle
```javascript
it('TC-E14: writeMetaJson preserves elaboration_config through write cycle (FR-007 AC-007-03)', () => {
    const meta = { ...legacyMeta(), elaboration_config: { max_turns: 15 } };
    writeMetaJson(testDir, meta);
    const written = readMetaRaw();
    assert.deepStrictEqual(written.elaboration_config, { max_turns: 15 });
});
```

**TC-E15**: writeMetaJson succeeds when elaborations is absent
```javascript
it('TC-E15: writeMetaJson succeeds when elaborations absent (NFR-007)', () => {
    const meta = legacyMeta();
    assert.doesNotThrow(() => writeMetaJson(testDir, meta));
    const written = readMetaRaw();
    assert.ok(typeof written === 'object');
    assert.equal(written.elaborations, undefined);
});
```

**TC-E16**: writeMetaJson round-trip preserves elaboration record
```javascript
it('TC-E16: write-read round-trip preserves elaboration record (FR-009 AC-009-04)', () => {
    const record = {
        step_id: '02-01',
        turn_count: 10,
        personas_active: ['business-analyst', 'solutions-architect', 'system-designer'],
        timestamp: '2026-02-20T15:00:00.000Z',
        synthesis_summary: 'Architecture tradeoff resolution'
    };
    const meta = { ...legacyMeta(), elaborations: [record] };
    writeMetaJson(testDir, meta);
    const readBack = readMetaJson(testDir);
    assert.deepStrictEqual(readBack.elaborations, [record]);
});
```

### Suite E: Regression (Unchanged Behaviors)

**TC-E17**: readMetaJson returns null for missing meta.json (unchanged)
```javascript
it('TC-E17: readMetaJson returns null for missing meta.json (NFR-007)', () => {
    const result = readMetaJson(testDir);
    assert.equal(result, null);
});
```

**TC-E18**: readMetaJson returns null for corrupt JSON (unchanged)
```javascript
it('TC-E18: readMetaJson returns null for corrupt JSON (NFR-007)', () => {
    fs.writeFileSync(path.join(testDir, 'meta.json'), '{not valid json');
    const result = readMetaJson(testDir);
    assert.equal(result, null);
});
```

**TC-E19**: Legacy migration + elaboration defaults coexist
```javascript
it('TC-E19: legacy migration + elaboration defaults coexist (NFR-005, NFR-007)', () => {
    writeMeta({
        description: 'legacy item',
        source: 'manual',
        phase_a_completed: true,
        codebase_hash: 'abc1234'
    });
    const meta = readMetaJson(testDir);
    assert.equal(meta.analysis_status, 'analyzed');
    assert.deepStrictEqual(meta.phases_completed, [
        '00-quick-scan', '01-requirements',
        '02-impact-analysis', '03-architecture', '04-design'
    ]);
    assert.deepStrictEqual(meta.steps_completed, []);
    assert.deepStrictEqual(meta.depth_overrides, {});
    assert.deepStrictEqual(meta.elaborations, []);
    assert.deepStrictEqual(meta.elaboration_config, {});
});
```

### Suite F: Integration Chains

**TC-E20**: Full elaboration lifecycle: read default -> add record -> write -> read back
```javascript
it('TC-E20: full elaboration lifecycle: default -> add -> write -> read (FR-009 AC-009-01..04)', () => {
    writeMeta(legacyMeta());
    // Step 1: Read meta (defaults applied)
    const meta = readMetaJson(testDir);
    assert.deepStrictEqual(meta.elaborations, []);
    // Step 2: Add elaboration record (simulating agent behavior)
    const record = {
        step_id: '01-03',
        turn_count: 7,
        personas_active: ['business-analyst', 'solutions-architect', 'system-designer'],
        timestamp: new Date().toISOString(),
        synthesis_summary: 'Identified offline sync requirements'
    };
    meta.elaborations.push(record);
    // Step 3: Write back
    writeMetaJson(testDir, meta);
    // Step 4: Read back and verify
    const updated = readMetaJson(testDir);
    assert.equal(updated.elaborations.length, 1);
    assert.equal(updated.elaborations[0].step_id, '01-03');
    assert.equal(updated.elaborations[0].turn_count, 7);
});
```

**TC-E21**: Multiple elaboration records per step: append not replace
```javascript
it('TC-E21: multiple elaboration records per step (FR-009 AC-009-04)', () => {
    const record1 = {
        step_id: '01-03',
        turn_count: 5,
        personas_active: ['business-analyst', 'solutions-architect', 'system-designer'],
        timestamp: '2026-02-20T14:00:00.000Z',
        synthesis_summary: 'First elaboration on user journeys'
    };
    const record2 = {
        step_id: '01-03',
        turn_count: 8,
        personas_active: ['business-analyst', 'solutions-architect', 'system-designer'],
        timestamp: '2026-02-20T14:30:00.000Z',
        synthesis_summary: 'Second elaboration: deeper on edge cases'
    };
    // Write with first record
    writeMeta({ ...legacyMeta(), elaborations: [record1] });
    const meta = readMetaJson(testDir);
    // Append second record
    meta.elaborations.push(record2);
    writeMetaJson(testDir, meta);
    // Read back -- both records present
    const updated = readMetaJson(testDir);
    assert.equal(updated.elaborations.length, 2);
    assert.equal(updated.elaborations[0].synthesis_summary, 'First elaboration on user journeys');
    assert.equal(updated.elaborations[1].synthesis_summary, 'Second elaboration: deeper on edge cases');
});
```

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-02-20 | Test Design Engineer (Phase 05) | Initial test case specifications |

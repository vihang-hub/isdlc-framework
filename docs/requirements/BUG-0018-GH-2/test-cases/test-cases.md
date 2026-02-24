# Test Cases: BUG-0018-GH-2 -- Backlog Picker Pattern Mismatch

**Phase**: 05-test-strategy
**Created**: 2026-02-16
**Test file**: `src/claude/hooks/tests/test-backlog-picker-content.test.cjs`
**Total test cases**: 26

---

## TC-FR1: Strip Link Suffix from Picker Display

Tests verifying the orchestrator markdown contains suffix-stripping instructions (FR-1).

### TC-FR1-01: Requirements link suffix stripping instruction exists

**Traces to**: FR-1, AC-1.1
**Priority**: P0
**Type**: Content verification

**Precondition**: `src/claude/agents/00-sdlc-orchestrator.md` exists and contains a BACKLOG PICKER section.

**Steps**:
1. Read `00-sdlc-orchestrator.md` file content
2. Locate the BACKLOG PICKER section (starts with `# BACKLOG PICKER`)
3. Search the section for instruction text that references stripping `-> [requirements](...)` suffix

**Expected Result**: The BACKLOG PICKER section contains an instruction to strip the `-> [requirements](...)` suffix from captured item text.

**Pass Criteria**: The section text matches a pattern indicating suffix stripping for requirements links (e.g., contains `-> [requirements]` in the context of stripping/removing/truncating).

---

### TC-FR1-02: Design link suffix stripping instruction exists

**Traces to**: FR-1, AC-1.2
**Priority**: P0
**Type**: Content verification

**Steps**:
1. Read `00-sdlc-orchestrator.md` file content
2. Locate the BACKLOG PICKER section
3. Search for instruction text that references stripping `-> [design](...)` suffix

**Expected Result**: The section contains an instruction to strip `-> [design](...)` suffix alongside the requirements suffix.

**Pass Criteria**: The section text references both `[requirements]` and `[design]` link types in suffix stripping context.

---

### TC-FR1-03: Items without suffix still display correctly

**Traces to**: FR-1, AC-1.3
**Priority**: P0
**Type**: Content verification

**Steps**:
1. Read `00-sdlc-orchestrator.md` BACKLOG PICKER section
2. Verify the stripping instruction is conditional (only strips if suffix is present)

**Expected Result**: The section does not mandate stripping on all items -- it handles the case where no `->` suffix exists (items pass through unchanged).

**Pass Criteria**: The section describes the suffix stripping as conditional (e.g., "if the captured text contains `-> [`" or "strip any trailing" implying no-op when absent).

---

### TC-FR1-04: Stripped text used as workflow description

**Traces to**: FR-1, AC-1.4
**Priority**: P0
**Type**: Content verification

**Steps**:
1. Read the BACKLOG PICKER Presentation Rules section
2. Verify that the text used for workflow description is the post-stripping clean title

**Expected Result**: The section states that the chosen/selected text (after stripping) becomes the workflow description.

**Pass Criteria**: Presentation Rules or item selection flow references using the clean/stripped title as the description.

---

## TC-FR2: Parse All New Index Format Variants

Tests verifying the orchestrator handles all BACKLOG.md format variants (FR-2).

### TC-FR2-01: Numbered item pattern N.N recognized

**Traces to**: FR-2, AC-2.1
**Priority**: P0
**Type**: Content verification

**Steps**:
1. Read `00-sdlc-orchestrator.md` BACKLOG PICKER section
2. Verify the scan pattern references `N.N` numbered format

**Expected Result**: The section describes scanning for patterns like `- N.N [ ] <text>` (number.number prefix).

**Pass Criteria**: The text contains `N.N` or equivalent numbered pattern notation.

---

### TC-FR2-02: Checked items excluded

**Traces to**: FR-2, AC-2.2
**Priority**: P0
**Type**: Content verification

**Steps**:
1. Read BACKLOG PICKER section
2. Verify unchecked pattern `[ ]` is specified as the inclusion criterion

**Expected Result**: The scan targets unchecked `[ ]` items only, implicitly or explicitly excluding `[x]` items.

**Pass Criteria**: Pattern references `[ ]` (unchecked checkbox), not `[x]`.

---

### TC-FR2-03: Unchecked items included

**Traces to**: FR-2, AC-2.3
**Priority**: P0
**Type**: Content verification

**Steps**:
1. Read BACKLOG PICKER section
2. Verify the scan includes items with `[ ]` unchecked boxes

**Expected Result**: Items with `[ ]` are the ones presented in the picker.

**Pass Criteria**: The pattern explicitly uses `[ ]` as the checkbox marker for scanned items.

---

### TC-FR2-04: Strikethrough items excluded

**Traces to**: FR-2, AC-2.4
**Priority**: P1
**Type**: Content verification

**Steps**:
1. Read BACKLOG PICKER section
2. Search for handling of `~~text~~` (strikethrough) items

**Expected Result**: The section either explicitly excludes strikethrough items or the `[x]` exclusion implicitly covers them (strikethrough items always have `[x]`).

**Pass Criteria**: Checked `[x]` items (which are the ones with strikethrough in BACKLOG.md) are excluded. Verify by examining the actual BACKLOG.md to confirm strikethrough items always have `[x]`.

---

### TC-FR2-05: Section headers not parsed as items

**Traces to**: FR-2, AC-2.5
**Priority**: P1
**Type**: Content verification

**Steps**:
1. Read BACKLOG PICKER section
2. Verify the pattern requires `- N.N [ ]` prefix (which headers do not have)

**Expected Result**: Section headers like `### 3. Parallel Workflows` do not match the `- N.N [ ]` pattern and are naturally excluded.

**Pass Criteria**: The scan pattern starts with `- ` (dash-space) followed by a number, which excludes `###` header lines.

---

### TC-FR2-06: Sub-bullets not parsed as items

**Traces to**: FR-2, AC-2.6
**Priority**: P1
**Type**: Content verification

**Steps**:
1. Read BACKLOG PICKER section
2. Verify sub-bullets (indented lines) are handled as metadata, not items

**Expected Result**: The section describes metadata sub-bullets (Jira, Confluence) as belonging to the parent item, not as separate picker entries.

**Pass Criteria**: The Jira Metadata Parsing section describes sub-bullets as children of items, parsed for metadata extraction.

---

## TC-FR3: Preserve Jira Metadata Parsing

Tests verifying Jira metadata handling is intact after suffix stripping changes (FR-3).

### TC-FR3-01: Jira sub-bullet parsing preserved

**Traces to**: FR-3, AC-3.1
**Priority**: P1
**Type**: Content verification

**Steps**:
1. Read BACKLOG PICKER Jira Metadata Parsing section
2. Verify `**Jira:**` sub-bullet extraction is still documented

**Expected Result**: The section describes parsing `**Jira:**` sub-bullets to extract ticket IDs.

**Pass Criteria**: Text contains `**Jira:**` in the context of sub-bullet parsing.

---

### TC-FR3-02: Jira-backed items show ticket suffix

**Traces to**: FR-3, AC-3.2
**Priority**: P1
**Type**: Content verification

**Steps**:
1. Read the BACKLOG PICKER display format section
2. Verify Jira-backed items are displayed with `[Jira: TICKET-ID]` suffix

**Expected Result**: The picker display format shows Jira items with `[Jira: TICKET-ID]` appended.

**Pass Criteria**: The example or instruction contains `[Jira:` in the display format context.

---

### TC-FR3-03: Non-Jira items display without suffix

**Traces to**: FR-3, AC-3.3
**Priority**: P1
**Type**: Content verification

**Steps**:
1. Read the BACKLOG PICKER display format
2. Verify that non-Jira items are displayed without any Jira tag

**Expected Result**: The display format example shows items both with and without Jira tags, confirming non-Jira items are clean.

**Pass Criteria**: The example includes at least one item without `[Jira:` suffix (e.g., `Local-only item -- no Jira tag`).

---

## TC-FR4: Verify Test Coverage

Tests verifying that test coverage assertions are valid (FR-4).

### TC-FR4-01: Backlog test files existence check

**Traces to**: FR-4, AC-4.1
**Priority**: P1
**Type**: Filesystem verification

**Steps**:
1. Search `src/claude/hooks/tests/` for files matching `backlog*.test.cjs`
2. Record what is found

**Expected Result**: Either no backlog-specific test files exist (confirming the trace analysis finding), or any found files are accounted for.

**Pass Criteria**: The test documents the finding. If no backlog test files exist, this is expected and not a failure. The new test file (`test-backlog-picker-content.test.cjs`) is the coverage.

---

### TC-FR4-02: New test file covers suffix stripping

**Traces to**: FR-4, AC-4.3
**Priority**: P1
**Type**: Self-referential verification

**Steps**:
1. Verify that this test suite (once implemented) includes tests for `-> [requirements](...)` suffix stripping
2. Count test cases mapping to FR-1

**Expected Result**: At least 4 test cases cover suffix stripping (TC-FR1-01 through TC-FR1-04).

**Pass Criteria**: Traceability matrix shows FR-1 mapped to >= 4 test cases.

---

### TC-FR4-03: All tests pass after implementation

**Traces to**: FR-4, AC-4.4
**Priority**: P0
**Type**: Execution verification (validated in Phase 16)

**Steps**:
1. Run `npm run test:all`
2. All tests pass

**Expected Result**: Zero test failures across both ESM and CJS streams.

**Pass Criteria**: Exit code 0 from `npm run test:all`.

---

### TC-FR4-04: Old format tests still valid

**Traces to**: FR-4, AC-4.2
**Priority**: P1
**Type**: Content verification

**Steps**:
1. Verify that the orchestrator BACKLOG PICKER still describes the `- N.N [ ] <text>` pattern (not replaced)
2. The old format is a subset of the new format -- suffix is optional

**Expected Result**: The original scan pattern remains, with suffix stripping added as an additional step.

**Pass Criteria**: The `- N.N [ ] <text>` pattern text is present in the BACKLOG PICKER section.

---

## TC-FR5: Evaluate `start` Action Workflow Entry

Tests verifying the `start` action reuse mechanism is documented (FR-5).

### TC-FR5-01: Start action documented as feature reuse

**Traces to**: FR-5, AC-5.1
**Priority**: P2
**Type**: Content verification

**Steps**:
1. Read `src/claude/commands/isdlc.md`
2. Locate the `start` action section
3. Verify it describes reusing the feature workflow

**Expected Result**: The `start` action section describes reusing the feature workflow phases (skipping Phase 00 and Phase 01).

**Pass Criteria**: The section contains text indicating `start` reuses `feature` workflow or its phases.

---

### TC-FR5-02: workflows.json has no start entry (by design)

**Traces to**: FR-5, AC-5.2
**Priority**: P2
**Type**: Content verification

**Steps**:
1. Read `.isdlc/config/workflows.json`
2. Verify there is no `start` key in the `workflows` object

**Expected Result**: No `start` entry exists -- this is the expected state (by design).

**Pass Criteria**: `workflows.json` parsed as JSON does not contain a `start` key at the top-level workflows level.

---

### TC-FR5-03: Reuse mechanism documented in code comment or ADR

**Traces to**: FR-5, AC-5.3
**Priority**: P2
**Type**: Content verification

**Steps**:
1. Read `isdlc.md` start action section
2. Search for a comment or note explaining the reuse mechanism

**Expected Result**: The section or nearby text explains that `start` intentionally reuses the `feature` workflow rather than having its own `workflows.json` entry.

**Pass Criteria**: The text contains an explanation of the reuse design decision (not just usage instructions).

---

## TC-NFR1: Backward Compatibility

Tests verifying backward compatibility with old BACKLOG.md format (NFR-1).

### TC-NFR1-01: Fallback to CLAUDE.md documented

**Traces to**: NFR-1
**Priority**: P1
**Type**: Content verification

**Steps**:
1. Read BACKLOG PICKER section
2. Verify backward compatibility instruction for missing BACKLOG.md

**Expected Result**: The section describes falling back to scanning CLAUDE.md when BACKLOG.md does not exist.

**Pass Criteria**: Text contains fallback instruction mentioning `CLAUDE.md` and `BACKLOG.md` absence.

---

### TC-NFR1-02: Old format still parseable

**Traces to**: NFR-1
**Priority**: P1
**Type**: Content verification

**Steps**:
1. Read BACKLOG PICKER section
2. Verify the `- N.N [ ] <text>` pattern handles items without `->` suffix

**Expected Result**: The pattern captures items regardless of whether they have a suffix (suffix stripping is conditional, not mandatory).

**Pass Criteria**: The scan pattern is `- N.N [ ] <text>` (captures everything), and the stripping step is an additional operation that handles the no-suffix case gracefully.

---

## TC-NFR2: No Regression

Tests verifying no existing tests are broken (NFR-2).

### TC-NFR2-01: ESM tests still pass

**Traces to**: NFR-2
**Priority**: P1
**Type**: Execution verification (validated in Phase 16)

**Steps**:
1. Run `npm test`
2. All ESM tests pass

**Expected Result**: Zero failures in ESM stream.

**Pass Criteria**: Exit code 0.

---

### TC-NFR2-02: CJS tests still pass

**Traces to**: NFR-2
**Priority**: P1
**Type**: Execution verification (validated in Phase 16)

**Steps**:
1. Run `npm run test:hooks`
2. All CJS tests pass

**Expected Result**: Zero failures in CJS stream.

**Pass Criteria**: Exit code 0.

---

## TC-CROSS: Cross-Reference Consistency

Tests verifying Phase A output format matches picker stripping target.

### TC-CROSS-01: Phase A format matches picker strip pattern

**Traces to**: FR-1, FR-2
**Priority**: P0
**Type**: Cross-file content verification

**Steps**:
1. Read `isdlc.md` and extract the Phase A index entry format (line ~257)
2. Read `00-sdlc-orchestrator.md` and extract the suffix stripping instruction
3. Verify the suffix generated by Phase A is the same suffix stripped by the picker

**Expected Result**: The `-> [requirements](docs/requirements/{slug}/)` suffix from Phase A is recognized by the picker's stripping instruction.

**Pass Criteria**: The Phase A template contains `-> [requirements]` and the picker's strip instruction targets `-> [requirements]`.

---

### TC-CROSS-02: Fix mode scan also strips suffix

**Traces to**: FR-1, FR-2
**Priority**: P0
**Type**: Content verification

**Steps**:
1. Read `00-sdlc-orchestrator.md` Fix Mode Sources section
2. Verify suffix stripping applies to fix mode scan as well as feature mode

**Expected Result**: The fix mode scan (line ~312 area) also includes suffix stripping, not just the feature mode scan.

**Pass Criteria**: The fix mode section references or inherits the suffix stripping behavior.

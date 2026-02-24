# Non-Functional Requirements Matrix

## REQ-0002: PowerShell Scripts for Windows

| NFR ID | Category | Requirement | Metric | Measurement Method | Priority |
|--------|----------|-------------|--------|-------------------|----------|
| NFR-001 | Compatibility | PowerShell version support | Works on PS 5.1+ AND PS 7+ | Test on Windows PowerShell 5.1 and pwsh 7.x | Must Have |
| NFR-002 | Functional Parity | Feature equivalence with bash scripts | 100% feature coverage | Side-by-side comparison checklist against install.sh, uninstall.sh, update.sh | Must Have |
| NFR-003 | Performance | Installation time | Within 2x of bash equivalent | Time comparison on equivalent hardware | Should Have |
| NFR-004 | Safety | Uninstall file scope | Zero user file deletions outside manifest | Diff project tree before/after uninstall; verify only manifest files removed | Must Have |
| NFR-005 | Preservation | Update artifact survival | 100% of user artifacts preserved | Hash comparison of state.json, constitution.md, CLAUDE.md, settings.local.json, providers.yaml before/after update | Must Have |
| NFR-006 | Error Handling | Graceful failure with clear messages | No partial installations on failure; all errors produce actionable messages | Error injection testing (missing dirs, corrupt JSON, permission denied) | Must Have |
| NFR-007 | Dependencies | No external PowerShell modules | Zero Gallery module imports | Static analysis of script imports; grep for Import-Module/Install-Module | Must Have |

## REQ-0013: Supervised Mode

| NFR ID | Category | Requirement | Metric | Measurement Method | Priority |
|--------|----------|-------------|--------|-------------------|----------|
| NFR-013-01 | Compatibility | Backward compatibility when disabled | 100% existing tests pass with no supervised_mode config | Run full test suite (CJS + ESM) with supervised_mode absent or disabled | Must Have |
| NFR-013-02 | Reliability | Fail-open on configuration errors | Framework never crashes or blocks due to malformed supervised_mode config | Fuzz testing with invalid config values (missing fields, wrong types, corrupt JSON) | Must Have |
| NFR-013-03 | Performance | Summary generation time | < 10 seconds for phases with up to 50 file changes | Timing instrumentation during integration tests | Should Have |
| NFR-013-04 | Reliability | State integrity during review pause | state.json always reflects current review status; no orphaned review states | Kill session during review, restart, verify state recovery | Must Have |
| NFR-013-05 | Reliability | Redo circuit breaker | Redo count never exceeds 3 per phase per workflow run | Unit test with redo counter validation | Must Have |
| NFR-013-06 | Maintainability | No new dependencies | Zero new npm packages; zero new agent or skill files | Diff comparison of package.json and agent/skill directories | Must Have |

## REQ-0024: Gate Requirements Pre-Injection

| NFR ID | Category | Requirement | Metric | Measurement Method | Priority |
|--------|----------|-------------|--------|-------------------|----------|
| NFR-024-01 | Reliability | Fail-open on any error | Returns empty string ("") on missing files, parse errors, malformed JSON, missing fields, permission errors. Never throws. | Unit tests for each error scenario: missing file, invalid JSON, empty file, missing phase key, missing fields | Must Have |
| NFR-024-02 | Performance | Block generation time | Under 100ms for any phase configuration (synchronous file reads) | Timing assertions in unit tests | Should Have |
| NFR-024-03 | Maintainability | Single source of truth | Reads the same config files hooks read: iteration-requirements.json, artifact-paths.json, constitution.md | Code review confirms file paths match gate-blocker.cjs, iteration-corridor.cjs, constitution-validator.cjs | Must Have |
| NFR-024-04 | Compatibility | Backward compatible delegation prompts | Existing prompts unchanged when utility unavailable or returns empty. Block is appended additively. | Integration tests verify prompt structure with and without GATE REQUIREMENTS block | Must Have |
| NFR-024-05 | Maintainability | Module system consistency | Utility is CJS (.cjs) in src/claude/hooks/lib/ using module.exports and require() | File extension check and static analysis of module syntax | Must Have |

## REQ-0033: Wire Skill Index Block Injection and Unify Skill Injection

| NFR ID | Category | Requirement | Metric | Measurement Method | Priority |
|--------|----------|-------------|--------|-------------------|----------|
| NFR-033-01 | Performance | Skill index block formatting stays within prompt size limits | <= 30 lines for 14 entries (formatSkillIndexBlock spec) | Count output lines per agent with most skills | Must Have |
| NFR-033-02 | Performance | Skill injection does not add significant latency to phase delegation | < 5 seconds total for built-in + external injection | Time STEP 3d execution with and without injection | Should Have |
| NFR-033-03 | Reliability | Fail-open is the default for ALL injection paths | 0 delegation failures caused by skill injection errors | Monitor phase delegation success rate across workflows | Must Have |
| NFR-033-04 | Maintainability | Injection instructions in isdlc.md are self-documenting | No separate documentation needed to understand injection process | Code review confirms clarity of imperative instructions | Should Have |
| NFR-033-05 | Compatibility | Injection works in both single-project and monorepo modes | Tested in both configurations with correct path resolution | Manual verification in each mode | Must Have |
| NFR-033-06 | Compatibility | External skill content does not exceed 10,000 characters per skill | Auto-truncation with reference fallback for oversized skills | Content length check in injection logic | Must Have |

## REQ-0001: Unified SessionStart Cache (GH #91)

| NFR ID | Category | Requirement | Metric | Measurement Method | Priority |
|--------|----------|-------------|--------|-------------------|----------|
| NFR-001-01 | Performance | Static file reads per 9-phase workflow reduced to fallback-only | < 10 reads of static content per full workflow (down from ~200-340) | Instrumented test run comparing read counts before and after | Must Have |
| NFR-001-02 | Performance | Roundtable cold-start time dramatically reduced | First-response time < 1 minute (down from ~5 minutes) | Timed execution of roundtable analysis with cache vs without | Must Have |
| NFR-001-03 | Performance | SessionStart hook completes within timeout | Hook execution < 5000ms | Process timing instrumentation in tests | Must Have |
| NFR-001-04 | Performance | Cache build completes quickly | rebuildSessionCache() < 10 seconds | Timed execution in integration test | Should Have |
| NFR-001-05 | Reliability | All consumers fail-open when cache is absent | Zero unhandled exceptions when cache is deleted, corrupt, or empty | Fault injection tests (delete, corrupt, empty cache) during full workflow | Must Have |
| NFR-001-06 | Reliability | Stale cache is detectable via source hash | Hash mismatch when any source file is modified after cache build | Unit test that modifies source file mtime and checks hash comparison | Should Have |
| NFR-001-07 | Maintainability | Cache sections use clear parseable delimiters | Each section extractable via simple regex or string search | Unit test that extracts each section by delimiter | Must Have |
| NFR-001-08 | Compatibility | Hook uses CommonJS (.cjs) per project convention | File extension is .cjs; uses require() and module.exports | Code review and linting | Must Have |
| NFR-001-09 | Resource Constraint | Cache file fits within context window budget | session-cache.md <= ~128K characters | Automated size check in rebuildSessionCache() with warning on breach | Must Have |
| NFR-001-10 | Compatibility | Existing workflows work identically without cache | Full workflow completes successfully with cache file deleted | End-to-end workflow test with cache removed | Must Have |

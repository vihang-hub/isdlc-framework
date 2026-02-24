# Non-Functional Requirements Matrix: Roundtable Analysis Agent

**Feature ID**: REQ-ROUNDTABLE-ANALYST
**Source**: GitHub Issue #20
**Version**: 1.0.0
**Created**: 2026-02-19

---

| NFR ID | Category | Requirement | Metric | Measurement Method | Priority |
|--------|----------|-------------|--------|-------------------|----------|
| NFR-001 | Performance | Step transition time (within phase) | Time from user [C] selection to next step's first prompt < 3 seconds | Measure elapsed time between meta.json write and first output token of next step | Should Have |
| NFR-002 | UX Consistency | Persona switch consistency at phase boundaries | Zero persona-style leakage across boundaries (BA style in Architect phase or vice versa); handoff message present at 100% of transitions | Manual review of phase boundary transcripts; check for presence of handoff messages | Must Have |
| NFR-003 | Resumability | Session recovery on resume | Context recovery (meta.json read + step file load + greeting) completes within 5 seconds; zero loss of completed step data | Time from analyze verb start to first persona output on resumed session; verify all steps_completed entries are preserved | Must Have |
| NFR-004 | Extensibility | New step discovery | New step file discovered and executed on next run without agent modification; zero changes to roundtable-analyst.md required to add a step | Add a step file, run analysis, verify it appears in execution sequence | Should Have |
| NFR-005 | Backward Compatibility | Fallback to standard agents | Analyze verb works identically when roundtable-analyst.md is absent; build auto-detection produces identical results for roundtable-produced artifacts | Remove roundtable agent file, run analyze verb, verify standard agents are used; run build on roundtable artifacts, verify phase-skip works | Must Have |
| NFR-006 | UX Quality | Conversational naturalness | Open-ended questions (not yes/no); acknowledgment of user responses before proceeding; brief mode uses draft-for-confirmation pattern | Manual review of conversation transcripts for question style, acknowledgment presence, and brief mode behavior | Should Have |

---

## Measurement Notes

### NFR-001: Step Transition Performance
- **Baseline**: Current phase transitions in the analyze verb take 1-3 seconds (phase boundary only). Step transitions are new and should be lighter-weight.
- **Risk**: Step files are markdown read from disk, not compiled. File I/O should be negligible. The primary cost is the Task tool round-trip for meta.json update.

### NFR-002: Persona Switch Consistency
- **Validation approach**: Review the first 3 messages from each persona after a transition. Check that communication style descriptors match the persona definition.
- **Edge case**: If the user asks a question that spans persona domains (e.g., asking about architecture during requirements), the current persona should acknowledge the cross-domain nature and flag it for the next persona.

### NFR-003: Session Resumability
- **Baseline**: Current phase-level resumability takes < 2 seconds (meta.json read + phase determination). Step-level adds steps_completed parsing.
- **Data preservation**: The `steps_completed` array and artifact files are the dual recovery mechanism. Steps persist artifacts before marking complete.

### NFR-004: Extensibility
- **Validation approach**: Create a test step file in a phase directory. Run the agent. Verify the step appears in execution order. Remove the file. Verify the agent runs without error.
- **Constraint**: Step files must have valid YAML frontmatter. Invalid frontmatter causes a warning, not a crash (graceful degradation).

### NFR-005: Backward Compatibility
- **Critical path**: The build verb reads `meta.phases_completed` and `meta.analysis_status`. Both fields MUST be set identically whether the roundtable agent or standard agents produced the artifacts.
- **Test approach**: Run full analysis with roundtable agent, then immediately run `/isdlc build` and verify auto-detection works correctly.

### NFR-006: Conversational UX Quality
- **Quality indicators**: Questions should start with "What", "How", "Why", "Tell me about" -- not "Do you", "Is there", "Does it". Acknowledgments should reference specific content from the user's response.
- **Brief mode indicator**: In brief mode, the persona should present a draft and ask "Sound right?" rather than starting with open-ended discovery questions.

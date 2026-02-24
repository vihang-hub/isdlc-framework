# Non-Functional Requirements Matrix: Elaboration Mode

**Feature ID**: REQ-GH21-ELABORATION-MODE
**Source**: GitHub Issue #21

---

| NFR ID | Category | Requirement | Metric | Measurement Method | Priority |
|--------|----------|-------------|--------|-------------------|----------|
| NFR-001 | Performance | Elaboration mode activation responsiveness | First persona introduction displayed within 3 seconds of [E] selection | Manual observation during acceptance testing | Should Have |
| NFR-002 | Usability | Persona voice distinctiveness during multi-persona discussion | >= 80% correct persona identification in blind review of elaboration transcripts (based on communication style alone, without reading attribution prefix) | Manual review of 5 elaboration transcripts by a developer not involved in implementation | Must Have |
| NFR-003 | Reliability | Synthesis completeness -- all decisions captured | Zero decisions made during elaboration are missing from the synthesis summary | Comparison of synthesis output against full discussion transcript during acceptance testing | Must Have |
| NFR-004 | Reliability | Artifact integrity after synthesis -- no data loss | Pre-elaboration artifact content is fully preserved; diff shows additions only, zero deletions of pre-existing content | Diff analysis of artifact files before and after elaboration synthesis | Must Have |
| NFR-005 | Reliability | Session resume after elaboration | After elaboration on step N, session resume starts at correct next step; elaboration records in meta.json are preserved across sessions | Session resume test: complete elaboration, force-quit, resume, verify step position and meta.json integrity | Must Have |
| NFR-006 | Reliability | Turn limit enforcement | No elaboration session exceeds configured max_turns (default: 10); 100% enforcement rate | Turn counting in elaboration records in meta.json; automated verification | Should Have |
| NFR-007 | Compatibility | Backward compatibility with existing menu behaviors | All existing menu options ([C] Continue, [S] Skip, natural language input) work identically before and after elaboration implementation; zero regressions | Regression testing of complete menu system: [C], [S], [E], natural input, phase boundary variant | Must Have |

---

## Compliance Requirements

No specific compliance requirements (GDPR, HIPAA, SOC2, PCI-DSS) apply to this feature. Elaboration mode is an interaction enhancement within a local development tool that does not process user data, financial data, or health records.

---

## Quality Attribute Priority Ranking

1. **Reliability** (NFR-003, NFR-004, NFR-005): Elaboration must not corrupt artifacts or break session management. This is the highest priority because data loss in analysis artifacts would undermine trust in the entire framework.
2. **Usability** (NFR-002): Distinct persona voices are the core value proposition. If personas sound alike, elaboration provides no advantage over single-persona deep mode.
3. **Compatibility** (NFR-007): The existing menu system must work identically. Any regression in [C] or [S] behavior would break all users, not just those using elaboration.
4. **Performance** (NFR-001): Responsiveness matters for UX but is lower priority because analysis is an inherently interactive (not latency-sensitive) workflow.
5. **Reliability - Turn Limits** (NFR-006): Important guardrail but the lead persona can manually wrap up discussions even without hard enforcement.

# Requirements Specification: REQ-0042 Session Cache Markdown Tightening

**Status**: Draft
**Confidence**: High
**Last Updated**: 2026-02-26
**Coverage**: Business Context, Stakeholders, User Journeys, Technical Context, Quality Attributes, Functional Requirements, Out of Scope, MoSCoW

---

## 1. Business Context

### Problem Statement

The session cache consumes ~44% of the context window after `/clear`. Three markdown sections account for 63% of the cache (109,978 chars out of 177,704 total):

| Section | Chars | % of Cache |
|---------|-------|------------|
| ROUNDTABLE_CONTEXT | 47,092 | 26.5% |
| SKILL_INDEX | 39,866 | 22.4% |
| DISCOVERY_CONTEXT | 22,814 | 12.8% |
| **Total markdown** | **109,772** | **61.8%** |

REQ-0041 attempted to reduce the JSON sections via TOON encoding (~9.4% character reduction), but in practice the savings did not translate to real context window reduction -- the LLM tokenizer appears to expand the compact TOON format back to a similar token count. Therefore, the full 25-30% cache reduction target must be achieved by this item alone through markdown tightening.

### Success Metrics

- Total cache reduction of 25-30% from REQ-0042 alone (~44K-53K chars saved)
- Per-section reduction targets: SKILL_INDEX 50%+, ROUNDTABLE_CONTEXT 40%+, DISCOVERY_CONTEXT 40%+
- Zero information loss: every distinct fact present in verbose version is present in tightened version
- No degradation in agent performance (validated through usage observation)

### Driving Factors

- Context window budget is constrained; every character consumed by the cache reduces space available for the user's actual conversation
- Longer caches slow down first-token latency and increase cost per conversation turn
- The session cache is injected into every conversation, making efficiency gains multiply across all usage
- REQ-0041 TOON encoding did not produce measurable context window savings in practice, making markdown tightening the sole viable approach

### Cost of Inaction

Without tightening, the session cache will continue to consume ~44% of the context window, leaving less room for conversation history and artifacts as the framework grows. REQ-0041 has demonstrated that character-level compression alone is insufficient -- structural removal of redundant content is required.

### Dependency Note

REQ-0041 (TOON encoder) should still land first as it is already implemented, but the combined savings target is no longer assumed. REQ-0042 is self-sufficient for the 25-30% reduction goal.

## 2. Stakeholders and Personas

### Primary User: Framework Developer

- **Role**: Develops and maintains the iSDLC framework
- **Goals**: Maximize available context window for development conversations
- **Pain Points**: Cache consumes nearly half the context window; verbose formatting wastes tokens on structural overhead rather than information content
- **Proficiency**: High -- understands the cache architecture and can evaluate tightening quality

### Secondary User: Framework End User

- **Role**: Uses iSDLC to manage software projects
- **Goals**: Responsive agents with full project knowledge
- **Pain Points**: Indirectly affected by context pressure -- longer caches mean agents lose conversational context sooner
- **Proficiency**: Variable -- unaware of the cache mechanism; perceives it through agent quality

### Automated Consumer: LLM Agents

- **Role**: Parse and act on session cache content
- **Goals**: Extract structured information (skill IDs, persona instructions, project context) from the cache
- **Pain Points**: Verbose formatting consumes token budget without adding signal; repeated banners waste attention
- **Consumption Patterns**:
  - SDLC orchestrator: Extracts persona and topic content from ROUNDTABLE_CONTEXT via `### Persona:` and `### Topic:` heading delimiters
  - Phase agents: Read SKILL_INDEX to locate available skills by ID and path
  - Roundtable lead: Receives persona/topic content via dispatch prompt (does not read cache directly)
  - Various agents: Read DISCOVERY_CONTEXT for project architecture and test health knowledge

## 3. User Journeys

### Journey 1: Cache Rebuild

1. Developer runs `node bin/rebuild-cache.js` or cache is rebuilt automatically
2. `rebuildSessionCache()` reads source files (persona .md, topic .md, skills manifest, discovery report)
3. **NEW**: Tightening functions transform each section's content during assembly
4. Assembled cache is written to `.isdlc/session-cache.md`
5. Developer can verify reduction via `--verbose` flag (reports section sizes)

### Journey 2: Session Start (Cache Injection)

1. User starts a Claude Code conversation
2. `inject-session-cache.cjs` hook reads `.isdlc/session-cache.md`
3. Full cache content is output to stdout and injected into LLM context
4. Agent parses sections using `<!-- SECTION: ... -->` delimiters
5. Agent behavior is identical to verbose cache -- same skills found, same persona voices, same project knowledge

### Journey 3: Roundtable Analysis Dispatch

1. Orchestrator receives session cache in context
2. Orchestrator checks for `<!-- SECTION: ROUNDTABLE_CONTEXT -->` in cache
3. Orchestrator extracts persona content by splitting on `### Persona:` headings
4. Orchestrator extracts topic content by splitting on `### Topic:` headings
5. Extracted content is inlined into dispatch prompt as PERSONA_CONTEXT and TOPIC_CONTEXT
6. Roundtable lead parses inlined content and adopts persona voices
7. **Requirement**: Tightened persona content must preserve all voice-critical sections (Identity, Principles, Voice Integrity, Interaction Style, compacted Self-Validation)

## 4. Technical Context

### Existing Architecture

- `rebuildSessionCache()` in `src/claude/hooks/lib/common.cjs` (line 4093) is the single assembly point
- `buildSection(name, contentFn)` wraps each section with `<!-- SECTION: ... -->` delimiters
- `formatSkillIndexBlock()` (line 1624) formats per-agent skill blocks
- `inject-session-cache.cjs` is the injection hook -- reads and outputs the cache file, self-contained
- REQ-0041 added TOON encoding for JSON sections via `buildJsonSection()` helper (character savings confirmed but token-level savings unproven)

### Integration Points

- Source files on disk remain unchanged (persona .md, topic .md, discovery report)
- Transformations happen inside `rebuildSessionCache()` during content assembly
- `formatSkillIndexBlock()` output format change affects all agents that parse SKILL_INDEX
- Orchestrator extraction logic depends on `### Persona:` and `### Topic:` heading delimiters in ROUNDTABLE_CONTEXT
- `<!-- SECTION: ... -->` / `<!-- /SECTION: ... -->` delimiters must remain unchanged

### Conventions and Patterns

- Fail-open pattern: errors in tightening should fall through to verbose content, never to empty output
- CJS module system for hooks and common.cjs
- Single-line Bash convention for all scripts
- Existing test baseline: 555+ tests (302 ESM lib + 253 CJS hook tests)

## 5. Quality Attributes and Risks

### Quality Attributes

| Attribute | Priority | Threshold |
|-----------|----------|-----------|
| Information Completeness | Critical | Every distinct fact in verbose version present in tightened version |
| Cache Size Reduction | Critical | 25-30% reduction from REQ-0042 alone (44K-53K chars) |
| Fail-Open Safety | High | Any tightening error falls through to verbose content |
| Parse Compatibility | High | All downstream consumers (orchestrator, agents) parse tightened output correctly |
| Performance | Medium | No measurable increase in `rebuildSessionCache()` execution time |
| Maintainability | Medium | Tightening functions are individually testable and independently adjustable |

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| R-001: Persona voice degradation from over-trimming | Medium | High | Keep Identity, Principles, Voice Integrity, Interaction Style intact; only strip sections confirmed redundant with roundtable lead's system prompt |
| R-002: Orchestrator extraction breaks on changed heading format | Low | Critical | Preserve `### Persona:` and `### Topic:` delimiters exactly; add regression test for extraction pattern |
| R-003: Agent fails to find skill by path after format change | Medium | High | Ensure skill ID and shortened path remain present in tightened SKILL_INDEX format; add test for parsability |
| R-004: Discovery context loses critical project knowledge | Low | Medium | Preserve all table data and key metrics; strip only prose paragraphs |
| R-005: Reduction falls short of 25-30% target | Medium | High | Track per-section savings during implementation; each section has an aggressive target to ensure combined 25-30% is achievable |
| R-006: Aggressive tightening degrades agent behavior | Medium | High | Validate through real usage; tightening functions can be individually adjusted or disabled via fail-open pattern without code changes |

## 6. Functional Requirements

### FR-001: SKILL_INDEX Banner Deduplication

**Confidence**: High

Tighten the SKILL_INDEX section by moving the "AVAILABLE SKILLS (consult when relevant using Read tool):" instruction to a single header at the top of the section, eliminating per-agent repetition.

- **AC-001-01**: The instruction banner appears exactly once at the top of the SKILL_INDEX section, not once per agent block
- **AC-001-02**: Each agent block retains its `## Agent: {name}` heading followed by skill entries
- **AC-001-03**: The tightened SKILL_INDEX section is smaller than the verbose version by at least 2,000 chars

### FR-002: SKILL_INDEX Compact Skill Format

**Confidence**: High

Convert the two-line-per-skill format (ID+description line, path line) into a single-line format with pipe separator. Shorten the path by establishing a base path convention in the section header, emitting only the relative `{category}/{name}` portion per skill.

- **AC-002-01**: Each skill entry is a single line in the format: `{ID}: {name} | {description} | {category}/{name}`
- **AC-002-02**: The section header includes the base path: `Base: src/claude/skills/{category}/{name}/SKILL.md`
- **AC-002-03**: All skill entries (ID, name, description) from the verbose format are present; the full path is reconstructable from base + relative
- **AC-002-04**: The combined effect of FR-001 and FR-002 reduces the SKILL_INDEX section by at least 50% (at least 20,000 chars saved)

### FR-003: ROUNDTABLE_CONTEXT Persona Section Stripping

**Confidence**: High

Strip persona file sections that are redundant with the roundtable lead's system prompt during cache assembly. Sections to strip: 4 (Analytical Approach -- covered by topic files), 6 (Artifact Responsibilities), 8 (Artifact Folder Convention), 9 (Meta.json Protocol), 10 (Constraints).

- **AC-003-01**: Tightened persona content does NOT contain sections titled "Analytical Approach", "Artifact Responsibilities", "Artifact Folder Convention", "Meta.json Protocol (Agent Teams Mode)", or "Constraints"
- **AC-003-02**: Tightened persona content DOES contain sections titled "Identity", "Principles", "Voice Integrity Rules", "Interaction Style"
- **AC-003-03**: The `### Persona:` heading delimiter is preserved for orchestrator extraction
- **AC-003-04**: YAML frontmatter is stripped from persona content (the roundtable lead does not need it)

### FR-004: ROUNDTABLE_CONTEXT Self-Validation Compaction

**Confidence**: High

Compact section 7 (Self-Validation Protocol) by merging the "before writing" and "before finalization" checklists into a single condensed checklist per persona.

- **AC-004-01**: Self-Validation content is present as a single merged checklist (not two separate sections)
- **AC-004-02**: All validation criteria from both original checklists are represented (possibly in more concise wording)
- **AC-004-03**: The roundtable lead can still reference validation criteria by persona (the content remains within each persona's block)
- **AC-004-04**: The combined effect of FR-003 and FR-004 reduces per-persona content by at least 50% (roughly 2,500-3,000 chars per persona, ~7,500-9,000 total across 3 personas)

### FR-005: ROUNDTABLE_CONTEXT Topic File Tightening

**Confidence**: High

Strip YAML frontmatter and depth_guidance/source_step_files metadata from topic files during cache assembly, retaining only the Analytical Knowledge, Validation Criteria, and Artifact Instructions sections.

- **AC-005-01**: Topic content in the cache does NOT contain YAML frontmatter blocks
- **AC-005-02**: Topic content in the cache does NOT contain `depth_guidance` or `source_step_files` metadata
- **AC-005-03**: Topic content DOES retain "Analytical Knowledge", "Validation Criteria", and "Artifact Instructions" sections
- **AC-005-04**: The `### Topic:` heading delimiter is preserved for orchestrator extraction
- **AC-005-05**: The combined effect of FR-003 through FR-005 reduces the ROUNDTABLE_CONTEXT section by at least 40% (at least 19,000 chars saved)

### FR-006: DISCOVERY_CONTEXT Aggressive Prose Stripping

**Confidence**: High

Strip all prose paragraphs from the DISCOVERY_CONTEXT section during cache assembly. Preserve all table data, all headings, and all list items. The resulting section contains only structured content (headings, tables, lists) with no narrative prose.

- **AC-006-01**: All tables (architecture overview, tech stack, test health dashboard, and any other markdown tables) are preserved verbatim
- **AC-006-02**: All headings (lines starting with `#`) are preserved verbatim
- **AC-006-03**: All list items (lines starting with `- ` or `* ` or numbered) are preserved
- **AC-006-04**: Prose paragraphs (blocks of text that are not headings, tables, or list items) are removed
- **AC-006-05**: The DISCOVERY_CONTEXT section is reduced by at least 40% (at least 9,000 chars saved)

### FR-007: Fail-Open Tightening Safety

**Confidence**: High

Each tightening function must fail open: if any transformation error occurs, the original verbose content is used instead. No section should ever be empty or corrupted due to a tightening failure.

- **AC-007-01**: Each tightening function is wrapped in try/catch that returns the original content on any error
- **AC-007-02**: A failed tightening does not prevent other sections from being tightened
- **AC-007-03**: Verbose mode (`--verbose`) logs a warning when a tightening function falls back to verbose content

### FR-008: Reduction Reporting

**Confidence**: High

Report per-section character savings when `rebuildSessionCache()` is called with verbose mode, similar to the existing TOON reduction reporting.

- **AC-008-01**: Verbose mode outputs per-section reduction: `TIGHTEN {section}: {before} -> {after} chars ({pct}% reduction)`
- **AC-008-02**: Verbose mode outputs total markdown reduction summary across all tightened sections
- **AC-008-03**: Reduction statistics are written to stderr (same pattern as TOON reporting)

## 7. Out of Scope

| Item | Reason | Dependency |
|------|--------|------------|
| Modifying source files on disk | Constraint: transformations happen at assembly time only | None |
| TOON encoding for markdown sections | Markdown is not structured data; TOON is for JSON (REQ-0041) | REQ-0041 |
| Conditional section inclusion (omit ROUNDTABLE_CONTEXT when not analyzing) | Valuable but separate optimization -- changes hook behavior | Future REQ |
| CONSTITUTION section tightening | Not identified as a high-value target (15K chars, lower % of total) | None |
| EXTERNAL_SKILLS section tightening | Currently empty/skipped in most installations | None |
| Automated fact-preservation testing | Prose content cannot be mechanically verified; validated through usage observation | None |
| Reversing or modifying REQ-0041 TOON encoding | Out of scope; TOON encoding is harmless even if savings are not realized | REQ-0041 |

## 8. MoSCoW Prioritization

| FR | Title | Priority | Rationale |
|----|-------|----------|-----------|
| FR-001 | SKILL_INDEX Banner Deduplication | Must Have | Highest char savings per effort; straightforward transformation |
| FR-002 | SKILL_INDEX Compact Skill Format | Must Have | Pairs with FR-001 for 50%+ section reduction; path shortening adds ~9.6K savings |
| FR-003 | ROUNDTABLE_CONTEXT Persona Section Stripping | Must Have | Strips redundant sections including Analytical Approach (covered by topic files) |
| FR-004 | ROUNDTABLE_CONTEXT Self-Validation Compaction | Must Have | Completes persona tightening; needed to hit 40%+ section target |
| FR-005 | ROUNDTABLE_CONTEXT Topic File Tightening | Must Have | Strips metadata not used at runtime; needed to hit 40%+ section target |
| FR-006 | DISCOVERY_CONTEXT Aggressive Prose Stripping | Must Have | Aggressive approach needed since REQ-0042 carries the full reduction burden |
| FR-007 | Fail-Open Tightening Safety | Must Have | Non-negotiable safety constraint |
| FR-008 | Reduction Reporting | Should Have | Developer convenience; essential for verifying 25-30% target is met |

## Pending Sections

None -- all sections complete.

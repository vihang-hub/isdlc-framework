# Component Interactions: Roundtable Analysis Agent

**Feature ID**: REQ-ROUNDTABLE-ANALYST (GH-20)
**Phase**: 03-architecture
**Date**: 2026-02-19

This document contains detailed sequence diagrams and interaction specifications for the key flows in the roundtable analysis agent system.

---

## 1. Full Analysis Session Flow (Happy Path)

This diagram shows a complete analysis session from invocation through Phase 01 completion, including step execution, menu interaction, and meta.json updates.

```mermaid
sequenceDiagram
    participant U as User
    participant I as isdlc.md<br/>(Analyze Handler)
    participant R as roundtable-analyst<br/>(Maya Chen - BA)
    participant SF as Step Files<br/>(01-requirements/)
    participant M as meta.json
    participant A as Artifacts<br/>(requirements-spec.md)

    U->>I: /isdlc analyze "my-feature"
    I->>I: resolveItem("my-feature")
    I->>M: readMetaJson(slugDir)
    Note over M: phases_completed: ["00-quick-scan"]<br/>steps_completed: ["00-01","00-02","00-03"]

    I->>I: nextPhase = "01-requirements"
    I->>I: Check: roundtable-analyst.md exists? YES

    I->>R: Task tool delegation:<br/>Phase 01, steps_completed=[...],<br/>depth_overrides={}, scope=medium

    Note over R: Activate Maya Chen (BA) persona<br/>Determine depth: standard (medium scope)

    R->>SF: List analysis-steps/01-requirements/*.md
    Note over SF: 01-business-context.md<br/>02-user-needs.md<br/>... 08-prioritization.md

    R->>R: Filter completed steps (none for Phase 01)
    R->>U: "Hi, I'm Maya Chen, your Business Analyst.<br/>I'll guide you through requirements discovery."

    rect rgb(230, 245, 255)
    Note over R,A: Step 01-01: Business Context Discovery
    R->>U: "What problem does this feature solve?<br/>Who benefits most from it?"
    U->>R: "We need interactive analysis because..."
    R->>R: Validate response (## Validation)
    R->>A: Update requirements-spec.md (## Artifacts)
    R->>M: steps_completed += "01-01"
    R->>U: [E] Elaboration [C] Continue [S] Skip
    U->>R: "C"
    end

    rect rgb(230, 255, 230)
    Note over R,A: Step 01-02: User Needs Discovery
    R->>U: "So the primary users are developers.<br/>What's their biggest pain point today?"
    U->>R: "They get artifacts without input..."
    R->>R: Validate + update artifacts
    R->>M: steps_completed += "01-02"
    R->>U: [E] Elaboration [C] Continue [S] Skip
    U->>R: "C"
    end

    Note over R: Steps 01-03 through 01-08 follow same pattern

    R->>I: Return (Phase 01 complete)

    I->>M: phases_completed += "01-requirements"
    I->>M: writeMetaJson()
    I->>I: updateBacklogMarker()
    I->>U: "Phase 01 complete.<br/>Continue to Phase 02 (Impact Analysis)? [Y/n]"
```

---

## 2. Adaptive Depth Selection Flow

This diagram shows how depth is determined and how user overrides work.

```mermaid
sequenceDiagram
    participant U as User
    participant R as roundtable-analyst
    participant QS as quick-scan.md
    participant M as meta.json

    R->>M: Read depth_overrides
    Note over M: depth_overrides = {} (no override)

    R->>QS: Read quick-scan.md
    Note over QS: Estimated Scope: small<br/>File Count Estimate: 3<br/>Confidence: medium

    R->>R: Map: small -> brief depth

    R->>U: "This looks straightforward. I'll keep<br/>the analysis brief -- say 'deep' if you<br/>want the full treatment."

    rect rgb(255, 245, 230)
    Note over R: Execute step at BRIEF depth
    R->>U: "Based on the quick scan, here are the<br/>3 main requirements I see: {list}.<br/>Sound right, or should we dig deeper?"
    U->>R: "deep"
    end

    R->>R: Switch to DEEP depth
    R->>M: depth_overrides["01-requirements"] = "deep"

    rect rgb(255, 230, 230)
    Note over R: Remaining steps execute at DEEP depth
    R->>U: "Got it, switching to thorough mode.<br/>Let's start from scratch on this topic.<br/>What are all the user roles involved?<br/>What happens in edge cases?"
    U->>R: Detailed response
    end
```

---

## 3. Session Resumption Flow

This diagram shows how a resumed session recovers context and skips completed steps.

```mermaid
sequenceDiagram
    participant U as User
    participant I as isdlc.md
    participant R as roundtable-analyst
    participant M as meta.json
    participant A as Artifacts

    Note over U: User returns next day

    U->>I: /isdlc analyze "my-feature"
    I->>M: readMetaJson()
    Note over M: analysis_status: "partial"<br/>phases_completed: ["00-quick-scan", "01-requirements"]<br/>steps_completed: ["00-01".."00-03", "01-01".."01-08",<br/>"02-01", "02-02"]<br/>depth_overrides: {"02-impact-analysis": "deep"}

    I->>I: nextPhase = "02-impact-analysis"
    I->>I: Check roundtable exists: YES

    I->>R: Task: Phase 02, steps_completed=[...],<br/>depth_overrides={"02-impact-analysis":"deep"}

    Note over R: Activate Alex Rivera (Architect) persona

    R->>M: Read steps_completed for Phase 02
    Note over R: Completed: 02-01, 02-02<br/>Next: 02-03 (risk-zones)

    R->>M: Read depth_overrides["02-impact-analysis"]
    Note over R: Override: "deep"

    R->>A: Read impact-analysis.md (previous work)

    R->>U: "Welcome back. Last time we covered<br/>blast radius assessment and entry point<br/>identification. Let's pick up with risk<br/>zone analysis."
    R->>U: "(Using thorough analysis mode as<br/>you requested last session.)"

    R->>R: Resume from step 02-03 at deep depth
```

---

## 4. Persona Transition at Phase Boundary

This diagram shows the handoff between Maya (BA, Phase 01) and Alex (Architect, Phase 02).

```mermaid
sequenceDiagram
    participant U as User
    participant I as isdlc.md
    participant R_Maya as roundtable-analyst<br/>(Maya - Task 1)
    participant R_Alex as roundtable-analyst<br/>(Alex - Task 2)
    participant M as meta.json
    participant A as Artifacts

    Note over R_Maya: Maya completes final step of Phase 01

    R_Maya->>A: Write final requirements-spec.md updates
    R_Maya->>M: steps_completed += "01-08"
    R_Maya->>U: [C] Continue to Phase 02 (Impact Analysis)
    U->>R_Maya: "C"
    R_Maya->>I: Return (phase complete)

    Note over I: Task 1 context destroyed

    I->>M: phases_completed += "01-requirements"
    I->>M: writeMetaJson()
    I->>U: "Phase 01 complete.<br/>Continue to Phase 02? [Y/n]"
    U->>I: "Y"

    Note over I: New Task invocation = fresh context

    I->>R_Alex: Task: Phase 02 (02-impact-analysis)

    Note over R_Alex: Fresh context: Alex Rivera (Architect)<br/>No Maya state leakage (separate Task)

    R_Alex->>A: Read requirements-spec.md (Maya's output)
    R_Alex->>R_Alex: Summarize Maya's requirements

    R_Alex->>U: "Maya Chen has finished requirements<br/>discovery. Handing off to Alex Rivera<br/>(Solutions Architect) who will assess<br/>the impact and design the architecture."
    R_Alex->>U: "I've reviewed Maya's requirements spec.<br/>Here's what I'm working with:<br/>{brief summary of key requirements}"

    R_Alex->>R_Alex: Begin Phase 02 step execution
```

---

## 5. Step Menu Interaction Patterns

### 5.1 Continue Flow
```
User sees:
  [E] Elaboration Mode -- bring all perspectives to discuss this topic
  [C] Continue -- move to the next step
  [S] Skip remaining steps in this phase
  Or type naturally to provide feedback.

User types: "C"
Agent: Advances to next step. Loads next step file. Presents prompt.
```

### 5.2 Natural Language Flow
```
User sees: (same menu)
User types: "What about edge cases when the network is down?"

Agent: Incorporates feedback into current step analysis.
       Updates artifacts if the feedback changes requirements.
       Re-presents the same step menu after processing.
```

### 5.3 Elaboration Stub Flow
```
User sees: (same menu)
User types: "E"

Agent: "Elaboration mode is coming in a future update (#21).
       For now, I'll go deeper on this topic myself."
       Switches current step to "deep" mode.
       Re-engages with more probing questions.
```

### 5.4 Skip Flow
```
User sees: (same menu)
User types: "S"

Agent: Marks all remaining steps in current phase as skipped.
       Does NOT add them to steps_completed (they were skipped, not completed).
       Returns to isdlc.md handler (phase complete).
```

### 5.5 Final Step of Phase
```
User sees:
  [E] Elaboration Mode -- bring all perspectives to discuss this topic
  [C] Continue to Phase 02 (Impact Analysis)
  Or type naturally to provide feedback.

Note: [S] is not shown on the final step (nothing to skip).
Note: [C] label changes to show next phase name (FR-007 AC-007-05).
```

---

## 6. Step File Execution Detail

### Step File Loading

```
roundtable-analyst receives: phase_key = "01-requirements"

1. Resolve path: src/claude/skills/analysis-steps/01-requirements/
2. List directory contents (Read tool or Glob)
3. Filter: *.md files only
4. Sort: lexicographic by filename (01- < 02- < ... < 08-)
5. Parse each file's YAML frontmatter
6. Build execution queue:
   [
     { step_id: "01-01", title: "Business Context", depth: "standard", ... },
     { step_id: "01-02", title: "User Needs", depth: "standard", ... },
     ...
     { step_id: "01-08", title: "Prioritization", depth: "brief", ... }
   ]
7. Filter out completed steps (step_id in steps_completed)
8. Execute remaining steps in order
```

### Step File Body Section Selection

The roundtable agent selects which body section to execute based on the active depth:

| Active Depth | Section Used | Behavior |
|-------------|-------------|----------|
| brief | `## Brief Mode` | Present draft summary for confirmation |
| standard | `## Standard Mode` | Multi-question discovery |
| deep | `## Deep Mode` | Extended probing with follow-ups |

If the selected section is missing from a step file, fall back to `## Standard Mode`. If that is also missing, use the entire body as the prompt.

### Step Completion Protocol

After each step:
1. Execute `## Validation` section criteria against user responses
2. Execute `## Artifacts` section instructions (update output files)
3. Append `step_id` to `meta.steps_completed` array
4. Write meta.json via `writeMetaJson()`
5. Present step menu

This ensures that if the session is interrupted between steps, all completed work is persisted.

---

## 7. Error Handling Flows

### 7.1 Invalid Step File Frontmatter

```
Agent loads step file -> YAML parse fails

Action:
1. Log warning: "Step file {filename} has invalid frontmatter. Skipping."
2. Do NOT add step_id to steps_completed
3. Continue to next step file
4. The skipped step will be retried on next session (not in steps_completed)
```

### 7.2 Step File Directory Empty

```
Agent lists analysis-steps/{phase_key}/ -> No .md files found

Action:
1. Log info: "No step files found for phase {phase_key}."
2. Return to isdlc.md (phase treated as complete with no steps)
3. Phase is added to phases_completed by isdlc.md
```

### 7.3 meta.json Write Failure

```
writeMetaJson() throws (e.g., disk full, permissions)

Action:
1. Log error: "Failed to write meta.json: {error}"
2. Step work is lost for resumability purposes
3. Artifact file updates may have already been written (partial state)
4. User is informed: "Warning: progress tracking failed. Your artifacts
   were updated but the session may not resume correctly."
5. Continue to next step (do not abort the session)
```

### 7.4 Artifact Folder Missing

```
Agent attempts to write artifact -> folder does not exist

Action:
1. Create the folder (mkdir -p equivalent)
2. Write the artifact
3. This should not normally occur because isdlc.md creates the folder
   during the add verb, but defensive creation prevents failure
```

---

## 8. Data Integrity Guarantees

| Operation | Guarantee | Mechanism |
|-----------|-----------|-----------|
| Step completion | At-most-once recording | step_id appended after artifact write, before menu |
| Artifact updates | Last-writer-wins | Single-threaded execution (one step at a time) |
| meta.json consistency | analysis_status derived from phases_completed | writeMetaJson() enforces derivation |
| Phase completion | Recorded by isdlc.md after roundtable returns | Separate write from step-level tracking |
| Depth override persistence | Written at time of override | Immediate write to meta.json |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-02-19 | Solution Architect (Phase 03) | Initial component interactions |

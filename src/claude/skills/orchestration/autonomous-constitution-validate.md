---
name: autonomous-constitution-validate
description: Enable agents to autonomously iterate on artifacts until constitutional compliance is achieved
skill_id: ORCH-011
owner: sdlc-orchestrator
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Gate validation, constitutional compliance checking
dependencies: []
---

# Autonomous Constitution Validation

**Category**: Orchestration
**Agents**: All 14 agents (Orchestrator enforces, Phase agents iterate)
**Phases**: All phases with quality gates (GATE-01 through GATE-13)
**Purpose**: Enable agents to autonomously iterate on artifacts until constitutional compliance is achieved

---

## Skill Description

This skill extends the Ralph Wiggum-inspired autonomous iteration mechanism to **constitutional compliance validation**. When artifacts violate constitutional principles at a gate check, the responsible agent automatically:

1. Analyzes which constitutional articles were violated
2. Identifies the specific violations in artifacts
3. Fixes the artifacts to comply
4. Re-validates until compliance is achieved OR max iterations reached

This prevents immediate gate failure and enables self-correcting behavior for constitutional compliance.

---

## When to Use

### At Every Quality Gate (GATE-01 through GATE-13)

After an agent completes their phase work:
1. Agent performs self-validation including constitutional compliance
2. If violations found → iterate and fix
3. Report to orchestrator only when compliant OR max iterations exceeded

### During Artifact Creation

Agents should proactively validate constitutional compliance as they create artifacts, not just at the gate.

---

## Constitutional Articles Reference

The constitution at `.isdlc/constitution.md` typically contains these articles (project-specific):

| Article | Principle | Primary Validators |
|---------|-----------|-------------------|
| **I** | Specification Primacy | Agents 01, 03, 05 |
| **II** | Test-First Development | Agents 04, 05, 06 |
| **III** | Security by Design | Agents 02, 05, 08 |
| **IV** | Explicit Over Implicit | Agents 01, 02, 03 |
| **V** | Simplicity First | Agents 02, 03, 05, 07 |
| **VI** | Code Review Required | Agents 05, 07 |
| **VII** | Artifact Traceability | All agents |
| **VIII** | Documentation Currency | Agents 05, 07, 10, 13 |
| **IX** | Quality Gate Integrity | Orchestrator, all agents |
| **X** | Fail-Safe Defaults | Agents 02, 05, 08 |
| **XI** | Integration Testing Integrity | Agents 04, 06 |
| **XII** | Domain-Specific Compliance | Agents 01, 08, 13 |

---

## Iteration Protocol

### 1. Initialization

```
iteration_count = 0
max_iterations = 5  # Constitutional iterations are separate from test iterations
articles_to_validate = [articles applicable to this phase]
violations_found = []
```

### 2. Validation Loop

**Step 1: Validate Against Constitution**
- Read constitution from `.isdlc/constitution.md`
- Check each applicable article against phase artifacts
- Compile list of violations with specific details

**Step 2: Evaluate Results**
- ✅ **No violations** → Exit loop (COMPLIANT)
- ❌ **Violations found** → Proceed to Step 3
- ⚠️ **Max iterations reached** → Exit loop (ESCALATE)

**Step 3: Analyze Violations**
For each violation, document:
- Which article was violated (e.g., "Article V: Explicit Over Implicit")
- What specific artifact/content violated it
- Why it's a violation
- What needs to change

**Step 4: Fix Violations**
- Update artifacts to comply with constitutional articles
- Make incremental changes (address one article per iteration if complex)
- Document what was changed and why

**Step 5: Retry**
- Increment iteration_count
- Return to Step 1

### 3. Exit Conditions

**Compliant**: All applicable articles satisfied
- Update state.json with compliance status
- Proceed to gate validation
- Document iterations used

**Max Iterations Exceeded**: `iteration_count >= max_iterations`
- Update state.json with violation details
- Document all iteration attempts
- Escalate to human with:
  - List of unresolved violations
  - Attempts made to fix
  - Recommendations for resolution

**Fundamental Conflict**: Constitutional article conflicts with requirements
- Exit immediately
- Escalate to human
- Recommend constitution amendment OR requirements change

---

## Iteration Tracking

### State Management

Track constitutional validation in `.isdlc/state.json`:

```json
{
  "phases": {
    "01-requirements": {
      "status": "in_progress",
      "constitutional_validation": {
        "current_iteration": 2,
        "max_iterations": 5,
        "articles_checked": ["I", "V", "VII", "XII"],
        "status": "iterating",
        "history": [
          {
            "iteration": 1,
            "timestamp": "2026-01-17T10:15:00Z",
            "violations": [
              {
                "article": "V",
                "artifact": "requirements-spec.md",
                "violation": "Found 3 requirements with vague language: 'fast', 'easy to use', 'reliable'",
                "fix_applied": "Quantified NFRs: response time <200ms, WCAG 2.1 AA, 99.9% uptime"
              }
            ],
            "result": "VIOLATIONS_FIXED"
          },
          {
            "iteration": 2,
            "timestamp": "2026-01-17T10:20:00Z",
            "violations": [],
            "result": "COMPLIANT"
          }
        ],
        "final_status": "compliant",
        "total_iterations": 2
      }
    }
  }
}
```

### Logging Best Practices

For each iteration, log:
1. **Articles checked**: Which constitutional articles were validated
2. **Violations found**: Specific violations with artifact references
3. **Fixes applied**: What was changed to achieve compliance
4. **Result**: VIOLATIONS_FIXED, COMPLIANT, or ESCALATED

---

## Article-Specific Validation Rules

### Article I: Specification Primacy
**Check**: Code/design matches specifications exactly
**Violations**:
- Implementation deviates from requirements without documented justification
- Features added that aren't in specifications
**Fix**: Update artifacts to match specs, or document deviation in ADR

### Article II: Test-First Development
**Check**: Tests exist before/alongside implementation
**Violations**:
- Code committed without corresponding tests
- Test strategy missing for feature
**Fix**: Add missing tests, update test strategy

### Article III: Security by Design
**Check**: Security considerations documented before implementation
**Violations**:
- Missing threat model
- Security architecture not defined
- No security review for sensitive features
**Fix**: Add security documentation, threat model section

### Article IV: Explicit Over Implicit
**Check**: No unresolved `[NEEDS CLARIFICATION]` markers
**Violations**:
- Vague requirements ("fast", "user-friendly", "reliable")
- Undocumented assumptions
- Missing edge case handling
**Fix**: Quantify vague terms, document assumptions, add edge cases

### Article V: Simplicity First
**Check**: No over-engineering or premature optimization
**Violations**:
- Features beyond requirements ("gold plating")
- Unnecessary abstraction layers
- Premature optimization
- Custom implementation of common functionality without justification
**Fix**: Remove unnecessary complexity, simplify design, prefer libraries

### Article VI: Code Review Required
**Check**: All code reviewed before gate passage
**Violations**:
- Code merged without review
- Review comments not addressed
- No review sign-off documented
**Fix**: Complete code review, address all comments, document sign-off

### Article VII: Artifact Traceability
**Check**: All artifacts have IDs and links
**Violations**:
- Requirements without IDs
- Code without requirement references
- Tests without requirement links
**Fix**: Add IDs, establish traceability links

### Article VIII: Documentation Currency
**Check**: Documentation matches current code state
**Violations**:
- Outdated API documentation
- Missing inline comments for complex logic
- Stale README
**Fix**: Update documentation to match current state

### Article IX: Quality Gate Integrity
**Check**: Gates are validated, not skipped
**Violations**:
- Attempting to skip gate validation
- Waiving gate criteria without escalation
**Fix**: Complete gate requirements before proceeding

### Article X: Fail-Safe Defaults
**Check**: Secure/safe defaults implemented
**Violations**:
- Permissive default permissions
- Unvalidated inputs
- Sensitive data in error messages
**Fix**: Implement deny-by-default, add input validation

### Article XI: Integration Testing Integrity
**Check**: Integration tests validate component interactions
**Violations**:
- Missing integration tests for component boundaries
- Integration test coverage below threshold
- Mock-only testing without real integration validation
**Fix**: Add integration tests for component interactions, validate real integrations

### Article XII: Domain-Specific Compliance
**Check**: Regulatory compliance addressed
**Violations**:
- Missing compliance documentation
- Non-compliant implementations
**Fix**: Add compliance sections, fix non-compliant code

---

## Max Iteration Limits

Constitutional validation uses a separate iteration budget from test iterations:

| Track | Max Constitutional Iterations | Timeout |
|-------|------------------------------|---------|
| **Quick** | 3 | 3 min/iteration |
| **Standard** | 5 | 5 min/iteration |
| **Enterprise** | 7 | 7 min/iteration |

**Rationale**: Constitutional compliance is about documentation and design, not complex debugging. Fewer iterations should suffice.

---

## Integration with Gates

### Gate Validation Order

For each gate, validation occurs in this order:

1. **Artifact Existence Check**: Do required artifacts exist?
2. **Artifact Quality Check**: Do artifacts meet quality standards?
3. **Constitutional Compliance Check**: Do artifacts comply with constitution?
4. **Technical Validation**: Tests pass, coverage met, etc.

Constitutional iteration happens at step 3.

### Gate Validation Fields

```yaml
gate_criteria:
  - artifacts_exist: true
  - artifacts_quality: true
  - constitutional_compliance: true  # Uses autonomous iteration
  - constitutional_iterations_logged: true
  - no_unresolved_violations: true
  - technical_validation: true
```

### Gate Report Format

```markdown
## GATE-XX Validation Report

### Constitutional Compliance
- **Status**: COMPLIANT
- **Articles Checked**: I, V, VII, XII
- **Iterations Required**: 2
- **Max Allowed**: 5

### Iteration History
| Iter | Article | Violation | Fix Applied |
|------|---------|-----------|-------------|
| 1 | V | Vague NFRs | Quantified metrics |
| 2 | - | None | - |

### Final Status: ✅ PASS
```

---

## Agent Responsibilities

### SDLC Orchestrator (Agent 00)

**Enforcer Role**:
1. Validate that agents performed constitutional self-validation
2. Review constitutional iteration history in state.json
3. Verify all applicable articles were checked
4. Escalate persistent violations to human
5. Block gate advancement if violations unresolved

**At Each Gate**:
```
1. Check phase agent's constitutional_validation in state.json
2. IF status == "compliant": Proceed with gate validation
3. IF status == "escalated": Present to human for resolution
4. IF status == "iterating": Wait for completion
5. IF missing: Reject gate, require constitutional self-validation
```

### All Phase Agents (01-13)

**Self-Validation Role**:
1. Before declaring phase complete, run constitutional self-validation
2. Iterate on violations autonomously
3. Track all iterations in state.json
4. Escalate only after max iterations exceeded
5. Include constitutional compliance in gate report

**Validation Workflow**:
```
1. Complete phase artifacts
2. Read constitution from .isdlc/constitution.md
3. Validate artifacts against applicable articles
4. IF violations found AND iterations < max:
   - Fix artifacts
   - Increment iteration
   - Retry from step 3
5. IF compliant OR max iterations:
   - Log final status to state.json
   - Report to orchestrator
```

---

## Example Scenarios

### Scenario 1: Requirements Analyst (Agent 01)

**Phase**: 01 - Requirements
**Applicable Articles**: I, IV, VII, IX, XII

**Iteration 1**:
- Check Article IV: Found "The system should be fast" - VIOLATION
- Fix: Changed to "API response time p95 < 200ms"
- Result: VIOLATIONS_FIXED

**Iteration 2**:
- Check Article VII: Requirements missing IDs - VIOLATION
- Fix: Added REQ-0001 through REQ-0015
- Result: VIOLATIONS_FIXED

**Iteration 3**:
- All articles satisfied
- Result: COMPLIANT

### Scenario 2: Software Developer (Agent 05)

**Phase**: 05 - Implementation
**Applicable Articles**: I, II, III, V, VI, VII, VIII, IX, X

**Iteration 1**:
- Check Article II: Unit tests missing for 3 functions - VIOLATION
- Fix: Added tests for all functions
- Result: VIOLATIONS_FIXED

**Iteration 2**:
- Check Article VIII: Inline documentation outdated - VIOLATION
- Fix: Updated JSDoc comments
- Result: VIOLATIONS_FIXED

**Iteration 3**:
- Check Article V: Found unnecessary abstraction layer - VIOLATION
- Fix: Simplified by removing AbstractUserFactory
- Result: VIOLATIONS_FIXED

**Iteration 4**:
- All articles satisfied
- Result: COMPLIANT

### Scenario 3: Max Iterations Exceeded

**Phase**: 02 - Architecture
**Applicable Articles**: III, IV, V, VII, IX, X

**Iterations 1-5**:
- Article III violations persist: Security architecture keeps conflicting with performance requirements
- Each fix for security degrades performance below NFR threshold
- After 5 iterations: fundamental conflict detected

**Result**: ESCALATED
- **Reason**: "Constitutional conflict between Article III (Security by Design) and performance NFR-002 (p95 < 100ms). Security measures add 50ms latency."
- **Recommendation**: "Stakeholder decision required: relax performance requirement OR accept security trade-off. Document decision in ADR."

---

## Safety Mechanisms

### 1. Infinite Loop Prevention
- **Hard limit**: Max iterations per track (3/5/7)
- **Timeout**: Each iteration has timeout
- **Same violation detection**: If same violation appears 3x, escalate

### 2. Scope Protection
- Constitutional validation only checks applicable articles for the phase
- Agents don't need to validate articles outside their scope
- Orchestrator tracks which articles each phase validated

### 3. Conflict Detection
Auto-detect and escalate on:
- Constitutional articles conflicting with each other
- Constitutional requirements conflicting with project requirements
- Fundamental design conflicts that can't be resolved by iteration

---

## Configuration

### Track-Specific Settings

Add to `src/isdlc/config/tracks.yaml`:

```yaml
tracks:
  quick:
    constitutional_validation:
      enabled: true
      max_iterations: 3
      timeout_per_iteration_minutes: 3

  standard:
    constitutional_validation:
      enabled: true
      max_iterations: 5
      timeout_per_iteration_minutes: 5

  enterprise:
    constitutional_validation:
      enabled: true
      max_iterations: 7
      timeout_per_iteration_minutes: 7
```

### Phase-Article Mapping

Add to `src/isdlc/config/constitution-mapping.yaml`:

```yaml
phase_articles:
  "01-requirements": ["I", "IV", "VII", "IX", "XII"]
  "02-architecture": ["III", "IV", "V", "VII", "IX", "X"]
  "03-design": ["I", "IV", "V", "VII", "IX"]
  "04-test-strategy": ["II", "VII", "IX", "XI"]
  "05-implementation": ["I", "II", "III", "V", "VI", "VII", "VIII", "IX", "X"]
  "06-testing": ["II", "VII", "IX", "XI"]
  "07-code-review": ["V", "VI", "VII", "VIII", "IX"]
  "08-validation": ["III", "IX", "X", "XII"]
  "09-cicd": ["II", "IX"]
  "10-local-testing": ["VIII", "IX"]
  "11-test-deploy": ["IX", "X"]
  "12-production": ["IX", "X"]
  "13-operations": ["VIII", "IX", "XII"]
```

---

## Related Skills

- **autonomous-iterate** (DEV-014) - Test-focused iteration (Phase 05, 06)
- **gate-validation** (ORCH-004) - Gate validation coordination
- **skill-validation** (ORCH-010) - Skill ownership enforcement

---

## References

- **Inspired by**: Ralph Wiggum autonomous iteration loops
- **Extends**: autonomous-iterate skill pattern
- **Gate Integration**: GATE-01 through GATE-13
- **State Management**: `.isdlc/state.json`
- **Constitution Location**: `.isdlc/constitution.md`

---

**Version**: 1.0.0
**Created**: 2026-01-18
**Last Updated**: 2026-01-18
**Status**: Active

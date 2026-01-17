# Project Constitution Guide
## How to Create and Use Constitutional Principles in iSDLC Projects

**Date**: 2026-01-17
**Version**: 1.0.0

---

## What is a Project Constitution?

A **Project Constitution** is a set of immutable principles that govern all development activities in your project. Think of it as your project's "bill of rights" - fundamental rules that all agents and team members must follow.

### Why Use a Constitution?

✅ **Consistency**: Ensures all 14 agents apply the same principles
✅ **Quality**: Enforces standards automatically at quality gates
✅ **Alignment**: Keeps long-running projects on track architecturally
✅ **Clarity**: Makes expectations explicit and non-negotiable
✅ **Automation**: Agents validate constitutional compliance automatically

---

## When to Create a Constitution

### ✅ Create One When:
- Starting a new project with multiple developers
- Building regulated systems (healthcare, finance, government)
- Need consistent quality enforcement
- Long-running project (>3 months)
- Team needs shared principles
- Compliance requirements exist

### ⚠️ Consider Skipping When:
- Quick prototype or proof-of-concept
- Solo developer, personal project
- Exploratory research project
- Very short timeline (<1 week)
- Requirements are highly uncertain

---

## How to Create Your Constitution

### Step 1: Copy the Template

```bash
cp isdlc-framework/templates/constitution.md .isdlc/constitution.md
```

Or if using `init-project.sh`, it's done automatically.

### Step 2: Review Example Articles

The template includes 10 example articles:

1. **Specification Primacy** - Specs are source of truth
2. **Test-First Development** - Tests before code
3. **Library-First Design** - Prefer libraries over custom code
4. **Security by Design** - Security from day one
5. **Explicit Over Implicit** - No assumptions, mark uncertainties
6. **Simplicity First** - YAGNI, avoid over-engineering
7. **Artifact Traceability** - Requirements → Code mapping
8. **Documentation Currency** - Keep docs updated
9. **Quality Gate Integrity** - Gates can't be skipped
10. **Fail-Safe Defaults** - Secure and safe by default

### Step 3: Customize for Your Project

**For a Simple Internal Tool:**
```markdown
# Project Constitution - Internal Dashboard

## Article I: Test Coverage
Unit test coverage MUST be ≥70%.

## Article II: Code Review
All code MUST be reviewed by one other developer.

## Article III: Security Basics
No secrets in code. Use environment variables.
```

**For an Enterprise SaaS Product:**
```markdown
# Project Constitution - Enterprise CRM Platform

## Article I: Specification Primacy
[Keep full article from template]

## Article II: Test-First Development
[Keep full article, adjust coverage to 85%]

## Article III: Security by Design
[Keep full article, add SOC2 compliance]

## Article IV: Multi-Tenancy Isolation
Tenant data MUST be completely isolated. Row-level security enforced.

## Article V: High Availability
System MUST maintain 99.9% uptime. Auto-scaling configured.

## Article VI: GDPR Compliance
[Custom article for data privacy requirements]

... (6-12 articles total)
```

### Step 4: Get Team Agreement

- Share the constitution with your team
- Discuss and refine articles
- Ensure everyone understands and agrees
- Make it official once consensus is reached

### Step 5: Commit It

```bash
git add .isdlc/constitution.md
git commit -m "Add project constitution"
```

---

## How Agents Use the Constitution

### Orchestrator (Agent 00)

**At Project Start:**
1. Reads `.isdlc/constitution.md`
2. Validates it exists and is complete
3. If missing, recommends creating one

**At Each Quality Gate:**
1. Checks constitutional compliance
2. Validates against relevant articles
3. Fails gate if violations found
4. Documents compliance in `gate-validation.json`

### Phase Agents (01-13)

**Before Starting Work:**
1. Read `.isdlc/constitution.md`
2. Review articles relevant to their phase
3. Apply principles to all decisions

**During Their Phase:**
1. Follow constitutional requirements
2. Document compliance in artifacts
3. Self-validate before gate submission

**Example - Software Developer (Agent 05):**
- Reads Articles I, II, III, VI, VII, VIII, X
- Implements only what's specified (Article I)
- Writes tests first (Article II)
- Prefers libraries (Article III)
- Keeps it simple (Article VI)
- Links code to requirements (Article VII)
- Updates docs (Article VIII)
- Uses fail-safe defaults (Article X)

---

## Constitutional Validation at Gates

### How Validation Works

Each quality gate checks relevant constitutional articles:

```
GATE-01 (Requirements):
✓ Article I: Requirements are complete specs
✓ Article V: No [NEEDS CLARIFICATION] markers
✓ Article VII: Traceability matrix exists
✓ Article XII: Compliance requirements identified

GATE-05 (Implementation):
✓ Article I: Code matches specifications
✓ Article II: Tests written first, coverage ≥80%
✓ Article III: Libraries used, ADRs document choices
✓ Article VI: No over-engineering
✓ Article VII: Code references requirement IDs
✓ Article VIII: Docs updated
✓ Article X: Fail-safe defaults implemented
```

### What Happens on Violation?

1. **First Violation**:
   - Orchestrator returns work to agent
   - Provides specific violation details
   - Agent remediates and resubmits

2. **Second Violation** (same article):
   - Orchestrator escalates to human
   - Project paused until resolution
   - May indicate constitution needs amendment

3. **Resolution**:
   - Fix the violation, OR
   - Amend the constitution (with team approval)

---

## Amending the Constitution

### When to Amend

- Original article doesn't fit project reality
- Requirements changed significantly
- Team learned better practices mid-project
- New regulatory requirements

### How to Amend

1. **Propose Amendment**
   - Document what needs to change and why
   - Explain impact on existing work

2. **Team Discussion**
   - Review with all stakeholders
   - Ensure consensus

3. **Update Constitution**
   - Edit `.isdlc/constitution.md`
   - Version it (e.g., "v2.0.0")
   - Add amendment log

4. **Inform Orchestrator**
   - Notify the orchestrator of changes
   - May need to revisit previous phases

5. **Commit Changes**
   ```bash
   git add .isdlc/constitution.md
   git commit -m "Constitution amendment v2.0.0: Update test coverage to 75%"
   ```

---

## Common Constitutional Patterns

### Pattern: Minimal Constitution (3-5 Articles)

Good for:
- Small teams (<5 people)
- Internal tools
- Short projects (<3 months)

```markdown
## Article I: Test Coverage ≥70%
## Article II: Code Review Required
## Article III: No Secrets in Code
## Article IV: Simple Wins Over Clever
```

### Pattern: Standard Constitution (6-10 Articles)

Good for:
- Medium teams (5-15 people)
- Customer-facing products
- 3-12 month projects

Use template articles I-IX, customize as needed.

### Pattern: Comprehensive Constitution (10-15 Articles)

Good for:
- Large teams (>15 people)
- Regulated industries
- Multi-year projects
- Critical systems

Use all template articles + domain-specific ones:
- Compliance (HIPAA, PCI-DSS, GDPR)
- Performance SLAs
- High availability requirements
- Data retention policies
- Disaster recovery

---

## Constitutional Article Ideas by Domain

### Healthcare / HIPAA
```markdown
## Article: HIPAA Compliance
1. All PHI MUST be encrypted at rest and in transit
2. Audit logging for all PHI access
3. Role-based access control enforced
4. Data retention per HIPAA requirements
```

### Financial / PCI-DSS
```markdown
## Article: PCI-DSS Compliance
1. No credit card data stored unencrypted
2. Tokenization for all payment data
3. Security scans before each deployment
4. Quarterly penetration testing
```

### E-Commerce / High Traffic
```markdown
## Article: Performance Requirements
1. API response time p95 < 200ms
2. Support 10,000 concurrent users
3. Auto-scaling configured
4. Load testing before production
```

### Multi-Tenant SaaS
```markdown
## Article: Tenant Isolation
1. Row-level security enforced
2. No cross-tenant queries
3. Tenant ID in all API requests
4. Data export per tenant
```

### Open Source / Community
```markdown
## Article: Open Source Principles
1. MIT license for all code
2. Contribution guidelines enforced
3. Code of conduct applied
4. Public roadmap maintained
```

---

## Troubleshooting

### "Agent ignores constitution"

**Problem**: Agent doesn't seem to follow constitutional principles.

**Solutions**:
1. Verify `.isdlc/constitution.md` exists
2. Check constitution is readable (not corrupted)
3. Ensure articles are clearly written
4. Remind orchestrator to enforce compliance

### "Too many violations"

**Problem**: Gates keep failing due to constitutional violations.

**Solutions**:
1. Constitution may be too strict for your project
2. Review and amend unrealistic articles
3. Provide examples in constitution
4. Train team on constitutional requirements

### "Constitution too vague"

**Problem**: Agents interpret articles differently.

**Solutions**:
1. Make requirements more specific and measurable
2. Add validation criteria
3. Include examples in articles
4. Define what "MUST" and "SHOULD" mean

---

## Best Practices

### ✅ DO:
- Keep articles **specific and measurable**
- Include **validation criteria** for each article
- Provide **examples** when possible
- Get **team buy-in** before finalizing
- **Version** constitution changes
- Review constitution **quarterly**

### ❌ DON'T:
- Make it too long (>15 articles)
- Use vague language ("be good", "be fast")
- Change it frequently (creates confusion)
- Skip team discussion
- Copy another project's constitution blindly
- Ignore violations to meet deadlines

---

## Examples from Real Projects

### Example 1: Fintech Startup
- 8 articles total
- Heavy focus on security and compliance
- Test coverage 85%
- Security reviews at 3 gates
- PCI-DSS compliance article

### Example 2: Internal Dashboard
- 3 articles total
- Simple and pragmatic
- Test coverage 70%
- Code review required
- No over-engineering

### Example 3: Healthcare SaaS
- 12 articles total
- HIPAA compliance central
- Audit logging everywhere
- Data encryption mandatory
- Disaster recovery tested quarterly

---

## Resources

- **Constitution Template**: `isdlc-framework/templates/constitution.md`
- **Framework Analysis**: `docs/FRAMEWORK-COMPARISON-ANALYSIS.md`
- **Agent Documentation**: `.claude/agents/00-sdlc-orchestrator.md`
- **Inspiration**: GitHub Spec Kit, BMAD-METHOD

---

## Questions?

If you're unsure whether to create a constitution or what to include:

1. Start with the **Minimal Constitution** pattern (3-5 articles)
2. Add articles as you discover needs
3. Review after first sprint/milestone
4. Adjust based on what works

Remember: **A constitution should help, not hinder**. If it's slowing you down without adding value, simplify it.

---

**Guide Version**: 1.0.0
**Last Updated**: 2026-01-17
**Framework Compatibility**: iSDLC v1.0.0+

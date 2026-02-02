---
name: atdd-priority-tagging
description: Assign P0-P3 priorities to acceptance tests based on risk and business impact
skill_id: TEST-017
owner: test-design-engineer
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: ATDD mode - when assigning priorities to acceptance test scenarios
dependencies: [TEST-014, TEST-005]
---

# ATDD Priority Tagging

## Purpose
Assign P0-P3 priority tags to acceptance tests based on business impact, risk assessment, and implementation order requirements, enabling the priority-based RED→GREEN workflow.

## When to Use
- ATDD mode is active
- After scenario mapping (TEST-014)
- Before generating ATDD checklist (TEST-016)
- When requirements change and priorities need reassessment

## Prerequisites
- Acceptance criteria mapped to test scenarios
- Business context understood
- Risk assessment available (if exists)

## Priority Levels

### P0 - Critical (Implement First)

**Criteria for P0:**
- Core business functionality (revenue-generating features)
- Security-critical paths (authentication, authorization, data protection)
- Data integrity operations (create, update, delete business data)
- Legal/compliance requirements (GDPR, PCI-DSS, HIPAA)
- Features that if broken, would halt business operations

**Examples:**
- User login/logout
- Payment processing
- Order submission
- Data encryption
- Password reset
- Session management

```typescript
it.skip('[P0] AC1: should process payment and create order', () => {
  // Critical: payment + order creation = core business flow
});
```

### P1 - High (Implement Second)

**Criteria for P1:**
- Important user journeys (common paths used daily)
- Features with significant user impact
- Integration points with external systems
- Error handling for critical paths
- Features that affect data consistency

**Examples:**
- Search functionality
- Profile management
- Notification delivery
- Report generation
- Inventory updates
- Email sending

```typescript
it.skip('[P1] AC5: should send confirmation email after order', () => {
  // High: not blocking payment, but expected user experience
});
```

### P2 - Medium (Implement Third)

**Criteria for P2:**
- Secondary features (nice-to-have functionality)
- Edge cases of P0/P1 features
- UI/UX enhancements
- Performance optimizations
- Bulk operations
- Filtering and sorting

**Examples:**
- Advanced search filters
- Pagination
- Sorting options
- Bulk actions
- Export to CSV
- Theme preferences

```typescript
it.skip('[P2] AC8: should sort search results by date descending', () => {
  // Medium: sorting is helpful but not critical
});
```

### P3 - Low (Implement Last)

**Criteria for P3:**
- Cosmetic features (animations, transitions)
- Rare edge cases (unlikely scenarios)
- Nice-to-have polish
- Optional enhancements
- Accessibility beyond legal requirements
- Browser-specific quirks

**Examples:**
- Tooltips
- Loading animations
- Keyboard shortcuts
- Custom themes
- Print stylesheets
- Easter eggs

```typescript
it.skip('[P3] AC12: should show loading spinner during fetch', () => {
  // Low: UX polish, not functional requirement
});
```

## Process

### Step 1: Gather Context

Collect information needed for prioritization:

1. **Business requirements**: What does the product owner consider critical?
2. **Risk assessment**: What could cause data loss, security breach, or revenue impact?
3. **User impact**: How many users affected? How often is feature used?
4. **Dependencies**: What features depend on this? What does this depend on?
5. **Compliance**: Any legal or regulatory requirements?

### Step 2: Apply Priority Matrix

Score each acceptance criterion:

| Factor | P0 (3 pts) | P1 (2 pts) | P2 (1 pt) | P3 (0 pts) |
|--------|------------|------------|-----------|------------|
| **Business Impact** | Revenue-critical | Important | Useful | Nice-to-have |
| **User Frequency** | Every session | Daily | Weekly | Rarely |
| **Security Risk** | Auth/data breach | Partial exposure | Minor leak | None |
| **Data Risk** | Loss/corruption | Inconsistency | Delayed | None |
| **Dependency Count** | 5+ features depend | 2-4 depend | 1 depends | None |

**Total Score → Priority:**
- 12-15 points: P0
- 8-11 points: P1
- 4-7 points: P2
- 0-3 points: P3

### Step 3: Apply Domain-Specific Rules

Common patterns by domain:

#### E-commerce
| Feature | Default Priority |
|---------|------------------|
| Checkout flow | P0 |
| Payment processing | P0 |
| Inventory management | P0 |
| Product search | P1 |
| Reviews/ratings | P2 |
| Wishlist | P3 |

#### SaaS Applications
| Feature | Default Priority |
|---------|------------------|
| User authentication | P0 |
| Core business logic | P0 |
| Subscription/billing | P0 |
| Dashboard | P1 |
| Notifications | P1 |
| Themes/customization | P3 |

#### Healthcare
| Feature | Default Priority |
|---------|------------------|
| Patient data access | P0 |
| HIPAA compliance | P0 |
| Prescription management | P0 |
| Appointment scheduling | P1 |
| Report generation | P1 |
| UI preferences | P3 |

### Step 4: Tag Tests

Add priority tags to test names:

```typescript
// Format: [P{0-3}] AC{n}: description
it.skip('[P0] AC1: should authenticate user with valid credentials', ...);
it.skip('[P1] AC5: should send password reset email', ...);
it.skip('[P2] AC8: should paginate search results', ...);
it.skip('[P3] AC12: should animate page transitions', ...);
```

For frameworks with marker support:

```python
# pytest
@pytest.mark.P0
@pytest.mark.skip
def test_ac1_authenticate_user():
    pass

@pytest.mark.P1
@pytest.mark.skip
def test_ac5_password_reset_email():
    pass
```

```java
// JUnit 5 with tags
@Test
@Tag("P0")
@Disabled("ATDD scaffold")
void ac1_shouldAuthenticateUser() { }
```

### Step 5: Update ATDD Checklist

Record priorities in checklist:

```json
{
  "acceptance_criteria": [
    {
      "ac_id": "AC1",
      "priority": "P0",
      "priority_rationale": "Core auth flow - security critical"
    },
    {
      "ac_id": "AC5",
      "priority": "P1",
      "priority_rationale": "Password reset - high user impact, not blocking"
    }
  ],
  "coverage_summary": {
    "by_priority": {
      "P0": { "total": 3, "passing": 0 },
      "P1": { "total": 4, "passing": 0 },
      "P2": { "total": 2, "passing": 0 },
      "P3": { "total": 1, "passing": 0 }
    }
  }
}
```

## Priority Distribution Guidelines

Aim for a reasonable distribution:

```
Ideal Distribution:
P0: 20-30% (critical path)
P1: 30-40% (important features)
P2: 20-30% (secondary features)
P3: 10-20% (polish/edge cases)

Red Flags:
- P0 > 50%: Everything can't be critical - reassess
- P3 > 30%: Too much polish, not enough core testing
- No P0: Missing critical path tests
- All same priority: Not differentiated
```

## Inputs

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| acceptance_criteria | Array | Yes | ACs from scenario mapping |
| risk_assessment | Markdown | Optional | Project risk analysis |
| business_requirements | Markdown | Optional | Product owner priorities |

## Outputs

| Output | Type | Description |
|--------|------|-------------|
| prioritized_tests | Array | ACs with priority tags |
| priority_rationale | Markdown | Explanation of assignments |
| distribution_report | Object | Priority distribution stats |

## Validation

Before completing priority tagging:
- [ ] All ACs have exactly one priority (P0, P1, P2, or P3)
- [ ] Priority distribution is reasonable (no single priority > 50%)
- [ ] Critical business flows are P0
- [ ] Security features are P0 or P1
- [ ] Rationale documented for P0 items
- [ ] Test names include priority tags
- [ ] ATDD checklist updated with priorities

## Integration Points

- **Scenario Mapping (TEST-014)**: Receives ACs to prioritize
- **Prioritization (TEST-005)**: Extends core prioritization patterns
- **ATDD Checklist (TEST-016)**: Records priorities
- **Software Developer (05)**: Implements in priority order
- **Integration Tester (06)**: Validates all priorities complete

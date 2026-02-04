---
name: atdd-scenario-mapping
description: Convert Given-When-Then acceptance criteria to executable test scenarios with test.skip()
skill_id: TEST-014
owner: test-design-engineer
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: ATDD mode - when generating skipped test scaffolds from acceptance criteria
dependencies: [TEST-001, TEST-002]
---

# ATDD Scenario Mapping

## Purpose
Convert acceptance criteria written in Given-When-Then format into executable test scenarios with `test.skip()` scaffolds, enabling the ATDD RED→GREEN workflow.

## When to Use
- ATDD mode is active (`state.json → active_workflow.atdd_mode: true`)
- Requirements phase has produced acceptance criteria
- Before implementation begins (Phase 04 → Phase 05 transition)

## Prerequisites
- Acceptance criteria documented in Given-When-Then format
- Test framework identified (Jest, pytest, JUnit, etc.)
- Test directory structure defined

## Process

### Step 1: Parse Acceptance Criteria

Extract Given-When-Then components from requirements:

```markdown
## Acceptance Criteria (Input)

### AC1: Successful order submission
**Given** a customer with items in their cart
**And** valid payment method on file
**When** they click "Place Order"
**Then** the order is created with status "pending"
**And** payment is charged
**And** confirmation email is sent
```

### Step 2: Map to Test Structure

Transform each AC into test scaffold:

```typescript
// Output: tests/acceptance/order.test.ts

describe('Order Submission', () => {
  it.skip('[P0] AC1: should create order on successful submission', () => {
    // GIVEN: a customer with items in their cart
    // AND: valid payment method on file

    // WHEN: they click "Place Order"

    // THEN: the order is created with status "pending"
    // AND: payment is charged
    // AND: confirmation email is sent
  });
});
```

### Step 3: Handle Complex Scenarios

For acceptance criteria with multiple outcomes:

```typescript
// AC with multiple THEN clauses → multiple assertions needed
it.skip('[P0] AC1: should create order on successful submission', () => {
  // Setup (Given)
  const cart = createCartWithItems();
  const paymentMethod = createValidPaymentMethod();

  // Action (When)
  // const result = await submitOrder(cart, paymentMethod);

  // Assertions (Then) - all must be verified
  // expect(result.order.status).toBe('pending');
  // expect(paymentService.charge).toHaveBeenCalled();
  // expect(emailService.send).toHaveBeenCalledWith(expect.objectContaining({ type: 'confirmation' }));
});
```

### Step 4: Handle Conditional Scenarios

For AC with branching logic:

```markdown
### AC2: Order fails on invalid payment
**Given** a customer with items in their cart
**And** expired payment method
**When** they click "Place Order"
**Then** they see error "Payment method expired"
**And** no order is created
```

→ Separate test case:

```typescript
it.skip('[P1] AC2: should show error when payment method expired', () => {
  // GIVEN: a customer with items in their cart
  // AND: expired payment method

  // WHEN: they click "Place Order"

  // THEN: they see error "Payment method expired"
  // AND: no order is created
});
```

### Step 5: Generate AC-to-Test Mapping

Create traceability entry:

```csv
AC_ID,Description,Priority,Test_File,Test_Name,Status
AC1,Successful order submission,P0,tests/acceptance/order.test.ts,[P0] AC1: should create order on successful submission,skip
AC2,Order fails on invalid payment,P1,tests/acceptance/order.test.ts,[P1] AC2: should show error when payment method expired,skip
```

## Inputs

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| requirements_spec.md | Markdown | Yes | Requirements with acceptance criteria |
| test_framework | String | Yes | Target framework (jest, pytest, junit, etc.) |
| test_directory | String | Yes | Where to place test files |

## Outputs

| Output | Type | Description |
|--------|------|-------------|
| tests/acceptance/*.test.* | Test files | Skipped test scaffolds |
| docs/isdlc/atdd-checklist.json | JSON | AC tracking (partial) |
| docs/testing/traceability-matrix.csv | CSV | AC → Test mapping |

## Framework-Specific Syntax

### JavaScript/TypeScript (Jest, Vitest, Mocha)
```typescript
it.skip('test name', () => { /* scaffold */ });
test.skip('test name', () => { /* scaffold */ });
describe.skip('suite name', () => { /* scaffold */ });
```

### Python (pytest)
```python
@pytest.mark.skip(reason="ATDD scaffold")
def test_scenario():
    pass
```

### Java (JUnit 5)
```java
@Test
@Disabled("ATDD scaffold - implement in Phase 05")
void testScenario() { }
```

### Go
```go
func TestScenario(t *testing.T) {
    t.Skip("ATDD scaffold - implement in Phase 05")
}
```

### Ruby (RSpec)
```ruby
xit 'should do something' do
  # scaffold
end
```

## Naming Conventions

Test names should include:
1. **Priority tag**: `[P0]`, `[P1]`, `[P2]`, `[P3]`
2. **AC identifier**: `AC1:`, `AC2:`, etc.
3. **Clear description**: What the test validates

Examples:
- `[P0] AC1: should redirect to dashboard on successful login`
- `[P1] AC5: should show validation error for invalid email format`
- `[P2] AC12: should sort results by date descending`

## Validation

Before completing scenario mapping:
- [ ] All acceptance criteria have corresponding test scaffolds
- [ ] All tests use framework-appropriate skip syntax
- [ ] All tests include Given/When/Then comments
- [ ] All tests have priority tags
- [ ] Traceability matrix updated with AC → Test mapping

## Integration Points

- **Requirements Analyst (01)**: Receives AC from requirements phase
- **Test Design Engineer (04)**: Primary owner, generates scaffolds
- **Software Developer (05)**: Receives scaffolds, implements tests
- **Integration Tester (06)**: Validates no orphan skips remain

# Test Case: TC-{number}

**Title**: {Descriptive title of what is being tested}

---

## Metadata

| Field | Value |
|-------|-------|
| ID | TC-{number} |
| Type | {Unit \| Integration \| E2E \| Security \| Performance \| Accessibility} |
| Priority | {Critical \| High \| Medium \| Low} |
| Automated | {Yes \| No \| Partial} |
| Author | {Author name} |
| Created | {Date} |
| Last Updated | {Date} |

---

## Traceability

| Type | IDs |
|------|-----|
| Requirements | REQ-{id}, REQ-{id} |
| User Stories | US-{id}, US-{id} |
| Design | {module/component reference} |

---

## Description

{Detailed description of what this test case verifies}

---

## Preconditions

Before executing this test:
- [ ] {Precondition 1: e.g., "User is logged in"}
- [ ] {Precondition 2: e.g., "Database contains test data"}
- [ ] {Precondition 3: e.g., "Feature flag X is enabled"}

---

## Test Data

### Input Data

| Field | Value | Notes |
|-------|-------|-------|
| {field1} | {value} | {notes} |
| {field2} | {value} | {notes} |

### Test Fixtures

```json
{
  "user": {
    "id": "test-user-1",
    "email": "test@example.com"
  }
}
```

---

## Test Steps

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | {Action description} | {Expected outcome} |
| 2 | {Action description} | {Expected outcome} |
| 3 | {Action description} | {Expected outcome} |
| 4 | {Action description} | {Expected outcome} |

---

## Expected Results

### Primary Assertion
{The main thing that must be true for the test to pass}

### Secondary Assertions
- {Additional assertion 1}
- {Additional assertion 2}
- {Additional assertion 3}

---

## Postconditions

After test execution:
- {State change 1: e.g., "Record is created in database"}
- {State change 2: e.g., "Email is sent"}

---

## Cleanup

{Steps to clean up test data or restore state}

- {Cleanup step 1}
- {Cleanup step 2}

---

## Test Code (if automated)

```typescript
describe('{Feature/Module}', () => {
  describe('{Function/Method}', () => {
    it('should {expected behavior}', async () => {
      // Arrange
      const input = { /* test data */ };

      // Act
      const result = await functionUnderTest(input);

      // Assert
      expect(result).toEqual(expectedOutput);
    });
  });
});
```

---

## Variations

| Variation | Input Change | Expected Change |
|-----------|--------------|-----------------|
| {Variation 1} | {what's different} | {how result differs} |
| {Variation 2} | {what's different} | {how result differs} |

---

## Edge Cases

| Edge Case | Input | Expected Result |
|-----------|-------|-----------------|
| Empty input | `{}` | {expected} |
| Max length | {max value} | {expected} |
| Invalid type | {invalid} | {expected error} |

---

## Negative Test Cases

| Scenario | Input | Expected Error |
|----------|-------|----------------|
| {Scenario 1} | {invalid input} | {error message/code} |
| {Scenario 2} | {invalid input} | {error message/code} |

---

## Notes

{Any additional notes, known issues, or considerations}

---

## Execution History

| Date | Tester | Result | Build | Notes |
|------|--------|--------|-------|-------|
| {date} | {name} | {Pass/Fail} | {version} | {notes} |

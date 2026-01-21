---
name: test-case-design
description: Write test cases from requirements and acceptance criteria
skill_id: TEST-002
owner: test-design-engineer
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Test planning, requirement coverage, QA preparation
dependencies: [TEST-001]
---

# Test Case Design

## Purpose
Design comprehensive test cases from requirements and acceptance criteria that cover functional, negative, boundary, and edge case scenarios.

## When to Use
- After requirements approved
- After acceptance criteria written
- Test planning phase
- Regression suite expansion

## Prerequisites
- User stories with acceptance criteria
- Test strategy defined
- Domain understanding

## Process

### Step 1: Analyze Acceptance Criteria
```
For each AC:
- Identify testable conditions
- Extract expected outcomes
- Note preconditions
- Find boundaries
```

### Step 2: Design Test Scenarios
```
Scenario types:
- Happy path (success)
- Negative (invalid inputs)
- Boundary (limits)
- Edge cases (unusual situations)
- Error handling
```

### Step 3: Write Test Cases
```
Test case structure:
- ID and title
- Preconditions
- Test steps
- Expected results
- Test data
- Priority
```

### Step 4: Create Test Data
```
Data requirements:
- Valid data sets
- Invalid data sets
- Boundary values
- Special characters
- Empty/null values
```

### Step 5: Review and Trace
```
Quality checks:
- Full AC coverage
- Traceability maintained
- No redundant tests
- Priorities assigned
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| user_stories | JSON | Yes | Stories with AC |
| requirements | Markdown | Yes | Requirement details |
| test_strategy | Markdown | Yes | Testing approach |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| test_cases/ | Markdown | Test case files |
| test_data/ | JSON | Test data sets |
| coverage_matrix.csv | CSV | AC to TC mapping |

## Project-Specific Considerations
- Multi-step form scenarios
- OAuth2 flow variations
- File upload edge cases
- Application state transitions
- External API response scenarios

## Integration Points
- **Requirements Agent**: Receives AC
- **Developer Agent**: Test implementation
- **Traceability**: Linked to requirements

## Examples
```
Test Cases for US-005: Document Upload

TC-005-001: Successful PDF Upload
Priority: High
Preconditions:
  - User is logged in
  - User has an application in draft status
Steps:
  1. Navigate to application documents section
  2. Click "Upload Document"
  3. Select a valid PDF file (5MB)
  4. Select document type "Transcript"
  5. Click "Upload"
Expected Results:
  - Upload progress bar appears
  - Success message displays
  - Document appears in document list
  - Document shows correct name, size, type
Test Data:
  - File: transcript_valid.pdf (5MB)
  - Type: application/pdf

TC-005-002: Reject Oversized File
Priority: High
Preconditions:
  - User is logged in
Steps:
  1. Navigate to document upload
  2. Select file larger than 10MB
  3. Attempt upload
Expected Results:
  - Upload is rejected before starting
  - Error message: "File must be under 10MB"
  - No file appears in list
Test Data:
  - File: large_file.pdf (15MB)

TC-005-003: Reject Invalid File Type
Priority: High
Preconditions:
  - User is logged in
Steps:
  1. Navigate to document upload
  2. Select .exe file
  3. Attempt upload
Expected Results:
  - Upload is rejected
  - Error message: "Only PDF, JPG, PNG files allowed"
Test Data:
  - File: malware.exe

TC-005-004: Handle Upload Interruption
Priority: Medium
Preconditions:
  - User is logged in
  - Network is unstable
Steps:
  1. Start uploading large file
  2. Simulate network interruption at 50%
  3. Wait for timeout
Expected Results:
  - Error message displayed
  - Retry button available
  - Partial upload cleaned up
  - Can retry successfully

TC-005-005: Boundary - Exactly 10MB File
Priority: Medium
Steps:
  1. Upload file exactly 10MB
Expected Results:
  - Upload succeeds (10MB is allowed)
Test Data:
  - File: exactly_10mb.pdf (10,485,760 bytes)

TC-005-006: Special Characters in Filename
Priority: Low
Steps:
  1. Upload file with special characters: "tëst döc (1).pdf"
Expected Results:
  - Upload succeeds
  - Filename displayed correctly
  - Download works

Test Coverage Matrix:
| AC | Test Cases |
|----|------------|
| AC1: Successful upload | TC-005-001 |
| AC2: File type validation | TC-005-003 |
| AC3: File size limit | TC-005-002, TC-005-005 |
| AC4: Upload progress | TC-005-001, TC-005-004 |
| AC5: Duplicate handling | TC-005-007 |
| AC6: Upload failure | TC-005-004 |
```

## Validation
- All AC covered by test cases
- Positive and negative scenarios
- Boundary values tested
- Test data specified
- Priorities assigned
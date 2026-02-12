# Workflow Task Templates

Template task descriptions organized by workflow type and phase. The `generate-plan` skill (ORCH-012) uses this file to produce `.isdlc/tasks.md`.

**Format rules:**
- Plain text descriptions only (no checkboxes, no IDs)
- The generate-plan skill adds `TNNNN` numbering, `[P]` markers, and `- [ ]` formatting
- Task descriptions should be concise and action-oriented

---

## feature

### 01-requirements
- Discover project context and business requirements
- Identify users and define personas
- Define core features and capabilities
- Specify non-functional requirements
- Write user stories with acceptance criteria
- Prioritize requirements (MoSCoW)
- Finalize and save requirements artifacts

### 02-architecture
- Analyze requirements and identify architectural drivers
- Select architecture pattern and document ADR
- Evaluate and select technology stack
- Design database schema
- Design security architecture
- Design infrastructure and estimate costs
- Validate architecture artifacts

### 03-design
- Design interface specifications (API contracts)
- Create module designs
- Design UI wireframes and user flows
- Define error taxonomy
- Create validation rules
- Validate design artifacts against GATE-03

### 06-implementation
<!-- Tasks below are high-level placeholders. The refinement step (3e-refine) will
     expand them with file-level annotations, traceability, and dependency sub-lines
     once the design phase completes. -->
- Check existing test infrastructure
- Write failing unit tests (TDD Red)
- Implement code to pass tests (TDD Green)
- Iterate until all tests pass with 80% coverage
- Refactor and validate code quality
- Validate constitutional compliance

### 10-local-testing
- Detect tech stack and build plan
- Start dependent services
- Build and start application
- Health-check application readiness

### 06-testing
- Read testing environment URL from state
- Run integration tests
- Run end-to-end tests
- Run contract tests
- Run mutation tests
- Run adversarial tests
- Iterate until all tests pass
- Analyze coverage and generate reports
- Clean up testing environment

### 09-cicd
- Configure CI pipeline
- Configure CD pipeline
- Set up build automation and Dockerfile
- Configure pipeline quality gates
- Validate pipeline execution

### 07-code-review
- Perform code review
- Run static code analysis
- Analyze quality metrics
- Assess technical debt
- Produce QA sign-off

---

## fix

### 01-requirements
- Identify bug and gather reproduction details
- Extract external ID from tracker
- Draft bug report for review
- Save bug report artifacts

### 06-implementation
<!-- Tasks below are high-level placeholders. The refinement step (3e-refine) will
     expand them with file-level annotations, traceability, and dependency sub-lines
     once the design phase completes. -->
- Check existing test infrastructure
- Write failing test that reproduces the bug (TDD Red)
- Implement fix to pass tests (TDD Green)
- Iterate until all tests pass with 80% coverage
- Refactor and validate code quality
- Validate constitutional compliance

### 10-local-testing
- Detect tech stack and build plan
- Start dependent services
- Build and start application
- Health-check application readiness

### 06-testing
- Read testing environment URL from state
- Run integration tests
- Run end-to-end tests
- Run contract tests
- Run mutation tests
- Run adversarial tests
- Iterate until all tests pass
- Analyze coverage and generate reports
- Clean up testing environment

### 09-cicd
- Configure CI pipeline
- Configure CD pipeline
- Set up build automation and Dockerfile
- Configure pipeline quality gates
- Validate pipeline execution

### 07-code-review
- Perform code review
- Run static code analysis
- Analyze quality metrics
- Assess technical debt
- Produce QA sign-off

---

# UI Wireframes: Custom Skill Management (REQ-0022)

**Phase**: 04-design
**Version**: 1.0
**Created**: 2026-02-18
**Traces to**: FR-001 through FR-009

---

## Note on UI Context

The iSDLC framework is a CLI-based tool running inside Claude Code. There are no graphical UI elements. "Wireframes" for this project are text-based terminal output specifications showing the exact format of messages, prompts, and interactive menus displayed to the user.

---

## 1. Skill Add -- Validation Error Display (FR-001, NFR-006)

When a skill file fails validation, all errors are collected and displayed at once.

```
+------------------------------------------------------------------+
| Skill validation failed for: /path/to/my-skill.md                |
|                                                                   |
| Errors:                                                           |
|   - Missing required frontmatter field: name                      |
|   - Missing required frontmatter field: description               |
|                                                                   |
| Expected format:                                                  |
|   ---                                                             |
|   name: my-skill-name                                             |
|   description: Brief description of the skill                     |
|   ---                                                             |
|                                                                   |
|   # Skill Content                                                 |
|   ...                                                             |
+------------------------------------------------------------------+
```

---

## 2. Skill Add -- Success Confirmation (FR-001)

After file validation and copy succeed, before the wiring session.

```
+------------------------------------------------------------------+
| Skill file validated and copied.                                  |
|                                                                   |
|   Name: nestjs-conventions                                        |
|   Description: NestJS framework conventions and patterns          |
|   File: .claude/skills/external/nestjs-conventions.md             |
|                                                                   |
| Starting wiring session...                                        |
+------------------------------------------------------------------+
```

---

## 3. Skill Add -- Duplicate Detected (FR-001)

When a skill with the same name already exists in the manifest.

```
+------------------------------------------------------------------+
| Skill 'nestjs-conventions' already exists in the registry.        |
|                                                                   |
| Current bindings:                                                 |
|   Phases: 06-implementation, 03-architecture                      |
|   Delivery: context                                               |
|                                                                   |
| Overwrite with new file? [Y] Yes  [N] No (keep existing)         |
+------------------------------------------------------------------+
```

---

## 4. Wiring Session -- Step 1: Context Display (FR-003)

Displayed at the start of the wiring session by the skill-manager agent.

```
+------------------------------------------------------------------+
| Wiring Session: nestjs-conventions                                |
| "NestJS framework conventions and patterns"                       |
|                                                                   |
| Smart binding analysis (confidence: high):                        |
|   Suggested phases: 06-implementation, 03-architecture            |
|   Suggested agents: software-developer, solution-architect        |
|   Suggested delivery: context                                     |
+------------------------------------------------------------------+
```

---

## 5. Wiring Session -- Step 2: Phase Selection (FR-003)

Grouped phase list with pre-checked suggestions. User selects by naming phases.

```
+------------------------------------------------------------------+
| Select phases to bind this skill to:                              |
|                                                                   |
| Requirements & Analysis:                                          |
|   [ ] 01-requirements                                             |
|   [ ] 02-impact-analysis                                          |
|   [ ] 02-tracing                                                  |
|                                                                   |
| Architecture & Design:                                            |
|   [x] 03-architecture  (suggested)                                |
|   [ ] 04-design                                                   |
|                                                                   |
| Testing:                                                          |
|   [ ] 05-test-strategy                                            |
|   [ ] 07-testing                                                  |
|                                                                   |
| Implementation:                                                   |
|   [x] 06-implementation  (suggested)                              |
|                                                                   |
| Quality & Security:                                               |
|   [ ] 08-code-review                                              |
|   [ ] 09-validation                                               |
|   [ ] 16-quality-loop                                             |
|                                                                   |
| DevOps:                                                           |
|   [ ] 10-cicd                                                     |
|   [ ] 11-local-testing                                            |
|                                                                   |
| Type phase names to add/remove, or "done" to continue.            |
+------------------------------------------------------------------+
```

---

## 6. Wiring Session -- Step 3: Delivery Type (FR-003)

Single-select radio for delivery type.

```
+------------------------------------------------------------------+
| Select delivery type:                                             |
|                                                                   |
|   [C] Context                                                     |
|       Skill content appended as background knowledge.             |
|       Best for: conventions, patterns, domain knowledge.          |
|                                                                   |
|   [I] Instruction                                                 |
|       Skill content injected as rules the agent MUST follow.      |
|       Best for: coding standards, naming conventions, policies.   |
|                                                                   |
|   [R] Reference                                                   |
|       Skill referenced by name; agent reads on demand.            |
|       Best for: large documents, API references, guides.          |
|                                                                   |
| Suggested: [C] Context                                            |
+------------------------------------------------------------------+
```

---

## 7. Wiring Session -- Step 4: Confirmation (FR-003)

Final confirmation before saving.

```
+------------------------------------------------------------------+
| Binding Summary for 'nestjs-conventions':                         |
|                                                                   |
|   Phases:   06-implementation, 03-architecture                    |
|   Agents:   software-developer, solution-architect                |
|   Delivery: context                                               |
|   Mode:     always                                                |
|                                                                   |
|   [S] Save   [A] Adjust   [X] Cancel                             |
+------------------------------------------------------------------+
```

---

## 8. Wiring Session -- Re-wire Mode (FR-009)

When re-wiring an existing skill, shows current bindings as defaults.

```
+------------------------------------------------------------------+
| Re-wiring Session: nestjs-conventions                             |
| "NestJS framework conventions and patterns"                       |
|                                                                   |
| Current bindings:                                                 |
|   Phases: 06-implementation, 03-architecture                      |
|   Agents: software-developer, solution-architect                  |
|   Delivery: context                                               |
|                                                                   |
| Modify the selections below, or [S] Save to keep as-is.          |
+------------------------------------------------------------------+
```

---

## 9. Skill Add -- Final Confirmation (FR-001)

After the wiring session completes and the manifest is written.

```
+------------------------------------------------------------------+
| Skill 'nestjs-conventions' registered and wired.                  |
|                                                                   |
|   Phases: 06-implementation, 03-architecture                      |
|   Agents: software-developer, solution-architect                  |
|   Delivery: context | Mode: always                                |
|                                                                   |
| This skill will be injected into matching agent prompts           |
| during workflow execution.                                        |
+------------------------------------------------------------------+
```

---

## 10. Skill List -- Output (FR-006)

Display of all registered skills with their bindings.

```
+------------------------------------------------------------------+
| External Skills (3 registered):                                   |
|                                                                   |
|   1. nestjs-conventions                                           |
|      Phases: 06-implementation, 03-architecture                   |
|      Delivery: context | Mode: always                             |
|                                                                   |
|   2. company-coding-standards                                     |
|      Phases: 06-implementation, 08-code-review                    |
|      Delivery: instruction | Mode: always                        |
|                                                                   |
|   3. aws-deployment-guide                                         |
|      Phases: 10-cicd                                              |
|      Delivery: reference | Mode: always                          |
+------------------------------------------------------------------+
```

---

## 11. Skill List -- Empty State (FR-006)

When no skills are registered.

```
+------------------------------------------------------------------+
| No external skills registered.                                    |
| Use '/isdlc skill add <path>' to add one.                        |
+------------------------------------------------------------------+
```

---

## 12. Skill Remove -- Prompt (FR-007)

Confirmation prompt before removing a skill.

```
+------------------------------------------------------------------+
| Remove 'nestjs-conventions' from external skills?                 |
|                                                                   |
|   [K] Keep file   (remove from registry, keep .md file)          |
|   [D] Delete file (remove from registry AND delete .md file)     |
|   [C] Cancel                                                      |
+------------------------------------------------------------------+
```

---

## 13. Skill Remove -- Confirmation (FR-007)

After removal.

```
+------------------------------------------------------------------+
| Skill 'nestjs-conventions' removed from registry.                 |
| File kept at: .claude/skills/external/nestjs-conventions.md       |
+------------------------------------------------------------------+
```

Or (if file deleted):

```
+------------------------------------------------------------------+
| Skill 'nestjs-conventions' removed from registry.                 |
| File deleted: .claude/skills/external/nestjs-conventions.md       |
+------------------------------------------------------------------+
```

---

## 14. Skill Remove -- Not Found (FR-007)

When the skill name does not exist in the manifest.

```
+------------------------------------------------------------------+
| Skill 'nonexistent-skill' not found in registry.                  |
| Run '/isdlc skill list' to see registered skills.                |
+------------------------------------------------------------------+
```

---

## 15. Runtime Injection -- Injected Context Block (FR-005)

What the phase agent sees appended to its delegation prompt (context delivery).

```
+------------------------------------------------------------------+
| EXTERNAL SKILL CONTEXT: nestjs-conventions                        |
| ---                                                               |
| # NestJS Conventions                                              |
|                                                                   |
| ## Module Structure                                               |
| - One module per bounded context                                  |
| - Use barrel exports (index.ts) for module public API             |
| ...                                                               |
| ---                                                               |
+------------------------------------------------------------------+
```

---

## 16. Runtime Injection -- Injected Instruction Block (FR-005)

What the phase agent sees (instruction delivery).

```
+------------------------------------------------------------------+
| EXTERNAL SKILL INSTRUCTION (company-coding-standards):            |
| You MUST follow these guidelines:                                 |
| # Company Coding Standards                                        |
|                                                                   |
| ## Naming                                                         |
| - All variables: camelCase                                        |
| - All constants: UPPER_SNAKE_CASE                                 |
| ...                                                               |
+------------------------------------------------------------------+
```

---

## 17. Runtime Injection -- Reference Block (FR-005)

What the phase agent sees (reference delivery).

```
+------------------------------------------------------------------+
| EXTERNAL SKILL AVAILABLE: aws-deployment-guide -- Read from       |
| .claude/skills/external/aws-deployment-guide.md if relevant       |
| to your current task                                              |
+------------------------------------------------------------------+
```

---

## 18. Runtime Injection -- Truncation Warning (FR-005)

When a skill file exceeds 10,000 characters.

```
+------------------------------------------------------------------+
| EXTERNAL SKILL AVAILABLE: large-reference-doc -- Read from        |
| .claude/skills/external/large-reference-doc.md if relevant        |
| to your current task                                              |
|                                                                   |
| [TRUNCATED -- full content at                                     |
| .claude/skills/external/large-reference-doc.md]                   |
+------------------------------------------------------------------+
```

---

## 19. Natural Language Consent Messages (FR-008)

### skill add
```
Looks like you want to add a new skill. I'll validate the file and
guide you through wiring it to the right phases. What's the path to
the skill file?
```

### skill wire
```
I'll open a wiring session to configure which phases this skill
applies to. Which skill would you like to wire?
```

### skill list
```
Here are your registered external skills:
```

### skill remove
```
I'll help you remove that skill from the registry. Which one would
you like to unregister?
```

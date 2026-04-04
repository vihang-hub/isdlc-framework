# task-completion-gate hook: block phase advancement if tasks.md has unfinished tasks

**Source**: GitHub #232

## Summary

Add a hook that reads `docs/isdlc/tasks.md` and blocks phase advancement if any task in the current phase section is marked `[ ]` (incomplete) without explicit user approval.

## Motivation

During REQ-GH-224 build, the Phase-Loop Controller marked Phase 06 complete while 3 Must-Have tasks (T017, T019, T020) were still `[ ]` in tasks.md. No hook caught this.

Article I.5: "User-confirmed task plans are binding specifications. Phase agents MAY refine tasks into sub-tasks but MUST NOT alter, remove, or expand the scope of parent tasks without user approval."

Currently only enforced by convention. Nothing in the runtime validates it.

## Behavior

On phase status change to `completed`:
1. Read `docs/isdlc/tasks.md`
2. Locate the section for the completing phase
3. Count `[ ]` vs `[X]` tasks
4. If any `[ ]` tasks remain → BLOCK, surface "override with user approval" path
5. Fail-open if tasks.md missing (log warning)

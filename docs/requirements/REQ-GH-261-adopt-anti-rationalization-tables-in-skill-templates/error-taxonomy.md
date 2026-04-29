# Error Taxonomy: Constitutional Quality Enforcement (GH-261)

| Code | Trigger | Severity | Recovery |
|---|---|---|---|
| ERR-DFR-001 | Deferral pattern in production code | Block (PreToolUse) | Agent rewrites file without deferral |
| ERR-TQV-001 | AC has no matching test | Block (gate) | Agent writes missing test, 3f loop (5 retries) |
| ERR-TQV-002 | Test block has zero assertions | Block (gate) | Agent adds assertions, 3f loop |
| ERR-TQV-003 | Error path has no negative test | Block (gate) | Agent adds negative test, 3f loop |
| ERR-STV-001 | Modified file not in tasks.md | Block (gate) | Agent adds file to task or removes change |
| ERR-STV-002 | AC has no file modification | Block (gate) | Agent implements missing AC |
| ERR-SDV-001 | External input without validation | Block (gate) | Agent adds validation |
| ERR-SDV-002 | Generic security claim without file references | Block (gate) | Agent provides specific evidence |
| ERR-RDV-001 | Review has insufficient file references | Block (gate) | Agent re-reviews with file detail |
| ERR-RDV-002 | Review has zero findings on large diff | Block (gate) | Agent produces substantive findings |

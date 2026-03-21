# Architecture Overview: Claude Parity Tests

**Item**: REQ-0077 | **GitHub**: #141

---

## 1. Test Strategy

Fixture-based parity tests. No LLM involved. Tests compare:
- Core ImplementationLoop output vs expected output from current implementation
- State.json snapshots at each checkpoint

## 2. Fixture Structure

```
tests/core/teams/fixtures/
  implementation-loop/
    basic-3-files/
      input-state.json        ← initial state
      file-list.json          ← files to process
      verdict-sequence.json   ← mock verdict responses
      expected-contexts.json  ← expected WRITER/REVIEW/UPDATE contexts
      expected-final-state.json ← expected loop state after completion
    tdd-ordering/
      ...
    max-cycles-exceeded/
      ...
    single-file/
      ...
```

## 3. Test Layers

| Layer | What It Tests | How |
|-------|--------------|-----|
| Unit | ImplementationLoop methods | Direct function calls with fixtures |
| Unit | State read/write | Temp directory with fixture state.json |
| Integration | Full loop execution | Feed verdict sequence, compare final state |
| Contract | Schema validation | Validate outputs against JSON schemas |

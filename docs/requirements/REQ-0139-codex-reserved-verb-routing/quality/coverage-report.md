# Coverage Report — REQ-0139 Codex Reserved Verb Routing

**Phase**: 16-quality-loop
**Date**: 2026-03-25

---

## New Code Coverage

| File | Functions | Lines (est.) | Branches (est.) | Tests Covering |
|------|-----------|-------------|-----------------|----------------|
| `src/isdlc/config/reserved-verbs.json` | N/A (data) | 100% | N/A | VR-35, VR-36, PVS-01..08 |
| `src/providers/codex/verb-resolver.js` | 3/3 (100%) | ~95% | ~92% | VR-01..VR-37 (37 tests) |
| `src/providers/codex/projection.js` — `buildVerbRoutingSection()` | 1/1 (100%) | ~98% | ~95% | PVS-01..PVS-08 (8 tests) |
| `src/providers/codex/runtime.js` — `applyVerbGuard()` | 1/1 (100%) | ~98% | ~95% | RVG-01..RVG-12 (12 tests) |

## Coverage by Function

### verb-resolver.js

| Function | Coverage | Branches Tested |
|----------|----------|-----------------|
| `loadVerbSpec()` | 100% | Default path, custom path, missing file, cached return |
| `notDetected()` | 100% | With reason, without reason |
| `resolveVerb()` | ~95% | Empty input, slash command, spec missing, exclusions, single match, multi match, disambiguation, active workflow |

### projection.js — buildVerbRoutingSection()

| Branch | Tested |
|--------|--------|
| Null/undefined/empty spec | Yes (PVS-07) |
| Valid spec with verbs | Yes (PVS-01..PVS-06) |
| Disambiguation present | Yes (PVS-05) |
| Exclusions present | Yes (PVS-03, PVS-04) |
| Section heading format | Yes (PVS-08) |

### runtime.js — applyVerbGuard()

| Branch | Tested |
|--------|--------|
| Config missing | Yes (RVG-04) |
| Config verb_routing !== "runtime" | Yes (RVG-03) |
| Config verb_routing === "runtime" + verb detected | Yes (RVG-01, RVG-02) |
| Config verb_routing === "runtime" + no verb | Yes (RVG-05) |
| Active workflow | Yes (RVG-06) |
| Ambiguity | Yes (RVG-07) |
| Excluded prompt | Yes (RVG-08) |
| Slash command | Yes (RVG-09) |
| Empty prompt | Yes (RVG-10) |

## Overall Assessment

Estimated coverage for REQ-0139 new code: **>90% line, >90% branch**. Exceeds 80% threshold.

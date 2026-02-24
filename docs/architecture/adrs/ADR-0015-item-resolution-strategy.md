# ADR-0015: Item Resolution Strategy for Analyze and Build Verbs

## Status
Accepted

## Context
The `analyze` and `build` verbs need to resolve a user-provided reference to a specific backlog item. Users may provide:

- An exact slug: `"payment-processing"`
- A BACKLOG.md item number: `"3.2"`
- An external reference: `"#42"` or `"JIRA-1250"`
- A description fragment: `"payment processing"`

The resolution must be deterministic, fast, and handle ambiguous input gracefully.

## Decision
Use a **priority-chain resolution strategy** that tries multiple strategies in order, stopping at the first match:

| Priority | Strategy | Input Pattern | Lookup |
|----------|----------|---------------|--------|
| 1 | Exact slug | Alphanumeric with hyphens | `docs/requirements/{slug}/meta.json` exists |
| 2 | BACKLOG.md item number | `N.N` pattern | Line-scan BACKLOG.md |
| 3 | External reference | `#N` or `PROJECT-N` | Scan meta.json files for matching `source_id` |
| 4 | Fuzzy description match | Free text | Case-insensitive substring search in BACKLOG.md titles |

If no match is found, offer to run `add` first to create the item.

If multiple matches are found (only possible with strategy 4), present the options and ask the user to choose.

## Consequences

**Positive:**
- Flexible: supports all common ways users reference items
- Deterministic: priority order prevents ambiguity between strategies
- Fast: slug lookup is O(1) file existence check; BACKLOG scan is O(n) but n is small
- Graceful degradation: falls through from most specific to most fuzzy

**Negative:**
- Fuzzy matching may produce false positives for short description fragments
- External reference scan requires reading multiple meta.json files (O(m) where m = item count)
- No caching of resolution results (acceptable for small item counts)

## Alternatives Considered
- **Slug-only resolution**: Simplest but forces users to remember exact slugs. Poor UX.
- **Interactive picker**: Always show a menu of items. Too slow for users who know what they want.
- **Full-text search index**: Over-engineering for < 100 items. Article V.
- **BACKLOG.md number only**: Would work but misses the common case of users typing descriptions.

## Traces
- FR-002 (Analyze verb, step 1: resolve target item)
- FR-003 (Build verb, step 1: resolve target item)
- Article IV (Explicit Over Implicit), Article V (Simplicity First)

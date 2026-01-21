# Post-Mortem: {Incident Title}

**Incident ID**: INC-{number}
**Date of Incident**: {YYYY-MM-DD}
**Post-Mortem Date**: {YYYY-MM-DD}
**Author**: {Name}
**Status**: {Draft \| Final}

---

## Executive Summary

{2-3 paragraph summary suitable for executive audience}

---

## Incident Summary

| Metric | Value |
|--------|-------|
| Duration | {X hours Y minutes} |
| Severity | {Critical \| High \| Medium \| Low} |
| User Impact | {X% of users affected} |
| Financial Impact | {if applicable} |
| Time to Detect (TTD) | {X minutes} |
| Time to Mitigate (TTM) | {X minutes} |
| Time to Resolve (TTR) | {X minutes} |

---

## Timeline

### Detection
| Time (UTC) | Event |
|------------|-------|
| HH:MM | First user report / Alert triggered |
| HH:MM | Team member acknowledged |
| HH:MM | Incident officially declared |

### Investigation
| Time (UTC) | Event |
|------------|-------|
| HH:MM | {Investigation step} |
| HH:MM | {Investigation step} |
| HH:MM | Root cause identified |

### Mitigation
| Time (UTC) | Event |
|------------|-------|
| HH:MM | Mitigation started |
| HH:MM | {Mitigation step} |
| HH:MM | Service restored |

### Resolution
| Time (UTC) | Event |
|------------|-------|
| HH:MM | Permanent fix applied |
| HH:MM | Incident declared resolved |

---

## Root Cause Analysis

### The Five Whys

1. **Why** did {symptom} occur?
   - Because {reason 1}

2. **Why** did {reason 1} happen?
   - Because {reason 2}

3. **Why** did {reason 2} happen?
   - Because {reason 3}

4. **Why** did {reason 3} happen?
   - Because {reason 4}

5. **Why** did {reason 4} happen?
   - Because {root cause}

### Root Cause Summary
{Clear statement of the root cause}

### Technical Details
{Detailed technical explanation}

```
{Code snippets, logs, or configuration that caused the issue}
```

---

## Contributing Factors

### Primary Factors
1. {Factor 1 with explanation}
2. {Factor 2 with explanation}

### Secondary Factors
1. {Factor 1 with explanation}
2. {Factor 2 with explanation}

### Process Factors
1. {Factor 1 with explanation}
2. {Factor 2 with explanation}

---

## Impact Assessment

### User Impact
- **Affected Users**: {number or percentage}
- **Affected Functionality**: {what couldn't users do}
- **User Complaints**: {number received}
- **Data Impact**: {any data loss or corruption}

### Business Impact
- **Revenue Impact**: {$X or N/A}
- **SLA Violation**: {Yes/No - details}
- **Reputation Impact**: {description}

### Technical Impact
- **Systems Affected**: {list}
- **Data Integrity**: {any concerns}
- **Technical Debt**: {any created}

---

## Response Assessment

### What Went Well

1. **{Category}**: {What went well and why}
   - Evidence: {specific example}

2. **{Category}**: {What went well and why}
   - Evidence: {specific example}

3. **{Category}**: {What went well and why}
   - Evidence: {specific example}

### What Didn't Go Well

1. **{Category}**: {What didn't go well and why}
   - Impact: {how it affected response}

2. **{Category}**: {What didn't go well and why}
   - Impact: {how it affected response}

3. **{Category}**: {What didn't go well and why}
   - Impact: {how it affected response}

### Where We Got Lucky

1. {Lucky factor and potential worse outcome}
2. {Lucky factor and potential worse outcome}

---

## Lessons Learned

### Key Insights

1. {Insight 1}
2. {Insight 2}
3. {Insight 3}

### Process Improvements

1. {Improvement 1}
2. {Improvement 2}

### Technical Improvements

1. {Improvement 1}
2. {Improvement 2}

---

## Action Items

### Immediate (< 1 week)

| ID | Action | Owner | Status |
|----|--------|-------|--------|
| AI-001 | {Specific, actionable item} | {Name} | {Status} |
| AI-002 | {Specific, actionable item} | {Name} | {Status} |

### Short-term (< 1 month)

| ID | Action | Owner | Status |
|----|--------|-------|--------|
| AI-003 | {Specific, actionable item} | {Name} | {Status} |
| AI-004 | {Specific, actionable item} | {Name} | {Status} |

### Long-term (< 1 quarter)

| ID | Action | Owner | Status |
|----|--------|-------|--------|
| AI-005 | {Specific, actionable item} | {Name} | {Status} |
| AI-006 | {Specific, actionable item} | {Name} | {Status} |

---

## Prevention

### How This Could Have Been Prevented

1. {Prevention measure 1}
2. {Prevention measure 2}
3. {Prevention measure 3}

### How We'll Prevent Recurrence

1. {Specific measure being implemented}
2. {Specific measure being implemented}
3. {Specific measure being implemented}

---

## Detection Improvements

### Current Detection
- **How Detected**: {monitoring, user report, etc.}
- **Time to Detect**: {X minutes}

### Improved Detection
- **New Monitoring**: {what will be added}
- **Expected TTD**: {target time}

---

## Related Incidents

| Incident | Date | Relationship |
|----------|------|--------------|
| INC-{xxx} | {date} | {Similar root cause / Related} |

---

## Appendix

### A. Relevant Logs
```
{Log excerpts}
```

### B. Relevant Metrics
{Screenshots or graphs from monitoring}

### C. Communication Sent
{Copy of any external communication}

### D. References
- {Link to incident ticket}
- {Link to relevant documentation}
- {Link to related PRs/commits}

---

## Post-Mortem Meeting

**Date**: {YYYY-MM-DD}
**Attendees**: {List}

### Discussion Notes
{Key points from the post-mortem meeting}

### Decisions Made
{Any decisions made during the meeting}

---

## Sign-Off

| Role | Name | Date |
|------|------|------|
| Author | {Name} | {Date} |
| Reviewed By | {Name} | {Date} |
| Approved By | {Name} | {Date} |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | {date} | {author} | Initial version |

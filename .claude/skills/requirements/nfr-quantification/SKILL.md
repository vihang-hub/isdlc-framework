---
name: nfr-quantification
description: Convert non-functional requirements to measurable metrics
skill_id: REQ-010
owner: requirements
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Defining NFRs, architecture input, SLA definition
dependencies: [REQ-003]
---

# NFR Quantification

## Purpose
Transform vague non-functional requirements into specific, measurable metrics that can be tested, monitored, and used as acceptance criteria.

## When to Use
- NFR definition
- SLA discussions
- Architecture decisions
- Performance targets
- Monitoring setup

## Prerequisites
- NFR categories identified
- Business context understood
- Industry benchmarks available

## Process

### Step 1: Identify NFR Categories
```
Categories to quantify:
- Performance (response time, throughput)
- Scalability (users, data volume)
- Availability (uptime, recovery)
- Security (compliance, encryption)
- Usability (accessibility, satisfaction)
- Reliability (error rates, MTBF)
- Maintainability (code quality, documentation)
```

### Step 2: Define Specific Metrics
```
For each NFR, specify:
- Metric name
- Unit of measurement
- Target value
- Acceptable range
- Measurement method
- Monitoring frequency
```

### Step 3: Set Realistic Targets
```
Consider:
- Industry benchmarks
- Competitor analysis
- User expectations
- Technical feasibility
- Cost implications
- Current baseline (if exists)
```

### Step 4: Create NFR Matrix
```
Matrix format:
| NFR ID | Category | Metric | Target | Min | Max | Method |
|--------|----------|--------|--------|-----|-----|--------|
| NFR-001 | Perf | Response | 2s | 1s | 3s | APM |
```

### Step 5: Define Measurement Plan
```
For each metric:
- How is it measured?
- When is it measured?
- Who reviews results?
- What triggers alerts?
- What is the escalation path?
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| raw_nfrs | Markdown | Yes | Unquantified NFRs |
| benchmarks | JSON | Optional | Industry standards |
| constraints | Markdown | Optional | System constraints |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| nfr_matrix.md | Markdown | Quantified NFRs |
| monitoring_plan.md | Markdown | Measurement approach |
| sla_targets.md | Markdown | SLA definition |

## Project-Specific Considerations
- Peak load during application deadlines
- GDPR compliance metrics (response times for data requests)
- External API dependency SLAs
- Multi-region latency targets

## Integration Points
- **Architecture Agent**: NFRs drive design
- **DevOps Agent**: Monitoring implementation
- **Operations Agent**: SLA tracking
- **Test Manager**: Performance test design

## Examples
```
NFR Quantification Matrix - SDLC Framework

PERFORMANCE:
| ID | Metric | Target | Threshold | Critical |
|----|--------|--------|-----------|----------|
| NFR-P01 | Page load time | < 2s | < 3s | < 5s |
| NFR-P02 | API response | < 500ms | < 1s | < 2s |
| NFR-P03 | Search results | < 2s | < 3s | < 5s |
| NFR-P04 | File upload (10MB) | < 30s | < 60s | < 120s |

SCALABILITY:
| ID | Metric | Target | Notes |
|----|--------|--------|-------|
| NFR-S01 | Concurrent users | 10,000 | Normal load |
| NFR-S02 | Peak users | 25,000 | Deadline periods |
| NFR-S03 | Applications/day | 5,000 | Processing capacity |
| NFR-S04 | Storage growth | 100GB/month | Document uploads |

AVAILABILITY:
| ID | Metric | Target | Recovery |
|----|--------|--------|----------|
| NFR-A01 | Uptime | 99.5% | Monthly measure |
| NFR-A02 | RTO | 4 hours | Max recovery time |
| NFR-A03 | RPO | 1 hour | Max data loss |

SECURITY:
| ID | Metric | Target |
|----|--------|--------|
| NFR-SEC01 | Encryption | AES-256 at rest |
| NFR-SEC02 | TLS | TLS 1.3 minimum |
| NFR-SEC03 | Password hash | bcrypt, cost 12 |
| NFR-SEC04 | Session timeout | 30 min inactive |

GDPR COMPLIANCE:
| ID | Metric | Target |
|----|--------|--------|
| NFR-G01 | Data access request | < 30 days |
| NFR-G02 | Deletion request | < 72 hours |
| NFR-G03 | Breach notification | < 72 hours |
```

## Validation
- All NFRs have measurable metrics
- Targets are realistic and achievable
- Measurement method defined
- Monitoring plan in place
- Stakeholder agreement on targets


# ============================================================================
# ARCHITECTURE AGENT SKILLS (12 Skills: ARCH-001 to ARCH-012)
# ============================================================================
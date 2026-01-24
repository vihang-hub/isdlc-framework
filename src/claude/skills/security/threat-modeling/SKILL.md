---
name: threat-modeling
description: Identify security threats using STRIDE methodology
skill_id: SEC-002
owner: security-compliance-auditor
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Security design, risk identification
dependencies: []
---

# Threat Modeling

## Purpose
Systematically identify security threats to the system using STRIDE methodology and define appropriate mitigations.

## When to Use
- System design phase
- Before implementation
- Major feature additions
- Security assessment

## Prerequisites
- System architecture
- Data flow diagrams
- Asset inventory

## Process

### Step 1: Define Scope
```
Scope definition:
- System boundaries
- Components included
- Trust boundaries
- Data flows
```

### Step 2: Create Data Flow Diagram
```
DFD elements:
- External entities
- Processes
- Data stores
- Data flows
- Trust boundaries
```

### Step 3: Apply STRIDE
```
For each component:
- Spoofing: Identity threats
- Tampering: Data modification
- Repudiation: Deniability
- Information Disclosure: Data leaks
- Denial of Service: Availability
- Elevation of Privilege: Access
```

### Step 4: Document Threats
```
Threat documentation:
- Threat ID
- Category (STRIDE)
- Description
- Affected component
- Likelihood
- Impact
- Mitigation
```

### Step 5: Define Mitigations
```
Mitigation planning:
- Control type
- Implementation
- Owner
- Priority
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| architecture | Markdown | Yes | System design |
| dfd | Mermaid | Yes | Data flow diagram |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| threat_model.md | Markdown | Complete analysis |
| threat_matrix.csv | CSV | Threat inventory |
| mitigation_plan.md | Markdown | Mitigation actions |

## Project-Specific Considerations
- User authentication threats
- Application data tampering
- Document confidentiality
- GDPR compliance threats

## Integration Points
- **Architecture Agent**: DFD input
- **Developer Agent**: Mitigation implementation

## Examples
[See detailed example in Part 1 - skills-content-part1.md under SEC-002]

## Validation
- All components analyzed
- STRIDE applied comprehensively
- Mitigations defined
- Priorities assigned
- Stakeholders reviewed
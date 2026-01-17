---
name: infrastructure-design
description: Design cloud architecture and containerization strategy
skill_id: ARCH-005
owner: architecture
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Infrastructure planning, cloud migration, scaling design
dependencies: [ARCH-001, ARCH-002]
---

# Infrastructure Design

## Purpose
Design the infrastructure architecture including cloud services, containerization, networking, and deployment topology to support application requirements.

## When to Use
- Initial infrastructure design
- Cloud provider selection
- Scaling architecture
- Cost optimization

## Prerequisites
- Application architecture defined
- NFRs (especially scalability)
- Budget constraints
- Team DevOps capabilities

## Process

### Step 1: Define Infrastructure Requirements
```
From NFRs, determine:
- Compute needs (CPU, memory)
- Storage needs (type, size)
- Network needs (bandwidth, latency)
- Availability requirements (SLA)
- Geographic distribution
- Compliance requirements (data residency)
```

### Step 2: Select Cloud Provider
```
Evaluation criteria:
- Service availability
- Pricing model
- Team familiarity
- Compliance certifications
- Regional presence
- Managed service quality
```

### Step 3: Design Compute Architecture
```
Options:
- VMs: Full control, more management
- Containers: Portable, efficient
- Serverless: Pay-per-use, limited control
- Managed services: Less control, less ops

For each tier:
- Web tier
- Application tier
- Database tier
- Background workers
```

### Step 4: Design Networking
```
Network components:
- VPC/Virtual Network
- Subnets (public/private)
- Load balancers
- CDN for static assets
- DNS configuration
- Firewall rules
```

### Step 5: Create Infrastructure Diagram
```
Document:
- All components
- Network topology
- Data flow
- Failover paths
- External integrations
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| application_architecture | Markdown | Yes | App design |
| nfr_matrix | Markdown | Yes | Scale requirements |
| budget | JSON | Optional | Cost constraints |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| infrastructure_design.md | Markdown | Complete design |
| infrastructure_diagram | Image/Mermaid | Visual topology |
| cost_estimate.md | Markdown | Expected costs |

## Project-Specific Considerations
- GDPR: EU data residency for EU users
- Peak load: Application deadline periods
- Document storage: S3 with CDN
- Database: Managed PostgreSQL for reliability

## Integration Points
- **DevOps Agent**: Implementation
- **Security Agent**: Network security review
- **Operations Agent**: Monitoring setup

## Examples
```
Infrastructure Design - SDLC Framework

Cloud Provider: AWS (EU-WEST-1 primary for GDPR)

Architecture:
┌─────────────────────────────────────────────────────────┐
│                    CloudFront CDN                        │
│                 (Static assets, caching)                 │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│              Application Load Balancer                   │
│                    (HTTPS only)                          │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────┐
│                    ECS Fargate                           │
│     ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│     │  API (x3)   │  │  API (x3)   │  │ Worker (x2) │   │
│     └─────────────┘  └─────────────┘  └─────────────┘   │
└─────────────────────────────────────────────────────────┘
                           │
            ┌──────────────┼──────────────┐
            ▼              ▼              ▼
     ┌──────────┐   ┌──────────┐   ┌──────────┐
     │   RDS    │   │ElastiCache│  │    S3    │
     │PostgreSQL│   │  Redis    │   │Documents │
     │ (Multi-AZ)│   │          │   │          │
     └──────────┘   └──────────┘   └──────────┘

Environments:
- Production: Full redundancy
- Staging: Reduced capacity (same architecture)
- Development: Minimal (single instances)

Cost Estimate (Monthly):
- Compute (ECS): $200
- Database (RDS): $150
- Cache (Redis): $50
- Storage (S3): $30
- Network (ALB, CDN): $50
- Total: ~$480/month (staging adds ~$150)
```

## Validation
- Meets availability requirements
- Scales to NFR targets
- Within budget constraints
- GDPR compliance addressed
- Diagram is complete and accurate
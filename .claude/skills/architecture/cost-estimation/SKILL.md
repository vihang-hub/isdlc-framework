---
name: cost-estimation
description: Estimate infrastructure and operational costs
skill_id: ARCH-009
owner: solution-architect
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Budget planning, architecture decisions, scaling projections
dependencies: [ARCH-005]
---

# Cost Estimation

## Purpose
Estimate infrastructure costs, operational expenses, and total cost of ownership to support budget planning and architecture decisions.

## When to Use
- Architecture planning
- Budget approval
- Scaling decisions
- Cost optimization
- Vendor comparison

## Prerequisites
- Infrastructure design defined
- Expected usage patterns
- Cloud provider pricing
- Operational requirements

## Process

### Step 1: Identify Cost Components
```
Categories:
- Compute (VMs, containers, serverless)
- Database (instances, storage, backup)
- Storage (object, block, backup)
- Network (transfer, CDN, load balancer)
- Third-party services
- Licenses
- Operational (monitoring, logging)
```

### Step 2: Estimate Usage
```
For each component:
- Baseline usage
- Growth rate
- Peak vs normal
- Seasonal variation
```

### Step 3: Calculate Costs
```
For each component:
- Unit cost (from pricing)
- Estimated units
- Monthly cost
- Annual cost
- Growth projection
```

### Step 4: Consider Optimizations
```
Cost reduction options:
- Reserved instances
- Spot instances
- Right-sizing
- Auto-scaling
- Caching
- CDN
- Storage tiers
```

### Step 5: Create Cost Model
```
Model includes:
- Itemized costs
- Monthly totals
- Annual projections
- Growth scenarios
- Optimization opportunities
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| infrastructure_design | Markdown | Yes | Architecture |
| usage_projections | JSON | Yes | Expected usage |
| pricing | JSON | Optional | Provider pricing |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| cost_estimate.md | Markdown | Detailed estimate |
| cost_model.xlsx | Spreadsheet | Calculations |
| optimization_recommendations | Markdown | Cost savings |

## Project-Specific Considerations
- Document storage grows linearly
- Peak costs during deadline periods
- External API costs (if metered)
- GDPR compliance may add costs

## Integration Points
- **DevOps Agent**: Infrastructure implementation
- **Operations Agent**: Cost monitoring

## Examples
```
Cost Estimate - SDLC Framework (AWS, EU-WEST-1)

MONTHLY COST BREAKDOWN:

COMPUTE:
| Component | Spec | Qty | Monthly |
|-----------|------|-----|---------|
| API (ECS) | 0.5 vCPU, 1GB | 2-10 | $80-400 |
| Workers | 0.5 vCPU, 1GB | 1-5 | $40-200 |
| Average | | | $180 |

DATABASE:
| Component | Spec | Qty | Monthly |
|-----------|------|-----|---------|
| RDS PostgreSQL | db.t3.medium | 1 | $100 |
| RDS Storage | 100GB | 1 | $25 |
| Read Replica | db.t3.small | 1 | $50 |
| Backup | 100GB | 1 | $10 |
| Total | | | $185 |

CACHE:
| Component | Spec | Monthly |
|-----------|------|---------|
| ElastiCache | cache.t3.micro | $15 |

STORAGE:
| Component | Spec | Monthly |
|-----------|------|---------|
| S3 (documents) | 500GB | $12 |
| S3 (requests) | 1M req | $5 |
| CloudFront | 100GB transfer | $10 |
| Total | | $27 |

NETWORK:
| Component | Monthly |
|-----------|---------|
| ALB | $20 |
| Data Transfer | $30 |
| Total | $50 |

OTHER:
| Component | Monthly |
|-----------|---------|
| Secrets Manager | $5 |
| CloudWatch | $20 |
| Route53 | $5 |
| Total | $30 |

SUMMARY:
| Category | Monthly | Annual |
|----------|---------|--------|
| Compute | $180 | $2,160 |
| Database | $185 | $2,220 |
| Cache | $15 | $180 |
| Storage | $27 | $324 |
| Network | $50 | $600 |
| Other | $30 | $360 |
| TOTAL | $487 | $5,844 |

With reserved instances (1yr): ~$4,200/year
Peak months (add 50%): ~$730/month

GROWTH PROJECTION:
| Year | Users | Monthly Cost |
|------|-------|--------------|
| Y1 | 5K | $500 |
| Y2 | 15K | $800 |
| Y3 | 30K | $1,200 |
```

## Validation
- All components included
- Pricing is current
- Usage estimates reasonable
- Growth scenarios modeled
- Optimization identified
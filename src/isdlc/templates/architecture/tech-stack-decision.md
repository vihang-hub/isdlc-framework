# Technology Stack Decision

**Project**: {Project Name}
**Date**: {Date}
**Author**: {Author}

---

## Executive Summary

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Frontend | {technology} | {brief reason} |
| Backend | {technology} | {brief reason} |
| Database | {technology} | {brief reason} |
| Authentication | {technology} | {brief reason} |
| Cloud/Hosting | {technology} | {brief reason} |
| CI/CD | {technology} | {brief reason} |

---

## Requirements Driving Decisions

### Performance Requirements
- {NFR reference and target}

### Scalability Requirements
- {NFR reference and target}

### Security Requirements
- {NFR reference and target}

### Team Constraints
- {Team size, skills, experience}

### Budget Constraints
- {Budget limitations}

### Timeline Constraints
- {Timeline requirements}

---

## Evaluation Criteria

| Criterion | Weight | Description |
|-----------|--------|-------------|
| Maturity | High | Production-ready, stable releases |
| Community | High | Active community, Stack Overflow presence |
| Documentation | Medium | Quality documentation, tutorials |
| Performance | Varies | Meets performance requirements |
| Security | High | Security track record, active maintenance |
| Licensing | Medium | Compatible with project, cost implications |
| Team Fit | High | Team experience, learning curve |
| Cost | Medium | Licensing, infrastructure, operations |

---

## Frontend

### Selected: {Technology}

### Options Evaluated

| Option | Maturity | Community | Performance | Team Fit | Score |
|--------|----------|-----------|-------------|----------|-------|
| React | 5 | 5 | 4 | {score} | {total} |
| Vue.js | 4 | 4 | 4 | {score} | {total} |
| Svelte | 3 | 3 | 5 | {score} | {total} |
| Angular | 5 | 4 | 3 | {score} | {total} |

### Rationale
{Why this choice was made}

### Additional Frontend Decisions
- **State Management**: {choice and rationale}
- **UI Component Library**: {choice and rationale}
- **CSS Approach**: {choice and rationale}
- **Build Tool**: {choice and rationale}

---

## Backend

### Selected: {Technology}

### Options Evaluated

| Option | Maturity | Community | Performance | Team Fit | Score |
|--------|----------|-----------|-------------|----------|-------|
| Node.js | 5 | 5 | 4 | {score} | {total} |
| Python/FastAPI | 4 | 4 | 4 | {score} | {total} |
| Go | 4 | 3 | 5 | {score} | {total} |
| Java/Spring | 5 | 4 | 4 | {score} | {total} |

### Rationale
{Why this choice was made}

### Additional Backend Decisions
- **Framework**: {choice and rationale}
- **ORM/Database Client**: {choice and rationale}
- **Testing Framework**: {choice and rationale}

---

## Database

### Selected: {Technology}

### Options Evaluated

| Option | Type | Maturity | Scalability | Team Fit | Score |
|--------|------|----------|-------------|----------|-------|
| PostgreSQL | Relational | 5 | 4 | {score} | {total} |
| MySQL | Relational | 5 | 4 | {score} | {total} |
| MongoDB | Document | 4 | 5 | {score} | {total} |
| DynamoDB | Key-Value | 4 | 5 | {score} | {total} |

### Rationale
{Why this choice was made}

### Additional Database Decisions
- **Caching Layer**: {choice and rationale}
- **Search Engine**: {choice and rationale, if needed}

---

## Authentication

### Selected: {Technology}

### Options Evaluated

| Option | Type | Maturity | Security | Cost | Score |
|--------|------|----------|----------|------|-------|
| Auth0 | Managed | 5 | 5 | $$$ | {total} |
| Clerk | Managed | 4 | 5 | $$ | {total} |
| NextAuth | Self-hosted | 4 | 4 | Free | {total} |
| Custom | Self-hosted | N/A | Varies | Free | {total} |

### Rationale
{Why this choice was made}

---

## Cloud/Hosting

### Selected: {Technology}

### Options Evaluated

| Option | Maturity | Services | Cost | Team Fit | Score |
|--------|----------|----------|------|----------|-------|
| AWS | 5 | 5 | $$$ | {score} | {total} |
| GCP | 5 | 5 | $$ | {score} | {total} |
| Azure | 5 | 5 | $$$ | {score} | {total} |
| Vercel | 4 | 3 | $ | {score} | {total} |
| Railway | 3 | 3 | $ | {score} | {total} |

### Rationale
{Why this choice was made}

---

## CI/CD

### Selected: {Technology}

### Options Evaluated

| Option | Integration | Features | Cost | Score |
|--------|-------------|----------|------|-------|
| GitHub Actions | 5 | 4 | Free/$ | {total} |
| GitLab CI | 5 | 5 | Free/$$ | {total} |
| CircleCI | 4 | 5 | $$ | {total} |
| Jenkins | 3 | 5 | Free | {total} |

### Rationale
{Why this choice was made}

---

## Additional Tools

| Category | Tool | Purpose |
|----------|------|---------|
| Monitoring | {tool} | {purpose} |
| Logging | {tool} | {purpose} |
| Error Tracking | {tool} | {purpose} |
| Analytics | {tool} | {purpose} |

---

## Cost Estimate

| Component | Monthly Cost | Notes |
|-----------|--------------|-------|
| Hosting | ${amount} | {details} |
| Database | ${amount} | {details} |
| Auth | ${amount} | {details} |
| Monitoring | ${amount} | {details} |
| **Total** | **${total}** | |

---

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| {risk 1} | {H/M/L} | {H/M/L} | {mitigation} |
| {risk 2} | {H/M/L} | {H/M/L} | {mitigation} |

---

## Related ADRs

- ADR-{number}: {Title}
- ADR-{number}: {Title}

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | {date} | {author} | Initial version |

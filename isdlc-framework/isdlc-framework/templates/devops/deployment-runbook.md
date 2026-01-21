# Deployment Runbook

**Project**: {Project Name}
**Environment**: {Production / Staging / Development}
**Version**: {Version}
**Last Updated**: {Date}

---

## 1. Overview

### 1.1 Purpose
This runbook provides step-by-step instructions for deploying {Project Name} to {Environment}.

### 1.2 Scope
- Application deployment
- Database migrations
- Configuration updates
- Rollback procedures

### 1.3 Prerequisites

- [ ] Access to {cloud provider} console
- [ ] `{CLI tool}` installed and configured
- [ ] Repository access
- [ ] Deployment approval (production only)

---

## 2. Pre-Deployment Checklist

### 2.1 Verification

- [ ] All tests passing in CI
- [ ] Security scan completed
- [ ] Code review approved
- [ ] Release notes prepared
- [ ] Deployment window confirmed
- [ ] Stakeholders notified

### 2.2 Backup (Production Only)

- [ ] Database backup created
- [ ] Backup verified
- [ ] Current version documented

```bash
# Create database backup
{backup command}

# Verify backup
{verification command}
```

### 2.3 Environment Check

```bash
# Verify environment is healthy
{health check command}

# Check current version
{version check command}
```

---

## 3. Deployment Procedure

### 3.1 Prepare Release

**Step 1: Tag Release**
```bash
# Create release tag
git tag -a v{version} -m "Release v{version}"
git push origin v{version}
```

**Step 2: Build Artifacts**
```bash
# Build production artifacts
{build command}

# Build and push Docker image (if applicable)
{docker build command}
{docker push command}
```

### 3.2 Deploy Application

**Step 3: Deploy to {Environment}**

```bash
# Deploy application
{deployment command}

# Example for various platforms:
# AWS ECS: aws ecs update-service --cluster {cluster} --service {service} --force-new-deployment
# Kubernetes: kubectl apply -f deployment.yaml
# Vercel: vercel --prod
```

**Step 4: Run Database Migrations (if applicable)**

```bash
# Run migrations
{migration command}

# Verify migrations
{verification command}
```

**Step 5: Verify Deployment**

```bash
# Check deployment status
{status command}

# Verify new version
curl https://{domain}/health
```

---

## 4. Post-Deployment Verification

### 4.1 Health Checks

| Endpoint | Expected Status | Verified |
|----------|-----------------|----------|
| `/health` | 200 OK | [ ] |
| `/health/db` | 200 OK | [ ] |
| `/health/ready` | 200 OK | [ ] |

### 4.2 Smoke Tests

| Test | Expected Result | Verified |
|------|-----------------|----------|
| Homepage loads | 200 OK, renders correctly | [ ] |
| Login flow | User can log in | [ ] |
| {Critical feature} | {Expected behavior} | [ ] |

### 4.3 Monitoring Check

- [ ] No spike in error rates
- [ ] Response times normal
- [ ] No alerts triggered
- [ ] Logs showing normal activity

---

## 5. Rollback Procedure

### 5.1 When to Rollback

Rollback immediately if:
- [ ] Error rate > 5%
- [ ] Response time p99 > {threshold}ms
- [ ] Health checks failing
- [ ] Critical functionality broken

### 5.2 Rollback Steps

**Step 1: Announce Rollback**
```
Notify team in {Slack channel}: "Initiating rollback of v{version} due to {reason}"
```

**Step 2: Execute Rollback**

```bash
# Rollback to previous version
{rollback command}

# Examples:
# AWS ECS: aws ecs update-service --cluster {cluster} --service {service} --task-definition {previous-task-def}
# Kubernetes: kubectl rollout undo deployment/{deployment}
```

**Step 3: Rollback Migrations (if applicable)**

```bash
# Rollback last migration
{migration rollback command}

# Verify rollback
{verification command}
```

**Step 4: Verify Rollback**

```bash
# Check version
curl https://{domain}/health

# Run smoke tests
{smoke test commands}
```

**Step 5: Post-Rollback**

- [ ] Document incident
- [ ] Notify stakeholders
- [ ] Create incident ticket
- [ ] Schedule post-mortem

---

## 6. Troubleshooting

### 6.1 Deployment Fails

**Symptoms**: Deployment command returns error

**Diagnosis**:
```bash
# Check deployment logs
{log command}

# Check service status
{status command}
```

**Resolution**:
1. Check error message
2. Review recent changes
3. Fix issue or rollback

### 6.2 Health Checks Failing

**Symptoms**: Health endpoint returns non-200

**Diagnosis**:
```bash
# Check application logs
{log command}

# Check database connectivity
{db check command}
```

**Resolution**:
1. Check database connection
2. Check external dependencies
3. Review environment variables
4. Rollback if unresolved

### 6.3 High Error Rate

**Symptoms**: Error rate spike after deployment

**Diagnosis**:
```bash
# Check error logs
{error log command}

# Check recent changes
git log --oneline -10
```

**Resolution**:
1. Identify failing requests
2. Check for breaking changes
3. Rollback if critical

### 6.4 Performance Degradation

**Symptoms**: Increased response times

**Diagnosis**:
```bash
# Check resource utilization
{monitoring command}

# Check database queries
{slow query log}
```

**Resolution**:
1. Check for N+1 queries
2. Check memory/CPU usage
3. Scale if needed
4. Rollback if unresolved

---

## 7. Communication

### 7.1 Before Deployment

```
Channel: {Slack channel}
Message: "Starting deployment of v{version} to {environment}. Expected duration: {X} minutes."
```

### 7.2 After Successful Deployment

```
Channel: {Slack channel}
Message: "Successfully deployed v{version} to {environment}. All health checks passing."
```

### 7.3 Deployment Issue

```
Channel: {Slack channel}
Message: "Issue detected during deployment of v{version}. {Brief description}. Investigating..."
```

### 7.4 After Rollback

```
Channel: {Slack channel}
Message: "Rolled back v{version} to v{previous-version} due to {reason}. Environment stable."
```

---

## 8. Contacts

| Role | Name | Contact |
|------|------|---------|
| On-call Engineer | {name} | {phone/slack} |
| Team Lead | {name} | {phone/slack} |
| DevOps | {name} | {phone/slack} |
| Database Admin | {name} | {phone/slack} |

---

## 9. Appendix

### A. Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | Database connection string | Yes |
| `{VAR}` | {Description} | {Yes/No} |

### B. Useful Commands

```bash
# View logs
{log viewing command}

# SSH to server (if applicable)
{ssh command}

# Database console
{db console command}
```

### C. Related Documents

- Architecture Overview: {link}
- Rollback Runbook: {link}
- Incident Response Runbook: {link}

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | {date} | {author} | Initial version |

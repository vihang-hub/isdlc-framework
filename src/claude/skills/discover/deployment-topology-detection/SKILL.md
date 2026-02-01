---
name: deployment-topology-detection
description: Detect deployment infrastructure from project configuration
skill_id: DISC-105
owner: architecture-analyzer
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: During architecture analysis to understand deployment and infrastructure setup
dependencies: [DISC-101]
---

# Deployment Topology Detection

## Purpose
Identify the deployment infrastructure, CI/CD pipelines, and infrastructure-as-code configurations present in the project. This informs downstream phases about how the application is built, tested, and deployed.

## When to Use
- During architecture analysis to catalog infrastructure configuration
- When determining if containerization, serverless, or traditional deployment is used
- When mapping the CI/CD pipeline for the project

## Prerequisites
- Directory scan (DISC-101) has mapped the project structure
- Project root is accessible for configuration file scanning
- Common infrastructure file patterns are known

## Process

### Step 1: Scan for Container Configuration
Search for `Dockerfile`, `docker-compose.yml`, `docker-compose.yaml`, `.dockerignore`, and container orchestration files. Check for Kubernetes manifests in `k8s/`, `kubernetes/`, `deploy/`, or `manifests/` directories. Identify base images, multi-stage builds, and compose service definitions.

### Step 2: Detect Infrastructure as Code
Look for Terraform files (`.tf`), CloudFormation templates, Pulumi configurations, CDK projects, Ansible playbooks, and serverless framework configs (`serverless.yml`, `sam-template.yaml`). Catalog each IaC tool and the resources it manages.

### Step 3: Map CI/CD Pipeline
Identify CI/CD configuration files: `.github/workflows/`, `.gitlab-ci.yml`, `Jenkinsfile`, `.circleci/config.yml`, `azure-pipelines.yml`, `bitbucket-pipelines.yml`, `.travis.yml`. Parse pipeline stages to understand build, test, and deploy steps. Record the platform and deployment targets.

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| project_root | string | Yes | Absolute path to the project root |
| directory_tree | object | Yes | Output from directory-scan |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| deployment_type | string | containerized, serverless, traditional, or hybrid |
| cicd_platform | string | Detected CI/CD platform name |
| infrastructure_files | list | Paths to all infrastructure configuration files |
| pipeline_stages | list | Build, test, deploy stages from CI/CD config |

## Integration Points
- **directory-scan**: Provides structural context for locating infra files
- **cloud-configuration**: Shares cloud provider detection results
- **architecture-documentation**: Deployment topology feeds the architecture overview
- **state-initialization**: Deployment type is persisted in state.json

## Validation
- At least one deployment indicator is found or absence is explicitly noted
- CI/CD platform detection is based on actual config file presence
- Infrastructure files listed are confirmed to exist on disk
- Deployment type classification includes supporting evidence

---
name: integration-point-mapping
description: Map external service integrations and API connections
skill_id: DISC-106
owner: architecture-analyzer
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: During architecture analysis to catalog external service dependencies
dependencies: [DISC-101, DISC-102]
---

# Integration Point Mapping

## Purpose
Discover and catalog all external service integrations, API connections, and third-party dependencies in the codebase. This creates a map of the project's external boundaries and communication patterns.

## When to Use
- During architecture analysis to understand external dependencies
- When assessing the complexity of the integration landscape
- When planning for testing strategies that require mocking external services

## Prerequisites
- Directory scan (DISC-101) has identified source code locations
- Tech detection (DISC-102) has identified the languages and frameworks in use
- Source files and configuration files are readable

## Process

### Step 1: Search for HTTP Client Usage
Grep source code for HTTP client libraries: `axios`, `fetch`, `requests`, `http.Client`, `HttpClient`, `RestTemplate`, `Faraday`. Extract base URLs, endpoint patterns, and request configurations. Identify REST, GraphQL, and gRPC communication patterns.

### Step 2: Detect SDK and Service Imports
Search for cloud provider SDK imports (AWS SDK, Google Cloud libraries, Azure SDK), payment processors (Stripe, PayPal), auth providers (Auth0, Firebase Auth, Cognito), monitoring services (Datadog, Sentry, New Relic), and messaging systems (Redis, RabbitMQ, Kafka, SQS).

### Step 3: Map Environment-Driven Integrations
Scan `.env`, `.env.example`, environment variable references, and config files for URLs, API keys, and connection strings pointing to external services. Catalog each integration with its service name, protocol, authentication method, and the environment variables it requires.

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| source_paths | list | Yes | Directories containing source code |
| config_files | list | No | Configuration and environment files to scan |
| tech_results | object | Yes | Output from tech-detection for language context |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| integration_map | list | External services with protocols and auth methods |
| env_dependencies | list | Required environment variables for integrations |
| communication_patterns | list | REST, GraphQL, gRPC, WebSocket, message queue |
| service_categories | object | Integrations grouped by category |

## Integration Points
- **tech-detection**: Language context guides which SDK patterns to search for
- **architecture-documentation**: Integration map enriches the architecture overview
- **deployment-topology-detection**: Shared infrastructure detection for message queues
- **test-evaluator**: Integration points inform test mocking requirements

## Validation
- All detected integrations have a service name and protocol identified
- Environment variables are cataloged with their purpose
- SDK imports are verified against actual dependency manifest entries
- Integration map covers both explicit API calls and implicit service dependencies

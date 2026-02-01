---
name: domain-detection
description: Detect project business domain from codebase and project context
skill_id: DISC-304
owner: constitution-generator
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: When identifying the business domain to apply domain-specific compliance and quality standards
dependencies: []
---

# Domain Detection

## Purpose
Detect the business domain of a project by analyzing the project description, codebase keywords, and configuration patterns. Maps detected domains to applicable compliance requirements and quality standards.

## When to Use
- At the start of constitution generation before research coordination
- When a project's domain context is unknown or unspecified
- When determining which compliance frameworks apply to the project

## Prerequisites
- Project description or README is available
- Codebase is accessible for keyword scanning
- Domain taxonomy reference is loaded

## Process

### Step 1: Analyze Project Description
Parse the project description, README, and any available documentation for explicit domain mentions. Look for keywords that directly indicate the business domain (e.g., "healthcare platform", "payment processing", "e-commerce marketplace").

### Step 2: Scan for Domain Indicators
Scan the codebase for implicit domain indicators in code, configs, and dependencies. Map keywords to domains: payment/stripe/billing indicates finance, patient/diagnosis/HL7 indicates healthcare, cart/inventory/catalog indicates e-commerce, student/course/enrollment indicates education, vehicle/route/GPS indicates logistics.

### Step 3: Match Against Domain Taxonomy
Compare detected indicators against the domain taxonomy to assign a primary domain and any secondary domains. Each domain in the taxonomy carries a set of associated compliance requirements (HIPAA for healthcare, PCI-DSS for finance, GDPR for user data, SOC2 for SaaS).

### Step 4: Generate Domain Report
Produce a domain detection report listing the primary domain, secondary domains, confidence scores, and all applicable compliance requirements. Include the evidence (keywords, files) that led to each determination.

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| project_description | string | Yes | User-provided project description or README content |
| codebase_keywords | array | No | Keywords extracted from codebase scan |
| config_files | array | No | Configuration files that may contain domain hints |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| detected_domain | string | Primary business domain identified |
| secondary_domains | array | Additional applicable domains |
| compliance_requirements | array | Regulatory frameworks that apply to the domain |
| confidence_score | number | Confidence level of the domain detection (0-1) |

## Integration Points
- **research-coordination**: Provides domain context to scope research agents
- **article-generation**: Supplies compliance requirements for article creation
- **tech-detection**: May receive codebase keywords from tech stack scanning

## Validation
- At least one domain is detected with confidence above 0.5
- All detected domains exist in the domain taxonomy
- Compliance requirements are valid framework identifiers
- Evidence trail links each domain assignment to specific indicators

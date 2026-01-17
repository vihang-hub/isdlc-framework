---
name: performance-test-design
description: Design load and performance test scenarios
skill_id: TEST-012
owner: test-manager
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Performance planning, load testing, NFR validation
dependencies: [TEST-001]
---

# Performance Test Design

## Purpose
Design performance tests that validate NFRs including response time, throughput, scalability, and system behavior under load.

## When to Use
- NFR validation
- Scalability testing
- Pre-release validation
- Capacity planning

## Prerequisites
- NFRs defined with metrics
- Architecture understood
- Test environment available
- Baseline established

## Process

### Step 1: Define Test Objectives
```
Objectives:
- Response time validation
- Throughput measurement
- Scalability limits
- Breaking point identification
- Endurance verification
```

### Step 2: Identify Test Scenarios
```
Scenario types:
- Load test (expected load)
- Stress test (beyond capacity)
- Spike test (sudden load)
- Endurance test (sustained load)
```

### Step 3: Design Test Cases
```
For each scenario:
- User journey simulation
- Load profile
- Success criteria
- Metrics to capture
```

### Step 4: Create Load Profiles
```
Profile elements:
- Virtual users
- Ramp-up pattern
- Steady state duration
- Think times
- Data distribution
```

### Step 5: Document Test Plan
```
Plan includes:
- Scenarios and scripts
- Environment requirements
- Success criteria
- Execution schedule
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| nfr_matrix | Markdown | Yes | Performance NFRs |
| user_journeys | Markdown | Yes | Key user flows |
| architecture | Markdown | Yes | System design |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| performance_test_plan.md | Markdown | Test plan |
| load_scripts/ | k6/JMeter | Test scripts |
| baseline_metrics.json | JSON | Baseline data |

## Project-Specific Considerations
- Application deadline peak load
- University search performance
- Document upload under load
- Concurrent application submissions

## Integration Points
- **DevOps Agent**: Environment scaling
- **Operations Agent**: Monitoring
- **Architecture Agent**: Capacity review

## Examples
```
Performance Test Plan - SDLC Framework

OBJECTIVES:
1. Validate NFR-P01: Page load < 3s at normal load
2. Validate NFR-P02: API response < 500ms
3. Validate NFR-S01: Support 10,000 concurrent users
4. Validate NFR-S02: Support 25,000 peak users
5. Identify system breaking point

TEST SCENARIOS:

Scenario 1: Baseline Load Test
- Users: 1,000 concurrent
- Duration: 30 minutes
- Ramp-up: 5 minutes
- Purpose: Establish baseline metrics

Scenario 2: Normal Load Test
- Users: 5,000 concurrent
- Duration: 1 hour
- Ramp-up: 10 minutes
- Purpose: Validate normal operation

Scenario 3: Peak Load Test
- Users: 10,000 concurrent
- Duration: 30 minutes
- Ramp-up: 15 minutes
- Purpose: Validate peak capacity

Scenario 4: Stress Test
- Users: 15,000 → 25,000
- Duration: 30 minutes
- Ramp-up: Stepped (5K increments)
- Purpose: Find breaking point

Scenario 5: Spike Test
- Users: 5,000 → 15,000 → 5,000
- Spike duration: 5 minutes
- Purpose: Test auto-scaling

Scenario 6: Endurance Test
- Users: 3,000 constant
- Duration: 8 hours
- Purpose: Detect memory leaks

USER JOURNEYS:

Journey 1: University Search (40% of load)
1. Home page load
2. Search with filters
3. View university details
4. View program details
5. Add to favorites

Journey 2: Application Flow (30% of load)
1. Login
2. Dashboard
3. Start application
4. Fill 5 form steps
5. Upload document
6. Submit

Journey 3: Status Check (20% of load)
1. Login
2. Dashboard
3. View application
4. Check status

Journey 4: Browse Only (10% of load)
1. Home page
2. Random navigation
3. Search

LOAD SCRIPT (k6):

```javascript
// scripts/load-test.js
import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate, Trend } from 'k6/metrics'

const errorRate = new Rate('errors')
const searchDuration = new Trend('search_duration')

export const options = {
  scenarios: {
    normal_load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '5m', target: 1000 },
        { duration: '30m', target: 5000 },
        { duration: '5m', target: 0 }
      ]
    }
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],
    errors: ['rate<0.01']
  }
}

export default function() {
  // Journey selection based on weights
  const journey = selectJourney()
  
  if (journey === 'search') {
    universitySearchJourney()
  } else if (journey === 'application') {
    applicationJourney()
  }
  // ...
}

function universitySearchJourney() {
  // Home page
  let res = http.get(`${BASE_URL}/`)
  check(res, { 'home ok': r => r.status === 200 })
  sleep(2) // Think time
  
  // Search
  const start = Date.now()
  res = http.get(`${BASE_URL}/api/v1/universities?country=DE`)
  searchDuration.add(Date.now() - start)
  check(res, { 'search ok': r => r.status === 200 })
  
  if (res.status !== 200) {
    errorRate.add(1)
    return
  }
  
  // View details
  const universities = JSON.parse(res.body).data
  if (universities.length > 0) {
    const id = universities[0].id
    res = http.get(`${BASE_URL}/api/v1/universities/${id}`)
    check(res, { 'detail ok': r => r.status === 200 })
  }
  
  sleep(3)
}
```

SUCCESS CRITERIA:

| Metric | Baseline | Normal | Peak | Threshold |
|--------|----------|--------|------|-----------|
| Response p95 | <300ms | <500ms | <1s | <2s |
| Error rate | <0.1% | <0.5% | <1% | <2% |
| Throughput | 500 rps | 2000 rps | 4000 rps | N/A |

ENVIRONMENT:

Performance test environment:
- 4x API instances (vs 2 prod)
- Production-equivalent database
- Isolated network
- Full monitoring stack

Schedule:
- Baseline: Weekly
- Full suite: Pre-release
- Endurance: Monthly
```

## Validation
- All NFRs have tests
- Scenarios cover user journeys
- Thresholds defined
- Scripts executable
- Environment specified
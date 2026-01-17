---
name: integration-implementation
description: Implement external service integrations
skill_id: DEV-007
owner: developer
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Third-party API integration
dependencies: [DEV-001, DEV-003]
---

# Integration Implementation

## Purpose
Implement robust integrations with external services including proper error handling, retries, and circuit breakers.

## When to Use
- External API integration
- Third-party service connection
- Webhook implementation

## Prerequisites
- Integration design complete
- API documentation available
- Credentials configured
- Error handling patterns

## Process

### Step 1: Create Service Adapter
```
Adapter pattern:
- Interface definition
- Implementation
- Configuration
- Dependency injection
```

### Step 2: Implement API Client
```
Client features:
- Request building
- Authentication
- Response parsing
- Error mapping
```

### Step 3: Add Resilience
```
Resilience patterns:
- Retry with backoff
- Circuit breaker
- Timeout handling
- Fallback behavior
```

### Step 4: Implement Data Mapping
```
Data transformation:
- External → internal
- Internal → external
- Validation
- Defaults
```

### Step 5: Add Monitoring
```
Observability:
- Request logging
- Metrics
- Error tracking
- Health checks
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| integration_spec | Markdown | Yes | Integration design |
| api_docs | Markdown | Yes | External API docs |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| services/ | TypeScript | Service adapters |
| clients/ | TypeScript | API clients |
| mappers/ | TypeScript | Data mappers |

## Project-Specific Considerations
- University database API
- Rate limiting handling
- Caching responses
- Sync job implementation

## Integration Points
- **Architecture Agent**: Integration design
- **Test Manager**: Integration tests
- **Operations Agent**: Monitoring

## Examples
```typescript
// src/integrations/university-api/university-api.client.ts
import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { HttpService } from '@nestjs/axios'
import { CircuitBreaker, CircuitBreakerState } from './circuit-breaker'
import { RetryPolicy } from './retry-policy'
import { 
  UniversityApiResponse, 
  UniversitySearchParams 
} from './types'

@Injectable()
export class UniversityApiClient {
  private readonly logger = new Logger(UniversityApiClient.name)
  private readonly baseUrl: string
  private readonly apiKey: string
  private readonly circuitBreaker: CircuitBreaker
  private readonly retryPolicy: RetryPolicy

  constructor(
    private httpService: HttpService,
    private configService: ConfigService
  ) {
    this.baseUrl = this.configService.get('UNIVERSITY_API_URL')
    this.apiKey = this.configService.get('UNIVERSITY_API_KEY')
    
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      recoveryTimeout: 30000,
      halfOpenMaxCalls: 3
    })
    
    this.retryPolicy = new RetryPolicy({
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2
    })
  }

  async searchUniversities(
    params: UniversitySearchParams
  ): Promise<UniversityApiResponse> {
    return this.circuitBreaker.execute(async () => {
      return this.retryPolicy.execute(async () => {
        const response = await this.httpService.axiosRef.get(
          `${this.baseUrl}/universities`,
          {
            params: {
              country: params.country,
              name: params.query,
              page: params.page,
              limit: params.limit
            },
            headers: {
              'X-API-Key': this.apiKey
            },
            timeout: 10000
          }
        )

        return response.data
      })
    })
  }

  async getUniversity(externalId: string): Promise<UniversityApiResponse> {
    return this.circuitBreaker.execute(async () => {
      const response = await this.httpService.axiosRef.get(
        `${this.baseUrl}/universities/${externalId}`,
        {
          headers: { 'X-API-Key': this.apiKey },
          timeout: 10000
        }
      )

      return response.data
    })
  }

  getCircuitState(): CircuitBreakerState {
    return this.circuitBreaker.getState()
  }
}

// src/integrations/university-api/circuit-breaker.ts
export class CircuitBreaker {
  private state: CircuitBreakerState = 'closed'
  private failureCount = 0
  private lastFailureTime: number = 0
  private halfOpenCalls = 0

  constructor(private config: CircuitBreakerConfig) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.config.recoveryTimeout) {
        this.state = 'half-open'
        this.halfOpenCalls = 0
      } else {
        throw new CircuitOpenError('Circuit breaker is open')
      }
    }

    if (this.state === 'half-open') {
      if (this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
        throw new CircuitOpenError('Circuit breaker half-open limit reached')
      }
      this.halfOpenCalls++
    }

    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess(): void {
    this.failureCount = 0
    if (this.state === 'half-open') {
      this.state = 'closed'
    }
  }

  private onFailure(): void {
    this.failureCount++
    this.lastFailureTime = Date.now()

    if (this.failureCount >= this.config.failureThreshold) {
      this.state = 'open'
    }
  }

  getState(): CircuitBreakerState {
    return this.state
  }
}

// src/integrations/university-api/university.mapper.ts
import { University, Program } from '@prisma/client'
import { 
  ExternalUniversity, 
  ExternalProgram 
} from './types'

export class UniversityMapper {
  static toInternal(external: ExternalUniversity): Partial<University> {
    return {
      externalId: external.id,
      name: external.name,
      country: this.mapCountryCode(external.country_code),
      city: external.location?.city || 'Unknown',
      website: external.website_url,
      logoUrl: external.logo?.url,
      lastSyncedAt: new Date()
    }
  }

  static programToInternal(external: ExternalProgram): Partial<Program> {
    return {
      externalId: external.id,
      name: external.name,
      degreeLevel: this.mapDegreeLevel(external.level),
      fieldOfStudy: external.field,
      language: external.language || 'English',
      durationMonths: external.duration_months,
      tuitionAmount: external.tuition?.amount,
      tuitionCurrency: external.tuition?.currency || 'EUR',
      applicationDeadline: external.deadline 
        ? new Date(external.deadline) 
        : null
    }
  }

  private static mapCountryCode(code: string): string {
    // Map 2-letter to country name if needed
    const countries: Record<string, string> = {
      'DE': 'Germany',
      'NL': 'Netherlands',
      'FR': 'France'
      // ... more mappings
    }
    return countries[code] || code
  }

  private static mapDegreeLevel(level: string): string {
    const levels: Record<string, string> = {
      'bachelor': 'Bachelor',
      'master': 'Master',
      'phd': 'PhD',
      'mba': 'MBA'
    }
    return levels[level.toLowerCase()] || level
  }
}

// src/integrations/university-api/university-sync.service.ts
@Injectable()
export class UniversitySyncService {
  private readonly logger = new Logger(UniversitySyncService.name)

  constructor(
    private universityApiClient: UniversityApiClient,
    private prisma: PrismaService
  ) {}

  @Cron('0 2 * * *') // Run at 2 AM daily
  async syncUniversities(): Promise<SyncResult> {
    this.logger.log('Starting university sync')
    
    const result: SyncResult = {
      created: 0,
      updated: 0,
      errors: []
    }

    try {
      let page = 1
      let hasMore = true

      while (hasMore) {
        const response = await this.universityApiClient.searchUniversities({
          page,
          limit: 100
        })

        for (const external of response.universities) {
          try {
            const data = UniversityMapper.toInternal(external)
            
            await this.prisma.university.upsert({
              where: { externalId: external.id },
              create: data as any,
              update: data
            })

            // Sync programs for this university
            await this.syncPrograms(external.id)
            
            result.updated++
          } catch (error) {
            result.errors.push({
              externalId: external.id,
              error: error.message
            })
          }
        }

        hasMore = response.pagination.hasMore
        page++
      }

      this.logger.log(`Sync complete: ${result.updated} updated, ${result.errors.length} errors`)
    } catch (error) {
      this.logger.error('Sync failed', error)
      throw error
    }

    return result
  }
}
```

## Validation
- API calls work correctly
- Error handling complete
- Circuit breaker tested
- Data mapping accurate
- Sync job runs successfully
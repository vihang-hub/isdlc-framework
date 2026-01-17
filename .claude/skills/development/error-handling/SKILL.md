---
name: error-handling
description: Implement consistent error handling patterns
skill_id: DEV-008
owner: developer
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Exception handling, error responses
dependencies: [DEV-001]
---

# Error Handling Implementation

## Purpose
Implement consistent error handling that provides meaningful messages, proper logging, and follows the error taxonomy.

## When to Use
- All code implementation
- API error responses
- Validation errors
- External service errors

## Prerequisites
- Error taxonomy defined
- Logging configured
- Error response format defined

## Process

### Step 1: Create Error Classes
```
Custom exceptions:
- Extend base exceptions
- Include error codes
- Add context data
```

### Step 2: Implement Error Filters
```
Global error handling:
- Exception filters
- Error transformation
- Response formatting
```

### Step 3: Add Error Logging
```
Logging strategy:
- Log level by severity
- Include context
- Sanitize sensitive data
```

### Step 4: Handle Specific Cases
```
Case handling:
- Validation errors
- Auth errors
- Not found
- External service errors
- Unexpected errors
```

### Step 5: Test Error Scenarios
```
Error testing:
- Unit test exceptions
- Integration test responses
- Error message verification
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| error_taxonomy | Markdown | Yes | Error definitions |
| logging_config | YAML | Yes | Logging setup |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| exceptions/ | TypeScript | Custom exceptions |
| filters/ | TypeScript | Error filters |
| interceptors/ | TypeScript | Error interceptors |

## Project-Specific Considerations
- Validation error details
- External API error mapping
- GDPR error handling
- User-friendly messages

## Integration Points
- **Design Agent**: Error taxonomy
- **Operations Agent**: Error monitoring

## Examples
```typescript
// src/common/exceptions/app.exception.ts
export class AppException extends Error {
  constructor(
    public readonly code: string,
    public readonly message: string,
    public readonly statusCode: number,
    public readonly details?: any
  ) {
    super(message)
    this.name = 'AppException'
  }
}

// src/common/exceptions/index.ts
export class ValidationException extends AppException {
  constructor(details: ValidationError[]) {
    super(
      'VAL_INVALID_INPUT',
      'Validation failed',
      400,
      details
    )
  }
}

export class UnauthorizedException extends AppException {
  constructor(message = 'Authentication required') {
    super('AUTH_UNAUTHORIZED', message, 401)
  }
}

export class ForbiddenException extends AppException {
  constructor(message = 'Access denied') {
    super('AUTHZ_FORBIDDEN', message, 403)
  }
}

export class NotFoundException extends AppException {
  constructor(resource: string) {
    super('NF_RESOURCE', `${resource} not found`, 404)
  }
}

export class BusinessException extends AppException {
  constructor(code: string, message: string) {
    super(code, message, 400)
  }
}

export class ExternalServiceException extends AppException {
  constructor(service: string, originalError?: Error) {
    super(
      'EXT_SERVICE_ERROR',
      `${service} is temporarily unavailable`,
      503,
      { service, originalError: originalError?.message }
    )
  }
}

// src/common/filters/all-exceptions.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  Logger
} from '@nestjs/common'
import { Request, Response } from 'express'
import { AppException } from '../exceptions/app.exception'

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter')

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request>()

    const errorResponse = this.buildErrorResponse(exception, request)
    
    // Log error
    this.logError(exception, request, errorResponse)

    response
      .status(errorResponse.statusCode)
      .json(errorResponse.body)
  }

  private buildErrorResponse(exception: unknown, request: Request) {
    const requestId = request.headers['x-request-id'] || 
                      crypto.randomUUID()

    // Handle our custom exceptions
    if (exception instanceof AppException) {
      return {
        statusCode: exception.statusCode,
        body: {
          success: false,
          error: {
            code: exception.code,
            message: exception.message,
            details: exception.details
          },
          meta: {
            requestId,
            timestamp: new Date().toISOString()
          }
        }
      }
    }

    // Handle NestJS HTTP exceptions
    if (exception instanceof HttpException) {
      const response = exception.getResponse() as any
      return {
        statusCode: exception.getStatus(),
        body: {
          success: false,
          error: {
            code: this.mapHttpStatusToCode(exception.getStatus()),
            message: response.message || exception.message,
            details: response.errors
          },
          meta: {
            requestId,
            timestamp: new Date().toISOString()
          }
        }
      }
    }

    // Handle validation pipe errors
    if (this.isValidationError(exception)) {
      return {
        statusCode: 400,
        body: {
          success: false,
          error: {
            code: 'VAL_INVALID_INPUT',
            message: 'Validation failed',
            details: this.formatValidationErrors(exception)
          },
          meta: {
            requestId,
            timestamp: new Date().toISOString()
          }
        }
      }
    }

    // Unknown errors - don't expose details
    return {
      statusCode: 500,
      body: {
        success: false,
        error: {
          code: 'SYS_INTERNAL_ERROR',
          message: 'An unexpected error occurred'
        },
        meta: {
          requestId,
          timestamp: new Date().toISOString()
        }
      }
    }
  }

  private logError(
    exception: unknown, 
    request: Request, 
    errorResponse: any
  ) {
    const logData = {
      requestId: errorResponse.body.meta.requestId,
      method: request.method,
      path: request.url,
      statusCode: errorResponse.statusCode,
      errorCode: errorResponse.body.error.code,
      userId: (request as any).user?.id
    }

    if (errorResponse.statusCode >= 500) {
      this.logger.error(
        `${logData.method} ${logData.path} - ${errorResponse.statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
        logData
      )
    } else if (errorResponse.statusCode >= 400) {
      this.logger.warn(
        `${logData.method} ${logData.path} - ${errorResponse.statusCode}`,
        logData
      )
    }
  }

  private mapHttpStatusToCode(status: number): string {
    const mapping: Record<number, string> = {
      400: 'VAL_BAD_REQUEST',
      401: 'AUTH_UNAUTHORIZED',
      403: 'AUTHZ_FORBIDDEN',
      404: 'NF_NOT_FOUND',
      409: 'BIZ_CONFLICT',
      429: 'SYS_RATE_LIMITED'
    }
    return mapping[status] || 'SYS_ERROR'
  }
}

// Usage in service
async submitApplication(id: string, userId: string) {
  const application = await this.findOne(id, userId)
  
  if (!application) {
    throw new NotFoundException('Application')
  }

  if (application.status !== 'draft') {
    throw new BusinessException(
      'BIZ_ALREADY_SUBMITTED',
      'Application has already been submitted'
    )
  }

  if (application.progress < 100) {
    throw new BusinessException(
      'BIZ_INCOMPLETE',
      'Please complete all required sections before submitting'
    )
  }

  // ... submit logic
}
```

## Validation
- All errors handled consistently
- Error codes match taxonomy
- Logging appropriate
- User messages helpful
- No sensitive data leaked
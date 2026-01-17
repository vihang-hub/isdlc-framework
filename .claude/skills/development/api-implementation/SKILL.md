---
name: api-implementation
description: Implement REST/GraphQL API endpoints
skill_id: DEV-003
owner: developer
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Backend API development
dependencies: [DEV-001, DEV-002]
---

# API Implementation

## Purpose
Implement API endpoints that follow the OpenAPI specification, handle requests properly, validate inputs, and return consistent responses.

## When to Use
- New endpoint development
- API modifications
- Integration development

## Prerequisites
- OpenAPI specification
- Data models defined
- Authentication configured
- Validation rules known

## Process

### Step 1: Review API Contract
```
From OpenAPI spec:
- HTTP method
- URL path
- Request parameters
- Request body schema
- Response schemas
- Error responses
```

### Step 2: Create DTOs
```
Data Transfer Objects:
- Request DTOs with validation
- Response DTOs
- Query parameter DTOs
```

### Step 3: Implement Controller
```
Controller responsibilities:
- Route handling
- Request parsing
- Call service layer
- Format response
```

### Step 4: Implement Service
```
Service responsibilities:
- Business logic
- Data access
- External calls
- Error handling
```

### Step 5: Add Validation & Guards
```
Request validation:
- Input validation
- Authentication
- Authorization
- Rate limiting
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| openapi_spec | YAML | Yes | API contract |
| design_spec | Markdown | Yes | Design details |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| controller | TypeScript | Route handlers |
| service | TypeScript | Business logic |
| dtos | TypeScript | Request/response types |

## Project-Specific Considerations
- JWT authentication
- Role-based authorization
- Consistent error format
- Pagination patterns

## Integration Points
- **Design Agent**: OpenAPI spec source
- **Test Manager**: API tests
- **Security Agent**: Auth review

## Examples
```typescript
// src/application/dto/create-application.dto.ts
import { IsUUID, IsNotEmpty } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class CreateApplicationDto {
  @ApiProperty({ 
    description: 'Program ID to apply for',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @IsUUID()
  @IsNotEmpty()
  programId: string
}

// src/application/dto/application-response.dto.ts
export class ApplicationResponseDto {
  @ApiProperty()
  id: string

  @ApiProperty()
  programId: string

  @ApiProperty({ enum: ['draft', 'submitted', 'under_review', 'accepted', 'rejected'] })
  status: string

  @ApiProperty({ required: false })
  submittedAt?: Date

  @ApiProperty()
  createdAt: Date

  @ApiProperty({ type: () => ProgramSummaryDto })
  program?: ProgramSummaryDto
}

// src/application/application.controller.ts
import { 
  Controller, Get, Post, Put, Param, Body, 
  UseGuards, Request, Query, HttpStatus
} from '@nestjs/common'
import { 
  ApiTags, ApiOperation, ApiResponse, 
  ApiBearerAuth, ApiQuery 
} from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { ApplicationService } from './application.service'
import { CreateApplicationDto } from './dto/create-application.dto'
import { ApplicationResponseDto } from './dto/application-response.dto'
import { ApiPaginatedResponse } from '../common/decorators/api-paginated-response'

@ApiTags('Applications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('applications')
export class ApplicationController {
  constructor(private readonly applicationService: ApplicationService) {}

  @Post()
  @ApiOperation({ summary: 'Create new application' })
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    type: ApplicationResponseDto,
    description: 'Application created successfully'
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: 'Deadline passed or already applied' 
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Program not found' 
  })
  async create(
    @Request() req,
    @Body() createDto: CreateApplicationDto
  ): Promise<ApplicationResponseDto> {
    return this.applicationService.create(req.user.id, createDto)
  }

  @Get()
  @ApiOperation({ summary: 'Get user applications' })
  @ApiPaginatedResponse(ApplicationResponseDto)
  @ApiQuery({ name: 'status', required: false, enum: ['draft', 'submitted'] })
  async findAll(
    @Request() req,
    @Query('status') status?: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20
  ) {
    return this.applicationService.findByUser(req.user.id, {
      status,
      page: Number(page),
      limit: Number(limit)
    })
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get application by ID' })
  @ApiResponse({ status: HttpStatus.OK, type: ApplicationResponseDto })
  @ApiResponse({ status: HttpStatus.NOT_FOUND })
  async findOne(
    @Request() req,
    @Param('id') id: string
  ): Promise<ApplicationResponseDto> {
    return this.applicationService.findOne(id, req.user.id)
  }

  @Post(':id/submit')
  @ApiOperation({ summary: 'Submit application' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    type: ApplicationResponseDto,
    description: 'Application submitted successfully'
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: 'Application incomplete or already submitted' 
  })
  async submit(
    @Request() req,
    @Param('id') id: string
  ): Promise<ApplicationResponseDto> {
    return this.applicationService.submit(id, req.user.id)
  }
}

// src/application/application.service.ts
@Injectable()
export class ApplicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2
  ) {}

  async create(
    userId: string, 
    dto: CreateApplicationDto
  ): Promise<ApplicationResponseDto> {
    // Check program exists and deadline not passed
    const program = await this.prisma.program.findUnique({
      where: { id: dto.programId }
    })

    if (!program) {
      throw new NotFoundException('Program not found')
    }

    if (new Date() > program.deadline) {
      throw new BadRequestException('Application deadline has passed')
    }

    // Check for existing application
    const existing = await this.prisma.application.findFirst({
      where: { userId, programId: dto.programId }
    })

    if (existing) {
      throw new BadRequestException('Already applied to this program')
    }

    // Create application
    const application = await this.prisma.application.create({
      data: {
        userId,
        programId: dto.programId,
        status: 'draft'
      },
      include: { program: true }
    })

    return this.toResponseDto(application)
  }

  async submit(id: string, userId: string): Promise<ApplicationResponseDto> {
    const application = await this.prisma.application.findFirst({
      where: { id, userId }
    })

    if (!application) {
      throw new NotFoundException('Application not found')
    }

    if (application.status !== 'draft') {
      throw new BadRequestException('Application already submitted')
    }

    // Validate completeness
    const isComplete = await this.validateCompleteness(id)
    if (!isComplete) {
      throw new BadRequestException('Application is incomplete')
    }

    // Submit
    const updated = await this.prisma.application.update({
      where: { id },
      data: {
        status: 'submitted',
        submittedAt: new Date()
      },
      include: { program: true }
    })

    // Emit event for notifications
    this.eventEmitter.emit('application.submitted', { 
      applicationId: id, 
      userId 
    })

    return this.toResponseDto(updated)
  }
}
```

## Validation
- Matches OpenAPI spec
- Validation working
- Auth/authz in place
- Error handling complete
- Tests passing
---
name: code-behavior-extraction
description: Parse code to identify observable behavior patterns
skill_id: RE-001
owner: behavior-analyzer
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Extracting behavior from existing code during reverse engineering
dependencies: []
---

# Code Behavior Extraction

## Purpose
Parse source code to identify and extract observable behavior patterns including inputs, outputs, control flow, and side effects. Forms the foundation for generating acceptance criteria from existing implementations.

## When to Use
- Reverse engineering existing codebases
- Generating acceptance criteria from code
- Documenting undocumented behavior
- Creating characterization test baselines

## Prerequisites
- Source code files accessible
- Language/framework identified
- Code compiles/runs (for dynamic analysis)

## Process

### Step 1: Identify Entry Points
```
For each target type:
- API: Routes, controllers, handlers
- UI: Page components, event handlers
- CLI: Command definitions, handlers
- Jobs: Processors, scheduled tasks
- Services: Public methods, interfaces
```

### Step 2: Trace Control Flow
```
For each entry point:
1. Identify function signature (params, return type)
2. Trace through to all called functions
3. Mark conditional branches (if/switch/guard)
4. Note loops and iterations
5. Identify exit points (return, throw, exit)
```

### Step 3: Extract Input Patterns
```
Inputs include:
- Function parameters
- Request body/query/path params
- Environment variables
- Configuration values
- Database/external state
```

### Step 4: Extract Output Patterns
```
Outputs include:
- Return values
- Response bodies
- Written data (DB, file, cache)
- Emitted events
- Published messages
- External API calls
```

### Step 5: Build Behavior Model
```json
{
  "entry_point": "POST /api/users",
  "inputs": [
    { "name": "email", "type": "string", "source": "body" },
    { "name": "password", "type": "string", "source": "body" }
  ],
  "outputs": [
    { "type": "response", "status": 201, "body_shape": "User" }
  ],
  "control_flow": [
    { "condition": "user exists", "branch": "error-409" },
    { "condition": "validation fails", "branch": "error-400" }
  ],
  "side_effects": [
    { "type": "database", "operation": "INSERT", "table": "users" },
    { "type": "event", "name": "UserCreated" }
  ]
}
```

## Extraction Patterns by Framework

### Express.js / NestJS
```typescript
// Route definition
@Post('users')
async createUser(@Body() dto: CreateUserDto) { ... }

// Extract:
// - HTTP method: POST
// - Path: /users
// - Input: CreateUserDto (body)
// - Decorators: validation, guards
```

### FastAPI / Django
```python
@app.post("/users")
async def create_user(user: UserCreate):
    ...

# Extract:
# - HTTP method: POST
# - Path: /users
# - Input: UserCreate (Pydantic model)
# - Decorators: dependencies, permissions
```

### React/Vue Components
```typescript
function UserForm({ onSubmit }: Props) {
  const [email, setEmail] = useState('');
  const handleSubmit = () => onSubmit({ email });
  ...
}

// Extract:
// - Props: onSubmit callback
// - State: email
// - Events: form submit
// - Output: calls onSubmit with data
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| source_file | Path | Yes | File to analyze |
| entry_point | String | Optional | Specific function/class |
| include_deps | Boolean | No | Follow dependencies |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| behavior_model | JSON | Structured behavior representation |
| control_flow_graph | JSON | Branching and conditions |
| dependency_list | Array | Called functions/services |

## Project-Specific Considerations
- Adapt extraction patterns based on detected framework (NestJS vs Express vs FastAPI)
- Handle monorepo structures with shared code paths
- Account for middleware chains and decorator patterns
- Consider async/await patterns and Promise chains
- Include GraphQL resolvers if detected alongside REST

## Integration Points
- **Priority Scoring (RE-008)**: Receives targets to analyze in priority order
- **AC Generation (RE-002)**: Consumes behavior models to generate Given-When-Then
- **Side Effect Detection (RE-005)**: Shares control flow analysis
- **Architecture Analyzer (D1)**: Uses framework detection results

## Validation
- All entry points identified
- Input/output types captured
- Control flow branches documented
- Side effects detected

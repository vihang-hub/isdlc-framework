---
name: side-effect-mocking
description: Create mocks for external dependencies and side effects
skill_id: RE-103
owner: characterization-test-generator
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Setting up test isolation from external systems
dependencies: [RE-005]
---

# Side Effect Mocking

## Purpose
Generate appropriate mocks for external dependencies and side effects identified during behavior analysis. These mocks isolate characterization tests from external systems while capturing what calls would have been made.

## When to Use
- Isolating tests from external APIs
- Mocking database operations
- Capturing queue/event publishes
- Testing without real dependencies

## Prerequisites
- Side effects identified from RE-005
- Service dependencies mapped
- External API contracts known

## Process

### Step 1: Identify Mock Targets
```
From side effect analysis:
- Database repositories/clients
- External HTTP clients
- Message queue publishers
- Email/notification services
- File system operations
- Cache clients
```

### Step 2: Determine Mock Strategy
```
Strategies by type:
- Spy: Capture calls while allowing real execution
- Stub: Return predefined values
- Mock: Full behavior replacement
- Fake: In-memory implementation
```

### Step 3: Generate Mock Implementations
```
For each target:
1. Create mock interface/class
2. Implement capture mechanisms
3. Provide default responses
4. Support configurable behavior
```

### Step 4: Create Setup/Teardown Helpers
```
Helpers for:
- Installing mocks before tests
- Resetting state between tests
- Verifying expected calls
- Cleaning up after tests
```

## Mock Patterns by Type

### Database Repository Mocks
```typescript
// Mock repository with capture
export const createUserRepositoryMock = () => {
  const captured: CapturedDbOperation[] = [];

  const mock = {
    _captured: captured,

    async save(user: User): Promise<User> {
      captured.push({
        operation: 'INSERT',
        table: 'users',
        data: { ...user },
        timestamp: new Date()
      });
      return { ...user, id: user.id || `user-${Date.now()}` };
    },

    async findOne(criteria: any): Promise<User | null> {
      captured.push({
        operation: 'SELECT',
        table: 'users',
        criteria,
        timestamp: new Date()
      });
      return null; // Default: not found
    },

    async update(id: string, data: Partial<User>): Promise<User> {
      captured.push({
        operation: 'UPDATE',
        table: 'users',
        criteria: { id },
        data,
        timestamp: new Date()
      });
      return { id, ...data } as User;
    },

    async delete(id: string): Promise<void> {
      captured.push({
        operation: 'DELETE',
        table: 'users',
        criteria: { id },
        timestamp: new Date()
      });
    },

    reset() {
      captured.length = 0;
    }
  };

  return mock;
};

// Usage
const userRepo = createUserRepositoryMock();
const service = new UserService(userRepo);

await service.register({ email: 'test@example.com' });

expect(userRepo._captured).toContainEqual(
  expect.objectContaining({
    operation: 'INSERT',
    table: 'users'
  })
);
```

### External API Client Mocks
```typescript
// Mock HTTP client with request capture
export const createHttpClientMock = () => {
  const captured: CapturedHttpCall[] = [];
  const responses: Map<string, any> = new Map();

  const mock = {
    _captured: captured,

    // Configure responses
    whenGet(url: string, response: any) {
      responses.set(`GET:${url}`, response);
      return this;
    },

    whenPost(url: string, response: any) {
      responses.set(`POST:${url}`, response);
      return this;
    },

    // Mock methods
    async get(url: string, config?: any) {
      captured.push({ method: 'GET', url, config, timestamp: new Date() });
      return responses.get(`GET:${url}`) || { status: 200, data: {} };
    },

    async post(url: string, data: any, config?: any) {
      captured.push({ method: 'POST', url, data, config, timestamp: new Date() });
      return responses.get(`POST:${url}`) || { status: 201, data: {} };
    },

    reset() {
      captured.length = 0;
      responses.clear();
    }
  };

  return mock;
};

// Usage
const httpClient = createHttpClientMock()
  .whenPost('/api/external/notify', { status: 200 });

const service = new NotificationService(httpClient);
await service.notify('user-123', 'Welcome!');

expect(httpClient._captured).toContainEqual(
  expect.objectContaining({
    method: 'POST',
    url: '/api/external/notify'
  })
);
```

### Message Queue Mocks
```typescript
// Mock queue with message capture
export const createQueueMock = (name: string) => {
  const captured: CapturedQueueMessage[] = [];

  return {
    name,
    _captured: captured,

    async add(jobName: string, data: any, options?: any) {
      captured.push({
        queue: name,
        job: jobName,
        data,
        options,
        timestamp: new Date()
      });
      return { id: `job-${Date.now()}` };
    },

    async addBulk(jobs: Array<{ name: string; data: any }>) {
      jobs.forEach(job => {
        captured.push({
          queue: name,
          job: job.name,
          data: job.data,
          timestamp: new Date()
        });
      });
      return jobs.map((_, i) => ({ id: `job-${Date.now()}-${i}` }));
    },

    reset() {
      captured.length = 0;
    }
  };
};

// Usage
const emailQueue = createQueueMock('email');
const service = new UserService(emailQueue);

await service.register({ email: 'test@example.com' });

expect(emailQueue._captured).toContainEqual(
  expect.objectContaining({
    job: 'send-welcome',
    data: expect.objectContaining({ email: 'test@example.com' })
  })
);
```

### Event Emitter Mocks
```typescript
// Mock event emitter with capture
export const createEventEmitterMock = () => {
  const captured: CapturedEvent[] = [];
  const listeners: Map<string, Function[]> = new Map();

  return {
    _captured: captured,

    emit(event: string, payload: any) {
      captured.push({ event, payload, timestamp: new Date() });
      const handlers = listeners.get(event) || [];
      handlers.forEach(h => h(payload));
    },

    on(event: string, handler: Function) {
      const handlers = listeners.get(event) || [];
      handlers.push(handler);
      listeners.set(event, handlers);
    },

    reset() {
      captured.length = 0;
    }
  };
};
```

### Email Service Mocks
```typescript
// Mock email service with capture
export const createEmailServiceMock = () => {
  const captured: CapturedEmail[] = [];

  return {
    _captured: captured,

    async sendMail(options: { to: string; subject: string; html: string }) {
      captured.push({
        type: 'email',
        to: options.to,
        subject: options.subject,
        html: options.html,
        timestamp: new Date()
      });
      return { messageId: `msg-${Date.now()}` };
    },

    async sendTemplate(template: string, to: string, data: any) {
      captured.push({
        type: 'template',
        template,
        to,
        data,
        timestamp: new Date()
      });
      return { messageId: `msg-${Date.now()}` };
    },

    reset() {
      captured.length = 0;
    }
  };
};
```

## Mock Setup Helpers

```typescript
// tests/helpers/mock-setup.ts

export interface MockContainer {
  userRepository: ReturnType<typeof createUserRepositoryMock>;
  emailService: ReturnType<typeof createEmailServiceMock>;
  eventEmitter: ReturnType<typeof createEventEmitterMock>;
  httpClient: ReturnType<typeof createHttpClientMock>;
  queues: {
    email: ReturnType<typeof createQueueMock>;
    notifications: ReturnType<typeof createQueueMock>;
  };
}

export const createMockContainer = (): MockContainer => ({
  userRepository: createUserRepositoryMock(),
  emailService: createEmailServiceMock(),
  eventEmitter: createEventEmitterMock(),
  httpClient: createHttpClientMock(),
  queues: {
    email: createQueueMock('email'),
    notifications: createQueueMock('notifications')
  }
});

export const resetAllMocks = (container: MockContainer) => {
  container.userRepository.reset();
  container.emailService.reset();
  container.eventEmitter.reset();
  container.httpClient.reset();
  container.queues.email.reset();
  container.queues.notifications.reset();
};

// Usage in tests
describe('UserService', () => {
  let mocks: MockContainer;
  let service: UserService;

  beforeEach(() => {
    mocks = createMockContainer();
    service = new UserService(mocks);
  });

  afterEach(() => {
    resetAllMocks(mocks);
  });
});
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| side_effects | Array | Yes | From RE-005 |
| service_deps | Object | Yes | Service dependencies |
| framework | String | Optional | Test framework |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| mock_implementations | TypeScript | Mock classes/functions |
| setup_helpers | TypeScript | Test setup utilities |
| capture_types | TypeScript | Captured data types |

## Validation
- All side effects mockable
- Capture mechanisms working
- Reset functions available
- Type safety maintained

---
name: side-effect-detection
description: Detect database, API, queue, file, and other side effects
skill_id: RE-005
owner: feature-mapper
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Identifying all side effects of code execution
dependencies: [RE-001]
---

# Side Effect Detection

## Purpose
Systematically identify all side effects that occur during code execution, including database operations, external API calls, message queue interactions, file system changes, and cache modifications. This information is critical for generating complete acceptance criteria and setting up proper mocks in characterization tests.

## When to Use
- Identifying what to mock in tests
- Documenting system integrations
- Understanding blast radius of changes
- Creating complete Then clauses

## Prerequisites
- Behavior model from RE-001
- Access to source code and dependencies
- Service/repository classes identified

## Process

### Step 1: Identify Database Side Effects
```
Scan for:
- ORM operations: save(), insert(), update(), delete()
- Raw queries: query(), execute(), raw()
- Transaction markers: @Transaction, transaction()
- Bulk operations: bulkCreate(), insertMany()

Capture:
- Table/collection name
- Operation type (INSERT, UPDATE, DELETE)
- Affected columns/fields
- Transaction boundaries
```

### Step 2: Identify External API Side Effects
```
Scan for:
- HTTP clients: axios, fetch, got, requests
- SDK calls: stripe.customers.create(), aws.s3.putObject()
- GraphQL mutations: client.mutate()
- SOAP calls: soapClient.call()

Capture:
- Service name
- Endpoint/method
- Request payload shape
- Expected response
```

### Step 3: Identify Message Queue Side Effects
```
Scan for:
- Queue publish: queue.add(), channel.publish()
- Event emit: eventEmitter.emit(), bus.dispatch()
- Kafka: producer.send()
- SNS/SQS: sns.publish(), sqs.sendMessage()

Capture:
- Queue/topic name
- Message payload shape
- Routing key (if applicable)
- Delivery guarantees
```

### Step 4: Identify File System Side Effects
```
Scan for:
- File writes: fs.writeFile(), file.save()
- File uploads: multer, formidable
- File deletes: fs.unlink(), rimraf
- Directory operations: mkdir, rmdir

Capture:
- File path pattern
- Operation type
- Content type
- Permissions
```

### Step 5: Identify Cache Side Effects
```
Scan for:
- Cache set: redis.set(), cache.put()
- Cache delete: redis.del(), cache.evict()
- Cache invalidation patterns
- TTL settings

Capture:
- Cache key pattern
- Operation type
- TTL if applicable
- Invalidation triggers
```

### Step 6: Identify Notification Side Effects
```
Scan for:
- Email: sendEmail(), mailer.send()
- SMS: twilio.send(), sns.sendSMS()
- Push: firebase.send(), apns.push()
- In-app: notification.create()

Capture:
- Channel type
- Recipient source
- Template/content
- Trigger conditions
```

## Side Effect Detection Patterns

### Database Operations

| Framework | Pattern | Side Effect |
|-----------|---------|-------------|
| TypeORM | `repo.save(entity)` | INSERT or UPDATE |
| TypeORM | `repo.remove(entity)` | DELETE |
| Prisma | `prisma.user.create()` | INSERT |
| Sequelize | `Model.bulkCreate()` | BULK INSERT |
| Mongoose | `doc.save()` | INSERT or UPDATE |
| Knex | `knex('table').insert()` | INSERT |

```typescript
// Example detection
await this.userRepo.save(user);  // -> DB:INSERT:users OR DB:UPDATE:users
await this.orderRepo.delete(id); // -> DB:DELETE:orders
```

### External API Calls

| Client | Pattern | Side Effect |
|--------|---------|-------------|
| Axios | `axios.post(url, data)` | API:POST:{url} |
| Fetch | `fetch(url, { method: 'POST' })` | API:POST:{url} |
| Stripe | `stripe.charges.create()` | API:stripe:charges.create |
| AWS | `s3.putObject()` | API:aws:s3.putObject |

```typescript
// Example detection
await axios.post('/external/webhook', payload);  // -> API:POST:/external/webhook
await stripe.paymentIntents.create({ ... });     // -> API:stripe:paymentIntents.create
```

### Message Queues

| System | Pattern | Side Effect |
|--------|---------|-------------|
| BullMQ | `queue.add('job', data)` | QUEUE:bull:{queueName} |
| RabbitMQ | `channel.publish(exchange, key, msg)` | QUEUE:rabbit:{exchange} |
| Kafka | `producer.send({ topic, messages })` | QUEUE:kafka:{topic} |
| SQS | `sqs.sendMessage({ QueueUrl })` | QUEUE:sqs:{queueName} |

```typescript
// Example detection
await this.emailQueue.add('send-welcome', { userId }); // -> QUEUE:bull:email
this.eventEmitter.emit('order.created', order);        // -> EVENT:order.created
```

## Side Effect Categorization

| Category | Reversible | Test Strategy |
|----------|------------|---------------|
| Database INSERT | Yes | Mock repo, verify call |
| Database UPDATE | Yes | Mock repo, verify call |
| Database DELETE | No | Mock repo, verify call |
| External API POST | Maybe | Mock client, verify call |
| Message Queue | Yes | Mock queue, verify publish |
| File Write | Yes | Use temp dir, verify content |
| Email Send | No | Mock service, verify call |
| Cache Set | Yes | Mock cache, verify call |

## Side Effect Output Format

```json
{
  "side_effects": [
    {
      "type": "database",
      "operation": "INSERT",
      "target": "users",
      "payload_shape": { "email": "string", "name": "string" },
      "reversible": true,
      "line_number": 45
    },
    {
      "type": "external_api",
      "service": "stripe",
      "method": "paymentIntents.create",
      "payload_shape": { "amount": "number", "currency": "string" },
      "reversible": false,
      "line_number": 52
    },
    {
      "type": "message_queue",
      "queue": "email",
      "job": "send-welcome",
      "payload_shape": { "userId": "string", "email": "string" },
      "reversible": true,
      "line_number": 58
    }
  ]
}
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| behavior_model | JSON | Yes | From RE-001 |
| source_code | String | Yes | Code to analyze |
| dependencies | Array | Optional | Imported modules |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| side_effects | Array | Categorized side effects |
| mock_requirements | Array | What to mock in tests |
| external_services | Array | External dependencies |

## Project-Specific Considerations
- Identify project-specific ORM patterns (TypeORM, Prisma, Sequelize, etc.)
- Map custom event bus implementations to standard patterns
- Document queue technology specifics (BullMQ, RabbitMQ, SQS)
- Note file storage patterns (local, S3, GCS)
- Include audit logging as a side effect category if present

## Integration Points
- **Behavior Extraction (RE-001)**: Shares control flow analysis
- **Postcondition Inference (RE-004)**: Side effects become Then clauses
- **Side Effect Mocking (RE-103)**: Provides mock requirements
- **Characterization Test Generator (R2)**: Guides test isolation strategy
- **Architecture Analyzer (D1)**: Validates against integration point mapping

## Validation
- All DB operations captured
- External calls identified
- Queue/event publishing found
- File operations detected

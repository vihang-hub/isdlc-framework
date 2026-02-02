---
name: data-transformation-mapping
description: Map input transformations through code paths
skill_id: RE-007
owner: behavior-analyzer
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Tracing how data is transformed from input to output
dependencies: [RE-001]
---

# Data Transformation Mapping

## Purpose
Trace how input data flows through the code and is transformed into output. This helps understand the relationship between inputs and outputs, identify data mutations, and document transformation logic for acceptance criteria.

## When to Use
- Understanding input-output relationships
- Documenting data pipelines
- Identifying field mappings
- Creating test fixtures

## Prerequisites
- Behavior model from RE-001
- Access to source code
- Type definitions (DTOs, interfaces)

## Process

### Step 1: Identify Input Shape
```
Analyze:
- Request DTOs / Input types
- Query/path parameters
- Request body structure
- Default values and optional fields

Document:
- Field names and types
- Required vs optional
- Nested structures
- Array types
```

### Step 2: Trace Field Usage
```
For each input field:
1. Find all references in code
2. Track assignments and mutations
3. Note transformations applied
4. Map to output fields
```

### Step 3: Identify Transformations
```
Common transformations:
- Type conversion (string -> number, date parsing)
- Format change (lowercase, trim, mask)
- Calculation (derived values)
- Enrichment (lookup additional data)
- Filtering (remove fields)
- Aggregation (combine values)
```

### Step 4: Map to Output Shape
```
For each output field:
1. Find source field(s)
2. Document transformation chain
3. Note generated/derived values
4. Identify excluded fields
```

### Step 5: Generate Transformation Matrix
```
Input Field → Transformation → Output Field
email       → lowercase       → email
password    → hash(bcrypt)    → passwordHash
name        → trim            → name
-           → generate()      → id
-           → Date.now()      → createdAt
```

## Transformation Patterns

### Direct Mapping
```typescript
// Input: { email: 'Test@Example.com', name: 'John' }
const user = {
  email: dto.email.toLowerCase(),  // email → lowercase → email
  name: dto.name.trim(),           // name → trim → name
};
// Output: { email: 'test@example.com', name: 'John' }
```

### Computed/Derived Fields
```typescript
// Input: { items: [{ price: 10, qty: 2 }, { price: 5, qty: 1 }] }
const order = {
  items: dto.items,
  subtotal: dto.items.reduce((sum, i) => sum + i.price * i.qty, 0),  // derived
  tax: subtotal * TAX_RATE,  // computed from derived
  total: subtotal + tax,     // computed from computed
};
// Output: { items: [...], subtotal: 25, tax: 2.0625, total: 27.0625 }
```

### Enrichment (Lookup)
```typescript
// Input: { productId: 'prod-123', quantity: 2 }
const product = await this.productRepo.findById(dto.productId);  // lookup
const orderItem = {
  product: {
    id: product.id,
    name: product.name,   // enriched
    price: product.price, // enriched
  },
  quantity: dto.quantity,
  lineTotal: product.price * dto.quantity,  // computed with enriched
};
```

### Field Exclusion
```typescript
// Input (internal): { id, email, password, createdAt }
// Output (API response): { id, email, createdAt }
// Excluded: password (sensitive data)

@Exclude()
password: string;
```

### Field Renaming
```typescript
// Input: { firstName: 'John', lastName: 'Doe' }
const user = {
  givenName: dto.firstName,   // renamed
  familyName: dto.lastName,   // renamed
  fullName: `${dto.firstName} ${dto.lastName}`,  // combined
};
// Output: { givenName: 'John', familyName: 'Doe', fullName: 'John Doe' }
```

### Array Transformations
```typescript
// Input: { items: [{ sku: 'A', qty: 1 }, { sku: 'B', qty: 2 }] }
const lineItems = dto.items.map(item => ({
  sku: item.sku,
  quantity: item.qty,                    // renamed
  price: this.priceService.get(item.sku), // enriched
}));
// Output: { items: [{ sku: 'A', quantity: 1, price: 9.99 }, ...] }
```

### Conditional Transformation
```typescript
// Input: { type: 'premium', basePrice: 100 }
const price = dto.type === 'premium'
  ? dto.basePrice * 1.2    // premium markup
  : dto.basePrice;
// Output depends on type value
```

## Transformation Matrix Format

```markdown
## Data Transformation: CreateUser

### Input → Output Mapping

| Input Field | Transformation | Output Field | Notes |
|-------------|----------------|--------------|-------|
| email | toLowerCase() | email | Normalized |
| password | bcrypt.hash() | passwordHash | 10 rounds |
| name | trim() | name | Whitespace removed |
| - | uuid() | id | Generated |
| - | new Date() | createdAt | Generated |
| - | new Date() | updatedAt | Generated |
| role | default('user') | role | Default if missing |

### Excluded Fields
| Field | Reason |
|-------|--------|
| password | Never in response |
| passwordHash | Security |

### Derived Calculations
| Output Field | Formula | Dependencies |
|--------------|---------|--------------|
| displayName | `${name} (${email})` | name, email |
```

## Complex Transformation Example

```typescript
// Order Creation Transformation
// Input: CreateOrderDto
{
  customerId: string;
  items: Array<{ productId: string; quantity: number }>;
  couponCode?: string;
}

// Transformation chain:
// 1. Lookup customer → enrich with address
// 2. For each item:
//    a. Lookup product → enrich with name, price
//    b. Calculate lineTotal = price * quantity
// 3. Calculate subtotal = sum of lineTotals
// 4. If couponCode, lookup coupon → calculate discount
// 5. Calculate tax = (subtotal - discount) * TAX_RATE
// 6. Calculate total = subtotal - discount + tax
// 7. Generate orderId, set status = 'pending'

// Output: Order
{
  id: string;           // generated
  customer: {           // enriched
    id: string;
    name: string;
    address: Address;
  };
  items: Array<{        // transformed
    product: { id, name, price };  // enriched
    quantity: number;              // pass-through
    lineTotal: number;             // computed
  }>;
  subtotal: number;     // aggregated
  discount: number;     // computed from coupon
  tax: number;          // computed
  total: number;        // computed
  status: 'pending';    // default
  createdAt: Date;      // generated
}
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| behavior_model | JSON | Yes | From RE-001 |
| source_code | String | Yes | Code to analyze |
| input_type | Object | Optional | Input DTO/schema |
| output_type | Object | Optional | Output DTO/schema |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| transformation_matrix | Object | Input to output mapping |
| derived_fields | Array | Computed/generated fields |
| excluded_fields | Array | Fields removed from output |
| enrichment_sources | Array | External lookups |

## Project-Specific Considerations
- Document serialization libraries used (class-transformer, marshmallow, etc.)
- Note sensitive field handling (PII masking, encryption)
- Map custom type converters and transformers
- Include pagination transformation patterns
- Document versioned response transformations for API versioning

## Integration Points
- **Behavior Extraction (RE-001)**: Receives input/output type information
- **Fixture Generation (RE-102)**: Transformations guide fixture structure
- **Postcondition Inference (RE-004)**: Transformation results become assertions
- **System Designer (03)**: Aligns with data flow documentation

## Validation
- All input fields traced
- All output fields sourced
- Transformations documented
- Edge cases identified

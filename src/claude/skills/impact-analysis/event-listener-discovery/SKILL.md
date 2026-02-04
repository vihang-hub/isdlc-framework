---
name: event-listener-discovery
description: Discover existing and new event listeners/handlers for feature implementation
skill_id: IA-204
owner: entry-point-finder
collaborators: []
project: isdlc
version: 1.0.0
when_to_use: During M2 Entry Point analysis to find event-driven entry points
dependencies: []
---

# Event Listener Discovery

## Purpose
Discover existing event listeners, pub/sub handlers, and webhook receivers that relate to the feature and identify new event handlers needed based on acceptance criteria.

## When to Use
- Finding existing event handling
- Planning new event listeners
- Understanding event-driven entry points
- Mapping acceptance criteria to events

## Prerequisites
- Finalized requirements with acceptance criteria
- Discovery report with event inventory
- Event handler file locations known

## Process

### Step 1: Search Existing Events
```
For each acceptance criterion:
1. Search event listener files
2. Check pub/sub subscriptions
3. Find webhook handlers
4. Note event bus patterns
```

### Step 2: Classify Relevance
```
For each found event:
- HIGH: Directly supports acceptance criterion
- MEDIUM: Can be extended for AC
- LOW: Tangentially related

Map each event to specific AC(s).
```

### Step 3: Identify New Events
```
For ACs requiring event handling:
1. Suggest event names following conventions
2. Define event payload schema
3. Identify publishers and subscribers
4. Note ordering/retry requirements
```

### Step 4: Document Findings
```
Return:
- Existing events with AC mapping
- Suggested new events
- Publisher/subscriber relationships
- Event schema definitions
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| acceptance_criteria | Array | Yes | List of ACs from requirements |
| discovery_report | Object | No | Event inventory from discovery |
| event_patterns | Object | No | Project's event conventions |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| existing_events | Array | Found events with AC mapping |
| new_events | Array | Suggested new events |
| pub_sub_map | Object | Publisher/subscriber relationships |
| schemas | Object | Event payload schemas |

## Validation
- Event-driven ACs have coverage
- Events follow naming conventions
- Pub/sub relationships clear
- AC mapping complete

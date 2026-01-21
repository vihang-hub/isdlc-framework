---
name: migration-writing
description: Create database migrations for schema changes
skill_id: DEV-012
owner: software-developer
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Schema changes, data transformations
dependencies: [DEV-004]
---

# Migration Writing

## Purpose
Write database migrations that safely modify schema while preserving data integrity.

## When to Use
- New table/column additions
- Schema modifications
- Index changes
- Data transformations

## Process

1. Plan migration
2. Write forward migration
3. Write rollback (if needed)
4. Test in development
5. Test with production-like data

## Project-Specific Considerations
- Always have rollback plan
- Test with realistic data volumes
- Consider GDPR (soft deletes)
- Handle production data carefully

## Examples
```typescript
// prisma/migrations/20240115_add_virus_scan/migration.sql

-- Add virus scan fields to documents table
ALTER TABLE documents 
ADD COLUMN virus_scan_status VARCHAR(20) DEFAULT 'pending',
ADD COLUMN virus_scan_at TIMESTAMP,
ADD COLUMN virus_scan_result JSONB;

-- Create index for pending scans
CREATE INDEX idx_documents_scan_pending 
ON documents (virus_scan_status) 
WHERE virus_scan_status = 'pending';
```
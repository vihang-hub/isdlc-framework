/**
 * Slug Generation
 * ================
 * URL-safe slug generation from free-text descriptions.
 *
 * Extracted from three-verb-utils.cjs (REQ-0083).
 * Traces: FR-001 (AC-001-01), VR-SLUG-001..004
 *
 * @module src/core/backlog/slug
 */

/**
 * Generates a URL-safe slug from a free-text description.
 * @param {string} description - Free-text item description
 * @returns {string} Sanitized slug (max 50 chars)
 */
export function generateSlug(description) {
  if (!description || typeof description !== 'string') {
    return 'untitled-item';
  }

  let slug = description
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);

  if (!slug) {
    slug = 'untitled-item';
  }

  return slug;
}

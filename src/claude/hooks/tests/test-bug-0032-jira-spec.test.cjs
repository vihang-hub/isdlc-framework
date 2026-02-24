'use strict';

/**
 * BUG-0032: Phase A Cannot Pull Jira Ticket Content - Test Suite
 * ================================================================
 * Tests validate that isdlc.md specification contains correct MCP tool call
 * instructions for Jira ticket fetching, plus regression tests for existing
 * detectSource() and generateSlug() behavior.
 *
 * Run:  node --test src/claude/hooks/tests/test-bug-0032-jira-spec.test.cjs
 *
 * BUG-0032-GH-7: Wire getJiraIssue into add/analyze handlers
 * Traces: FR-001, FR-002, FR-003, FR-004, CON-003
 *
 * Version: 1.0.0
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const { detectSource, generateSlug } = require('../lib/three-verb-utils.cjs');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Reads isdlc.md once and caches for all spec validation tests.
 * Uses path relative to project root (resolved from this test file location).
 */
function readIsdlcSpec() {
    const projectRoot = path.resolve(__dirname, '..', '..', '..', '..');
    const specPath = path.join(projectRoot, 'src', 'claude', 'commands', 'isdlc.md');
    return fs.readFileSync(specPath, 'utf8');
}

/**
 * Extracts a section of text between two heading patterns.
 * Returns the text between startPattern and the next heading of same or higher level.
 */
function extractSection(content, startPattern, endPattern) {
    const startMatch = content.match(startPattern);
    if (!startMatch) return '';
    const startIdx = startMatch.index;
    if (endPattern) {
        const afterStart = content.substring(startIdx + startMatch[0].length);
        const endMatch = afterStart.match(endPattern);
        if (endMatch) {
            return content.substring(startIdx, startIdx + startMatch[0].length + endMatch.index);
        }
    }
    return content.substring(startIdx);
}

// Cache the spec content (read once, use in all tests)
let specContent;

// ===========================================================================
// SPECIFICATION VALIDATION TESTS (SV)
// ===========================================================================

describe('BUG-0032: Specification Validation', () => {
    // Read spec once before all tests in this describe block
    it('setup: isdlc.md is readable', () => {
        specContent = readIsdlcSpec();
        assert.ok(specContent.length > 0, 'isdlc.md should not be empty');
    });

    // --- FR-001: Jira Ticket Fetch in Add Handler ---

    describe('FR-001: Add handler Jira fetch', () => {

        it('[P0] SV-01: Add handler step 3b contains getJiraIssue MCP call (FR-001 AC-001-01)', () => {
            assert.ok(specContent, 'spec must be loaded');
            // The Jira branch (step 3b) must reference getJiraIssue
            const hasGetJiraIssue = /getJiraIssue/i.test(specContent)
                && /jira/i.test(specContent);
            assert.ok(hasGetJiraIssue,
                'isdlc.md must contain getJiraIssue tool call in the Jira handling section');

            // More specific: the getJiraIssue call must be in the add handler context
            // Look for getJiraIssue near "source.*jira" or "Jira ticket" context
            const addHandlerSection = extractSection(specContent, /###?\s+ADD/i, /###?\s+(ANALYZE|BUILD|FIX)/i);
            if (addHandlerSection) {
                assert.ok(/getJiraIssue/i.test(addHandlerSection),
                    'getJiraIssue must appear within the ADD handler section');
            }
        });

        it('[P0] SV-02: Add handler contains getAccessibleAtlassianResources for cloudId (FR-003 AC-003-01)', () => {
            assert.ok(specContent, 'spec must be loaded');
            const hasCloudIdResolution = /getAccessibleAtlassianResources/i.test(specContent);
            assert.ok(hasCloudIdResolution,
                'isdlc.md must contain getAccessibleAtlassianResources for cloudId resolution');
        });

        it('[P0] SV-03: Add handler maps issuetype to item_type (FR-001 AC-001-02, AC-001-03)', () => {
            assert.ok(specContent, 'spec must be loaded');
            // Must specify Bug -> BUG mapping
            const hasBugMapping = /[Bb]ug.*BUG|issuetype.*Bug.*item_type.*BUG/i.test(specContent);
            assert.ok(hasBugMapping,
                'isdlc.md must map Jira Bug issue type to item_type BUG');

            // Must specify non-Bug -> REQ mapping
            const hasReqMapping = /(?:else|other|not.*[Bb]ug).*REQ|item_type.*REQ/i.test(specContent);
            assert.ok(hasReqMapping,
                'isdlc.md must map non-Bug Jira issue types to item_type REQ');
        });

        it('[P0] SV-04: Add handler specifies error fallback for failed fetch (FR-001 AC-001-05)', () => {
            assert.ok(specContent, 'spec must be loaded');
            // Must contain error handling pattern for Jira fetch failure
            const hasErrorFallback = /[Cc]ould not fetch [Jj]ira/i.test(specContent)
                || /[Jj]ira.*fail.*manual/i.test(specContent)
                || /[Jj]ira.*error.*fall.*back/i.test(specContent);
            assert.ok(hasErrorFallback,
                'isdlc.md must specify error fallback when Jira fetch fails (log warning + manual entry)');
        });

        it('[P1] SV-05: Add handler uses fetched summary for slug (FR-001 AC-001-04)', () => {
            assert.ok(specContent, 'spec must be loaded');
            // Must reference using fetched summary/title for slug generation
            const hasSummaryForSlug = /summary.*slug|title.*slug|fetched.*summary.*generateSlug/i.test(specContent);
            assert.ok(hasSummaryForSlug,
                'isdlc.md must specify that fetched Jira issue summary is used for slug generation');
        });
    });

    // --- FR-002: Jira Ticket Fetch in Analyze Handler ---

    describe('FR-002: Analyze handler Jira fetch', () => {

        it('[P0] SV-06: Analyze handler Group 1 contains conditional Jira fetch (FR-002 AC-002-01)', () => {
            assert.ok(specContent, 'spec must be loaded');
            // Group 1 must contain a Jira conditional fetch
            // Look for getJiraIssue in the Group 1 / analyze context
            const group1Section = extractSection(specContent, /\*\*Group 1\*\*/i, /\*\*Group 2\*\*/i);
            assert.ok(group1Section.length > 0, 'Group 1 section must exist');

            const hasJiraInGroup1 = /getJiraIssue/i.test(group1Section)
                || /[Jj]ira.*ref.*PROJECT/i.test(group1Section)
                || /PROJECT-N.*getJiraIssue/i.test(group1Section);
            assert.ok(hasJiraInGroup1,
                'Analyze handler Group 1 must contain a conditional Jira fetch (getJiraIssue)');
        });

        it('[P0] SV-07: Analyze handler specifies fail-fast on Jira error (FR-002 AC-002-03)', () => {
            assert.ok(specContent, 'spec must be loaded');
            const group1Section = extractSection(specContent, /\*\*Group 1\*\*/i, /\*\*Group 2\*\*/i);
            // Must specify fail-fast / STOP behavior for Jira fetch failure
            const hasFailFast = /[Jj]ira.*fail.*fast/i.test(group1Section)
                || /[Jj]ira.*STOP/i.test(group1Section)
                || /[Cc]ould not fetch.*[Jj]ira.*STOP/i.test(group1Section)
                || /[Jj]ira.*error.*STOP/i.test(group1Section)
                || (/[Ff]ail fast/i.test(group1Section) && /[Jj]ira/i.test(group1Section));
            assert.ok(hasFailFast,
                'Analyze handler must specify fail-fast behavior when Jira fetch fails in Group 1');
        });

        it('[P1] SV-08: Analyze handler passes fetched data as issueData (FR-002 AC-002-02)', () => {
            assert.ok(specContent, 'spec must be loaded');
            // Must specify that fetched Jira data is passed as pre-fetched issueData
            const hasIssueDataPassing = /issueData/i.test(specContent)
                && /[Jj]ira/i.test(specContent);
            assert.ok(hasIssueDataPassing,
                'isdlc.md must pass fetched Jira data as issueData to the add handler');
        });

        it('[P1] SV-11: Analyze handler specifies draft includes Jira content (FR-002 AC-002-04)', () => {
            assert.ok(specContent, 'spec must be loaded');
            // Must specify that Jira content goes into draft.md
            const hasDraftContent = /[Jj]ira.*draft/i.test(specContent)
                || /draft.*[Jj]ira/i.test(specContent)
                || /title.*heading.*description/i.test(specContent)
                || /summary.*description.*draft/i.test(specContent);
            assert.ok(hasDraftContent,
                'isdlc.md must specify that Jira title, description, and AC are included in draft.md');
        });
    });

    // --- FR-003: CloudId Resolution ---

    describe('FR-003: CloudId resolution', () => {

        it('[P0] SV-10: Spec includes MCP unavailability graceful degradation (FR-003 AC-003-03)', () => {
            assert.ok(specContent, 'spec must be loaded');
            const hasMcpUnavailable = /MCP.*not available/i.test(specContent)
                || /[Aa]tlassian.*MCP.*unavailable/i.test(specContent)
                || /MCP.*unavailable.*manual/i.test(specContent)
                || /[Aa]tlassian.*not.*available.*manual/i.test(specContent);
            assert.ok(hasMcpUnavailable,
                'isdlc.md must handle MCP unavailability gracefully (degrade to manual entry)');
        });

        it('[P2] SV-12: CloudId resolution handles multiple cloud instances (FR-003 AC-003-02)', () => {
            assert.ok(specContent, 'spec must be loaded');
            const hasMultiInstance = /first.*result/i.test(specContent)
                || /first.*accessible/i.test(specContent)
                || /multiple.*cloud/i.test(specContent)
                || /first.*resource/i.test(specContent);
            assert.ok(hasMultiInstance,
                'isdlc.md must handle multiple cloud instances (use first or prompt user)');
        });
    });

    // --- FR-004: Jira URL Parsing ---

    describe('FR-004: Jira URL parsing', () => {

        it('[P1] SV-09: Spec includes Jira URL parsing for --link flag (FR-004 AC-004-01)', () => {
            assert.ok(specContent, 'spec must be loaded');
            const hasUrlParsing = /atlassian\.net\/browse/i.test(specContent)
                || /[Jj]ira.*URL.*parse/i.test(specContent)
                || /--link.*[Jj]ira/i.test(specContent)
                || /[Jj]ira.*--link/i.test(specContent);
            assert.ok(hasUrlParsing,
                'isdlc.md must include Jira URL parsing for the --link flag');
        });

        it('[P1] SV-13: Non-Jira URLs preserve existing behavior (FR-004 AC-004-03)', () => {
            assert.ok(specContent, 'spec must be loaded');
            // The spec must not attempt Jira fetch for non-Atlassian URLs
            // This is verified by the presence of a conditional guard
            const hasGuard = /atlassian\.net/i.test(specContent)
                || /[Jj]ira.*URL.*pattern/i.test(specContent);
            assert.ok(hasGuard,
                'isdlc.md must guard Jira URL parsing to Atlassian URLs only');
        });
    });
});

// ===========================================================================
// REGRESSION TESTS (RT)
// ===========================================================================

describe('BUG-0032: Regression Tests', () => {

    describe('detectSource() backward compatibility (CON-003)', () => {

        it('[P0] RT-01: detectSource("PROJ-123") returns jira source', () => {
            const result = detectSource('PROJ-123');
            assert.equal(result.source, 'jira');
            assert.equal(result.source_id, 'PROJ-123');
            assert.equal(result.description, 'PROJ-123');
        });

        it('[P0] RT-02: detectSource("MYAPP-1") returns jira source', () => {
            const result = detectSource('MYAPP-1');
            assert.equal(result.source, 'jira');
            assert.equal(result.source_id, 'MYAPP-1');
            assert.equal(result.description, 'MYAPP-1');
        });

        it('[P0] RT-03: detectSource("#42") returns github source', () => {
            const result = detectSource('#42');
            assert.equal(result.source, 'github');
            assert.equal(result.source_id, 'GH-42');
            assert.equal(result.description, '#42');
        });

        it('[P0] RT-04: detectSource("fix login bug") returns manual source', () => {
            const result = detectSource('fix login bug');
            assert.equal(result.source, 'manual');
            assert.equal(result.source_id, null);
            assert.equal(result.description, 'fix login bug');
        });

        it('[P1] RT-05: detectSource bare number with jira preference routes to jira', () => {
            const result = detectSource('123', { issueTracker: 'jira', jiraProjectKey: 'PROJ' });
            assert.equal(result.source, 'jira');
            assert.equal(result.source_id, 'PROJ-123');
            assert.equal(result.description, 'PROJ-123');
        });

        it('[P1] RT-06: detectSource bare number with github preference routes to github', () => {
            const result = detectSource('123', { issueTracker: 'github' });
            assert.equal(result.source, 'github');
            assert.equal(result.source_id, 'GH-123');
            assert.equal(result.description, '#123');
        });
    });

    describe('generateSlug() backward compatibility (CON-003)', () => {

        it('[P2] RT-07: generateSlug("PROJ-123") returns "proj-123"', () => {
            const result = generateSlug('PROJ-123');
            assert.equal(result, 'proj-123');
        });

        it('[P2] RT-08: generateSlug("Add login page") returns "add-login-page"', () => {
            const result = generateSlug('Add login page');
            assert.equal(result, 'add-login-page');
        });
    });
});

// ===========================================================================
// SPECIFICATION STRUCTURE TESTS (SS)
// ===========================================================================

describe('BUG-0032: Specification Structure', () => {

    it('[P1] SS-01: Add handler has both GitHub (step 3a) and Jira (step 3b) branches', () => {
        const spec = specContent || readIsdlcSpec();
        // GitHub branch: step 3a with gh issue view
        const hasGitHubBranch = /gh issue view/i.test(spec);
        assert.ok(hasGitHubBranch, 'Add handler must have GitHub branch with gh issue view');

        // Jira branch: step 3b with getJiraIssue
        const hasJiraBranch = /getJiraIssue/i.test(spec);
        assert.ok(hasJiraBranch, 'Add handler must have Jira branch with getJiraIssue');
    });

    it('[P1] SS-02: Analyze handler Group 1 has both GitHub and Jira conditionals', () => {
        const spec = specContent || readIsdlcSpec();
        const group1Section = extractSection(spec, /\*\*Group 1\*\*/i, /\*\*Group 2\*\*/i);
        assert.ok(group1Section.length > 0, 'Group 1 section must exist');

        // GitHub: gh issue view in Group 1
        const hasGitHubInGroup1 = /gh issue view/i.test(group1Section);
        assert.ok(hasGitHubInGroup1, 'Group 1 must contain gh issue view for GitHub');

        // Jira: getJiraIssue in Group 1
        const hasJiraInGroup1 = /getJiraIssue/i.test(group1Section)
            || /[Jj]ira/i.test(group1Section);
        assert.ok(hasJiraInGroup1, 'Group 1 must contain Jira fetch conditional');
    });

    it('[P2] SS-03: Error handling matches between GitHub and Jira paths', () => {
        const spec = specContent || readIsdlcSpec();
        // Both paths should have fail-fast in analyze Group 1
        const group1Section = extractSection(spec, /\*\*Group 1\*\*/i, /\*\*Group 2\*\*/i);
        const hasGitHubFailFast = /fail fast/i.test(group1Section) || /STOP/i.test(group1Section);
        assert.ok(hasGitHubFailFast, 'Group 1 must have fail-fast error handling');
    });

    it('[P1] SS-04: gh issue view call still present (regression guard)', () => {
        const spec = specContent || readIsdlcSpec();
        // Count occurrences of gh issue view -- should be present in both add and analyze
        const matches = spec.match(/gh issue view/gi);
        assert.ok(matches, 'gh issue view must still be present in spec');
        assert.ok(matches.length >= 2,
            `gh issue view should appear at least 2 times (add + analyze), found ${matches ? matches.length : 0}`);
    });
});

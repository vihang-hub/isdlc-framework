#!/usr/bin/env node
/**
 * Antigravity - Isdlc Session Prime Script
 * ========================================
 * Rebuilds the session-cache.md and returns its content.
 */

const { rebuildSessionCache, getProjectRoot } = require('../../../hooks/lib/common.cjs');
const { formatResult } = require('../../../../antigravity/antigravity-bridge.cjs');
const fs = require('fs');
const path = require('path');

async function main() {
    try {
        const root = getProjectRoot();

        // 1. Rebuild the cache
        rebuildSessionCache({ verbose: false });

        // 2. Read the cache
        const cachePath = path.join(root, '.isdlc', 'session-cache.md');
        if (!fs.existsSync(cachePath)) {
            console.log(JSON.stringify(formatResult(false, "Session cache file not found after rebuild.")));
            process.exit(1);
        }

        const content = fs.readFileSync(cachePath, 'utf8');

        // 3. Return the content
        // We include it in the details so the LLM can see it in the tool result
        console.log(JSON.stringify(formatResult(true, "Session primed successfully.", {
            cache_content: content
        })));
        process.exit(0);
    } catch (e) {
        console.log(JSON.stringify(formatResult(false, `Error priming session: ${e.message}`)));
        process.exit(1);
    }
}

main();

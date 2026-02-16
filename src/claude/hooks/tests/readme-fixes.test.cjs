/**
 * Tests for README-claimed behaviors (REQ-README-AUDIT)
 * Covers: coverage enforcement (Fix 2), artifact validation (Fix 3), timeout check (Fix 8)
 */

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

// =========================================================================
// Test Helpers
// =========================================================================

function setupTestEnv() {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'isdlc-readme-test-'));
    const isdlcDir = path.join(tmpDir, '.isdlc');
    const configDir = path.join(isdlcDir, 'config');
    fs.mkdirSync(configDir, { recursive: true });

    // Copy iteration-requirements.json
    const srcConfig = path.join(__dirname, '..', 'config', 'iteration-requirements.json');
    if (fs.existsSync(srcConfig)) {
        fs.copyFileSync(srcConfig, path.join(configDir, 'iteration-requirements.json'));
    }

    // Copy schemas
    const srcSchemas = path.join(__dirname, '..', 'config', 'schemas');
    const schemasDir = path.join(configDir, 'schemas');
    fs.mkdirSync(schemasDir, { recursive: true });
    if (fs.existsSync(srcSchemas)) {
        for (const file of fs.readdirSync(srcSchemas)) {
            fs.copyFileSync(path.join(srcSchemas, file), path.join(schemasDir, file));
        }
    }

    // Copy skills-manifest.json
    const srcManifest = path.join(__dirname, '..', 'config', 'skills-manifest.json');
    const claudeConfigDir = path.join(tmpDir, '.claude', 'hooks', 'config');
    fs.mkdirSync(claudeConfigDir, { recursive: true });
    if (fs.existsSync(srcManifest)) {
        fs.copyFileSync(srcManifest, path.join(claudeConfigDir, 'skills-manifest.json'));
    }
    // Also copy to .isdlc
    if (fs.existsSync(srcManifest)) {
        fs.copyFileSync(srcManifest, path.join(configDir, 'skills-manifest.json'));
    }

    // Write minimal state.json
    fs.writeFileSync(path.join(isdlcDir, 'state.json'), JSON.stringify({
        framework_version: '0.1.0-alpha',
        iteration_enforcement: { enabled: true }
    }));

    return tmpDir;
}

function writeState(tmpDir, state) {
    fs.writeFileSync(
        path.join(tmpDir, '.isdlc', 'state.json'),
        JSON.stringify(state, null, 2)
    );
}

function cleanupTestEnv(tmpDir) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
}

function requireFresh(modulePath) {
    delete require.cache[require.resolve(modulePath)];
    return require(modulePath);
}

// =========================================================================
// Fix 2: Coverage Enforcement (test-watcher.cjs)
// =========================================================================

describe('Coverage Enforcement (Fix 2)', () => {
    const twPath = path.join(__dirname, '..', 'test-watcher.cjs');

    describe('parseCoverage', () => {
        let parseCoverage;

        beforeEach(() => {
            const tw = requireFresh(twPath);
            parseCoverage = tw.parseCoverage;
        });

        it('parses Jest/Vitest Statements coverage', () => {
            const output = 'Statements   : 85.71% ( 12/14 )';
            const result = parseCoverage(output);
            assert.equal(result.found, true);
            assert.equal(result.percentage, 85.71);
        });

        it('parses Jest/Vitest Lines coverage', () => {
            const output = 'Lines        : 92.30% ( 24/26 )';
            const result = parseCoverage(output);
            assert.equal(result.found, true);
            assert.equal(result.percentage, 92.3);
        });

        it('parses pytest-cov TOTAL line', () => {
            const output = 'TOTAL    100    15    85%';
            const result = parseCoverage(output);
            assert.equal(result.found, true);
            assert.equal(result.percentage, 85);
        });

        it('parses Go coverage output', () => {
            const output = 'ok  \tmypackage\t0.005s\tcoverage: 82.5% of statements';
            const result = parseCoverage(output);
            assert.equal(result.found, true);
            assert.equal(result.percentage, 82.5);
        });

        it('parses generic "X% coverage" format', () => {
            const output = 'Total: 75.3% coverage';
            const result = parseCoverage(output);
            assert.equal(result.found, true);
            assert.equal(result.percentage, 75.3);
        });

        it('returns found:false when no coverage data', () => {
            const output = 'Tests: 5 passed, 5 total\nAll tests passed';
            const result = parseCoverage(output);
            assert.equal(result.found, false);
            assert.equal(result.percentage, null);
        });

        it('returns found:false for null/undefined input', () => {
            assert.equal(parseCoverage(null).found, false);
            assert.equal(parseCoverage(undefined).found, false);
            assert.equal(parseCoverage('').found, false);
        });

        it('picks first matching pattern (Statements over Lines)', () => {
            const output = 'Statements   : 85.71%\nBranches     : 75.00%\nFunctions    : 90.00%\nLines        : 92.30%';
            const result = parseCoverage(output);
            assert.equal(result.found, true);
            assert.equal(result.percentage, 85.71);
        });
    });

    describe('check() with coverage', () => {
        let tmpDir;
        let check;

        beforeEach(() => {
            tmpDir = setupTestEnv();
            process.env.CLAUDE_PROJECT_DIR = tmpDir;
            // Clear all relevant require caches
            delete require.cache[require.resolve(twPath)];
            delete require.cache[require.resolve(path.join(__dirname, '..', 'lib', 'common.cjs'))];
            const tw = require(twPath);
            check = tw.check;
        });

        afterEach(() => {
            delete process.env.CLAUDE_PROJECT_DIR;
            cleanupTestEnv(tmpDir);
        });

        function makeCtx(state, testOutput, exitCode) {
            const requirements = JSON.parse(fs.readFileSync(
                path.join(tmpDir, '.isdlc', 'config', 'iteration-requirements.json'), 'utf8'
            ));
            return {
                input: {
                    tool_name: 'Bash',
                    tool_input: { command: 'npm test' },
                    tool_result: testOutput || 'Tests: 5 passed, 5 total'
                },
                state,
                requirements
            };
        }

        it('marks completed when coverage above threshold', () => {
            const state = {
                iteration_enforcement: { enabled: true },
                active_workflow: { type: 'feature', current_phase: '06-implementation' },
                phases: {}
            };
            const output = 'Tests: 5 passed, 5 total\n✓ All tests passed\nStatements   : 90.00%';
            const ctx = makeCtx(state, output);
            const result = check(ctx);

            assert.equal(result.decision, 'allow');
            const iterState = state.phases['06-implementation'].iteration_requirements.test_iteration;
            assert.equal(iterState.completed, true);
            assert.equal(iterState.status, 'success');
            assert.equal(iterState.coverage.found, true);
            assert.equal(iterState.coverage.percentage, 90);
            assert.equal(iterState.coverage.met, true);
        });

        it('does NOT mark completed when coverage below threshold', () => {
            const state = {
                iteration_enforcement: { enabled: true },
                active_workflow: { type: 'feature', current_phase: '06-implementation' },
                phases: {}
            };
            const output = 'Tests: 5 passed, 5 total\n✓ All tests passed\nStatements   : 60.00%';
            const ctx = makeCtx(state, output);
            const result = check(ctx);

            assert.equal(result.decision, 'allow');
            const iterState = state.phases['06-implementation'].iteration_requirements.test_iteration;
            assert.equal(iterState.completed, false);
            assert.equal(iterState.coverage.found, true);
            assert.equal(iterState.coverage.percentage, 60);
            assert.equal(iterState.coverage.met, false);
            assert.ok(result.stdout.includes('COVERAGE INSUFFICIENT'));
        });

        it('marks completed (fail-open) when no coverage data and threshold configured', () => {
            const state = {
                iteration_enforcement: { enabled: true },
                active_workflow: { type: 'feature', current_phase: '06-implementation' },
                phases: {}
            };
            const output = 'Tests: 5 passed, 5 total\n✓ All tests passed';
            const ctx = makeCtx(state, output);
            const result = check(ctx);

            assert.equal(result.decision, 'allow');
            const iterState = state.phases['06-implementation'].iteration_requirements.test_iteration;
            assert.equal(iterState.completed, true);
            assert.equal(iterState.coverage.found, false);
            assert.equal(iterState.coverage.met, true);
            assert.ok(result.stdout.includes('coverage flag'));
        });

        it('stores coverage object in iteration state', () => {
            const state = {
                iteration_enforcement: { enabled: true },
                active_workflow: { type: 'feature', current_phase: '06-implementation' },
                phases: {}
            };
            const output = 'Tests: 5 passed, 5 total\n✓ All tests passed\ncoverage: 95.5% of statements';
            const ctx = makeCtx(state, output);
            check(ctx);

            const iterState = state.phases['06-implementation'].iteration_requirements.test_iteration;
            assert.ok(iterState.coverage);
            assert.equal(iterState.coverage.found, true);
            assert.equal(iterState.coverage.percentage, 95.5);
            assert.equal(iterState.coverage.threshold, 80);
            assert.equal(iterState.coverage.met, true);
        });
    });
});

// =========================================================================
// Fix 3: Artifact Presence Validation (gate-blocker.cjs)
// =========================================================================

describe('Artifact Presence Validation (Fix 3)', () => {
    const gbPath = path.join(__dirname, '..', 'gate-blocker.cjs');
    let tmpDir;
    let check;

    beforeEach(() => {
        tmpDir = setupTestEnv();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        delete require.cache[require.resolve(gbPath)];
        delete require.cache[require.resolve(path.join(__dirname, '..', 'lib', 'common.cjs'))];
        const gb = require(gbPath);
        check = gb.check;
    });

    afterEach(() => {
        delete process.env.CLAUDE_PROJECT_DIR;
        cleanupTestEnv(tmpDir);
    });

    function makeGateCtx(state) {
        const requirements = JSON.parse(fs.readFileSync(
            path.join(tmpDir, '.isdlc', 'config', 'iteration-requirements.json'), 'utf8'
        ));
        return {
            input: {
                tool_name: 'Task',
                tool_input: {
                    subagent_type: 'sdlc-orchestrator',
                    prompt: 'advance to next phase'
                }
            },
            state,
            requirements
        };
    }

    it('blocks when required artifact is missing', () => {
        const state = {
            iteration_enforcement: { enabled: true },
            active_workflow: {
                type: 'feature',
                current_phase: '01-requirements',
                artifact_folder: 'REQ-0001-test-feature'
            },
            phases: {
                '01-requirements': {
                    status: 'in_progress',
                    iteration_requirements: {
                        interactive_elicitation: {
                            completed: true,
                            menu_interactions: 3,
                            final_selection: 'save'
                        }
                    },
                    constitutional_validation: {
                        completed: true,
                        iterations_used: 1,
                        status: 'compliant'
                    }
                }
            },
            skill_usage_log: [{ agent: 'requirements-analyst', agent_phase: '01-requirements' }]
        };

        const ctx = makeGateCtx(state);
        const result = check(ctx);

        // Should block due to missing artifact
        assert.equal(result.decision, 'block');
        assert.ok(result.stopReason.includes('artifact'));
    });

    it('allows when required artifact exists', () => {
        const artifactDir = path.join(tmpDir, 'docs', 'requirements', 'REQ-0001-test-feature');
        fs.mkdirSync(artifactDir, { recursive: true });
        fs.writeFileSync(path.join(artifactDir, 'requirements-spec.md'), '# Requirements');

        const state = {
            iteration_enforcement: { enabled: true },
            active_workflow: {
                type: 'feature',
                current_phase: '01-requirements',
                artifact_folder: 'REQ-0001-test-feature'
            },
            phases: {
                '01-requirements': {
                    status: 'in_progress',
                    iteration_requirements: {
                        interactive_elicitation: {
                            completed: true,
                            menu_interactions: 3,
                            final_selection: 'save'
                        }
                    },
                    constitutional_validation: {
                        completed: true,
                        iterations_used: 1,
                        status: 'compliant'
                    }
                }
            },
            skill_usage_log: [{ agent: 'requirements-analyst', agent_phase: '01-requirements' }]
        };

        const ctx = makeGateCtx(state);
        const result = check(ctx);

        assert.equal(result.decision, 'allow');
    });

    it('fail-open when artifact_folder is not set', () => {
        const state = {
            iteration_enforcement: { enabled: true },
            active_workflow: {
                type: 'feature',
                current_phase: '01-requirements'
                // No artifact_folder
            },
            phases: {
                '01-requirements': {
                    status: 'in_progress',
                    iteration_requirements: {
                        interactive_elicitation: {
                            completed: true,
                            menu_interactions: 3,
                            final_selection: 'save'
                        }
                    },
                    constitutional_validation: {
                        completed: true,
                        iterations_used: 1,
                        status: 'compliant'
                    }
                }
            },
            skill_usage_log: [{ agent: 'requirements-analyst', agent_phase: '01-requirements' }]
        };

        const ctx = makeGateCtx(state);
        const result = check(ctx);

        // Should allow because paths can't be resolved (fail-open)
        assert.equal(result.decision, 'allow');
    });

    it('allows phase without artifact_validation config', () => {
        const state = {
            iteration_enforcement: { enabled: true },
            active_workflow: {
                type: 'feature',
                current_phase: '00-quick-scan'
            },
            phases: {}
        };

        const ctx = makeGateCtx(state);
        const result = check(ctx);

        // Quick-scan has no artifact validation, should pass this check
        assert.equal(result.decision, 'allow');
    });

    it('allows when either variant of design artifact exists', () => {
        // BUG-0020: Design phase artifact path corrected to docs/requirements/
        const artifactDir = path.join(tmpDir, 'docs', 'requirements', 'REQ-0001-test-feature');
        fs.mkdirSync(artifactDir, { recursive: true });
        fs.writeFileSync(path.join(artifactDir, 'module-design.md'), '# Module Design');

        const state = {
            iteration_enforcement: { enabled: true },
            active_workflow: {
                type: 'feature',
                current_phase: '04-design',
                artifact_folder: 'REQ-0001-test-feature'
            },
            phases: {
                '04-design': {
                    status: 'in_progress',
                    constitutional_validation: {
                        completed: true,
                        iterations_used: 1,
                        status: 'compliant'
                    }
                }
            },
            skill_usage_log: [{ agent: 'system-designer', agent_phase: '04-design' }]
        };

        const ctx = makeGateCtx(state);
        const result = check(ctx);

        assert.equal(result.decision, 'allow');
    });
});

// =========================================================================
// Fix 8: Phase Timeout Check (common.cjs)
// =========================================================================

describe('Phase Timeout Check (Fix 8)', () => {
    let tmpDir;
    let checkPhaseTimeout;

    beforeEach(() => {
        tmpDir = setupTestEnv();
        process.env.CLAUDE_PROJECT_DIR = tmpDir;
        const commonPath = path.join(__dirname, '..', 'lib', 'common.cjs');
        delete require.cache[require.resolve(commonPath)];
        const common = require(commonPath);
        checkPhaseTimeout = common.checkPhaseTimeout;
    });

    afterEach(() => {
        delete process.env.CLAUDE_PROJECT_DIR;
        cleanupTestEnv(tmpDir);
    });

    it('returns exceeded:true when phase past timeout', () => {
        const twoHoursAgo = new Date(Date.now() - 120 * 60 * 1000).toISOString();
        const state = {
            active_workflow: { current_phase: '01-requirements' },
            phases: {
                '01-requirements': {
                    started_at: twoHoursAgo
                }
            }
        };
        const requirements = {
            phase_requirements: {
                '01-requirements': {
                    interactive_elicitation: {
                        enabled: true,
                        timeout_minutes: 60
                    }
                }
            }
        };

        const result = checkPhaseTimeout(state, requirements);
        assert.equal(result.exceeded, true);
        assert.ok(result.elapsed >= 119); // ~120 minutes
        assert.equal(result.limit, 60);
        assert.equal(result.phase, '01-requirements');
    });

    it('returns exceeded:false when phase within timeout', () => {
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        const state = {
            active_workflow: { current_phase: '01-requirements' },
            phases: {
                '01-requirements': {
                    started_at: fiveMinutesAgo
                }
            }
        };
        const requirements = {
            phase_requirements: {
                '01-requirements': {
                    interactive_elicitation: {
                        enabled: true,
                        timeout_minutes: 60
                    }
                }
            }
        };

        const result = checkPhaseTimeout(state, requirements);
        assert.equal(result.exceeded, false);
    });

    it('returns exceeded:false when no timeout configured', () => {
        const state = {
            active_workflow: { current_phase: '02-impact-analysis' },
            phases: {
                '02-impact-analysis': {
                    started_at: new Date(Date.now() - 999 * 60 * 1000).toISOString()
                }
            }
        };
        const requirements = {
            phase_requirements: {
                '02-impact-analysis': {
                    test_iteration: { enabled: false }
                }
            }
        };

        const result = checkPhaseTimeout(state, requirements);
        assert.equal(result.exceeded, false);
    });

    it('returns exceeded:false when no started_at timestamp', () => {
        const state = {
            active_workflow: { current_phase: '01-requirements' },
            phases: {
                '01-requirements': {}
            }
        };
        const requirements = {
            phase_requirements: {
                '01-requirements': {
                    interactive_elicitation: {
                        enabled: true,
                        timeout_minutes: 60
                    }
                }
            }
        };

        const result = checkPhaseTimeout(state, requirements);
        assert.equal(result.exceeded, false);
    });

    it('returns exceeded:false for null/missing inputs', () => {
        assert.equal(checkPhaseTimeout(null, null).exceeded, false);
        assert.equal(checkPhaseTimeout({}, null).exceeded, false);
        assert.equal(checkPhaseTimeout(null, {}).exceeded, false);
    });

    it('reads started_at from test_iteration when phase-level not set', () => {
        const twoHoursAgo = new Date(Date.now() - 120 * 60 * 1000).toISOString();
        const state = {
            active_workflow: { current_phase: '06-implementation' },
            phases: {
                '06-implementation': {
                    iteration_requirements: {
                        test_iteration: {
                            started_at: twoHoursAgo
                        }
                    }
                }
            }
        };
        const requirements = {
            phase_requirements: {
                '06-implementation': {
                    timeout_minutes: 90
                }
            }
        };

        const result = checkPhaseTimeout(state, requirements);
        assert.equal(result.exceeded, true);
        assert.equal(result.limit, 90);
    });

    it('reads timeout_minutes from phase level', () => {
        const twoHoursAgo = new Date(Date.now() - 120 * 60 * 1000).toISOString();
        const state = {
            active_workflow: { current_phase: '03-architecture' },
            phases: {
                '03-architecture': {
                    started_at: twoHoursAgo
                }
            }
        };
        const requirements = {
            phase_requirements: {
                '03-architecture': {
                    timeout_minutes: 45
                }
            }
        };

        const result = checkPhaseTimeout(state, requirements);
        assert.equal(result.exceeded, true);
        assert.equal(result.limit, 45);
    });
});

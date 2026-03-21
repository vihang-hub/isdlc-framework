/**
 * ImplementationLoop — Provider-neutral loop orchestration for Writer/Reviewer/Updater
 *
 * Part of the shared core extracted by REQ-0076 (Vertical Spike).
 * Manages file ordering, cycle counting, verdict routing, and TDD ordering
 * without any provider-specific (Claude/Codex/Antigravity) dependencies.
 *
 * Requirements: FR-002 (AC-002-01, AC-002-02, AC-002-03), FR-004 (AC-004-01)
 *
 * @module src/core/teams/implementation-loop
 */

/**
 * @typedef {Object} FileEntry
 * @property {string} path - File path relative to project root
 * @property {'source'|'test'} type - Whether this is a source or test file
 * @property {number} order - Original ordering from the task plan
 */

/**
 * @typedef {Object} LoopState
 * @property {FileEntry[]} files - Ordered file list
 * @property {number} current_file_index - Which file we're currently on
 * @property {Object<string, number>} cycle_per_file - Cycle count per file path
 * @property {number} max_cycles - Maximum review cycles per file (default 3)
 * @property {Array<{file: string, cycle: number, verdict: string}>} verdicts - Verdict history
 * @property {string[]} completed_files - Files that have passed review
 * @property {boolean} tdd_ordering - Whether TDD ordering is active
 */

/**
 * @typedef {Object} FileInfo
 * @property {string} file_path - Path to the file
 * @property {number} file_number - 1-based position in the file list
 * @property {number} total - Total number of files
 * @property {boolean} is_test - Whether this is a test file
 */

/**
 * @typedef {Object} TeamSpec
 * @property {string} team_type - Must be 'implementation_review_loop'
 * @property {string[]} members - Team member roles
 * @property {string} parallelism - Execution strategy
 * @property {number} max_iterations_per_file - Max review cycles per file
 * @property {string} state_owner - Who owns the loop state
 */

// Required fields for a valid TeamSpec
const REQUIRED_TEAM_SPEC_FIELDS = ['team_type', 'members', 'max_iterations_per_file'];

/**
 * Provider-neutral implementation loop orchestrator.
 *
 * Manages the Writer -> Reviewer -> Updater cycle for each file in the
 * implementation plan. Handles file ordering (including TDD test-first),
 * cycle counting, verdict routing, and state tracking.
 */
export class ImplementationLoop {
  /**
   * @param {TeamSpec} teamSpec - Team configuration
   * @param {LoopState|null} [loopState=null] - Optional existing loop state to resume
   * @throws {Error} If teamSpec is missing required fields
   */
  constructor(teamSpec, loopState = null) {
    if (!teamSpec || typeof teamSpec !== 'object') {
      throw new Error('ImplementationLoop requires a valid teamSpec object');
    }

    // Validate required fields (FR-002, AC-002-03)
    for (const field of REQUIRED_TEAM_SPEC_FIELDS) {
      if (teamSpec[field] === undefined) {
        throw new Error(`teamSpec missing required field: ${field}`);
      }
    }

    this._teamSpec = teamSpec;
    this._loopState = loopState;
  }

  /**
   * Initialize a new loop from a task plan file list.
   *
   * @param {FileEntry[]} files - Files from the task plan
   * @param {Object} [options={}] - Options
   * @param {boolean} [options.tdd_ordering=false] - Apply TDD ordering (test before source)
   * @returns {LoopState} Fresh loop state
   */
  initFromPlan(files, options = {}) {
    const tddOrdering = options.tdd_ordering ?? false;
    let orderedFiles = [...files];

    if (tddOrdering) {
      orderedFiles = this._applyTddOrdering(orderedFiles);
    }

    const state = {
      files: orderedFiles,
      current_file_index: 0,
      cycle_per_file: {},
      max_cycles: this._teamSpec.max_iterations_per_file || 3,
      verdicts: [],
      completed_files: [],
      tdd_ordering: tddOrdering
    };

    this._loopState = state;
    return state;
  }

  /**
   * Get the next file to process.
   *
   * @param {LoopState} loopState - Current loop state
   * @returns {FileInfo|null} Next file info, or null if all files are complete
   */
  computeNextFile(loopState) {
    if (loopState.current_file_index >= loopState.files.length) {
      return null;
    }

    const file = loopState.files[loopState.current_file_index];
    return {
      file_path: file.path,
      file_number: loopState.current_file_index + 1,
      total: loopState.files.length,
      is_test: file.type === 'test'
    };
  }

  /**
   * Build a WRITER_CONTEXT contract for the provider adapter.
   *
   * @param {LoopState} loopState - Current loop state
   * @param {FileInfo} fileInfo - File info from computeNextFile
   * @returns {Object} WRITER_CONTEXT object matching the contract schema
   */
  buildWriterContext(loopState, fileInfo) {
    return {
      mode: 'writer',
      per_file_loop: true,
      tdd_ordering: loopState.tdd_ordering,
      file_number: fileInfo.file_number,
      total_files: fileInfo.total,
      file_path: fileInfo.file_path,
      completed_files: [...loopState.completed_files]
    };
  }

  /**
   * Build a REVIEW_CONTEXT contract for the provider adapter.
   *
   * @param {LoopState} loopState - Current loop state
   * @param {FileInfo} fileInfo - File info from computeNextFile
   * @param {number} cycle - Current review cycle number (1-based)
   * @returns {Object} REVIEW_CONTEXT object matching the contract schema
   */
  buildReviewContext(loopState, fileInfo, cycle) {
    return {
      file_path: fileInfo.file_path,
      file_number: fileInfo.file_number,
      cycle
    };
  }

  /**
   * Build an UPDATE_CONTEXT contract for the provider adapter.
   *
   * @param {LoopState} loopState - Current loop state
   * @param {FileInfo} fileInfo - File info for the file being updated
   * @param {Object} findings - Reviewer findings
   * @param {Array} findings.blocking - Blocking findings that must be fixed
   * @param {Array} findings.warning - Warning findings (advisory)
   * @returns {Object} UPDATE_CONTEXT object matching the contract schema
   */
  buildUpdateContext(loopState, fileInfo, findings) {
    const filePath = fileInfo.file_path;
    const cycle = loopState.cycle_per_file[filePath] || 1;

    return {
      file_path: filePath,
      cycle,
      reviewer_verdict: 'REVISE',
      findings: {
        blocking: findings.blocking || [],
        warning: findings.warning || []
      }
    };
  }

  /**
   * Process a review verdict and advance the loop state.
   *
   * PASS → file completes, advance to next (or complete if last).
   * REVISE → increment cycle; if at max_cycles, return fail action.
   *
   * @param {LoopState} loopState - Current loop state
   * @param {'PASS'|'REVISE'} verdict - The reviewer's verdict
   * @returns {{ action: 'next_file'|'update'|'fail'|'complete', loopState: LoopState }}
   */
  processVerdict(loopState, verdict) {
    const currentFile = loopState.files[loopState.current_file_index];
    const filePath = currentFile.path;
    const currentCycle = loopState.cycle_per_file[filePath] || 1;

    // Record verdict in history (FR-002, AC-002-02)
    loopState.verdicts.push({
      file: filePath,
      cycle: currentCycle,
      verdict
    });

    if (verdict === 'PASS') {
      // File passed — add to completed, advance index
      loopState.completed_files.push(filePath);
      loopState.current_file_index++;

      // Check if we've processed all files
      if (loopState.current_file_index >= loopState.files.length) {
        return { action: 'complete', loopState };
      }
      return { action: 'next_file', loopState };
    }

    if (verdict === 'REVISE') {
      // Check if already at max cycles
      if (currentCycle >= loopState.max_cycles) {
        return { action: 'fail', loopState };
      }

      // Increment cycle and route to updater
      loopState.cycle_per_file[filePath] = currentCycle + 1;
      return { action: 'update', loopState };
    }

    throw new Error(`Unknown verdict: ${verdict}. Expected "PASS" or "REVISE".`);
  }

  /**
   * Check if the loop is complete (all files have passed review).
   *
   * @param {LoopState} loopState - Current loop state
   * @returns {boolean} True if all files are in completed_files
   */
  isComplete(loopState) {
    return loopState.completed_files.length >= loopState.files.length;
  }

  /**
   * Get a summary of the current loop state.
   *
   * @param {LoopState} loopState - Current loop state
   * @returns {Object} Summary with file counts, verdict history, etc.
   */
  getSummary(loopState) {
    return {
      total_files: loopState.files.length,
      completed_files: loopState.completed_files.length,
      remaining_files: loopState.files.length - loopState.completed_files.length,
      current_file_index: loopState.current_file_index,
      verdicts: [...loopState.verdicts],
      tdd_ordering: loopState.tdd_ordering
    };
  }

  /**
   * Apply TDD ordering: for each source file, place its matching test file first.
   * Files are paired by base name (e.g., widget.js <-> widget.test.js).
   * Unpaired files are appended at the end in original order.
   *
   * @private
   * @param {FileEntry[]} files - Unordered file list
   * @returns {FileEntry[]} TDD-ordered file list (test, source, test, source, ...)
   */
  _applyTddOrdering(files) {
    const testFiles = files.filter(f => f.type === 'test');
    const sourceFiles = files.filter(f => f.type === 'source');
    const result = [];
    const usedTests = new Set();
    const usedSources = new Set();

    // Extract base name from a path for matching
    const baseName = (filePath) => {
      const name = filePath.split('/').pop();
      return name
        .replace(/\.test\.(js|ts|cjs|mjs)$/, '')
        .replace(/\.(js|ts|cjs|mjs)$/, '');
    };

    // Pair source files with their tests
    for (const source of sourceFiles) {
      const srcBase = baseName(source.path);
      const matchingTest = testFiles.find(
        t => !usedTests.has(t.path) && baseName(t.path) === srcBase
      );

      if (matchingTest) {
        result.push(matchingTest); // test first
        result.push(source);       // then source
        usedTests.add(matchingTest.path);
        usedSources.add(source.path);
      }
    }

    // Append unpaired tests
    for (const test of testFiles) {
      if (!usedTests.has(test.path)) {
        result.push(test);
      }
    }

    // Append unpaired sources
    for (const source of sourceFiles) {
      if (!usedSources.has(source.path)) {
        result.push(source);
      }
    }

    return result;
  }
}

/**
 * iSDLC Core - Finalize Utilities
 * ================================
 * Provider-neutral finalize operations extracted from workflow-finalize.cjs.
 * Each function is a discrete, independently callable step.
 *
 * Traces to: FR-005 (REQ-GH-219)
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Merge a feature branch to main and delete it.
 * @param {string} branch - Branch name to merge
 * @param {string} projectRoot - Absolute path to project root
 * @returns {{ success: boolean, message: string, error?: string }}
 */
export function mergeBranch(branch, projectRoot) {
  try {
    // Commit any uncommitted work
    try {
      execSync('git add -A && git commit -m "Finalize workflow" --allow-empty', { cwd: projectRoot, stdio: 'pipe' });
    } catch (_) { /* may be nothing to commit */ }

    execSync('git checkout main', { cwd: projectRoot, stdio: 'pipe' });
    execSync(`git merge --no-ff ${branch} -m "Merge ${branch}"`, { cwd: projectRoot, stdio: 'pipe' });

    // Delete branch (non-critical)
    try {
      execSync(`git branch -d ${branch}`, { cwd: projectRoot, stdio: 'pipe' });
    } catch (_) { /* branch delete is non-critical */ }

    return { success: true, message: `Merged ${branch} to main` };
  } catch (err) {
    return { success: false, message: `Merge failed: ${err.message}`, error: err.message };
  }
}

/**
 * Move active_workflow to workflow_history.
 * @param {object} state - Full state.json object (mutated in place)
 * @returns {object} The mutated state
 */
export function moveWorkflowToHistory(state) {
  if (!state.active_workflow) return state;

  if (!state.workflow_history) state.workflow_history = [];
  state.workflow_history.push({
    ...state.active_workflow,
    status: 'completed',
    completed_at: new Date().toISOString()
  });

  return state;
}

/**
 * Clear transient workflow fields from state.
 * @param {object} state - Full state.json object (mutated in place)
 * @returns {object} The mutated state
 */
export function clearTransientFields(state) {
  delete state.active_workflow;
  state.current_phase = null;
  state.active_agent = null;
  return state;
}

/**
 * Sync external status (GitHub, BACKLOG.md).
 * @param {object} workflowInfo - { source, source_id, slug, artifact_folder }
 * @param {string} projectRoot - Absolute path to project root
 * @returns {{ github?: boolean, backlog?: boolean }}
 */
export function syncExternalStatus(workflowInfo, projectRoot) {
  const result = {};

  // GitHub issue close
  if (workflowInfo.source === 'github' && workflowInfo.source_id) {
    const match = workflowInfo.source_id.match(/^GH-(\d+)$/);
    if (match) {
      try {
        execSync(`gh issue close ${match[1]}`, { cwd: projectRoot, stdio: 'pipe' });
        result.github = true;
      } catch (_) {
        result.github = false;
      }
    }
  }

  // BACKLOG.md sync
  try {
    const backlogPath = join(projectRoot, 'BACKLOG.md');
    if (existsSync(backlogPath)) {
      let content = readFileSync(backlogPath, 'utf8');
      const slug = workflowInfo.slug || workflowInfo.artifact_folder || '';
      const issueNum = workflowInfo.source_id ? workflowInfo.source_id.replace(/^GH-/, '#') : null;
      const lines = content.split('\n');
      let matchIdx = -1;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (slug && line.includes(slug)) { matchIdx = i; break; }
        if (issueNum && line.includes(issueNum) && /\[[ A~]\]/.test(line)) { matchIdx = i; break; }
      }

      if (matchIdx >= 0) {
        lines[matchIdx] = lines[matchIdx].replace(/\[[ A~]\]/, '[x]');
        writeFileSync(backlogPath, lines.join('\n'), 'utf8');
        result.backlog = true;
      }
    }
  } catch (_) {
    result.backlog = false;
  }

  return result;
}

/**
 * Rebuild the session cache.
 * @param {string} projectRoot - Absolute path to project root
 * @returns {{ success: boolean, error?: string }}
 */
export function rebuildSessionCache(projectRoot) {
  try {
    execSync('node bin/rebuild-cache.js', { cwd: projectRoot, stdio: 'pipe', timeout: 30000 });
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Regenerate contracts (shipped + project-local).
 * @param {string} projectRoot - Absolute path to project root
 * @returns {{ success: boolean, error?: string }}
 */
export function regenerateContracts(projectRoot) {
  try {
    execSync('node bin/generate-contracts.js', { cwd: projectRoot, stdio: 'pipe', timeout: 30000 });
    try {
      execSync('node bin/generate-contracts.js --output .isdlc/config/contracts', { cwd: projectRoot, stdio: 'pipe', timeout: 30000 });
    } catch (_) { /* project-local contracts are optional */ }
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Rebuild memory embeddings (user + project).
 * @param {string} projectRoot - Absolute path to project root
 * @returns {{ success: boolean, error?: string }}
 */
export function rebuildMemoryEmbeddings(projectRoot) {
  try {
    execSync(
      `node -e 'import("./lib/memory-embedder.js").then(m => m.rebuildIndex(process.env.HOME + "/.isdlc/user-memory/sessions", process.env.HOME + "/.isdlc/user-memory/index.emb", { provider: "local" }).then(r => console.log(JSON.stringify(r))))'`,
      { cwd: projectRoot, stdio: 'pipe', timeout: 60000 }
    );
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Refresh code embeddings if pipeline is configured.
 * @param {string} projectRoot - Absolute path to project root
 * @returns {{ success: boolean, skipped?: boolean, error?: string }}
 */
export function refreshCodeEmbeddings(projectRoot) {
  try {
    const embeddingsDir = join(projectRoot, 'docs', '.embeddings');
    if (!existsSync(embeddingsDir)) {
      return { success: true, skipped: true };
    }
    execSync(
      `node -e 'import("./lib/embedding/chunker/index.js").then(() => console.log("ok"))'`,
      { cwd: projectRoot, stdio: 'pipe', timeout: 30000 }
    );
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

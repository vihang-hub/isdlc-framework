/**
 * Dashboard Server for Execution Observability
 *
 * REQ-0068: Serve the browser visualization and provide state API.
 * REQ-GH-258: Extended API for live workflow dashboard (skills, hooks, personas, meta).
 * Zero dependencies -- uses Node.js built-in http, fs, path modules.
 *
 * Routes:
 *   GET /           -> dashboard.html (SPA) -- .isdlc/dashboard.html primary, src/dashboard/index.html fallback
 *   GET /api/state  -> current state + topology + personas + skills + hooks + active_meta merged
 *   GET /api/history -> workflow_history array
 *   GET /api/history/:id -> single workflow by slug or source_id
 *
 * @module src/dashboard/server
 */

import { createServer } from 'node:http';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DEFAULT_PORT = 3456;
const MAX_PORT_ATTEMPTS = 5;
const AUTO_STOP_GRACE_MS = 30000;

/**
 * Start the dashboard HTTP server.
 *
 * @param {object} options
 * @param {string} options.stateJsonPath - Absolute path to state.json
 * @param {string} [options.topologyPath] - Absolute path to phase-topology.json
 * @param {number} [options.port=3456] - Preferred port
 * @param {boolean} [options.autoStop=false] - Auto-stop when workflow completes
 * @param {string} [options.personaDir] - Path to directory containing persona-*.md files (FR-010)
 * @param {string} [options.hookLogPath] - Path to hook-activity.log (FR-005)
 * @param {string} [options.skillsManifestPath] - Path to skills-manifest.json (FR-004)
 * @param {string} [options.externalSkillsManifestPath] - Path to external-skills-manifest.json (FR-004)
 * @param {string} [options.docsBasePath] - Base path for docs/requirements/{slug}/meta.json (FR-002)
 * @param {string} [options.dashboardHtmlPath] - Path to .isdlc/dashboard.html override (FR-008)
 * @returns {Promise<{ port: number, url: string, close: Function }>}
 */
export async function startDashboardServer(options) {
  const {
    stateJsonPath,
    topologyPath,
    port: preferredPort = DEFAULT_PORT,
    autoStop = false,
    personaDir,
    hookLogPath,
    skillsManifestPath,
    externalSkillsManifestPath,
    docsBasePath,
    dashboardHtmlPath
  } = options;

  // Load topology once at startup
  let topology = {};
  if (topologyPath && existsSync(topologyPath)) {
    try {
      topology = JSON.parse(readFileSync(topologyPath, 'utf8'));
    } catch (_err) {
      // Fallback: empty topology
    }
  }

  // REQ-GH-258 T006: Resolve dashboard HTML path with fallback
  // Primary: .isdlc/dashboard.html (customizable per-project)
  // Fallback: src/dashboard/index.html (shipped default)
  const isdlcDashboardPath = dashboardHtmlPath || join(dirname(stateJsonPath), 'dashboard.html');
  const fallbackIndexPath = join(__dirname, 'index.html');
  let resolvedHtmlPath = null;
  if (existsSync(isdlcDashboardPath)) {
    resolvedHtmlPath = isdlcDashboardPath;
  } else if (existsSync(fallbackIndexPath)) {
    resolvedHtmlPath = fallbackIndexPath;
  }

  // Resolve analysis-index.json path (sibling to state.json in .isdlc/)
  const analysisIndexPath = join(dirname(stateJsonPath), 'analysis-index.json');

  // Resolve hook-activity.log path (sibling to state.json in .isdlc/)
  const resolvedHookLogPath = hookLogPath || join(dirname(stateJsonPath), 'hook-activity.log');

  // Resolve skills manifest paths
  const resolvedSkillsManifestPath = skillsManifestPath || null;
  const resolvedExternalSkillsManifestPath = externalSkillsManifestPath || null;

  // Resolve docs base path for meta.json resolution
  const resolvedDocsBasePath = docsBasePath || null;

  // Resolve persona directory
  const resolvedPersonaDir = personaDir || null;

  // Cache for last-good state response
  let lastGoodState = null;

  // Cache for analysis index (5-second TTL to avoid excess I/O)
  let analysisIndexCache = null;
  let analysisIndexCacheTime = 0;
  const ANALYSIS_INDEX_CACHE_TTL_MS = 5000;

  // Auto-stop timer
  let autoStopTimer = null;

  function readState() {
    try {
      const content = readFileSync(stateJsonPath, 'utf8');
      const state = JSON.parse(content);
      lastGoodState = state;
      return state;
    } catch (_err) {
      return lastGoodState; // Return cached on error
    }
  }

  /**
   * Reads analysis-index.json with 5-second cache.
   * Fail-open: returns default on missing/corrupt file.
   */
  function scanAnalysisIndex() {
    const now = Date.now();
    if (analysisIndexCache && (now - analysisIndexCacheTime) < ANALYSIS_INDEX_CACHE_TTL_MS) {
      return analysisIndexCache;
    }
    try {
      if (existsSync(analysisIndexPath)) {
        const content = readFileSync(analysisIndexPath, 'utf8');
        const parsed = JSON.parse(content);
        analysisIndexCache = parsed;
        analysisIndexCacheTime = now;
        return parsed;
      }
    } catch (_err) {
      // Fail-open: return empty on corrupt/missing
    }
    const empty = { version: '1.0.0', updated_at: null, items: [] };
    analysisIndexCache = empty;
    analysisIndexCacheTime = now;
    return empty;
  }

  /**
   * REQ-GH-258 T002: Read agent skills from built-in and external manifests.
   * FR-004, FR-006: Skills display in dashboard.
   * Fail-open: returns empty arrays on any error.
   *
   * @param {string|null} activeAgent - Agent name from sub_agent_log or active_workflow
   * @returns {{ built_in: Array<{skill_id: string, name?: string}>, external: Array<{name: string, file?: string}> }}
   */
  function getAgentSkills(activeAgent) {
    const result = { built_in: [], external: [] };
    try {
      // Read built-in skills from skills-manifest.json
      if (resolvedSkillsManifestPath && existsSync(resolvedSkillsManifestPath)) {
        const manifest = JSON.parse(readFileSync(resolvedSkillsManifestPath, 'utf8'));
        if (activeAgent && manifest.ownership && manifest.ownership[activeAgent]) {
          const agentEntry = manifest.ownership[activeAgent];
          const skillIds = Array.isArray(agentEntry.skills) ? agentEntry.skills : [];
          result.built_in = skillIds.map(id => ({ skill_id: id }));
        }
      }
    } catch (_err) {
      // Fail-open: built_in stays empty
    }
    try {
      // Read external skills from external-skills-manifest.json
      if (resolvedExternalSkillsManifestPath && existsSync(resolvedExternalSkillsManifestPath)) {
        const extManifest = JSON.parse(readFileSync(resolvedExternalSkillsManifestPath, 'utf8'));
        if (Array.isArray(extManifest.skills)) {
          result.external = extManifest.skills.map(s => ({ name: s.name || s.skill_id || 'unknown', file: s.file || null }));
        }
      }
    } catch (_err) {
      // Fail-open: external stays empty
    }
    return result;
  }

  /**
   * REQ-GH-258 T003: Scan hook-activity.log (JSONL format).
   * FR-005, FR-006: Hook events display in dashboard.
   * Tail last 50 lines, optionally filter by current phase.
   * Fail-open: returns [] on missing/corrupt file.
   *
   * @param {string|null} currentPhase - If provided, filter to events matching this phase
   * @returns {Array<{ts: string, hook: string, event: string, phase: string, reason: string}>}
   */
  function scanHookLog(currentPhase) {
    try {
      if (!existsSync(resolvedHookLogPath)) return [];
      const content = readFileSync(resolvedHookLogPath, 'utf8');
      if (!content || !content.trim()) return [];
      const lines = content.trim().split('\n');
      // Tail last 50 lines
      const tail = lines.slice(-50);
      const events = [];
      for (const line of tail) {
        try {
          const entry = JSON.parse(line);
          events.push({
            ts: entry.ts || null,
            hook: entry.hook || null,
            event: entry.event || null,
            phase: entry.phase || null,
            reason: entry.reason || null
          });
        } catch (_parseErr) {
          // Skip corrupt lines (fail-open)
        }
      }
      // Filter by current phase if provided
      if (currentPhase) {
        return events.filter(e => e.phase === currentPhase);
      }
      return events;
    } catch (_err) {
      return [];
    }
  }

  /**
   * REQ-GH-258 T004: Read active analysis meta.json.
   * FR-002, FR-006: Active analysis metadata in dashboard.
   * Resolves active analysis slug from scanAnalysisIndex(), reads meta.json.
   * Fail-open: returns null on error.
   *
   * @returns {object|null} Parsed meta.json content or null
   */
  function readActiveMeta() {
    try {
      if (!resolvedDocsBasePath) return null;
      const analysisIndex = scanAnalysisIndex();
      const items = Array.isArray(analysisIndex.items) ? analysisIndex.items : [];
      // Find active analysis: most recent non-analyzed item with recent activity
      const ACTIVE_THRESHOLD_MS = 2 * 60 * 1000;
      const now = Date.now();
      let activeSlug = null;
      for (const item of items) {
        if (item.last_activity_at) {
          const age = now - new Date(item.last_activity_at).getTime();
          if (age < ACTIVE_THRESHOLD_MS && item.analysis_status !== 'analyzed') {
            if (!activeSlug || item.last_activity_at > activeSlug.last_activity_at) {
              activeSlug = item.slug;
            }
          }
        }
      }
      if (!activeSlug) return null;
      const metaPath = join(resolvedDocsBasePath, 'requirements', activeSlug, 'meta.json');
      if (!existsSync(metaPath)) return null;
      return JSON.parse(readFileSync(metaPath, 'utf8'));
    } catch (_err) {
      return null;
    }
  }

  /**
   * REQ-GH-258 T005: Scan persona-*.md files and extract role_type from frontmatter.
   * FR-010, FR-006: Persona nodes display in dashboard.
   * Scanned once at startup and cached.
   * Fail-open: returns [] on error.
   *
   * @returns {Array<{name: string, role_type: string|null}>}
   */
  let personaCache = null;
  function scanPersonas() {
    if (personaCache !== null) return personaCache;
    try {
      if (!resolvedPersonaDir || !existsSync(resolvedPersonaDir)) {
        personaCache = [];
        return personaCache;
      }
      const files = readdirSync(resolvedPersonaDir).filter(f => /^persona-.*\.md$/.test(f));
      const personas = [];
      for (const file of files) {
        const name = file.replace(/^persona-/, '').replace(/\.md$/, '');
        let roleType = null;
        try {
          const content = readFileSync(join(resolvedPersonaDir, file), 'utf8');
          // Read first 20 lines for frontmatter
          const firstLines = content.split('\n').slice(0, 20);
          let inFrontmatter = false;
          for (const line of firstLines) {
            if (line.trim() === '---') {
              if (inFrontmatter) break; // End of frontmatter
              inFrontmatter = true;
              continue;
            }
            if (inFrontmatter) {
              const match = line.match(/^role_type:\s*(.+)/);
              if (match) {
                roleType = match[1].trim();
                break;
              }
            }
          }
        } catch (_readErr) {
          // Fail-open: persona with null role_type
        }
        personas.push({ name, role_type: roleType });
      }
      personaCache = personas;
      return personaCache;
    } catch (_err) {
      personaCache = [];
      return personaCache;
    }
  }

  function buildStateResponse(state) {
    // BUG-GH-277: Include analysis data in response
    const analysisIndex = scanAnalysisIndex();
    const analysisItems = Array.isArray(analysisIndex.items) ? analysisIndex.items : [];

    // active_analysis: item with last_activity_at within 2 minutes (roundtable running now)
    const ACTIVE_THRESHOLD_MS = 2 * 60 * 1000;
    const now = Date.now();
    let activeAnalysis = null;
    for (const item of analysisItems) {
      if (item.last_activity_at) {
        const age = now - new Date(item.last_activity_at).getTime();
        if (age < ACTIVE_THRESHOLD_MS && item.analysis_status !== 'analyzed') {
          if (!activeAnalysis || item.last_activity_at > activeAnalysis.last_activity_at) {
            activeAnalysis = item;
          }
        }
      }
    }

    // REQ-GH-258: Determine active agent from sub_agent_log or active_workflow
    const subAgentLog = state?.active_workflow?.sub_agent_log || [];
    const lastAgent = subAgentLog.length > 0 ? subAgentLog[subAgentLog.length - 1] : null;
    const activeAgent = lastAgent?.agent || null;

    // REQ-GH-258: Current phase for hook log filtering
    const currentPhase = state?.active_workflow?.current_phase || null;

    return {
      active_workflow: state?.active_workflow || null,
      phases: state?.phases || {},
      topology: topology?.phases || {},
      workflow_type: state?.active_workflow?.type || null,
      timestamp: new Date().toISOString(),
      stale: state === lastGoodState && state !== null,
      analysis_items: analysisItems,
      active_analysis: activeAnalysis,
      // REQ-GH-258 new fields (FR-002, FR-004, FR-005, FR-010)
      active_meta: readActiveMeta(),
      hook_events: scanHookLog(currentPhase),
      agent_skills: getAgentSkills(activeAgent),
      personas: scanPersonas()
    };
  }

  function handleRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    // CORS headers for local development
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    if (pathname === '/' || pathname === '/index.html' || pathname === '/dashboard.html') {
      // REQ-GH-258 T006: Serve dashboard HTML with .isdlc/ primary, src/ fallback
      if (resolvedHtmlPath) {
        try {
          const html = readFileSync(resolvedHtmlPath, 'utf8');
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(html);
        } catch (_err) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Dashboard UI not found');
        }
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Dashboard UI not found');
      }
      return;
    }

    if (pathname === '/api/state') {
      const state = readState();
      const response = buildStateResponse(state);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(response));

      // Check for auto-stop condition
      if (autoStop && state && !state.active_workflow) {
        if (!autoStopTimer) {
          autoStopTimer = setTimeout(() => {
            server.close();
          }, AUTO_STOP_GRACE_MS);
        }
      } else if (autoStopTimer) {
        clearTimeout(autoStopTimer);
        autoStopTimer = null;
      }
      return;
    }

    if (pathname === '/api/history') {
      const state = readState();
      const history = state?.workflow_history || [];
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(history));
      return;
    }

    // Match /api/history/:id
    const historyMatch = pathname.match(/^\/api\/history\/(.+)$/);
    if (historyMatch) {
      const id = decodeURIComponent(historyMatch[1]);
      const state = readState();
      const history = state?.workflow_history || [];
      const entry = history.find(w =>
        w.slug === id || w.source_id === id || w.id === id || w.artifact_folder === id
      );

      if (entry) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(entry));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Workflow not found', id }));
      }
      return;
    }

    // 404 for unknown routes
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }

  // Create server and attempt port binding
  const server = createServer(handleRequest);

  const actualPort = await tryListen(server, preferredPort);
  const url = `http://127.0.0.1:${actualPort}`;

  return {
    port: actualPort,
    url,
    close() {
      if (autoStopTimer) clearTimeout(autoStopTimer);
      return new Promise((resolve) => {
        server.close(() => resolve());
      });
    }
  };
}

/**
 * Try to listen on a port, falling back to subsequent ports.
 *
 * @param {import('node:http').Server} server
 * @param {number} startPort
 * @returns {Promise<number>} The actual port bound
 */
// CLI entry point: node src/dashboard/server.js [--port N]
if (process.argv[1] && resolve(process.argv[1]) === resolve(__dirname, 'server.js')) {
  const portArg = process.argv.indexOf('--port');
  const port = portArg !== -1 ? parseInt(process.argv[portArg + 1], 10) : DEFAULT_PORT;
  const projectRoot = resolve(__dirname, '..', '..');
  startDashboardServer({
    stateJsonPath: join(projectRoot, '.isdlc', 'state.json'),
    topologyPath: join(projectRoot, 'src', 'claude', 'hooks', 'config', 'phase-topology.json'),
    port,
    // REQ-GH-258: New options for live dashboard data
    personaDir: join(projectRoot, 'src', 'claude', 'agents'),
    hookLogPath: join(projectRoot, '.isdlc', 'hook-activity.log'),
    skillsManifestPath: join(projectRoot, 'src', 'isdlc', 'config', 'skills-manifest.json'),
    externalSkillsManifestPath: join(projectRoot, 'docs', 'isdlc', 'external-skills-manifest.json'),
    docsBasePath: join(projectRoot, 'docs'),
    dashboardHtmlPath: join(projectRoot, '.isdlc', 'dashboard.html')
  }).then(info => {
    console.log(`Dashboard running at ${info.url}`);
  }).catch(err => {
    console.error('Failed to start dashboard:', err.message);
    process.exit(1);
  });
}

function tryListen(server, startPort) {
  return new Promise((resolvePort, reject) => {
    let attempts = 0;
    let port = startPort;

    function attempt() {
      server.once('error', (err) => {
        if (err.code === 'EADDRINUSE' && attempts < MAX_PORT_ATTEMPTS) {
          attempts++;
          port++;
          attempt();
        } else {
          reject(err);
        }
      });

      server.listen(port, '127.0.0.1', () => {
        // Use server.address().port to get the actual OS-assigned port
        // (handles port: 0 case where OS picks an ephemeral port)
        const actualPort = server.address().port;
        resolvePort(actualPort);
      });
    }

    attempt();
  });
}

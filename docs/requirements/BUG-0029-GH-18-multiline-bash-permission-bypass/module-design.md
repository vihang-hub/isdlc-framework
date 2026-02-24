# Module Design: BUG-0029-GH-18 Multiline Bash Permission Bypass

**Bug**: Framework agents generate multiline Bash commands that bypass Claude Code's
permission auto-allow rules. Claude Code matches permissions per-line; when comments
are interleaved with commands inside a single fenced `bash` block, the resulting
multi-line string does not match any auto-allow pattern.

**Fix strategy**: (1) Add a "Single-Line Bash Convention" section to CLAUDE.md and its
template. (2) Rewrite every multiline bash block across 5 agent/command files so each
command occupies its own single-line fenced block, with former `#` comments converted
to Markdown prose above the block.

**Scope**: 7 files, 23 multiline bash blocks to rewrite, 1 new convention section.

---

## Table of Contents

1. [File 1: CLAUDE.md -- Convention Section](#file-1-claudemd)
2. [File 2: src/claude/CLAUDE.md.template -- Convention Section + 2 Blocks](#file-2-claudemdtemplate)
3. [File 3: src/claude/agents/05-software-developer.md -- 3 Blocks](#file-3-05-software-developermd)
4. [File 4: src/claude/agents/06-integration-tester.md -- 5 Blocks](#file-4-06-integration-testermd)
5. [File 5: src/claude/commands/provider.md -- 11 Blocks](#file-5-providermd)
6. [File 6: src/claude/commands/discover.md -- 1 Block](#file-6-discovermd)
7. [File 7: src/claude/commands/isdlc.md -- 1 Block](#file-7-isdlcmd)

---

## Transformation Rules (apply uniformly)

1. **Move comments to prose**: Every `# comment` line inside a bash block becomes
   Markdown text (plain sentence or bullet) immediately above the next bash block.
2. **One command per block**: Each executable command gets its own ` ```bash ` / ` ``` `
   fence containing exactly one line.
3. **Preserve blank-line grouping as prose headings**: Where the original used blank
   lines to visually group commands, convert each group into a labeled sub-section
   or bullet.
4. **No semantic changes**: The commands themselves are unchanged -- only the
   container format changes.
5. **Indented blocks**: Some blocks appear inside numbered lists (indented by 3
   spaces). The replacement blocks must preserve the same indentation level.

---

## File 1: CLAUDE.md

**Path**: `/Users/vihangshah/enactor-code/isdlc/CLAUDE.md`

**Change type**: ADD (no existing bash blocks to rewrite)

### Change 1.1: Add Single-Line Bash Convention section

**Location**: Insert as a new `###` section under `## Agent Framework Context`
(line 65), after the last existing subsection (`### Git Commit Prohibition`, which
ends around line 216) and before `---` / `## Project Context` (line 218).

**Insert after line 216** (after the Git Commit Prohibition rationale paragraph):

```markdown
### Single-Line Bash Convention

When an agent prompt contains a fenced `bash` block that Claude Code will execute,
the block MUST contain exactly one command on one line. Claude Code's permission
auto-allow rules match each Bash invocation as a single string; a multi-line block
(with interleaved comments or multiple commands) produces a compound string that
matches no allow-list entry, causing a permission prompt on every run.

**Rules:**
- Each executable command gets its own ` ```bash ` / ` ``` ` fence.
- Comments that previously appeared as `# ...` inside the block become Markdown
  prose (plain text or a bullet point) immediately above the block.
- Grouping multiple commands for "copy-paste documentation" is acceptable in
  non-executable contexts (e.g., inside a ```` ```text ```` or ```` ``` ```` fence
  without a language tag), but any block tagged `bash` must be single-line.

Agents reference this section with:
> See **Single-Line Bash Convention** in CLAUDE.md.
```

---

## File 2: src/claude/CLAUDE.md.template

**Path**: `/Users/vihangshah/enactor-code/isdlc/src/claude/CLAUDE.md.template`

**Change type**: ADD convention section + MODIFY 2 bash blocks

### Change 2.0: Add Single-Line Bash Convention section

**Location**: Insert at the end of `## Agent Framework Context` section (after the
last subsection, `### CONSTITUTIONAL PRINCIPLES Preamble`, which ends at line 260).

Insert the identical convention text from Change 1.1 above.

### Change 2.1: Ollama Quick Start block (lines 84-95)

**BEFORE** (lines 83-95):
```
If using Ollama for local inference:

```bash
# Start Ollama server
ollama serve

# Pull a recommended model (choose based on your VRAM)
ollama pull qwen3-coder       # 24GB VRAM - Best for iSDLC
ollama pull glm-4.7            # 24GB VRAM - Strong reasoning
ollama pull gpt-oss:20b        # 16GB VRAM - Budget option

# Launch Claude Code (auto-detects Ollama)
claude
```
```

**AFTER**:
```
If using Ollama for local inference:

Start Ollama server:

```bash
ollama serve
```

Pull a recommended model (choose based on your VRAM):

```bash
ollama pull qwen3-coder
```

```bash
ollama pull glm-4.7
```

```bash
ollama pull gpt-oss:20b
```

Launch Claude Code (auto-detects Ollama):

```bash
claude
```
```

### Change 2.2: Manual Environment Variables block (lines 101-109)

**BEFORE** (lines 100-109):
```
For advanced users or custom setups:

```bash
# Ollama
export ANTHROPIC_BASE_URL=http://localhost:11434
export ANTHROPIC_AUTH_TOKEN=ollama
export ANTHROPIC_API_KEY=""

# Anthropic API (default)
export ANTHROPIC_API_KEY=sk-ant-...
```
```

**AFTER**:
```
For advanced users or custom setups:

Ollama:

```bash
export ANTHROPIC_BASE_URL=http://localhost:11434
```

```bash
export ANTHROPIC_AUTH_TOKEN=ollama
```

```bash
export ANTHROPIC_API_KEY=""
```

Anthropic API (default):

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```
```

---

## File 3: src/claude/agents/05-software-developer.md

**Path**: `/Users/vihangshah/enactor-code/isdlc/src/claude/agents/05-software-developer.md`

**Change type**: MODIFY 3 blocks (lines 169, 201, 392). Leave lines 522 and 566
unchanged (already single-line).

### Change 3.1: Test Command Discovery (lines 169-175)

**BEFORE** (lines 169-175):
```
```bash
# Example: Use what's configured, not hardcoded
npm test                    # If package.json has "test" script
npm run test:unit           # If separate unit test script exists
pytest tests/unit/          # If Python with pytest
go test ./...               # If Go project
```
```

**AFTER**:
```
Use what is configured, not hardcoded:

```bash
npm test
```

```bash
npm run test:unit
```

```bash
pytest tests/unit/
```

```bash
go test ./...
```
```

### Change 3.2: CPU Core Detection (lines 201-210)

**BEFORE** (lines 199-210):
```
Determine CPU core count to set parallelism level:

```bash
# Linux
N=$(nproc)

# macOS
N=$(sysctl -n hw.ncpu)

# Cross-platform Node.js
N=$(node -e "console.log(require('os').cpus().length)")
```
```

**AFTER**:
```
Determine CPU core count to set parallelism level:

Linux:

```bash
N=$(nproc)
```

macOS:

```bash
N=$(sysctl -n hw.ncpu)
```

Cross-platform Node.js:

```bash
N=$(node -e "console.log(require('os').cpus().length)")
```
```

### Change 3.3: Iteration Workflow step 3 (lines 392-400)

This block is indented inside a numbered list (3 spaces of indentation). The
replacement must preserve the same indentation context.

**BEFORE** (lines 392-400):
```
   ```bash
   # Discover and use the correct command:
   # 1. Check state.json.testing_infrastructure.tools
   # 2. Check package.json scripts
   # 3. Use discovered command, e.g.:
   npm test                    # or
   npm run test:unit           # or
   pytest tests/unit/          # etc.
   ```
```

**AFTER**:
```
   Discover and use the correct command: (1) check
   `state.json.testing_infrastructure.tools`, (2) check `package.json` scripts,
   (3) use the discovered command. Examples:

   ```bash
   npm test
   ```

   ```bash
   npm run test:unit
   ```

   ```bash
   pytest tests/unit/
   ```
```

---

## File 4: src/claude/agents/06-integration-tester.md

**Path**: `/Users/vihangshah/enactor-code/isdlc/src/claude/agents/06-integration-tester.md`

**Change type**: MODIFY 5 blocks (lines 128, 522, 602, 621, 659).

### Change 4.1: Command Discovery Protocol (lines 128-136)

**BEFORE** (lines 128-136):
```
```bash
# Step 1: Check state.json for configured commands
cat .isdlc/state.json | jq '.testing_infrastructure.tools'

# Step 2: Check package.json for test scripts
cat package.json | jq '.scripts | to_entries | map(select(.key | startswith("test")))'

# Step 3: Use discovered commands in your iteration loop
```
```

**AFTER**:
```
Step 1 -- Check state.json for configured commands:

```bash
cat .isdlc/state.json | jq '.testing_infrastructure.tools'
```

Step 2 -- Check package.json for test scripts:

```bash
cat package.json | jq '.scripts | to_entries | map(select(.key | startswith("test")))'
```

Step 3 -- Use discovered commands in your iteration loop.
```

### Change 4.2: ATDD Scan Command (lines 522-531)

**BEFORE** (lines 522-531):
```
```bash
# JavaScript/TypeScript
grep -rn "it\.skip\|test\.skip\|xit\|xdescribe" tests/acceptance/

# Python
grep -rn "@pytest.mark.skip" tests/acceptance/

# Java
grep -rn "@Disabled\|@Ignore" src/test/java/acceptance/
```
```

**AFTER**:
```
JavaScript/TypeScript:

```bash
grep -rn "it\.skip\|test\.skip\|xit\|xdescribe" tests/acceptance/
```

Python:

```bash
grep -rn "@pytest.mark.skip" tests/acceptance/
```

Java:

```bash
grep -rn "@Disabled\|@Ignore" src/test/java/acceptance/
```
```

### Change 4.3: ATDD Validation Step 3 -- Cross-Reference (lines 602-608)

**BEFORE** (lines 602-608):
```
```bash
# Extract test names from checklist
jq '.acceptance_criteria[].test_name' docs/isdlc/atdd-checklist.json

# Compare with actual test names in files
grep -h "it\('" tests/acceptance/*.test.ts | sed "s/.*it('//" | sed "s/',.*//"
```
```

**AFTER**:
```
Extract test names from checklist:

```bash
jq '.acceptance_criteria[].test_name' docs/isdlc/atdd-checklist.json
```

Compare with actual test names in files:

```bash
grep -h "it\('" tests/acceptance/*.test.ts | sed "s/.*it('//" | sed "s/',.*//"
```
```

### Change 4.4: ATDD Validation Step 4 -- Run Acceptance Suite (lines 621-627)

**BEFORE** (lines 621-627):
```
```bash
# Discover acceptance test command from package.json or state.json
npm run test:acceptance

# Or run with specific pattern
npm test -- --testPathPattern="acceptance"
```
```

**AFTER**:
```
Discover acceptance test command from package.json or state.json:

```bash
npm run test:acceptance
```

Or run with specific pattern:

```bash
npm test -- --testPathPattern="acceptance"
```
```

### Change 4.5: ATDD Mutation Testing (lines 659-662)

**BEFORE** (lines 659-662):
```
```bash
# Run mutation tests on acceptance tests
npm run test:mutation -- --files="src/**/*.ts" --mutate="tests/acceptance/**/*.test.ts"
```
```

**AFTER**:
```
Run mutation tests on acceptance tests:

```bash
npm run test:mutation -- --files="src/**/*.ts" --mutate="tests/acceptance/**/*.test.ts"
```
```

---

## File 5: src/claude/commands/provider.md

**Path**: `/Users/vihangshah/enactor-code/isdlc/src/claude/commands/provider.md`

**Change type**: MODIFY 11 blocks. Leave 2 blocks unchanged (line 375 single-command
`/provider setup-ollama`, line 399 single-command `curl`).

### Change 5.1: Free Cloud Quick Start (lines 88-102)

**BEFORE** (lines 88-102):
```
```bash
# 1. Get a FREE API key from one of these providers:
#    - Groq: https://console.groq.com/ (1,000 req/day)
#    - Together AI: https://api.together.xyz/ ($1 free credit)
#    - Google AI Studio: https://aistudio.google.com/ (60 req/min)

# 2. Set environment variable (example for Groq)
export GROQ_API_KEY=your-free-api-key

# 3. Initialize provider config
/provider init

# 4. Set free mode
/provider set free
```
```

**AFTER**:
```
1. Get a FREE API key from one of these providers:
   - Groq: https://console.groq.com/ (1,000 req/day)
   - Together AI: https://api.together.xyz/ ($1 free credit)
   - Google AI Studio: https://aistudio.google.com/ (60 req/min)

2. Set environment variable (example for Groq):

```bash
export GROQ_API_KEY=your-free-api-key
```

3. Initialize provider config:

```bash
/provider init
```

4. Set free mode:

```bash
/provider set free
```
```

### Change 5.2: Ollama Automatic Setup (lines 111-114)

**BEFORE** (lines 111-114):
```
```bash
# Automatic installation and configuration
/provider setup-ollama
```
```

**AFTER**:
```
Automatic installation and configuration:

```bash
/provider setup-ollama
```
```

### Change 5.3: Manual Ollama Setup (lines 125-142)

**BEFORE** (lines 125-142):
```
```bash
# 1. Install Ollama
# macOS: brew install ollama
# Linux: curl -fsSL https://ollama.com/install.sh | sh

# 2. Pull a coding model (choose based on your VRAM)
ollama pull qwen2.5-coder:14b    # 12GB VRAM
ollama pull qwen3-coder          # 24GB VRAM

# 3. Start Ollama server
ollama serve

# 4. Initialize iSDLC provider config
/provider init

# 5. Set budget mode (uses Ollama, falls back to free cloud)
/provider set budget
```
```

**AFTER**:
```
1. Install Ollama (macOS: `brew install ollama`, Linux: `curl -fsSL https://ollama.com/install.sh | sh`):

```bash
brew install ollama
```

2. Pull a coding model (choose based on your VRAM -- 12GB or 24GB):

```bash
ollama pull qwen2.5-coder:14b
```

```bash
ollama pull qwen3-coder
```

3. Start Ollama server:

```bash
ollama serve
```

4. Initialize iSDLC provider config:

```bash
/provider init
```

5. Set budget mode (uses Ollama, falls back to free cloud):

```bash
/provider set budget
```
```

### Change 5.4: Air-Gapped / Offline (lines 145-149)

**BEFORE** (lines 144-149):
```
### Option 4: Air-Gapped / Offline Environment
```bash
# Requires Ollama with models pre-installed
/provider init
/provider set local
```
```

**AFTER**:
```
### Option 4: Air-Gapped / Offline Environment

Requires Ollama with models pre-installed.

```bash
/provider init
```

```bash
/provider set local
```
```

### Change 5.5: Ollama not connecting (lines 207-213)

**BEFORE** (lines 207-213):
```
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Start Ollama if not running
ollama serve
```
```

**AFTER**:
```
Check if Ollama is running:

```bash
curl http://localhost:11434/api/tags
```

Start Ollama if not running:

```bash
ollama serve
```
```

### Change 5.6: API key issues (lines 216-222)

**BEFORE** (lines 216-222):
```
```bash
# Verify key is set
echo $ANTHROPIC_API_KEY

# Test directly
curl -H "x-api-key: $ANTHROPIC_API_KEY" https://api.anthropic.com/v1/messages
```
```

**AFTER**:
```
Verify key is set:

```bash
echo $ANTHROPIC_API_KEY
```

Test directly:

```bash
curl -H "x-api-key: $ANTHROPIC_API_KEY" https://api.anthropic.com/v1/messages
```
```

### Change 5.7: Force specific provider (lines 225-229)

**BEFORE** (lines 225-229):
```
```bash
# Override for current session
export ISDLC_PROVIDER_OVERRIDE=anthropic
export ISDLC_MODEL_OVERRIDE=sonnet
```
```

**AFTER**:
```
Override for current session:

```bash
export ISDLC_PROVIDER_OVERRIDE=anthropic
```

```bash
export ISDLC_MODEL_OVERRIDE=sonnet
```
```

### Change 5.8: Debug provider selection (lines 232-235)

**BEFORE** (lines 232-235):
```
```bash
export ISDLC_PROVIDER_DEBUG=true
# Run your command - you'll see provider routing decisions
```
```

**AFTER**:
```
Enable debug logging, then run your command to see provider routing decisions:

```bash
export ISDLC_PROVIDER_DEBUG=true
```
```

### Change 5.9: macOS Installation (lines 390-396)

**BEFORE** (lines 390-396):
```
```bash
# Via Homebrew (recommended)
brew install ollama

# Or direct download
curl -fsSL https://ollama.com/install.sh | sh
```
```

**AFTER**:
```
Via Homebrew (recommended):

```bash
brew install ollama
```

Or direct download:

```bash
curl -fsSL https://ollama.com/install.sh | sh
```
```

### Change 5.10: Pull Models (lines 417-429)

**BEFORE** (lines 417-429):
```
```bash
# Start Ollama server
ollama serve

# Pull a model (in another terminal)
ollama pull qwen2.5-coder:14b

# List installed models
ollama list

# Test a model
ollama run qwen2.5-coder:14b "Write a hello world in Python"
```
```

**AFTER**:
```
Start Ollama server:

```bash
ollama serve
```

Pull a model (in another terminal):

```bash
ollama pull qwen2.5-coder:14b
```

List installed models:

```bash
ollama list
```

Test a model:

```bash
ollama run qwen2.5-coder:14b "Write a hello world in Python"
```
```

### Change 5.11: Verify Setup (lines 433-438)

**BEFORE** (lines 433-438):
```
```bash
# Check Ollama is running
curl http://localhost:11434/api/tags

# Or use the provider command
/provider setup-ollama --check-only
```
```

**AFTER**:
```
Check Ollama is running:

```bash
curl http://localhost:11434/api/tags
```

Or use the provider command:

```bash
/provider setup-ollama --check-only
```
```

---

## File 6: src/claude/commands/discover.md

**Path**: `/Users/vihangshah/enactor-code/isdlc/src/claude/commands/discover.md`

**Change type**: MODIFY 1 block (lines 102-126)

### Change 6.1: Examples block (lines 102-126)

**BEFORE** (lines 102-126):
```
```bash
# Run discovery (presents interactive menu)
/discover

# Force new project setup with deep discovery
/discover --new

# Analyze existing project (standard depth, default)
/discover --existing

# Full-depth analysis with all agents + 5 debate rounds
/discover --deep full

# Standard depth with full transcript output
/discover --deep standard --verbose

# Analyze existing project, skip test evaluation
/discover --existing --skip-tests

# Discover a specific project in a monorepo
/discover --project api-service

# Prepare for ATDD workflow
/discover --atdd-ready
```
```

**AFTER**:
```
Run discovery (presents interactive menu):

```bash
/discover
```

Force new project setup with deep discovery:

```bash
/discover --new
```

Analyze existing project (standard depth, default):

```bash
/discover --existing
```

Full-depth analysis with all agents and 5 debate rounds:

```bash
/discover --deep full
```

Standard depth with full transcript output:

```bash
/discover --deep standard --verbose
```

Analyze existing project, skip test evaluation:

```bash
/discover --existing --skip-tests
```

Discover a specific project in a monorepo:

```bash
/discover --project api-service
```

Prepare for ATDD workflow:

```bash
/discover --atdd-ready
```
```

---

## File 7: src/claude/commands/isdlc.md

**Path**: `/Users/vihangshah/enactor-code/isdlc/src/claude/commands/isdlc.md`

**Change type**: MODIFY 1 block (lines 665-674)

### Change 7.1: Quick Start block (lines 665-674)

**BEFORE** (lines 665-674):
```
```bash
# For any project (auto-detects new vs existing)
/discover

# Force new project setup
/discover --new

# Force existing project analysis
/discover --existing
```
```

**AFTER**:
```
For any project (auto-detects new vs existing):

```bash
/discover
```

Force new project setup:

```bash
/discover --new
```

Force existing project analysis:

```bash
/discover --existing
```
```

---

## Summary

| File | Blocks rewritten | Blocks unchanged | Notes |
|------|-----------------|------------------|-------|
| CLAUDE.md | 0 | 0 | Convention section added only |
| CLAUDE.md.template | 2 | 0 | Convention section added + 2 rewrites |
| 05-software-developer.md | 3 | 2 | Lines 522, 566 already single-line |
| 06-integration-tester.md | 5 | 0 | All 5 are multiline |
| provider.md | 11 | 2 | Lines 375, 399 already single-line |
| discover.md | 1 | 0 | Large block splits into 8 singles |
| isdlc.md | 1 | 0 | Block splits into 3 singles |
| **TOTAL** | **23** | **4** | |

## Special Handling Notes

1. **Indented blocks** (05-software-developer.md, Change 3.3): The block at line 392
   sits inside a numbered list indented 3 spaces. The replacement prose and fenced
   blocks must maintain the same 3-space indentation.

2. **node -e command** (05-software-developer.md, Change 3.2, line 209): The command
   `N=$(node -e "console.log(require('os').cpus().length)")` contains embedded quotes.
   It is already a single line and requires no escaping changes -- just move it to
   its own block.

3. **provider.md Change 5.3 install command**: The original listed install instructions
   as comments. The rewrite picks `brew install ollama` as the executable example and
   moves the Linux alternative to prose. Both are also shown as separate single-line
   blocks.

4. **provider.md Change 5.8 trailing comment**: The original block has `export` on one
   line and a comment on the next. The comment becomes prose above the block.

5. **No /provider commands are actual bash**: Commands like `/provider init` are iSDLC
   slash commands, not shell commands. They appear inside `bash` fences for formatting.
   They remain in `bash` fences (single-line) for consistency with the existing style,
   but technically they do not trigger Claude Code permission checks. The rewrite is
   still beneficial for convention uniformity.

---

## GATE-04 Validation

- [x] All 7 files identified with exact locations
- [x] Before/after transformations specified for all 23 multiline blocks
- [x] Convention section text provided for CLAUDE.md and template
- [x] Special handling documented (indentation, quotes, slash commands)
- [x] No semantic changes to any command
- [x] Design proportional to bug-fix scope (no wireframes, no error taxonomy)

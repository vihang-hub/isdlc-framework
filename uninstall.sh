#!/bin/bash

# iSDLC Framework - Safe Uninstall Script
#
# SAFETY: Only removes framework-installed files tracked in the manifest.
# User-created agents, skills, commands, and hooks are PRESERVED.
#
# Usage:
#   ./uninstall.sh [options]
#
# Options:
#   --force           Skip all confirmation prompts
#   --backup          Archive framework files before removal
#   --purge-all       DANGER: Also remove user artifacts (.isdlc/state.json, constitution, etc.)
#   --purge-docs      DANGER: Also remove docs/ even if it contains user documents
#   --dry-run         Show what would be removed without removing anything
#   --help            Show this help message
#
# What gets removed (ONLY if tracked in manifest):
#   - Framework-installed files in .claude/agents/, skills/, commands/, hooks/
#   - Framework keys (hooks, permissions) from .claude/settings.json
#   - Framework config in .isdlc/ (config/, templates/, scripts/, installed-files.json)
#   - Empty docs/ scaffolding (only if no user content exists)
#   - scripts/convert-manifest.sh (legacy install fallback, if present)
#
# What is ALWAYS preserved:
#   - User-created agents, skills, commands, hooks (not in manifest)
#   - .claude/settings.local.json (user customizations)
#   - CLAUDE.md (user-owned)
#   - Runtime state in .isdlc/:
#       - state.json (project state, phase progress, iteration history)
#       - projects/{id}/state.json (monorepo per-project states)
#       - projects/{id}/skills/external/ (installed external skills)
#   - User documents in docs/isdlc/:
#       - constitution.md, constitution.draft.md (project constitution)
#       - tasks.md (orchestrator task plan)
#       - test-evaluation-report.md (test infrastructure analysis)
#       - atdd-checklist.json (ATDD compliance tracking)
#       - skill-customization-report.md (external skills summary)
#       - external-skills-manifest.json (external skills registry)
#       - checklists/ (gate checklist responses)
#       - projects/{id}/ (monorepo per-project documents)
#   - All user documents in docs/ (requirements, architecture, design, etc.)
#   - Any source code in the project

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# ============================================================================
# Parse flags
# ============================================================================
FORCE=false
BACKUP=false
PURGE_ALL=false
PURGE_DOCS=false
DRY_RUN=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --force)
            FORCE=true
            shift
            ;;
        --backup)
            BACKUP=true
            shift
            ;;
        --purge-all)
            PURGE_ALL=true
            shift
            ;;
        --purge-docs)
            PURGE_DOCS=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --help|-h)
            echo "iSDLC Framework - Safe Uninstall Script"
            echo ""
            echo "Usage: ./uninstall.sh [options]"
            echo ""
            echo "Options:"
            echo "  --force           Skip all confirmation prompts"
            echo "  --backup          Archive framework files to isdlc-backup-{timestamp}.tar.gz"
            echo "  --purge-all       DANGER: Also remove user artifacts (state, constitution, checklists)"
            echo "  --purge-docs      DANGER: Also remove docs/ even if it contains user documents"
            echo "  --dry-run         Show what would be removed without removing anything"
            echo "  --help            Show this help message"
            echo ""
            echo "SAFETY (default behavior):"
            echo "  - Only removes framework files tracked in .isdlc/installed-files.json"
            echo "  - Preserves user-created agents, skills, commands, hooks"
            echo "  - Preserves user artifacts: state.json, constitution.md, checklists/, phases/"
            echo "  - Preserves all documents in docs/ (requirements, architecture, design, etc.)"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Run ./uninstall.sh --help for usage information."
            exit 1
            ;;
    esac
done

PROJECT_ROOT="$(pwd)"

# ============================================================================
# Tracking arrays for summary
# ============================================================================
declare -a REMOVED_DIRS=()
declare -a REMOVED_FILES=()
declare -a CLEANED_FILES=()
declare -a SKIPPED_ITEMS=()
declare -a PRESERVED_USER_FILES=()

# ============================================================================
# Helper: perform or simulate an action
# ============================================================================
do_rm_f() {
    if [ "$DRY_RUN" = true ]; then
        echo -e "${YELLOW}  [dry-run] Would remove file: $1${NC}"
    else
        rm -f "$1"
    fi
    REMOVED_FILES+=("$1")
}

do_rmdir_if_empty() {
    # Remove directory only if empty
    if [ -d "$1" ] && [ -z "$(ls -A "$1" 2>/dev/null)" ]; then
        if [ "$DRY_RUN" = true ]; then
            echo -e "${YELLOW}  [dry-run] Would remove empty directory: $1${NC}"
        else
            rmdir "$1" 2>/dev/null || true
        fi
        REMOVED_DIRS+=("$1")
    fi
}

# ============================================================================
# Step 1: Detect framework installation
# ============================================================================
echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║           iSDLC Framework - Safe Uninstall                 ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Project Directory:${NC} $PROJECT_ROOT"
echo ""

HAS_ISDLC=false
HAS_CLAUDE_AGENTS=false
HAS_MANIFEST=false
IS_MONOREPO=false

if [ -d "$PROJECT_ROOT/.isdlc" ]; then
    HAS_ISDLC=true
fi

if [ -d "$PROJECT_ROOT/.claude/agents" ]; then
    HAS_CLAUDE_AGENTS=true
fi

if [ -f "$PROJECT_ROOT/.isdlc/installed-files.json" ]; then
    HAS_MANIFEST=true
fi

if [ -f "$PROJECT_ROOT/.isdlc/monorepo.json" ]; then
    IS_MONOREPO=true
fi

if [ "$HAS_ISDLC" = false ] && [ "$HAS_CLAUDE_AGENTS" = false ]; then
    echo -e "${RED}No iSDLC framework installation detected.${NC}"
    echo "  Expected .isdlc/ and/or .claude/agents/ to exist."
    exit 1
fi

echo -e "${GREEN}iSDLC framework detected.${NC}"
if [ "$IS_MONOREPO" = true ]; then
    echo -e "${BLUE}  Monorepo installation${NC}"
fi

# ============================================================================
# Step 2: Load manifest or warn about legacy installation
# ============================================================================
MANIFEST_FILE="$PROJECT_ROOT/.isdlc/installed-files.json"
declare -a MANIFEST_FILES=()

if [ "$HAS_MANIFEST" = true ]; then
    echo -e "${GREEN}  Installation manifest found - will only remove tracked files${NC}"

    if command -v jq &> /dev/null; then
        # Load file list from manifest
        while IFS= read -r file; do
            MANIFEST_FILES+=("$file")
        done < <(jq -r '.files[]' "$MANIFEST_FILE" 2>/dev/null)

        echo -e "${BLUE}  Tracked files: ${#MANIFEST_FILES[@]}${NC}"
    else
        echo -e "${YELLOW}  Warning: jq not available. Cannot parse manifest.${NC}"
        echo -e "${YELLOW}  Will use legacy removal mode (less safe).${NC}"
        HAS_MANIFEST=false
    fi
else
    echo ""
    echo -e "${YELLOW}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${YELLOW}║                    WARNING                                  ║${NC}"
    echo -e "${YELLOW}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}No installation manifest found at .isdlc/installed-files.json${NC}"
    echo ""
    echo -e "${YELLOW}This installation was created before manifest tracking was added.${NC}"
    echo -e "${YELLOW}The uninstaller cannot distinguish between:${NC}"
    echo -e "${YELLOW}  - Framework-installed files${NC}"
    echo -e "${YELLOW}  - User-created files${NC}"
    echo ""
    echo -e "${RED}RISK: User-created agents, skills, commands, or hooks may be deleted.${NC}"
    echo ""

    if [ "$FORCE" = false ]; then
        echo -e "${CYAN}Options:${NC}"
        echo "  1) Continue anyway (will attempt safe removal)"
        echo "  2) Abort and manually remove framework files"
        echo "  3) Create manifest from current state first (recommended)"
        echo ""
        read -p "Choose [1/2/3]: " LEGACY_CHOICE

        case "$LEGACY_CHOICE" in
            1)
                echo -e "${YELLOW}Continuing with legacy mode...${NC}"
                ;;
            2)
                echo -e "${RED}Uninstall aborted.${NC}"
                exit 0
                ;;
            3)
                echo ""
                echo -e "${BLUE}Creating manifest from current state...${NC}"
                # Generate manifest from existing framework files
                # This assumes all current files in .claude/{agents,skills,commands,hooks} are framework files
                TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
                MANIFEST_CONTENT='{"version":"1.0.0","created":"'"$TIMESTAMP"'","files":['
                FIRST_FILE=true

                for DIR in agents skills commands hooks; do
                    if [ -d "$PROJECT_ROOT/.claude/$DIR" ]; then
                        while IFS= read -r file; do
                            if [ "$FIRST_FILE" = false ]; then
                                MANIFEST_CONTENT+=','
                            fi
                            # Store relative path from project root
                            REL_PATH="${file#$PROJECT_ROOT/}"
                            MANIFEST_CONTENT+='"'"$REL_PATH"'"'
                            FIRST_FILE=false
                        done < <(find "$PROJECT_ROOT/.claude/$DIR" -type f 2>/dev/null)
                    fi
                done

                # Add settings.json if it exists
                if [ -f "$PROJECT_ROOT/.claude/settings.json" ]; then
                    if [ "$FIRST_FILE" = false ]; then
                        MANIFEST_CONTENT+=','
                    fi
                    MANIFEST_CONTENT+='".claude/settings.json"'
                fi

                MANIFEST_CONTENT+=']}'

                echo "$MANIFEST_CONTENT" | jq '.' > "$MANIFEST_FILE"
                echo -e "${GREEN}  ✓ Created manifest with $(echo "$MANIFEST_CONTENT" | jq '.files | length') files${NC}"
                echo ""
                echo -e "${YELLOW}Please review .isdlc/installed-files.json and remove any${NC}"
                echo -e "${YELLOW}user-created files from the list before running uninstall again.${NC}"
                exit 0
                ;;
            *)
                echo -e "${RED}Invalid choice. Aborting.${NC}"
                exit 1
                ;;
        esac
    fi
fi

# ============================================================================
# Step 3: Identify what will be removed vs preserved
# ============================================================================
echo ""
echo -e "${BLUE}Analyzing files...${NC}"

declare -a FILES_TO_REMOVE=()
declare -a USER_FILES_PRESERVED=()

if [ "$HAS_MANIFEST" = true ] && [ ${#MANIFEST_FILES[@]} -gt 0 ]; then
    # SAFE MODE: Only remove files in the manifest
    for file in "${MANIFEST_FILES[@]}"; do
        FULL_PATH="$PROJECT_ROOT/$file"
        if [ -f "$FULL_PATH" ]; then
            FILES_TO_REMOVE+=("$file")
        fi
    done

    # Find user-created files (files in .claude/ NOT in manifest)
    for DIR in agents skills commands hooks; do
        if [ -d "$PROJECT_ROOT/.claude/$DIR" ]; then
            while IFS= read -r file; do
                REL_PATH="${file#$PROJECT_ROOT/}"
                IN_MANIFEST=false
                for manifest_file in "${MANIFEST_FILES[@]}"; do
                    if [ "$REL_PATH" = "$manifest_file" ]; then
                        IN_MANIFEST=true
                        break
                    fi
                done
                if [ "$IN_MANIFEST" = false ]; then
                    USER_FILES_PRESERVED+=("$REL_PATH")
                fi
            done < <(find "$PROJECT_ROOT/.claude/$DIR" -type f 2>/dev/null)
        fi
    done
else
    # LEGACY MODE: Remove known framework patterns only
    # This is less safe but tries to preserve obvious user files

    # Known framework file patterns (conservative list)
    FRAMEWORK_PATTERNS=(
        # Orchestrator and numbered agents
        "00-sdlc-orchestrator.md"
        "01-requirements-analyst.md"
        "02-solution-architect.md"
        "03-tech-lead.md"
        "04-test-design-engineer.md"
        "05-software-developer.md"
        "06-integration-tester.md"
        "07-code-reviewer.md"
        "08-uat-coordinator.md"
        "09-devops-engineer.md"
        "10-release-manager.md"
        "11-deployment-specialist.md"
        "12-prod-support-engineer.md"
        "13-operations-analyst.md"
        "14-upgrade-engineer.md"
        # Discover agents
        "discover-orchestrator.md"
        "product-analyst.md"
        "architecture-analyzer.md"
        "architecture-designer.md"
        "skills-researcher.md"
        # Reverse engineering agents
        "R1-*.md"
        "R2-*.md"
        "R3-*.md"
        "R4-*.md"
        # Enactor agents
        "enactor-*.md"
        # Hook files
        "gate-blocker.cjs"
        "test-watcher.cjs"
        "constitution-validator.cjs"
        "menu-tracker.cjs"
        "skill-validator.cjs"
        "log-skill-usage.cjs"
        "review-reminder.cjs"
        "phase-loop-controller.cjs"
        "plan-surfacer.cjs"
        "phase-sequence-guard.cjs"
        "branch-guard.cjs"
        "state-write-validator.cjs"
        "walkthrough-tracker.cjs"
        "discover-menu-guard.cjs"
        "phase-transition-enforcer.cjs"
        "constitutional-iteration-validator.cjs"
        "menu-halt-enforcer.cjs"
        "explore-readonly-enforcer.cjs"
        "atdd-completeness-validator.cjs"
        "output-format-validator.cjs"
        "test-adequacy-blocker.cjs"
        "common.cjs"
    )

    for DIR in agents skills commands hooks; do
        if [ -d "$PROJECT_ROOT/.claude/$DIR" ]; then
            while IFS= read -r file; do
                REL_PATH="${file#$PROJECT_ROOT/}"
                FILENAME=$(basename "$file")
                IS_FRAMEWORK=false

                for pattern in "${FRAMEWORK_PATTERNS[@]}"; do
                    if [[ "$FILENAME" == $pattern ]]; then
                        IS_FRAMEWORK=true
                        break
                    fi
                done

                # For skills, check if it's under a known framework skill directory
                if [ "$DIR" = "skills" ]; then
                    if [[ "$REL_PATH" == *"/sdlc/"* ]] || \
                       [[ "$REL_PATH" == *"/discover/"* ]] || \
                       [[ "$REL_PATH" == *"/gates/"* ]] || \
                       [[ "$REL_PATH" == *"/workflows/"* ]]; then
                        IS_FRAMEWORK=true
                    fi
                fi

                if [ "$IS_FRAMEWORK" = true ]; then
                    FILES_TO_REMOVE+=("$REL_PATH")
                else
                    USER_FILES_PRESERVED+=("$REL_PATH")
                fi
            done < <(find "$PROJECT_ROOT/.claude/$DIR" -type f 2>/dev/null)
        fi
    done
fi

# ============================================================================
# Step 4: Show what will be removed and confirm
# ============================================================================
echo ""
echo -e "${YELLOW}The following will be removed:${NC}"
echo ""

if [ ${#FILES_TO_REMOVE[@]} -gt 0 ]; then
    echo -e "${BLUE}  Framework files (${#FILES_TO_REMOVE[@]} files):${NC}"
    # Show first 10 files
    COUNT=0
    for file in "${FILES_TO_REMOVE[@]}"; do
        if [ $COUNT -lt 10 ]; then
            echo "    $file"
        fi
        ((COUNT++))
    done
    if [ ${#FILES_TO_REMOVE[@]} -gt 10 ]; then
        echo "    ... and $((${#FILES_TO_REMOVE[@]} - 10)) more files"
    fi
fi

if [ ${#USER_FILES_PRESERVED[@]} -gt 0 ]; then
    echo ""
    echo -e "${GREEN}  User files PRESERVED (${#USER_FILES_PRESERVED[@]} files):${NC}"
    for file in "${USER_FILES_PRESERVED[@]}"; do
        echo "    $file"
    done
fi

echo ""
echo -e "${GREEN}User artifacts that will be PRESERVED (safe by default):${NC}"

# .isdlc/ artifacts
if [ -d "$PROJECT_ROOT/.isdlc" ]; then
    if [ "$PURGE_ALL" = true ]; then
        echo -e "${RED}  .isdlc/: WILL BE DELETED (--purge-all)${NC}"
    else
        echo -e "${GREEN}  .isdlc/ user artifacts:${NC}"
        [ -f "$PROJECT_ROOT/.isdlc/state.json" ] && echo -e "${GREEN}    - state.json (project state & history)${NC}"
        [ -f "$PROJECT_ROOT/.isdlc/constitution.md" ] && echo -e "${GREEN}    - constitution.md (project constitution)${NC}"
        [ -d "$PROJECT_ROOT/.isdlc/checklists" ] && echo -e "${GREEN}    - checklists/ (gate checklist responses)${NC}"
        [ -d "$PROJECT_ROOT/.isdlc/phases" ] && echo -e "${GREEN}    - phases/ (phase artifacts)${NC}"
        [ -d "$PROJECT_ROOT/.isdlc/projects" ] && echo -e "${GREEN}    - projects/ (monorepo project states)${NC}"
    fi
fi

# docs/ artifacts
if [ -d "$PROJECT_ROOT/docs" ]; then
    DOC_FILE_COUNT=$(find "$PROJECT_ROOT/docs" -type f ! -name ".*" 2>/dev/null | wc -l | tr -d ' ')
    if [ "$PURGE_DOCS" = true ]; then
        echo -e "${RED}  docs/: WILL BE DELETED (--purge-docs) - $DOC_FILE_COUNT files${NC}"
    elif [ "$DOC_FILE_COUNT" -gt 0 ]; then
        echo -e "${GREEN}  docs/ ($DOC_FILE_COUNT user documents)${NC}"
    else
        echo -e "${YELLOW}  docs/: empty scaffolding (will be cleaned up)${NC}"
    fi
fi

echo ""

if [ "$DRY_RUN" = true ]; then
    echo -e "${CYAN}  (--dry-run mode: no changes will be made)${NC}"
    echo ""
fi

if [ "$FORCE" = false ]; then
    read -p "Proceed with uninstall? [y/N]: " CONFIRM
    CONFIRM=${CONFIRM:-N}
    if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
        echo -e "${RED}Uninstall cancelled.${NC}"
        exit 0
    fi
    echo ""
fi

# ============================================================================
# Step 5: Backup (if --backup)
# ============================================================================
if [ "$BACKUP" = true ]; then
    TIMESTAMP=$(date +"%Y%m%d-%H%M%S")
    BACKUP_FILE="$PROJECT_ROOT/isdlc-backup-${TIMESTAMP}.tar.gz"

    echo -e "${BLUE}Creating backup...${NC}"

    # Build list of paths to backup
    BACKUP_PATHS=()
    [ -d "$PROJECT_ROOT/.claude/agents" ]   && BACKUP_PATHS+=(".claude/agents")
    [ -d "$PROJECT_ROOT/.claude/skills" ]   && BACKUP_PATHS+=(".claude/skills")
    [ -d "$PROJECT_ROOT/.claude/commands" ] && BACKUP_PATHS+=(".claude/commands")
    [ -d "$PROJECT_ROOT/.claude/hooks" ]    && BACKUP_PATHS+=(".claude/hooks")
    [ -f "$PROJECT_ROOT/.claude/settings.json" ] && BACKUP_PATHS+=(".claude/settings.json")
    [ -d "$PROJECT_ROOT/.isdlc" ]           && BACKUP_PATHS+=(".isdlc")
    [ -d "$PROJECT_ROOT/docs" ]             && BACKUP_PATHS+=("docs")

    if [ ${#BACKUP_PATHS[@]} -gt 0 ]; then
        if [ "$DRY_RUN" = true ]; then
            echo -e "${YELLOW}  [dry-run] Would create backup: $BACKUP_FILE${NC}"
            echo -e "${YELLOW}  [dry-run] Paths: ${BACKUP_PATHS[*]}${NC}"
        else
            tar -czf "$BACKUP_FILE" -C "$PROJECT_ROOT" "${BACKUP_PATHS[@]}" 2>/dev/null
            echo -e "${GREEN}  ✓ Backup created: $BACKUP_FILE${NC}"
        fi
    else
        echo -e "${YELLOW}  No framework files found to backup.${NC}"
    fi
    echo ""
fi

# ============================================================================
# Step 6: Remove framework files (manifest-tracked or pattern-matched)
# ============================================================================
echo -e "${BLUE}Removing framework files...${NC}"

for file in "${FILES_TO_REMOVE[@]}"; do
    FULL_PATH="$PROJECT_ROOT/$file"
    if [ -f "$FULL_PATH" ]; then
        do_rm_f "$FULL_PATH"
    fi
done

echo -e "${GREEN}  ✓ Removed ${#FILES_TO_REMOVE[@]} framework files${NC}"
echo ""

# ============================================================================
# Step 7: Clean empty directories in .claude/
# ============================================================================
echo -e "${BLUE}Cleaning empty directories...${NC}"

# Remove empty subdirectories (deepest first)
for DIR in agents skills commands hooks; do
    if [ -d "$PROJECT_ROOT/.claude/$DIR" ]; then
        # Find and remove empty directories, deepest first
        find "$PROJECT_ROOT/.claude/$DIR" -type d -empty -delete 2>/dev/null || true
        # Check if the main directory is now empty
        do_rmdir_if_empty "$PROJECT_ROOT/.claude/$DIR"
    fi
done

# Also clean hooks subdirectories
for SUBDIR in lib config dispatchers tests; do
    do_rmdir_if_empty "$PROJECT_ROOT/.claude/hooks/$SUBDIR"
done

echo ""

# ============================================================================
# Step 8: Clean settings.json (strip hooks and permissions keys)
# ============================================================================
if [ -f "$PROJECT_ROOT/.claude/settings.json" ]; then
    echo -e "${BLUE}Cleaning .claude/settings.json...${NC}"

    if command -v jq &> /dev/null; then
        CLEANED=$(jq 'del(.hooks, .permissions)' "$PROJECT_ROOT/.claude/settings.json" 2>/dev/null)

        if [ $? -eq 0 ]; then
            # Check if the result is empty object
            IS_EMPTY=$(echo "$CLEANED" | jq 'length == 0' 2>/dev/null)

            if [ "$IS_EMPTY" = "true" ]; then
                # File would become {}, delete it
                do_rm_f "$PROJECT_ROOT/.claude/settings.json"
                echo -e "${GREEN}  ✓ Removed .claude/settings.json (no remaining keys)${NC}"
            else
                if [ "$DRY_RUN" = true ]; then
                    echo -e "${YELLOW}  [dry-run] Would strip hooks and permissions from .claude/settings.json${NC}"
                else
                    echo "$CLEANED" > "$PROJECT_ROOT/.claude/settings.json"
                fi
                CLEANED_FILES+=(".claude/settings.json")
                echo -e "${GREEN}  ✓ Stripped hooks and permissions from .claude/settings.json${NC}"
            fi
        else
            echo -e "${YELLOW}  Warning: Could not parse .claude/settings.json with jq${NC}"
            SKIPPED_ITEMS+=(".claude/settings.json (jq parse error)")
        fi
    else
        echo -e "${YELLOW}  Warning: jq not available. Please manually remove these keys from .claude/settings.json:${NC}"
        echo -e "${YELLOW}    - \"hooks\"${NC}"
        echo -e "${YELLOW}    - \"permissions\"${NC}"
        SKIPPED_ITEMS+=(".claude/settings.json (jq unavailable)")
    fi
    echo ""
fi

# ============================================================================
# Step 9: Clean .isdlc/ - ONLY remove framework config, PRESERVE user artifacts
# ============================================================================
if [ -d "$PROJECT_ROOT/.isdlc" ]; then
    if [ "$PURGE_ALL" = true ]; then
        # DANGER MODE: Remove everything including user artifacts
        echo -e "${RED}Removing .isdlc/ completely (--purge-all)...${NC}"
        if [ "$DRY_RUN" = true ]; then
            echo -e "${YELLOW}  [dry-run] Would remove directory: .isdlc/${NC}"
        else
            rm -rf "$PROJECT_ROOT/.isdlc"
        fi
        REMOVED_DIRS+=(".isdlc/")
        echo -e "${RED}  ✓ Removed .isdlc/ (including user artifacts)${NC}"
    else
        # SAFE MODE: Only remove framework config, preserve user artifacts
        echo -e "${BLUE}Cleaning .isdlc/ (preserving user artifacts)...${NC}"

        # Framework-only directories that are safe to remove completely
        FRAMEWORK_ONLY_DIRS=(
            "config"           # Framework configuration files
            "templates"        # Framework templates (user copies are elsewhere)
            "scripts"          # Framework utility scripts
        )

        # Remove framework-only directories
        for DIR in "${FRAMEWORK_ONLY_DIRS[@]}"; do
            if [ -d "$PROJECT_ROOT/.isdlc/$DIR" ]; then
                if [ "$DRY_RUN" = true ]; then
                    echo -e "${YELLOW}  [dry-run] Would remove: .isdlc/$DIR/${NC}"
                else
                    rm -rf "$PROJECT_ROOT/.isdlc/$DIR"
                fi
                REMOVED_DIRS+=(".isdlc/$DIR/")
                echo -e "${GREEN}  ✓ Removed .isdlc/$DIR/ (framework config)${NC}"
            fi
        done

        # Remove framework-only files (but preserve user artifacts)
        FRAMEWORK_ONLY_FILES=(
            "installed-files.json"    # Installation manifest
            "monorepo.json"           # Monorepo config (if exists)
        )

        for FILE in "${FRAMEWORK_ONLY_FILES[@]}"; do
            if [ -f "$PROJECT_ROOT/.isdlc/$FILE" ]; then
                do_rm_f "$PROJECT_ROOT/.isdlc/$FILE"
                echo -e "${GREEN}  ✓ Removed .isdlc/$FILE (framework config)${NC}"
            fi
        done

        # USER ARTIFACTS - Always preserved (unless --purge-all):
        # Runtime state in .isdlc/:
        # - .isdlc/state.json (project state, history, iteration logs)
        # - .isdlc/projects/ (monorepo project runtime states)
        # User documents in docs/isdlc/:
        # - docs/isdlc/constitution.md (user-customized constitution)
        # - docs/isdlc/tasks.md (orchestrator task plan)
        # - docs/isdlc/test-evaluation-report.md (test infrastructure analysis)
        # - docs/isdlc/atdd-checklist.json (ATDD compliance tracking)
        # - docs/isdlc/skill-customization-report.md (external skills summary)
        # - docs/isdlc/external-skills-manifest.json (external skills registry)
        # - docs/isdlc/checklists/ (gate checklist responses)
        # - docs/isdlc/projects/ (monorepo per-project documents)

        echo ""
        echo -e "${GREEN}  Runtime state PRESERVED in .isdlc/:${NC}"

        # List preserved runtime items
        PRESERVED_ITEMS=()
        [ -f "$PROJECT_ROOT/.isdlc/state.json" ] && PRESERVED_ITEMS+=(".isdlc/state.json (project state & history)")
        [ -d "$PROJECT_ROOT/.isdlc/projects" ] && PRESERVED_ITEMS+=(".isdlc/projects/ (monorepo runtime states)")
        if [ ${#PRESERVED_ITEMS[@]} -gt 0 ]; then
            for ITEM in "${PRESERVED_ITEMS[@]}"; do
                echo -e "${GREEN}    - $ITEM${NC}"
                SKIPPED_ITEMS+=("$ITEM (runtime state)")
            done
        else
            echo -e "${YELLOW}    (no runtime state found)${NC}"
            # If no user artifacts, remove .isdlc/ if empty
            do_rmdir_if_empty "$PROJECT_ROOT/.isdlc"
        fi

        # Also show user documents in docs/isdlc/
        if [ -d "$PROJECT_ROOT/docs/isdlc" ]; then
            echo ""
            echo -e "${GREEN}  User documents PRESERVED in docs/isdlc/:${NC}"
            DOCS_PRESERVED=()
            [ -f "$PROJECT_ROOT/docs/isdlc/constitution.md" ] && DOCS_PRESERVED+=("constitution.md")
            [ -f "$PROJECT_ROOT/docs/isdlc/constitution.draft.md" ] && DOCS_PRESERVED+=("constitution.draft.md")
            [ -f "$PROJECT_ROOT/docs/isdlc/tasks.md" ] && DOCS_PRESERVED+=("tasks.md")
            [ -f "$PROJECT_ROOT/docs/isdlc/test-evaluation-report.md" ] && DOCS_PRESERVED+=("test-evaluation-report.md")
            [ -f "$PROJECT_ROOT/docs/isdlc/atdd-checklist.json" ] && DOCS_PRESERVED+=("atdd-checklist.json")
            [ -f "$PROJECT_ROOT/docs/isdlc/skill-customization-report.md" ] && DOCS_PRESERVED+=("skill-customization-report.md")
            [ -f "$PROJECT_ROOT/docs/isdlc/external-skills-manifest.json" ] && DOCS_PRESERVED+=("external-skills-manifest.json")
            [ -d "$PROJECT_ROOT/docs/isdlc/checklists" ] && DOCS_PRESERVED+=("checklists/")
            [ -d "$PROJECT_ROOT/docs/isdlc/projects" ] && DOCS_PRESERVED+=("projects/")

            for ITEM in "${DOCS_PRESERVED[@]}"; do
                echo -e "${GREEN}    - $ITEM${NC}"
                SKIPPED_ITEMS+=("docs/isdlc/$ITEM (user document)")
            done
        fi
    fi
fi
echo ""

# ============================================================================
# Step 10: Remove fallback script
# ============================================================================
if [ -f "$PROJECT_ROOT/scripts/convert-manifest.sh" ]; then
    echo -e "${BLUE}Removing fallback script...${NC}"
    do_rm_f "$PROJECT_ROOT/scripts/convert-manifest.sh"
    echo -e "${GREEN}  ✓ Removed scripts/convert-manifest.sh${NC}"
    do_rmdir_if_empty "$PROJECT_ROOT/scripts"
    echo ""
fi

# ============================================================================
# Step 11: Restore CLAUDE.md backup (offer to restore)
# ============================================================================
if [ -f "$PROJECT_ROOT/CLAUDE.md.backup" ]; then
    echo -e "${BLUE}Found CLAUDE.md.backup${NC}"

    if [ "$FORCE" = true ]; then
        # With --force, skip restore (don't overwrite current CLAUDE.md silently)
        echo -e "${YELLOW}  Skipping restore (--force). Backup remains at CLAUDE.md.backup${NC}"
        SKIPPED_ITEMS+=("CLAUDE.md.backup restore (--force)")
    elif [ "$DRY_RUN" = true ]; then
        echo -e "${YELLOW}  [dry-run] Would offer to restore CLAUDE.md from CLAUDE.md.backup${NC}"
    else
        read -p "  Restore CLAUDE.md from pre-install backup? [y/N]: " RESTORE_CONFIRM
        RESTORE_CONFIRM=${RESTORE_CONFIRM:-N}
        if [[ "$RESTORE_CONFIRM" =~ ^[Yy]$ ]]; then
            mv "$PROJECT_ROOT/CLAUDE.md.backup" "$PROJECT_ROOT/CLAUDE.md"
            echo -e "${GREEN}  ✓ Restored CLAUDE.md from backup${NC}"
        else
            echo -e "${YELLOW}  Backup left at CLAUDE.md.backup${NC}"
            SKIPPED_ITEMS+=("CLAUDE.md.backup restore (declined)")
        fi
    fi
    echo ""
fi

# ============================================================================
# Step 12: Docs cleanup - NEVER remove user content, only empty scaffolding
# ============================================================================
if [ -d "$PROJECT_ROOT/docs" ]; then
    if [ "$PURGE_DOCS" = true ]; then
        # DANGER MODE: Remove docs/ completely
        echo -e "${RED}Removing docs/ completely (--purge-docs)...${NC}"
        if [ "$DRY_RUN" = true ]; then
            echo -e "${YELLOW}  [dry-run] Would remove directory: docs/${NC}"
        else
            rm -rf "$PROJECT_ROOT/docs"
        fi
        REMOVED_DIRS+=("docs/")
        echo -e "${RED}  ✓ Removed docs/ (including user documents)${NC}"
    else
        # SAFE MODE: Never remove user content
        echo -e "${BLUE}Checking docs/ for user content...${NC}"

        # Count files in docs/ (excluding .DS_Store and other hidden files)
        DOC_FILE_COUNT=$(find "$PROJECT_ROOT/docs" -type f ! -name ".*" 2>/dev/null | wc -l | tr -d ' ')

        if [ "$DOC_FILE_COUNT" -gt 0 ]; then
            # User has created documents - NEVER touch them
            echo -e "${GREEN}  docs/ contains $DOC_FILE_COUNT user documents - PRESERVED${NC}"
            SKIPPED_ITEMS+=("docs/ ($DOC_FILE_COUNT user documents)")

            # List what's being preserved
            echo -e "${GREEN}  User documents preserved:${NC}"
            for SUBDIR in requirements architecture design testing; do
                if [ -d "$PROJECT_ROOT/docs/$SUBDIR" ]; then
                    SUBDIR_COUNT=$(find "$PROJECT_ROOT/docs/$SUBDIR" -type f ! -name ".*" 2>/dev/null | wc -l | tr -d ' ')
                    if [ "$SUBDIR_COUNT" -gt 0 ]; then
                        echo -e "${GREEN}    - docs/$SUBDIR/ ($SUBDIR_COUNT files)${NC}"
                    fi
                fi
            done

            # Check for other docs
            OTHER_DOCS=$(find "$PROJECT_ROOT/docs" -maxdepth 1 -type f ! -name ".*" 2>/dev/null | wc -l | tr -d ' ')
            if [ "$OTHER_DOCS" -gt 0 ]; then
                echo -e "${GREEN}    - docs/ root ($OTHER_DOCS files)${NC}"
            fi
        else
            # docs/ is empty scaffolding - safe to clean up
            echo -e "${YELLOW}  docs/ contains only empty scaffolding - cleaning up${NC}"

            # Remove empty standard subdirectories
            for SUBDIR in requirements architecture design testing; do
                do_rmdir_if_empty "$PROJECT_ROOT/docs/$SUBDIR"
            done

            # Remove docs/ itself if empty
            do_rmdir_if_empty "$PROJECT_ROOT/docs"
        fi
    fi
fi
echo ""

# ============================================================================
# Step 13: Clean empty .claude/ directory
# ============================================================================
if [ -d "$PROJECT_ROOT/.claude" ]; then
    # Check if anything remains besides settings.local.json
    REMAINING=$(ls -A "$PROJECT_ROOT/.claude" 2>/dev/null | grep -v '^settings\.local\.json$' | grep -v '^CLAUDE\.md\.backup$' || true)

    if [ -z "$REMAINING" ]; then
        if [ -f "$PROJECT_ROOT/.claude/settings.local.json" ]; then
            echo -e "${YELLOW}.claude/ contains only settings.local.json — preserving${NC}"
            SKIPPED_ITEMS+=(".claude/ (contains settings.local.json)")
        else
            do_rmdir_if_empty "$PROJECT_ROOT/.claude"
        fi
    else
        echo -e "${GREEN}.claude/ preserved — contains user files${NC}"
    fi
fi

# ============================================================================
# Summary
# ============================================================================
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
if [ "$DRY_RUN" = true ]; then
    echo -e "${GREEN}║            Dry Run Complete                                ║${NC}"
else
    echo -e "${GREEN}║            Uninstall Complete                              ║${NC}"
fi
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

if [ ${#REMOVED_FILES[@]} -gt 0 ]; then
    echo -e "${BLUE}Removed files:${NC} ${#REMOVED_FILES[@]}"
fi

if [ ${#REMOVED_DIRS[@]} -gt 0 ]; then
    echo -e "${BLUE}Removed directories:${NC}"
    for ITEM in "${REMOVED_DIRS[@]}"; do
        echo "  - $ITEM"
    done
    echo ""
fi

if [ ${#CLEANED_FILES[@]} -gt 0 ]; then
    echo -e "${BLUE}Cleaned files:${NC}"
    for ITEM in "${CLEANED_FILES[@]}"; do
        echo "  - $ITEM"
    done
    echo ""
fi

if [ ${#USER_FILES_PRESERVED[@]} -gt 0 ]; then
    echo -e "${GREEN}User files preserved:${NC} ${#USER_FILES_PRESERVED[@]}"
    for ITEM in "${USER_FILES_PRESERVED[@]}"; do
        echo "  - $ITEM"
    done
    echo ""
fi

if [ ${#SKIPPED_ITEMS[@]} -gt 0 ]; then
    echo -e "${BLUE}Skipped:${NC}"
    for ITEM in "${SKIPPED_ITEMS[@]}"; do
        echo "  - $ITEM"
    done
    echo ""
fi

if [ "$DRY_RUN" = true ]; then
    echo -e "${CYAN}No changes were made. Run without --dry-run to uninstall.${NC}"
fi
echo ""

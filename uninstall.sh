#!/bin/bash

# iSDLC Framework - Uninstall Script
#
# Removes the iSDLC framework from a project that was set up with install.sh.
#
# Usage:
#   ./uninstall.sh [options]
#
# Options:
#   --force       Skip all confirmation prompts
#   --backup      Archive framework files before removal
#   --keep-docs   Preserve docs/ directory entirely
#   --keep-state  Preserve .isdlc/ directory (state, constitution, checklists)
#   --dry-run     Show what would be removed without removing anything
#   --help        Show this help message
#
# What gets removed:
#   - .claude/agents/, .claude/skills/, .claude/commands/, .claude/hooks/
#   - Framework keys (hooks, permissions) from .claude/settings.json
#   - .isdlc/ directory (unless --keep-state)
#   - Framework-generated docs (unless --keep-docs)
#   - scripts/convert-manifest.sh (install fallback)
#
# What is preserved:
#   - .claude/settings.local.json (user customizations)
#   - CLAUDE.md (user-owned)
#   - Non-framework files in .claude/
#   - Non-empty docs/ content

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
KEEP_DOCS=false
KEEP_STATE=false
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
        --keep-docs)
            KEEP_DOCS=true
            shift
            ;;
        --keep-state)
            KEEP_STATE=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --help|-h)
            echo "iSDLC Framework - Uninstall Script"
            echo ""
            echo "Usage: ./uninstall.sh [options]"
            echo ""
            echo "Options:"
            echo "  --force       Skip all confirmation prompts"
            echo "  --backup      Archive framework files to isdlc-backup-{timestamp}.tar.gz"
            echo "  --keep-docs   Preserve docs/ directory entirely"
            echo "  --keep-state  Preserve .isdlc/ directory (state, constitution, checklists)"
            echo "  --dry-run     Show what would be removed without removing anything"
            echo "  --help        Show this help message"
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

# ============================================================================
# Helper: perform or simulate an action
# ============================================================================
do_rm_rf() {
    if [ "$DRY_RUN" = true ]; then
        echo -e "${YELLOW}  [dry-run] Would remove directory: $1${NC}"
    else
        rm -rf "$1"
    fi
    REMOVED_DIRS+=("$1")
}

do_rm_f() {
    if [ "$DRY_RUN" = true ]; then
        echo -e "${YELLOW}  [dry-run] Would remove file: $1${NC}"
    else
        rm -f "$1"
    fi
    REMOVED_FILES+=("$1")
}

do_rmdir() {
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
echo -e "${CYAN}║           iSDLC Framework - Uninstall                      ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Project Directory:${NC} $PROJECT_ROOT"
echo ""

HAS_ISDLC=false
HAS_CLAUDE_AGENTS=false
IS_MONOREPO=false

if [ -d "$PROJECT_ROOT/.isdlc" ]; then
    HAS_ISDLC=true
fi

if [ -d "$PROJECT_ROOT/.claude/agents" ]; then
    HAS_CLAUDE_AGENTS=true
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
# Step 2: Show what will be removed and confirm
# ============================================================================
echo ""
echo -e "${YELLOW}The following will be removed:${NC}"
echo ""

echo -e "${BLUE}  Framework directories:${NC}"
[ -d "$PROJECT_ROOT/.claude/agents" ]   && echo "    .claude/agents/"
[ -d "$PROJECT_ROOT/.claude/skills" ]   && echo "    .claude/skills/"
[ -d "$PROJECT_ROOT/.claude/commands" ] && echo "    .claude/commands/"
[ -d "$PROJECT_ROOT/.claude/hooks" ]    && echo "    .claude/hooks/"

if [ -f "$PROJECT_ROOT/.claude/settings.json" ]; then
    echo -e "${BLUE}  Settings cleanup:${NC}"
    echo "    .claude/settings.json (remove hooks and permissions keys)"
fi

if [ "$KEEP_STATE" = true ]; then
    echo -e "${BLUE}  .isdlc/:${NC} ${GREEN}KEPT${NC} (--keep-state)"
else
    [ -d "$PROJECT_ROOT/.isdlc" ] && echo -e "${BLUE}  State directory:${NC}" && echo "    .isdlc/ (entire directory)"
fi

if [ "$KEEP_DOCS" = true ]; then
    echo -e "${BLUE}  docs/:${NC} ${GREEN}KEPT${NC} (--keep-docs)"
else
    echo -e "${BLUE}  Docs cleanup:${NC}"
    if [ -f "$PROJECT_ROOT/docs/README.md" ]; then
        if grep -q "iSDLC" "$PROJECT_ROOT/docs/README.md" 2>/dev/null; then
            echo "    docs/README.md (framework-generated)"
        fi
    fi
    echo "    Empty docs subdirs (requirements/, architecture/, design/)"
fi

if [ -f "$PROJECT_ROOT/scripts/convert-manifest.sh" ]; then
    echo -e "${BLUE}  Fallback script:${NC}"
    echo "    scripts/convert-manifest.sh"
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
# Step 3: Backup (if --backup)
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
# Step 4: Monorepo cleanup (before .isdlc/ removal)
# ============================================================================
if [ "$IS_MONOREPO" = true ] && [ "$KEEP_DOCS" = false ]; then
    echo -e "${BLUE}Cleaning monorepo per-project doc directories...${NC}"

    if command -v jq &> /dev/null; then
        DOCS_LOCATION=$(jq -r '.docs_location // "root"' "$PROJECT_ROOT/.isdlc/monorepo.json" 2>/dev/null)
        PROJECT_IDS=$(jq -r '.projects | keys[]' "$PROJECT_ROOT/.isdlc/monorepo.json" 2>/dev/null)
        PROJECT_PATHS=$(jq -r '.projects | to_entries[] | .value.path' "$PROJECT_ROOT/.isdlc/monorepo.json" 2>/dev/null)

        if [ "$DOCS_LOCATION" = "project" ]; then
            # Docs live inside each project: {project-path}/docs/
            while IFS= read -r PROJ_PATH; do
                [ -z "$PROJ_PATH" ] && continue
                for SUBDIR in requirements architecture design; do
                    do_rmdir "$PROJECT_ROOT/$PROJ_PATH/docs/$SUBDIR"
                done
                do_rmdir "$PROJECT_ROOT/$PROJ_PATH/docs"
            done <<< "$PROJECT_PATHS"
        else
            # Docs live at root: docs/{project-id}/
            while IFS= read -r PROJ_ID; do
                [ -z "$PROJ_ID" ] && continue
                for SUBDIR in requirements architecture design; do
                    do_rmdir "$PROJECT_ROOT/docs/$PROJ_ID/$SUBDIR"
                done
                do_rmdir "$PROJECT_ROOT/docs/$PROJ_ID"
            done <<< "$PROJECT_IDS"
        fi

        echo -e "${GREEN}  ✓ Monorepo doc directories cleaned${NC}"
    else
        echo -e "${YELLOW}  Warning: jq not available. Monorepo doc directories may need manual cleanup.${NC}"
        echo -e "${YELLOW}  Check .isdlc/monorepo.json for project paths.${NC}"
        SKIPPED_ITEMS+=("monorepo doc dirs (jq unavailable)")
    fi
    echo ""
fi

# ============================================================================
# Step 5: Remove .claude/ framework directories
# ============================================================================
echo -e "${BLUE}Removing framework directories from .claude/...${NC}"

for DIR_NAME in agents skills commands hooks; do
    if [ -d "$PROJECT_ROOT/.claude/$DIR_NAME" ]; then
        do_rm_rf "$PROJECT_ROOT/.claude/$DIR_NAME"
        echo -e "${GREEN}  ✓ Removed .claude/$DIR_NAME/${NC}"
    fi
done

echo ""

# ============================================================================
# Step 6: Clean settings.json (strip hooks and permissions keys)
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
# Step 7: Remove .isdlc/ (unless --keep-state)
# ============================================================================
if [ "$KEEP_STATE" = true ]; then
    echo -e "${BLUE}.isdlc/ preserved${NC} (--keep-state)"
    SKIPPED_ITEMS+=(".isdlc/ (--keep-state)")
else
    if [ -d "$PROJECT_ROOT/.isdlc" ]; then
        echo -e "${BLUE}Removing .isdlc/...${NC}"
        do_rm_rf "$PROJECT_ROOT/.isdlc"
        echo -e "${GREEN}  ✓ Removed .isdlc/${NC}"
    fi
fi
echo ""

# ============================================================================
# Step 8: Remove fallback script
# ============================================================================
if [ -f "$PROJECT_ROOT/scripts/convert-manifest.sh" ]; then
    echo -e "${BLUE}Removing fallback script...${NC}"
    do_rm_f "$PROJECT_ROOT/scripts/convert-manifest.sh"
    echo -e "${GREEN}  ✓ Removed scripts/convert-manifest.sh${NC}"
    do_rmdir "$PROJECT_ROOT/scripts"
    echo ""
fi

# ============================================================================
# Step 9: Restore CLAUDE.md backup (offer to restore)
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
# Step 10: Docs cleanup (unless --keep-docs)
# ============================================================================
if [ "$KEEP_DOCS" = true ]; then
    echo -e "${BLUE}docs/ preserved${NC} (--keep-docs)"
    SKIPPED_ITEMS+=("docs/ (--keep-docs)")
else
    if [ -d "$PROJECT_ROOT/docs" ]; then
        echo -e "${BLUE}Cleaning docs/...${NC}"

        # Remove framework-generated README only if it still contains the marker
        if [ -f "$PROJECT_ROOT/docs/README.md" ]; then
            if grep -q "iSDLC" "$PROJECT_ROOT/docs/README.md" 2>/dev/null; then
                do_rm_f "$PROJECT_ROOT/docs/README.md"
                echo -e "${GREEN}  ✓ Removed docs/README.md (framework-generated)${NC}"
            else
                echo -e "${YELLOW}  Kept docs/README.md (user-modified)${NC}"
                SKIPPED_ITEMS+=("docs/README.md (user-modified)")
            fi
        fi

        # Remove empty standard subdirectories
        for SUBDIR in requirements architecture design; do
            do_rmdir "$PROJECT_ROOT/docs/$SUBDIR"
        done

        # Remove docs/ itself if empty
        do_rmdir "$PROJECT_ROOT/docs"
    fi
fi
echo ""

# ============================================================================
# Step 11: Clean empty .claude/ directory
# ============================================================================
if [ -d "$PROJECT_ROOT/.claude" ]; then
    # Check if anything remains besides settings.local.json
    REMAINING=$(ls -A "$PROJECT_ROOT/.claude" 2>/dev/null | grep -v '^settings\.local\.json$' | grep -v '^CLAUDE\.md\.backup$' || true)

    if [ -z "$REMAINING" ]; then
        if [ -f "$PROJECT_ROOT/.claude/settings.local.json" ]; then
            echo -e "${YELLOW}.claude/ contains only settings.local.json — preserving${NC}"
            SKIPPED_ITEMS+=(".claude/ (contains settings.local.json)")
        else
            do_rmdir "$PROJECT_ROOT/.claude"
        fi
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

if [ ${#REMOVED_DIRS[@]} -gt 0 ]; then
    echo -e "${BLUE}Removed directories:${NC}"
    for ITEM in "${REMOVED_DIRS[@]}"; do
        # Show relative path
        REL_PATH="${ITEM#"$PROJECT_ROOT"/}"
        echo "  - $REL_PATH"
    done
    echo ""
fi

if [ ${#REMOVED_FILES[@]} -gt 0 ]; then
    echo -e "${BLUE}Removed files:${NC}"
    for ITEM in "${REMOVED_FILES[@]}"; do
        REL_PATH="${ITEM#"$PROJECT_ROOT"/}"
        echo "  - $REL_PATH"
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

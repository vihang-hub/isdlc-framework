#!/bin/bash

# iSDLC Migration Script: .isdlc/ -> docs/isdlc/
#
# This script migrates user-generated documents from .isdlc/ to docs/isdlc/
# for installations created before v3.1.0.
#
# Usage:
#   ./scripts/migrate-docs.sh [options]
#
# Options:
#   --dry-run     Show what would be moved without making changes
#   --force       Skip confirmation prompts
#   --help        Show this help message

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

DRY_RUN=false
FORCE=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --help|-h)
            echo "iSDLC Migration Script: .isdlc/ -> docs/isdlc/"
            echo ""
            echo "Usage: ./scripts/migrate-docs.sh [options]"
            echo ""
            echo "Options:"
            echo "  --dry-run     Show what would be moved without making changes"
            echo "  --force       Skip confirmation prompts"
            echo "  --help        Show this help message"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

PROJECT_ROOT="$(pwd)"

echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     iSDLC Migration: .isdlc/ -> docs/isdlc/                ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Project Directory:${NC} $PROJECT_ROOT"
echo ""

# Check if migration is needed
if [ ! -d "$PROJECT_ROOT/.isdlc" ]; then
    echo -e "${RED}No .isdlc/ folder found. Nothing to migrate.${NC}"
    exit 1
fi

# Check for legacy documents
LEGACY_FILES=()
[ -f "$PROJECT_ROOT/.isdlc/constitution.md" ] && LEGACY_FILES+=(".isdlc/constitution.md")
[ -f "$PROJECT_ROOT/.isdlc/constitution.draft.md" ] && LEGACY_FILES+=(".isdlc/constitution.draft.md")
[ -f "$PROJECT_ROOT/.isdlc/test-evaluation-report.md" ] && LEGACY_FILES+=(".isdlc/test-evaluation-report.md")
[ -f "$PROJECT_ROOT/.isdlc/tasks.md" ] && LEGACY_FILES+=(".isdlc/tasks.md")
[ -f "$PROJECT_ROOT/.isdlc/skill-customization-report.md" ] && LEGACY_FILES+=(".isdlc/skill-customization-report.md")
[ -f "$PROJECT_ROOT/.isdlc/atdd-checklist.json" ] && LEGACY_FILES+=(".isdlc/atdd-checklist.json")
[ -f "$PROJECT_ROOT/.isdlc/external-skills-manifest.json" ] && LEGACY_FILES+=(".isdlc/external-skills-manifest.json")
[ -f "$PROJECT_ROOT/.isdlc/reverse-engineer-report.md" ] && LEGACY_FILES+=(".isdlc/reverse-engineer-report.md")
[ -f "$PROJECT_ROOT/.isdlc/ac-traceability.csv" ] && LEGACY_FILES+=(".isdlc/ac-traceability.csv")
[ -f "$PROJECT_ROOT/.isdlc/atdd-migration-guide.md" ] && LEGACY_FILES+=(".isdlc/atdd-migration-guide.md")

# Check for domain-specific ATDD checklists
for f in "$PROJECT_ROOT"/.isdlc/atdd-checklist-*.json; do
    [ -f "$f" ] && LEGACY_FILES+=("${f#$PROJECT_ROOT/}")
done

# Check for checklists directory
if [ -d "$PROJECT_ROOT/.isdlc/checklists" ] && [ "$(ls -A "$PROJECT_ROOT/.isdlc/checklists" 2>/dev/null)" ]; then
    LEGACY_FILES+=(".isdlc/checklists/ (directory)")
fi

if [ ${#LEGACY_FILES[@]} -eq 0 ]; then
    echo -e "${GREEN}No legacy documents found in .isdlc/${NC}"
    echo -e "${GREEN}Migration not needed - your installation is already up to date.${NC}"
    exit 0
fi

echo -e "${YELLOW}Found ${#LEGACY_FILES[@]} legacy documents to migrate:${NC}"
for FILE in "${LEGACY_FILES[@]}"; do
    echo "  - $FILE"
done
echo ""

if [ "$DRY_RUN" = true ]; then
    echo -e "${CYAN}(--dry-run mode: no changes will be made)${NC}"
    echo ""
fi

if [ "$FORCE" = false ] && [ "$DRY_RUN" = false ]; then
    read -p "Proceed with migration? [y/N]: " CONFIRM
    CONFIRM=${CONFIRM:-N}
    if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
        echo -e "${RED}Migration cancelled.${NC}"
        exit 0
    fi
    echo ""
fi

# Create new directory structure
echo -e "${BLUE}Creating docs/isdlc/ directory structure...${NC}"
if [ "$DRY_RUN" = false ]; then
    mkdir -p "$PROJECT_ROOT/docs/isdlc/checklists"
fi
echo -e "${GREEN}  ✓ Created docs/isdlc/${NC}"

# Migrate files
echo ""
echo -e "${BLUE}Migrating documents...${NC}"

migrate_file() {
    local src="$1"
    local dest="$2"

    if [ -f "$PROJECT_ROOT/$src" ]; then
        if [ "$DRY_RUN" = true ]; then
            echo -e "${YELLOW}  [dry-run] Would move: $src -> $dest${NC}"
        else
            # Ensure destination directory exists
            mkdir -p "$(dirname "$PROJECT_ROOT/$dest")"
            mv "$PROJECT_ROOT/$src" "$PROJECT_ROOT/$dest"
            echo -e "${GREEN}  ✓ Moved: $src -> $dest${NC}"
        fi
    fi
}

migrate_dir() {
    local src="$1"
    local dest="$2"

    if [ -d "$PROJECT_ROOT/$src" ]; then
        if [ "$DRY_RUN" = true ]; then
            echo -e "${YELLOW}  [dry-run] Would move directory: $src -> $dest${NC}"
        else
            mkdir -p "$PROJECT_ROOT/$dest"
            if [ "$(ls -A "$PROJECT_ROOT/$src" 2>/dev/null)" ]; then
                mv "$PROJECT_ROOT/$src"/* "$PROJECT_ROOT/$dest/"
            fi
            rmdir "$PROJECT_ROOT/$src" 2>/dev/null || true
            echo -e "${GREEN}  ✓ Moved directory: $src -> $dest${NC}"
        fi
    fi
}

# Migrate individual files
migrate_file ".isdlc/constitution.md" "docs/isdlc/constitution.md"
migrate_file ".isdlc/constitution.draft.md" "docs/isdlc/constitution.draft.md"
migrate_file ".isdlc/test-evaluation-report.md" "docs/isdlc/test-evaluation-report.md"
migrate_file ".isdlc/tasks.md" "docs/isdlc/tasks.md"
migrate_file ".isdlc/skill-customization-report.md" "docs/isdlc/skill-customization-report.md"
migrate_file ".isdlc/atdd-checklist.json" "docs/isdlc/atdd-checklist.json"
migrate_file ".isdlc/external-skills-manifest.json" "docs/isdlc/external-skills-manifest.json"
migrate_file ".isdlc/reverse-engineer-report.md" "docs/isdlc/reverse-engineer-report.md"
migrate_file ".isdlc/ac-traceability.csv" "docs/isdlc/ac-traceability.csv"
migrate_file ".isdlc/atdd-migration-guide.md" "docs/isdlc/atdd-migration-guide.md"

# Migrate domain-specific ATDD checklists
for f in "$PROJECT_ROOT"/.isdlc/atdd-checklist-*.json; do
    if [ -f "$f" ]; then
        filename=$(basename "$f")
        migrate_file ".isdlc/$filename" "docs/isdlc/$filename"
    fi
done

# Migrate checklists directory
migrate_dir ".isdlc/checklists" "docs/isdlc/checklists"

# Handle monorepo project directories
if [ -d "$PROJECT_ROOT/.isdlc/projects" ]; then
    echo ""
    echo -e "${BLUE}Migrating monorepo project documents...${NC}"

    for project_dir in "$PROJECT_ROOT"/.isdlc/projects/*/; do
        [ -d "$project_dir" ] || continue
        project_id=$(basename "$project_dir")

        # Create project docs directory
        if [ "$DRY_RUN" = false ]; then
            mkdir -p "$PROJECT_ROOT/docs/isdlc/projects/$project_id"
        fi

        # Migrate project-specific documents (NOT state.json or skills/)
        migrate_file ".isdlc/projects/$project_id/constitution.md" "docs/isdlc/projects/$project_id/constitution.md"
        migrate_file ".isdlc/projects/$project_id/skill-customization-report.md" "docs/isdlc/projects/$project_id/skill-customization-report.md"
        migrate_file ".isdlc/projects/$project_id/external-skills-manifest.json" "docs/isdlc/projects/$project_id/external-skills-manifest.json"
        migrate_file ".isdlc/projects/$project_id/test-evaluation-report.md" "docs/isdlc/projects/$project_id/test-evaluation-report.md"
        migrate_file ".isdlc/projects/$project_id/tasks.md" "docs/isdlc/projects/$project_id/tasks.md"
    done
fi

# Update state.json constitution path
echo ""
echo -e "${BLUE}Updating state.json constitution path...${NC}"
if [ -f "$PROJECT_ROOT/.isdlc/state.json" ] && command -v jq &> /dev/null; then
    if [ "$DRY_RUN" = true ]; then
        echo -e "${YELLOW}  [dry-run] Would update constitution.path in state.json${NC}"
    else
        # Check if constitution path is still the old location
        CURRENT_PATH=$(jq -r '.constitution.path // empty' "$PROJECT_ROOT/.isdlc/state.json" 2>/dev/null)
        if [ "$CURRENT_PATH" = ".isdlc/constitution.md" ]; then
            jq '.constitution.path = "docs/isdlc/constitution.md"' "$PROJECT_ROOT/.isdlc/state.json" > "$PROJECT_ROOT/.isdlc/state.json.tmp"
            mv "$PROJECT_ROOT/.isdlc/state.json.tmp" "$PROJECT_ROOT/.isdlc/state.json"
            echo -e "${GREEN}  ✓ Updated constitution.path in state.json${NC}"
        else
            echo -e "${YELLOW}  constitution.path already updated or not found${NC}"
        fi
    fi
else
    echo -e "${YELLOW}  Warning: jq not available or state.json not found${NC}"
fi

# Summary
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
if [ "$DRY_RUN" = true ]; then
    echo -e "${GREEN}║            Dry Run Complete                                ║${NC}"
else
    echo -e "${GREEN}║            Migration Complete                              ║${NC}"
fi
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

if [ "$DRY_RUN" = false ]; then
    echo -e "${GREEN}User documents have been moved to docs/isdlc/${NC}"
    echo -e "${GREEN}Runtime state remains in .isdlc/${NC}"
    echo ""
    echo -e "${CYAN}New structure:${NC}"
    echo "  docs/isdlc/           - User-generated documents"
    echo "  .isdlc/state.json     - Runtime state"
    echo "  .isdlc/config/        - Framework configuration"
else
    echo -e "${CYAN}No changes were made. Run without --dry-run to migrate.${NC}"
fi
echo ""

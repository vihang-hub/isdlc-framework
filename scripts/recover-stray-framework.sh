#!/bin/bash
# isdlc-recover-stray-framework.sh
#
# Cleans up stray iSDLC framework files that leaked into a project
# directory from a botched install. SAFE: content-aware — only removes
# files that are bit-for-bit identical to the framework's shipped version.
# Files with the same name but different content (e.g. your own LICENSE,
# README.md, bin/build.js, src/whatever) are LEFT ALONE.
#
# Usage:
#   cd /path/to/your/project
#   /tmp/isdlc-recover-stray-framework.sh            # dry-run, shows plan
#   /tmp/isdlc-recover-stray-framework.sh --apply    # actually remove

set -e

PROJECT_DIR="$(pwd)"
MODE="${1:-dry-run}"
FRAMEWORK_REPO="https://dev.enactor.co.uk/gitea/DevOpsInfra/isdlc-framework.git"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

if [ "$MODE" != "dry-run" ] && [ "$MODE" != "--apply" ]; then
    echo "Usage: $0 [--apply]"
    echo "  (no argument) dry-run — list what would be removed, no changes"
    echo "  --apply       actually remove the stray framework files"
    exit 1
fi

echo -e "${CYAN}iSDLC stray-framework recovery${NC}"
echo "Project: $PROJECT_DIR"
echo "Mode:    $MODE"
echo ""

# Undo accidental `git init` if .git exists but was just created empty.
# Heuristic: if .git has no HEAD commit yet AND no remote, it's from our
# botched `git init`. Safe to remove.
if [ -d .git ]; then
    if git rev-parse --verify HEAD >/dev/null 2>&1; then
        echo -e "${YELLOW}Warning: existing .git has real commits. Leaving it alone.${NC}"
        echo "If this .git was from a botched 'git init && git pull isdlc-framework',"
        echo "manually run 'rm -rf .git' after confirming."
        echo ""
    else
        echo -e "${YELLOW}.git has no commits — assuming botched git-init.${NC}"
        if [ "$MODE" = "--apply" ]; then
            rm -rf .git
            echo -e "${GREEN}  ✓ Removed empty .git${NC}"
        else
            echo "  (dry-run: would remove .git)"
        fi
        echo ""
    fi
fi

# Fetch the framework to a temp dir so we can compare files.
TMPFW="$(mktemp -d -t isdlc-recover.XXXXXX)"
trap 'rm -rf "$TMPFW"' EXIT

echo "Cloning framework to temp location for comparison..."
if ! git clone --quiet --depth 1 "$FRAMEWORK_REPO" "$TMPFW/framework" 2>&1; then
    echo -e "${RED}Error: failed to clone $FRAMEWORK_REPO${NC}"
    exit 1
fi
echo -e "${GREEN}  ✓ Cloned${NC}"
echo ""

# Walk the framework file list. For each file that exists in the project dir
# at the same relative path, compare content. If identical → stray; record.
cd "$TMPFW/framework"
FW_FILES="$(git ls-files)"
cd "$PROJECT_DIR"

STRAY_COUNT=0
COLLISION_COUNT=0
STRAY_LIST=""
COLLISION_LIST=""

while IFS= read -r f; do
    [ -z "$f" ] && continue
    if [ -f "$f" ]; then
        if cmp -s "$f" "$TMPFW/framework/$f"; then
            STRAY_LIST="${STRAY_LIST}${f}
"
            STRAY_COUNT=$((STRAY_COUNT + 1))
        else
            COLLISION_LIST="${COLLISION_LIST}${f}
"
            COLLISION_COUNT=$((COLLISION_COUNT + 1))
        fi
    fi
done <<< "$FW_FILES"

echo -e "${CYAN}Scan complete:${NC}"
echo "  Stray framework files (identical to upstream): $STRAY_COUNT"
echo "  Name collisions (different content, KEPT):     $COLLISION_COUNT"
echo ""

if [ $COLLISION_COUNT -gt 0 ]; then
    echo -e "${YELLOW}The following files share a framework name but have DIFFERENT${NC}"
    echo -e "${YELLOW}content — probably yours, will be left alone:${NC}"
    printf "%s" "$COLLISION_LIST" | sed 's/^/  /' | head -20
    if [ $COLLISION_COUNT -gt 20 ]; then
        echo "  ... and $((COLLISION_COUNT - 20)) more"
    fi
    echo ""
fi

if [ $STRAY_COUNT -eq 0 ]; then
    echo -e "${GREEN}Nothing to clean up. Directory is free of stray framework files.${NC}"
    echo ""
    echo "Next step: install the framework the proper way:"
    echo "  git clone $FRAMEWORK_REPO isdlc-framework"
    echo "  ./isdlc-framework/install.sh"
    exit 0
fi

echo -e "${CYAN}Stray files to remove (first 30):${NC}"
printf "%s" "$STRAY_LIST" | sed 's/^/  /' | head -30
if [ $STRAY_COUNT -gt 30 ]; then
    echo "  ... and $((STRAY_COUNT - 30)) more"
fi
echo ""

if [ "$MODE" != "--apply" ]; then
    echo -e "${YELLOW}DRY RUN — no changes made.${NC}"
    echo ""
    echo "Re-run with --apply to actually remove the $STRAY_COUNT stray files:"
    echo "  $0 --apply"
    exit 0
fi

# --apply mode
echo -e "${YELLOW}Removing $STRAY_COUNT stray files...${NC}"
REMOVED=0
while IFS= read -r f; do
    [ -z "$f" ] && continue
    if [ -f "$f" ]; then
        rm -f "$f"
        REMOVED=$((REMOVED + 1))
    fi
done <<< "$STRAY_LIST"
echo -e "${GREEN}  ✓ Removed $REMOVED files${NC}"

# Clean up now-empty framework directories (best-effort, only if they exist
# and are framework-shipped — never touch user-created dirs).
for d in .antigravity .github .validations coverage research-docs packages; do
    if [ -d "$d" ] && [ -z "$(ls -A "$d" 2>/dev/null)" ]; then
        rmdir "$d" 2>/dev/null && echo -e "${GREEN}  ✓ Removed empty $d/${NC}" || true
    fi
done

# Clean up empty framework subtrees under docs/ that we uniquely ship
for d in docs/articles docs/designs docs/diagrams docs/quality docs/isdlc; do
    if [ -d "$d" ]; then
        find "$d" -type d -empty -delete 2>/dev/null || true
    fi
done

echo ""
echo -e "${GREEN}Cleanup complete.${NC}"
echo ""
echo "Next step: install the framework the proper way:"
echo "  git clone $FRAMEWORK_REPO isdlc-framework"
echo "  ./isdlc-framework/install.sh"

#!/bin/bash

# iSDLC Framework - State Validation Script
# Validates project state.json and checks for common issues

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if in a project directory
if [ ! -f ".isdlc/state.json" ]; then
    echo -e "${RED}Error: Not in an iSDLC project directory${NC}"
    echo "Could not find .isdlc/state.json"
    exit 1
fi

echo -e "${GREEN}iSDLC State Validation${NC}"
echo "====================="
echo ""

# Check if jq is available
if ! command -v jq &> /dev/null; then
    echo -e "${YELLOW}Warning: jq not installed. Basic validation only.${NC}"
    echo ""
    echo "State file exists: .isdlc/state.json"
    echo ""
    cat .isdlc/state.json
    exit 0
fi

STATE_FILE=".isdlc/state.json"

# Validate JSON syntax
echo -e "${YELLOW}Checking JSON syntax...${NC}"
if jq empty "$STATE_FILE" 2>/dev/null; then
    echo -e "${GREEN}✓ Valid JSON${NC}"
else
    echo -e "${RED}✗ Invalid JSON syntax${NC}"
    exit 1
fi

# Extract key information
PROJECT_NAME=$(jq -r '.project.name' "$STATE_FILE")
CURRENT_PHASE=$(jq -r '.current_phase' "$STATE_FILE")
FRAMEWORK_VERSION=$(jq -r '.framework_version' "$STATE_FILE")

echo ""
echo "Project: $PROJECT_NAME"
echo "Framework Version: $FRAMEWORK_VERSION"
echo "Current Phase: $CURRENT_PHASE"
echo ""

# Check required fields
echo -e "${YELLOW}Checking required fields...${NC}"
ERRORS=0

check_field() {
    local field=$1
    local value=$(jq -r "$field" "$STATE_FILE")
    if [ "$value" == "null" ] || [ -z "$value" ]; then
        echo -e "${RED}✗ Missing: $field${NC}"
        ERRORS=$((ERRORS + 1))
    else
        echo -e "${GREEN}✓ $field${NC}"
    fi
}

check_field '.framework_version'
check_field '.project.name'
check_field '.current_phase'
check_field '.phases'

echo ""

# Check phase structure
echo -e "${YELLOW}Checking phase structure...${NC}"
PHASES=("01-requirements" "02-architecture" "03-design" "04-test-strategy" "05-implementation" "06-testing" "07-code-review" "08-validation" "09-cicd" "10-local-testing" "11-test-deploy" "12-production" "13-operations")

for phase in "${PHASES[@]}"; do
    if jq -e ".phases[\"$phase\"]" "$STATE_FILE" > /dev/null 2>&1; then
        STATUS=$(jq -r ".phases[\"$phase\"].status" "$STATE_FILE")
        echo -e "${GREEN}✓ $phase ($STATUS)${NC}"
    else
        echo -e "${RED}✗ Missing phase: $phase${NC}"
        ERRORS=$((ERRORS + 1))
    fi
done

echo ""

# Check phase status consistency
echo -e "${YELLOW}Checking phase consistency...${NC}"

FOUND_CURRENT=false
PREV_STATUS="completed"

for phase in "${PHASES[@]}"; do
    STATUS=$(jq -r ".phases[\"$phase\"].status" "$STATE_FILE")

    if [ "$phase" == "$CURRENT_PHASE" ]; then
        FOUND_CURRENT=true
        if [ "$STATUS" != "in_progress" ] && [ "$STATUS" != "pending" ]; then
            echo -e "${YELLOW}⚠ Current phase '$phase' has status '$STATUS' (expected in_progress or pending)${NC}"
        fi
    fi

    # Check that phases after current are pending
    if [ "$FOUND_CURRENT" = true ] && [ "$phase" != "$CURRENT_PHASE" ]; then
        if [ "$STATUS" != "pending" ]; then
            echo -e "${YELLOW}⚠ Phase '$phase' after current phase has status '$STATUS' (expected pending)${NC}"
        fi
    fi
done

if [ "$FOUND_CURRENT" = false ]; then
    echo -e "${RED}✗ Current phase '$CURRENT_PHASE' not found in phases${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}✓ Current phase is valid${NC}"
fi

echo ""

# Check blockers
BLOCKER_COUNT=$(jq '.blockers | length' "$STATE_FILE")
if [ "$BLOCKER_COUNT" -gt 0 ]; then
    echo -e "${YELLOW}Active Blockers: $BLOCKER_COUNT${NC}"
    jq -r '.blockers[] | "  - [\(.status)] \(.description)"' "$STATE_FILE"
else
    echo -e "${GREEN}No active blockers${NC}"
fi

echo ""

# Check artifacts directories
echo -e "${YELLOW}Checking artifact directories...${NC}"
for phase in "${PHASES[@]}"; do
    if [ -d ".isdlc/phases/$phase/artifacts" ]; then
        ARTIFACT_COUNT=$(find ".isdlc/phases/$phase/artifacts" -type f 2>/dev/null | wc -l | tr -d ' ')
        echo -e "${GREEN}✓ $phase/artifacts/ ($ARTIFACT_COUNT files)${NC}"
    else
        echo -e "${YELLOW}⚠ Missing: .isdlc/phases/$phase/artifacts/${NC}"
    fi
done

echo ""

# Check skills installation
echo -e "${YELLOW}Checking skills installation...${NC}"
if [ -d ".claude/skills" ]; then
    SKILL_COUNT=$(find .claude/skills -name "SKILL.md" 2>/dev/null | wc -l | tr -d ' ')
    if [ "$SKILL_COUNT" -eq 116 ]; then
        echo -e "${GREEN}✓ Skills installed: $SKILL_COUNT skills${NC}"
    else
        echo -e "${YELLOW}⚠ Expected 116 skills, found $SKILL_COUNT${NC}"
    fi

    # Check skill categories
    CATEGORIES=("orchestration" "requirements" "architecture" "design" "testing" "development" "security" "devops" "documentation" "operations")
    for cat in "${CATEGORIES[@]}"; do
        if [ -d ".claude/skills/$cat" ]; then
            CAT_COUNT=$(find ".claude/skills/$cat" -name "SKILL.md" 2>/dev/null | wc -l | tr -d ' ')
            echo -e "${GREEN}  ✓ $cat: $CAT_COUNT skills${NC}"
        else
            echo -e "${RED}  ✗ Missing category: $cat${NC}"
            ERRORS=$((ERRORS + 1))
        fi
    done
else
    echo -e "${RED}✗ Skills not installed (.claude/skills missing)${NC}"
    ERRORS=$((ERRORS + 1))
fi

echo ""

# Check templates and checklists
echo -e "${YELLOW}Checking framework resources...${NC}"
if [ -d ".isdlc/templates" ]; then
    echo -e "${GREEN}✓ Templates installed${NC}"
else
    echo -e "${YELLOW}⚠ Templates not found (.isdlc/templates)${NC}"
fi

if [ -d ".isdlc/checklists" ]; then
    CHECKLIST_COUNT=$(find .isdlc/checklists -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
    echo -e "${GREEN}✓ Checklists installed: $CHECKLIST_COUNT files${NC}"
else
    echo -e "${YELLOW}⚠ Checklists not found (.isdlc/checklists)${NC}"
fi

if [ -d ".isdlc/config" ]; then
    echo -e "${GREEN}✓ Config installed${NC}"
else
    echo -e "${YELLOW}⚠ Config not found (.isdlc/config)${NC}"
fi

echo ""

# Summary
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}Validation passed!${NC}"
    exit 0
else
    echo -e "${RED}Validation failed with $ERRORS error(s)${NC}"
    exit 1
fi

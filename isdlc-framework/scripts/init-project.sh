#!/bin/bash

# iSDLC Framework - Project Initialization Script
# For use within a monorepo initialized with init-monorepo.sh
# Usage: ./init-project.sh <project-path> [project-name]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check arguments
if [ -z "$1" ]; then
    echo -e "${RED}Error: Project path required${NC}"
    echo "Usage: $0 <project-path> [project-name]"
    exit 1
fi

PROJECT_PATH="$1"
PROJECT_NAME="${2:-$(basename "$PROJECT_PATH")}"

echo -e "${GREEN}iSDLC Framework - Project Initialization${NC}"
echo "=========================================="
echo "Project:   $PROJECT_PATH"
echo "Name:      $PROJECT_NAME"
echo ""

# Track Selection
echo -e "${YELLOW}Select Workflow Track:${NC}"
echo "1) Quick Flow      - Bug fixes, trivial changes (30min - 2hrs)"
echo "2) Standard Flow   - Features, services (4hrs - 3 days)"
echo "3) Enterprise Flow - Platforms, compliance (weeks - months)"
echo "4) Let orchestrator assess complexity"
echo ""
read -p "Select track [1-4]: " TRACK_CHOICE

case $TRACK_CHOICE in
    1)
        TRACK="quick"
        TRACK_NAME="Quick Flow"
        COMPLEXITY_LEVEL=1
        PHASES_REQUIRED="[1, 5, 6]"
        PHASES_OPTIONAL="[4, 7]"
        PHASES_SKIPPED="[2, 3, 8, 9, 10, 11, 12, 13]"
        ;;
    2)
        TRACK="standard"
        TRACK_NAME="Standard Flow"
        COMPLEXITY_LEVEL=2
        PHASES_REQUIRED="[1, 2, 3, 4, 5, 6, 7, 9]"
        PHASES_OPTIONAL="[8, 10]"
        PHASES_SKIPPED="[11, 12, 13]"
        ;;
    3)
        TRACK="enterprise"
        TRACK_NAME="Enterprise Flow"
        COMPLEXITY_LEVEL=4
        PHASES_REQUIRED="[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]"
        PHASES_OPTIONAL="[]"
        PHASES_SKIPPED="[]"
        ;;
    4)
        TRACK="auto"
        TRACK_NAME="Auto-assess"
        COMPLEXITY_LEVEL=null
        PHASES_REQUIRED="null"
        PHASES_OPTIONAL="null"
        PHASES_SKIPPED="null"
        echo -e "${YELLOW}Orchestrator will assess complexity at project start${NC}"
        ;;
    *)
        echo -e "${YELLOW}Invalid choice. Defaulting to Standard Flow${NC}"
        TRACK="standard"
        TRACK_NAME="Standard Flow"
        COMPLEXITY_LEVEL=2
        PHASES_REQUIRED="[1, 2, 3, 4, 5, 6, 7, 9]"
        PHASES_OPTIONAL="[8, 10]"
        PHASES_SKIPPED="[11, 12, 13]"
        ;;
esac

echo -e "${GREEN}Selected: $TRACK_NAME${NC}"
echo ""

# Create project directory if it doesn't exist
if [ ! -d "$PROJECT_PATH" ]; then
    echo -e "${YELLOW}Creating project directory...${NC}"
    mkdir -p "$PROJECT_PATH"
fi

cd "$PROJECT_PATH"

# Find monorepo root (look for .claude/skills or isdlc-framework)
find_monorepo_root() {
    local current="$PWD"
    while [ "$current" != "/" ]; do
        if [ -d "$current/.claude/skills" ] || [ -d "$current/isdlc-framework" ]; then
            echo "$current"
            return 0
        fi
        current="$(dirname "$current")"
    done
    return 1
}

MONOREPO_ROOT=$(find_monorepo_root)

if [ -z "$MONOREPO_ROOT" ]; then
    echo -e "${YELLOW}Warning: Monorepo root not found. Creating standalone project.${NC}"
    echo "For monorepo setup, run init-monorepo.sh first."
    STANDALONE=true
else
    echo -e "${GREEN}Found monorepo root: $MONOREPO_ROOT${NC}"
    STANDALONE=false
fi

# Create .isdlc directory structure
echo -e "${YELLOW}Creating .isdlc directory structure...${NC}"
mkdir -p .isdlc/phases/{01-requirements,02-architecture,03-design,04-test-strategy,05-implementation,06-testing,07-code-review,08-validation,09-cicd,10-local-testing,11-test-deploy,12-production,13-operations}/artifacts

# Create initial state.json
echo -e "${YELLOW}Creating initial state.json...${NC}"
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
cat > .isdlc/state.json << EOF
{
  "framework_version": "1.0.0",
  "project": {
    "name": "$PROJECT_NAME",
    "created": "$TIMESTAMP",
    "description": ""
  },
  "complexity_assessment": {
    "level": $COMPLEXITY_LEVEL,
    "track": "$TRACK",
    "assessed_at": "$TIMESTAMP",
    "assessed_by": "manual",
    "dimensions": {
      "architectural": null,
      "security": null,
      "testing": null,
      "deployment": null,
      "team": null,
      "timeline": null
    }
  },
  "workflow": {
    "track": "$TRACK",
    "track_name": "$TRACK_NAME",
    "phases_required": $PHASES_REQUIRED,
    "phases_optional": $PHASES_OPTIONAL,
    "phases_skipped": $PHASES_SKIPPED
  },
  "current_phase": "01-requirements",
  "phases": {
    "01-requirements": {
      "status": "pending",
      "started": null,
      "completed": null,
      "gate_passed": null,
      "artifacts": [],
      "notes": null
    },
    "02-architecture": {
      "status": "pending",
      "started": null,
      "completed": null,
      "gate_passed": null,
      "artifacts": [],
      "notes": null
    },
    "03-design": {
      "status": "pending",
      "started": null,
      "completed": null,
      "gate_passed": null,
      "artifacts": [],
      "notes": null
    },
    "04-test-strategy": {
      "status": "pending",
      "started": null,
      "completed": null,
      "gate_passed": null,
      "artifacts": [],
      "notes": null
    },
    "05-implementation": {
      "status": "pending",
      "started": null,
      "completed": null,
      "gate_passed": null,
      "artifacts": [],
      "notes": null
    },
    "06-testing": {
      "status": "pending",
      "started": null,
      "completed": null,
      "gate_passed": null,
      "artifacts": [],
      "notes": null
    },
    "07-code-review": {
      "status": "pending",
      "started": null,
      "completed": null,
      "gate_passed": null,
      "artifacts": [],
      "notes": null
    },
    "08-validation": {
      "status": "pending",
      "started": null,
      "completed": null,
      "gate_passed": null,
      "artifacts": [],
      "notes": null
    },
    "09-cicd": {
      "status": "pending",
      "started": null,
      "completed": null,
      "gate_passed": null,
      "artifacts": [],
      "notes": null
    },
    "10-local-testing": {
      "status": "pending",
      "started": null,
      "completed": null,
      "gate_passed": null,
      "artifacts": [],
      "notes": null
    },
    "11-test-deploy": {
      "status": "pending",
      "started": null,
      "completed": null,
      "gate_passed": null,
      "artifacts": [],
      "notes": null
    },
    "12-production": {
      "status": "pending",
      "started": null,
      "completed": null,
      "gate_passed": null,
      "artifacts": [],
      "notes": null
    },
    "13-operations": {
      "status": "pending",
      "started": null,
      "completed": null,
      "gate_passed": null,
      "artifacts": [],
      "notes": null
    }
  },
  "blockers": [],
  "active_agent": null,
  "history": [
    {
      "timestamp": "$TIMESTAMP",
      "agent": "init-script",
      "action": "Project initialized"
    }
  ]
}
EOF

# Copy project constitution
echo -e "${YELLOW}Copying project constitution...${NC}"
if [ "$STANDALONE" = true ]; then
    echo -e "${YELLOW}Warning: Constitution template not found. Manual installation required.${NC}"
else
    CONSTITUTION_TEMPLATE="$MONOREPO_ROOT/isdlc-framework/templates/constitution.md"
    if [ -f "$CONSTITUTION_TEMPLATE" ]; then
        cp "$CONSTITUTION_TEMPLATE" .isdlc/constitution.md
        echo -e "${GREEN}Constitution copied from framework template${NC}"
    else
        echo -e "${YELLOW}Warning: Constitution template not found at $CONSTITUTION_TEMPLATE${NC}"
    fi
fi

# Create project config
echo -e "${YELLOW}Creating project config...${NC}"
if [ "$STANDALONE" = true ]; then
    CONFIG_REF="# Standalone project - copy config from framework"
else
    CONFIG_REF="# Inherits from: $MONOREPO_ROOT/isdlc-framework/config/"
fi

cat > .isdlc/config.yaml << EOF
# Project-specific iSDLC configuration
$CONFIG_REF

project:
  name: "$PROJECT_NAME"
  # tech_stack:
  #   frontend: "React"
  #   backend: "Node.js"
  #   database: "PostgreSQL"

# Override framework defaults as needed:
# testing:
#   unit:
#     coverage_target: 90
EOF

# Create project CLAUDE.md
echo -e "${YELLOW}Creating CLAUDE.md...${NC}"
mkdir -p .claude

if [ "$STANDALONE" = true ]; then
    SKILLS_NOTE="Skills: Install from iSDLC framework"
    RESOURCES_NOTE="Resources: Install from iSDLC framework"
else
    REL_PATH=$(python3 -c "import os.path; print(os.path.relpath('$MONOREPO_ROOT', '$PWD'))" 2>/dev/null || echo "$MONOREPO_ROOT")
    SKILLS_NOTE="Skills: $REL_PATH/.claude/skills/ (116 skills)"
    RESOURCES_NOTE="Resources: $REL_PATH/isdlc-framework/"
fi

cat > .claude/CLAUDE.md << EOF
# Project: $PROJECT_NAME

This project uses the iSDLC Framework.

## Framework Resources

- $SKILLS_NOTE
- $RESOURCES_NOTE
- State: .isdlc/state.json

## Skills (116 across 10 categories)

| Category | Skills | Purpose |
|----------|--------|---------|
| orchestration | 8 | Workflow, gates, delegation |
| requirements | 10 | Requirements, user stories |
| architecture | 12 | System design, tech stack |
| design | 10 | API, UI/UX, modules |
| testing | 13 | Test strategy, coverage |
| development | 14 | Implementation, review |
| security | 13 | Threats, scanning |
| devops | 14 | CI/CD, infrastructure |
| documentation | 10 | Docs, runbooks |
| operations | 12 | Monitoring, incidents |

## Current Phase

Check .isdlc/state.json for current phase and status.

## SDLC Phases

01-requirements → 02-architecture → 03-design → 04-test-strategy
→ 05-implementation → 06-testing → 07-code-review → 08-validation
→ 09-cicd → 10-local-testing → 11-test-deploy → 12-production
→ 13-operations

## Project Notes

Add project-specific notes here.
EOF

# Create basic project directories
echo -e "${YELLOW}Creating project directories...${NC}"
mkdir -p src tests docs

# Create .gitignore if it doesn't exist
if [ ! -f .gitignore ]; then
    echo -e "${YELLOW}Creating .gitignore...${NC}"
    cat > .gitignore << 'EOF'
# Dependencies
node_modules/
vendor/
.venv/

# Build outputs
dist/
build/
*.egg-info/

# IDE
.idea/
.vscode/
*.swp
*.swo

# Environment
.env
.env.local
.env.*.local

# Logs
*.log
logs/

# Coverage
coverage/
.nyc_output/

# OS
.DS_Store
Thumbs.db
EOF
fi

echo ""
echo -e "${GREEN}Project initialized successfully!${NC}"
echo ""
echo "Structure created:"
echo "  .isdlc/                  - Project state and artifacts"
echo "  .isdlc/state.json        - Current phase and progress"
echo "  .isdlc/constitution.md   - Project constitutional principles"
echo "  .isdlc/phases/           - Phase artifacts"
echo "  .claude/CLAUDE.md        - Project context for Claude"
echo ""
if [ "$STANDALONE" = false ]; then
    echo "Shared resources from monorepo:"
    echo "  $MONOREPO_ROOT/.claude/skills/"
    echo "  $MONOREPO_ROOT/isdlc-framework/"
    echo ""
fi
echo "Next steps:"
echo "  1. cd $PROJECT_PATH"
echo "  2. Review .isdlc/state.json"
echo "  3. Start with requirements phase"
echo ""

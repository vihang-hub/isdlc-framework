#!/bin/bash

# iSDLC Framework - Project Installation Script
#
# This script installs the iSDLC framework into your existing project.
#
# Usage:
#   1. Clone the iSDLC framework into your project: git clone <repo> isdlc-framework
#   2. Run: ./isdlc-framework/install.sh
#   3. The script will set up the framework and clean up after itself
#
# What it does:
#   - Creates or merges .claude/ folder with agent definitions and skills
#   - Creates docs/ folder for requirements and documentation
#   - Creates .isdlc/ folder for project state tracking
#   - Removes the isdlc-framework folder after installation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Get the directory where this script is located (the cloned isdlc-framework folder)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# The project root is the parent of the cloned framework folder
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
# Framework resources are in src/ subdirectory
FRAMEWORK_DIR="$SCRIPT_DIR/src"

# ============================================================================
# Remove framework development files (not needed by end users)
# ============================================================================
# Git artifacts
if [ -d "$SCRIPT_DIR/.git" ]; then
    rm -rf "$SCRIPT_DIR/.git"
fi
if [ -f "$SCRIPT_DIR/.gitignore" ]; then
    rm -f "$SCRIPT_DIR/.gitignore"
fi

# Framework development notes
rm -f "$SCRIPT_DIR/CHANGELOG.md" 2>/dev/null || true
rm -f "$SCRIPT_DIR/NEXT-SESSION.md" 2>/dev/null || true

# Development session logs
rm -f "$SCRIPT_DIR/docs/SESSION-"*.md 2>/dev/null || true

# Archive of old documentation
rm -rf "$SCRIPT_DIR/docs/archive" 2>/dev/null || true

# OS artifacts
find "$SCRIPT_DIR" -name ".DS_Store" -delete 2>/dev/null || true

echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║           iSDLC Framework - Project Installation           ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Project Directory:${NC} $PROJECT_ROOT"
echo ""

# Confirm installation
echo -e "${YELLOW}This will install the iSDLC framework into your project:${NC}"
echo "  - .claude/        (agents and skills)"
echo "  - .isdlc/         (project state tracking)"
echo "  - docs/           (requirements and documentation)"
echo ""
read -p "Continue with installation? [Y/n]: " CONFIRM
CONFIRM=${CONFIRM:-Y}

if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo -e "${RED}Installation cancelled.${NC}"
    exit 0
fi

echo ""

# Get project name from directory (no prompt needed)
PROJECT_NAME=$(basename "$PROJECT_ROOT")
echo -e "${BLUE}Project Name:${NC} $PROJECT_NAME"

# ============================================================================
# Detect if this is an existing project with code
# ============================================================================
IS_EXISTING_PROJECT=false

# Check for common indicators of an existing project
if [ -f "package.json" ] || [ -f "requirements.txt" ] || [ -f "pyproject.toml" ] || \
   [ -f "go.mod" ] || [ -f "Cargo.toml" ] || [ -f "pom.xml" ] || [ -f "build.gradle" ] || \
   [ -f "Gemfile" ] || [ -f "composer.json" ] || [ -f "*.csproj" ] || [ -f "Makefile" ] || \
   [ -d "src" ] || [ -d "lib" ] || [ -d "app" ] || [ -d "pkg" ] || [ -d "cmd" ]; then
    IS_EXISTING_PROJECT=true
fi

# Also check if there are any source code files
if [ "$IS_EXISTING_PROJECT" = false ]; then
    SOURCE_FILES=$(find "$PROJECT_ROOT" -maxdepth 3 -type f \( -name "*.js" -o -name "*.ts" -o -name "*.py" -o -name "*.go" -o -name "*.rs" -o -name "*.java" -o -name "*.rb" -o -name "*.php" -o -name "*.cs" \) 2>/dev/null | head -1)
    if [ -n "$SOURCE_FILES" ]; then
        IS_EXISTING_PROJECT=true
    fi
fi

if [ "$IS_EXISTING_PROJECT" = true ]; then
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║           EXISTING PROJECT DETECTED                        ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}This appears to be an existing project with code.${NC}"
    echo -e "${YELLOW}The framework will be installed without modifying your project structure.${NC}"
    echo ""
else
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║              NEW PROJECT DETECTED                          ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${YELLOW}This appears to be a new project.${NC}"
    echo ""
fi

echo -e "${CYAN}After installation, run:${NC}"
echo -e "  1. ${GREEN}claude${NC} to start Claude Code"
echo -e "  2. ${GREEN}/discover${NC} to set up your project"
echo ""
echo -e "${YELLOW}The discover command will:${NC}"
echo "  • Analyze your project (or ask about it if new)"
echo "  • Research best practices for your stack"
echo "  • Guide you through creating a project constitution"
echo ""

# Workflow track is determined by orchestrator at runtime based on task complexity
TRACK="auto"
TRACK_NAME="Orchestrator-managed"
COMPLEXITY_LEVEL=null
PHASES_REQUIRED="null"
PHASES_OPTIONAL="null"
PHASES_SKIPPED="null"
MAX_ITERATIONS=10
ITERATION_TIMEOUT=5

cd "$PROJECT_ROOT"

# ============================================================================
# Step 1: Handle .claude folder
# ============================================================================
echo -e "${BLUE}[1/5]${NC} Setting up .claude folder..."

FRAMEWORK_CLAUDE="$FRAMEWORK_DIR/claude"

if [ ! -d "$FRAMEWORK_CLAUDE" ]; then
    echo -e "${RED}Error: Framework .claude folder not found at $FRAMEWORK_CLAUDE${NC}"
    exit 1
fi

# First, delete CLAUDE.md from the framework's .claude folder (it's for framework development only)
if [ -f "$FRAMEWORK_CLAUDE/CLAUDE.md" ]; then
    rm -f "$FRAMEWORK_CLAUDE/CLAUDE.md"
    echo -e "${YELLOW}  Removed framework CLAUDE.md (not needed for user projects)${NC}"
fi

if [ -d ".claude" ]; then
    echo -e "${YELLOW}  Existing .claude folder found - merging contents...${NC}"

    # Backup existing CLAUDE.md if it exists
    if [ -f ".claude/CLAUDE.md" ]; then
        echo -e "${YELLOW}  Backing up existing CLAUDE.md to CLAUDE.md.backup${NC}"
        cp ".claude/CLAUDE.md" ".claude/CLAUDE.md.backup"
    fi

    # Copy agents (overwrite)
    if [ -d "$FRAMEWORK_CLAUDE/agents" ]; then
        cp -r "$FRAMEWORK_CLAUDE/agents" ".claude/"
        echo -e "${GREEN}  ✓ Copied agents/${NC}"
    fi

    # Copy commands (overwrite)
    if [ -d "$FRAMEWORK_CLAUDE/commands" ]; then
        cp -r "$FRAMEWORK_CLAUDE/commands" ".claude/"
        echo -e "${GREEN}  ✓ Copied commands/${NC}"
    fi

    # Copy skills (overwrite)
    if [ -d "$FRAMEWORK_CLAUDE/skills" ]; then
        cp -r "$FRAMEWORK_CLAUDE/skills" ".claude/"
        echo -e "${GREEN}  ✓ Copied skills/${NC}"
    fi

    # Copy settings if they don't exist
    if [ -f "$FRAMEWORK_CLAUDE/settings.local.json" ] && [ ! -f ".claude/settings.local.json" ]; then
        cp "$FRAMEWORK_CLAUDE/settings.local.json" ".claude/"
        echo -e "${GREEN}  ✓ Copied settings.local.json${NC}"
    fi
else
    echo -e "${YELLOW}  Creating new .claude folder...${NC}"
    mkdir -p ".claude"

    # Copy only the framework components (CLAUDE.md already deleted above)
    if [ -d "$FRAMEWORK_CLAUDE/agents" ]; then
        cp -r "$FRAMEWORK_CLAUDE/agents" ".claude/"
    fi
    if [ -d "$FRAMEWORK_CLAUDE/commands" ]; then
        cp -r "$FRAMEWORK_CLAUDE/commands" ".claude/"
    fi
    if [ -d "$FRAMEWORK_CLAUDE/skills" ]; then
        cp -r "$FRAMEWORK_CLAUDE/skills" ".claude/"
    fi
    if [ -f "$FRAMEWORK_CLAUDE/settings.local.json" ]; then
        cp "$FRAMEWORK_CLAUDE/settings.local.json" ".claude/"
    fi

    echo -e "${GREEN}  ✓ Created .claude/${NC}"
fi

# ============================================================================
# Step 1b: Setup skill enforcement hooks (Node.js - Cross-Platform)
# ============================================================================
echo -e "${BLUE}[1b/5]${NC} Setting up skill enforcement hooks..."

# Check for Node.js (required for hooks)
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}  Warning: Node.js not found. Hooks require Node.js to run.${NC}"
    echo -e "${YELLOW}  Install Node.js from https://nodejs.org/${NC}"
fi

# Create hooks directory structure
mkdir -p ".claude/hooks/lib"
mkdir -p ".claude/hooks/tests/test-scenarios"

# Copy hook scripts from framework (Node.js files)
if [ -d "$FRAMEWORK_CLAUDE/hooks" ]; then
    cp -r "$FRAMEWORK_CLAUDE/hooks/"* ".claude/hooks/"
    echo -e "${GREEN}  ✓ Copied skill enforcement hooks (Node.js)${NC}"
fi

# Merge settings.json (hooks configuration)
if [ -f "$FRAMEWORK_CLAUDE/settings.json" ]; then
    if [ -f ".claude/settings.json" ]; then
        # Merge hooks into existing settings
        if command -v jq &> /dev/null; then
            tmp_file=$(mktemp)
            jq -s '.[0] * .[1]' ".claude/settings.json" "$FRAMEWORK_CLAUDE/settings.json" > "$tmp_file"
            mv "$tmp_file" ".claude/settings.json"
            echo -e "${GREEN}  ✓ Merged hooks into existing settings.json${NC}"
        else
            echo -e "${YELLOW}  Warning: jq not found, settings.json may need manual merge${NC}"
            cp "$FRAMEWORK_CLAUDE/settings.json" ".claude/settings.json.hooks"
        fi
    else
        cp "$FRAMEWORK_CLAUDE/settings.json" ".claude/settings.json"
        echo -e "${GREEN}  ✓ Created settings.json with hooks${NC}"
    fi
fi

# ============================================================================
# Step 2: Create docs folder
# ============================================================================
echo -e "${BLUE}[2/5]${NC} Setting up docs folder..."

if [ -d "docs" ]; then
    echo -e "${YELLOW}  docs/ folder already exists${NC}"
else
    mkdir -p docs
    echo -e "${GREEN}  ✓ Created docs/${NC}"
fi

# Create initial structure in docs
mkdir -p docs/requirements
mkdir -p docs/architecture
mkdir -p docs/design

# Copy framework-info.md to docs folder
if [ -f "$SCRIPT_DIR/framework-info.md" ]; then
    cp "$SCRIPT_DIR/framework-info.md" docs/
    echo -e "${GREEN}  ✓ Copied framework-info.md to docs/${NC}"
fi

# Copy templates to docs if they exist
if [ -d "$FRAMEWORK_DIR/isdlc/templates/requirements" ]; then
    cp "$FRAMEWORK_DIR/isdlc/templates/requirements/"*.md docs/requirements/ 2>/dev/null || true
    echo -e "${GREEN}  ✓ Copied requirement templates to docs/requirements/${NC}"
fi

# Create a README in docs
cat > docs/README.md << 'EOF'
# Project Documentation

This folder contains all project documentation following the iSDLC framework.

## Structure

```
docs/
├── requirements/       # Requirements specifications and user stories
├── architecture/       # Architecture decisions and system design
├── design/            # Detailed design documents
└── README.md          # This file
```

## Getting Started

1. Start with requirements in `requirements/`
2. Document architecture decisions in `architecture/`
3. Add detailed designs in `design/`

See `.isdlc/state.json` for current project phase and progress.
EOF

echo -e "${GREEN}  ✓ Created docs/README.md${NC}"

# ============================================================================
# Step 3: Create .isdlc folder with state
# ============================================================================
echo -e "${BLUE}[3/5]${NC} Setting up .isdlc folder..."

mkdir -p .isdlc/phases/{01-requirements,02-architecture,03-design,04-test-strategy,05-implementation,06-testing,07-code-review,08-validation,09-cicd,10-local-testing,11-test-deploy,12-production,13-operations}/artifacts

# Copy config files
if [ -d "$FRAMEWORK_DIR/isdlc/config" ]; then
    cp -r "$FRAMEWORK_DIR/isdlc/config" ".isdlc/"
    echo -e "${GREEN}  ✓ Copied config files${NC}"
fi

# Copy skills manifest to hooks config folder (hooks config lives with hooks)
mkdir -p ".claude/hooks/config"
if [ -f "$FRAMEWORK_DIR/isdlc/config/skills-manifest.yaml" ]; then
    cp "$FRAMEWORK_DIR/isdlc/config/skills-manifest.yaml" ".claude/hooks/config/"

    # Convert skills manifest from YAML to JSON for runtime hooks
    # Check for yq
    if command -v yq &> /dev/null; then
        yq -o=json ".claude/hooks/config/skills-manifest.yaml" > ".claude/hooks/config/skills-manifest.json"
        echo -e "${GREEN}  ✓ Copied and converted skills manifest to hooks/config/${NC}"
    # Check for Python with PyYAML
    elif command -v python3 &> /dev/null && python3 -c "import yaml, json" 2>/dev/null; then
        python3 -c "
import yaml, json
with open('.claude/hooks/config/skills-manifest.yaml') as f:
    data = yaml.safe_load(f)
with open('.claude/hooks/config/skills-manifest.json', 'w') as f:
    json.dump(data, f, indent=2)
" 2>/dev/null
        echo -e "${GREEN}  ✓ Copied and converted skills manifest to hooks/config/ (Python)${NC}"
    # Use scripts/convert-manifest.sh if available
    elif [ -f "$FRAMEWORK_DIR/isdlc/scripts/convert-manifest.sh" ]; then
        mkdir -p "scripts"
        cp "$FRAMEWORK_DIR/isdlc/scripts/convert-manifest.sh" "scripts/"
        chmod +x "scripts/convert-manifest.sh"
        "./scripts/convert-manifest.sh" --input ".claude/hooks/config/skills-manifest.yaml" --output ".claude/hooks/config/skills-manifest.json" >/dev/null 2>&1
        echo -e "${GREEN}  ✓ Copied and converted skills manifest to hooks/config/ (embedded)${NC}"
    # Fallback: copy pre-converted JSON if available
    elif [ -f "$FRAMEWORK_DIR/isdlc/config/skills-manifest.json" ]; then
        cp "$FRAMEWORK_DIR/isdlc/config/skills-manifest.json" ".claude/hooks/config/"
        echo -e "${GREEN}  ✓ Copied skills manifest (JSON) to hooks/config/${NC}"
    else
        echo -e "${YELLOW}  Warning: Could not convert manifest. Install yq or Python+PyYAML.${NC}"
    fi
fi

# Copy workflows.json to both .isdlc/config/ and .claude/hooks/config/
if [ -f "$FRAMEWORK_DIR/isdlc/config/workflows.json" ]; then
    mkdir -p ".isdlc/config"
    cp "$FRAMEWORK_DIR/isdlc/config/workflows.json" ".isdlc/config/"
    cp "$FRAMEWORK_DIR/isdlc/config/workflows.json" ".claude/hooks/config/"
    echo -e "${GREEN}  ✓ Copied workflow definitions${NC}"
fi

# Copy checklists
if [ -d "$FRAMEWORK_DIR/isdlc/checklists" ]; then
    cp -r "$FRAMEWORK_DIR/isdlc/checklists" ".isdlc/"
    echo -e "${GREEN}  ✓ Copied gate checklists${NC}"
fi

# Copy templates
if [ -d "$FRAMEWORK_DIR/isdlc/templates" ]; then
    cp -r "$FRAMEWORK_DIR/isdlc/templates" ".isdlc/"
    echo -e "${GREEN}  ✓ Copied templates${NC}"
fi

# Copy scripts (validate-state.sh, generate-report.sh)
if [ -d "$FRAMEWORK_DIR/isdlc/scripts" ]; then
    cp -r "$FRAMEWORK_DIR/isdlc/scripts" ".isdlc/"
    echo -e "${GREEN}  ✓ Copied utility scripts${NC}"
fi

# Copy constitution
if [ -f "$FRAMEWORK_DIR/isdlc/templates/constitution.md" ]; then
    cp "$FRAMEWORK_DIR/isdlc/templates/constitution.md" ".isdlc/constitution.md"
    echo -e "${GREEN}  ✓ Copied constitution${NC}"
fi

# Create state.json
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
cat > .isdlc/state.json << EOF
{
  "framework_version": "2.0.0",
  "project": {
    "name": "$PROJECT_NAME",
    "created": "$TIMESTAMP",
    "description": "",
    "is_new_project": $( [ "$IS_EXISTING_PROJECT" = true ] && echo "false" || echo "true" )
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
  "constitution": {
    "enforced": true,
    "path": ".isdlc/constitution.md",
    "validated_at": null
  },
  "autonomous_iteration": {
    "enabled": true,
    "max_iterations": $MAX_ITERATIONS,
    "timeout_per_iteration_minutes": $ITERATION_TIMEOUT,
    "circuit_breaker_threshold": 3
  },
  "skill_enforcement": {
    "enabled": true,
    "mode": "strict",
    "fail_behavior": "allow",
    "manifest_version": "2.0.0"
  },
  "cloud_configuration": {
    "provider": "undecided",
    "configured_at": null,
    "credentials_validated": false,
    "aws": null,
    "gcp": null,
    "azure": null,
    "deployment": {
      "staging_enabled": false,
      "production_enabled": false,
      "workflow_endpoint": "10-local-testing"
    }
  },
  "iteration_enforcement": {
    "enabled": true
  },
  "skill_usage_log": [],
  "active_workflow": null,
  "workflow_history": [],
  "current_phase": "01-requirements",
  "phases": {
    "01-requirements": { "status": "pending", "started": null, "completed": null, "gate_passed": null, "artifacts": [] },
    "02-architecture": { "status": "pending", "started": null, "completed": null, "gate_passed": null, "artifacts": [] },
    "03-design": { "status": "pending", "started": null, "completed": null, "gate_passed": null, "artifacts": [] },
    "04-test-strategy": { "status": "pending", "started": null, "completed": null, "gate_passed": null, "artifacts": [] },
    "05-implementation": { "status": "pending", "started": null, "completed": null, "gate_passed": null, "artifacts": [], "iteration_tracking": { "current": 0, "max": null, "history": [], "final_status": null } },
    "06-testing": { "status": "pending", "started": null, "completed": null, "gate_passed": null, "artifacts": [], "iteration_tracking": { "current": 0, "max": null, "history": [], "final_status": null } },
    "07-code-review": { "status": "pending", "started": null, "completed": null, "gate_passed": null, "artifacts": [] },
    "08-validation": { "status": "pending", "started": null, "completed": null, "gate_passed": null, "artifacts": [] },
    "09-cicd": { "status": "pending", "started": null, "completed": null, "gate_passed": null, "artifacts": [] },
    "10-local-testing": { "status": "pending", "started": null, "completed": null, "gate_passed": null, "artifacts": [] },
    "11-test-deploy": { "status": "pending", "started": null, "completed": null, "gate_passed": null, "artifacts": [] },
    "12-production": { "status": "pending", "started": null, "completed": null, "gate_passed": null, "artifacts": [] },
    "13-operations": { "status": "pending", "started": null, "completed": null, "gate_passed": null, "artifacts": [] }
  },
  "blockers": [],
  "active_agent": null,
  "history": [
    {
      "timestamp": "$TIMESTAMP",
      "agent": "init-script",
      "action": "Project initialized with iSDLC framework"
    }
  ]
}
EOF

echo -e "${GREEN}  ✓ Created state.json${NC}"

# Handle CLAUDE.md in project root
FRAMEWORK_INSTRUCTION="Read docs/framework-info.md"

if [ -f "CLAUDE.md" ]; then
    # Check if the instruction already exists
    if ! grep -q "$FRAMEWORK_INSTRUCTION" "CLAUDE.md"; then
        echo "" >> "CLAUDE.md"
        echo "$FRAMEWORK_INSTRUCTION" >> "CLAUDE.md"
        echo -e "${GREEN}  ✓ Added framework reference to existing CLAUDE.md${NC}"
    else
        echo -e "${YELLOW}  CLAUDE.md already contains framework reference${NC}"
    fi
else
    echo "$FRAMEWORK_INSTRUCTION" > "CLAUDE.md"
    echo ""
    echo -e "${YELLOW}  ⚠ CLAUDE.md was missing - created one in project root${NC}"
    echo -e "${GREEN}  ✓ Created CLAUDE.md with framework reference${NC}"
fi

# ============================================================================
# Step 5: Update constitution with project info and display for review
# ============================================================================
echo -e "${BLUE}[4/5]${NC} Configuring project constitution..."

# Update constitution with project name and track info
if [ -f ".isdlc/constitution.md" ]; then
    # Create a project-specific constitution based on the track
    cat > .isdlc/constitution.md << CONSTEOF
# Project Constitution - $PROJECT_NAME

<!-- CONSTITUTION_STATUS: STARTER_TEMPLATE -->
<!-- This marker indicates this constitution needs customization -->
<!-- Run /discover to customize -->

**Created**: $(date +"%Y-%m-%d")
**Status**: ⚠️ NEEDS CUSTOMIZATION

---

## ⚠️ CUSTOMIZATION REQUIRED

This is a **starter constitution** auto-generated during framework installation.
It contains generic articles that may not match your project's specific needs.

**To customize this constitution:**
Run \`/discover\` to analyze your project and generate tailored articles interactively.

**This constitution will be treated as a TEMPLATE until customized.**

---

## Preamble

This constitution establishes the fundamental principles governing all development activities within the **$PROJECT_NAME** project. These articles guide all SDLC phases and all agent interactions.

All agents (01-13) and the SDLC Orchestrator (00) will read and enforce these principles throughout the project lifecycle.

---

## Articles (Generic - Customize for Your Project)

### Article I: Specification Primacy

**Principle**: Specifications are the source of truth. Code serves specifications.

**Requirements**:
1. Code MUST implement specifications exactly as defined
2. Any deviation from specifications MUST be documented and justified
3. Specifications MUST be updated before code changes

---

### Article II: Test-First Development

**Principle**: Tests MUST be written before implementation.

**Requirements**:
1. Test cases MUST be designed before implementation
2. Unit tests MUST be written before production code
3. Code without tests CANNOT pass quality gates

**Coverage Thresholds**:
- Unit test coverage: ≥80%
- Integration test coverage: ≥70%

---

### Article III: Security by Design

**Principle**: Security considerations MUST precede implementation decisions.

**Requirements**:
1. No secrets in code - use environment variables
2. All inputs validated, all outputs sanitized
3. Critical/High vulnerabilities MUST be resolved before deployment

---

### Article IV: Simplicity First

**Principle**: Implement the simplest solution that satisfies requirements.

**Requirements**:
1. Avoid over-engineering and premature optimization
2. YAGNI (You Aren't Gonna Need It) - no speculative features
3. Complexity MUST be justified by requirements

---

### Article V: Quality Gate Integrity

**Principle**: Quality gates cannot be skipped. Failures require remediation.

**Requirements**:
1. All quality gates MUST be validated before phase advancement
2. Gate failures MUST be remediated (cannot be waived)
3. Gate fails twice → Escalate to human

---

## Customization Notes

Review and modify these articles based on your project's specific needs:
- Add compliance requirements (HIPAA, GDPR, PCI-DSS)
- Add performance SLAs
- Add accessibility requirements
- Adjust coverage thresholds
- Add domain-specific constraints

---

**Constitution Version**: 1.0.0
**Framework Version**: 2.0.0
CONSTEOF

    echo -e "${GREEN}  ✓ Created project constitution${NC}"
fi

# Note about constitution (both new and existing projects)
if [ "$IS_EXISTING_PROJECT" = true ]; then
    echo -e "${YELLOW}  Existing project - constitution template created at .isdlc/constitution.md${NC}"
else
    echo -e "${YELLOW}  Constitution template created at .isdlc/constitution.md${NC}"
fi
echo -e "${YELLOW}  Next step: Run /discover to customize your project constitution${NC}"

# ============================================================================
# Step 6: Cleanup - Remove isdlc-framework folder
# ============================================================================
echo -e "${BLUE}[5/5]${NC} Cleaning up installation files..."

# Store the script dir before we delete it
CLEANUP_DIR="$SCRIPT_DIR"

echo -e "${YELLOW}  Removing isdlc-framework/ folder...${NC}"

# We need to be careful here - delete the framework folder
cd "$PROJECT_ROOT"
rm -rf "$CLEANUP_DIR"

echo -e "${GREEN}  ✓ Removed isdlc-framework/${NC}"

# ============================================================================
# Done!
# ============================================================================
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║            Installation Complete!                          ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

echo -e "${CYAN}Project Structure:${NC}"
echo "  .claude/           - Agent definitions and skills"
echo "  .isdlc/            - Project state and framework resources"
echo "  docs/              - Documentation"
echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                    NEXT STEPS                              ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  1. Run ${GREEN}claude${NC} to start Claude Code"
echo -e "  2. Run ${GREEN}/discover${NC} to:"
echo "     • Analyze your project (or describe it if new)"
echo "     • Research best practices for your stack"
echo "     • Create a tailored constitution interactively"
echo -e "  3. Run ${GREEN}/sdlc start${NC} to begin your workflow"
echo ""
if [ "$IS_EXISTING_PROJECT" = true ]; then
    echo -e "${YELLOW}Note: Your existing project structure was not modified.${NC}"
fi

echo -e "${CYAN}Workflow:${NC} Orchestrator determines phases based on task complexity"
echo ""

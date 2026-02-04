#!/bin/bash

# ============================================================================
# iSDLC - Ollama Setup Helper
# ============================================================================
# This script helps users install and configure Ollama for local LLM inference.
# It detects the user's system, installs Ollama, pulls appropriate models,
# and validates the setup.
#
# Usage: ./setup-ollama.sh [--model MODEL] [--check-only] [--help]
#
# Version: 1.0.0
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Default model based on available VRAM
DEFAULT_MODEL=""
REQUESTED_MODEL=""
CHECK_ONLY=false
SKIP_MODEL_PULL=false

# ============================================================================
# Helper Functions
# ============================================================================

print_header() {
    echo ""
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║              iSDLC - Ollama Setup Helper                   ║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_step() {
    echo -e "${BLUE}[$1]${NC} $2"
}

print_success() {
    echo -e "${GREEN}  ✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}  ⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}  ✗ $1${NC}"
}

print_info() {
    echo -e "  $1"
}

show_help() {
    echo "Usage: ./setup-ollama.sh [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --model MODEL    Specify model to install (e.g., qwen2.5-coder:14b)"
    echo "  --check-only     Only check if Ollama is installed and working"
    echo "  --skip-model     Install Ollama but don't pull any model"
    echo "  --help           Show this help message"
    echo ""
    echo "Recommended models by VRAM:"
    echo "  8GB  VRAM: codellama:7b, qwen2.5-coder:7b"
    echo "  12GB VRAM: qwen2.5-coder:14b (recommended)"
    echo "  16GB VRAM: deepseek-coder-v2:16b"
    echo "  24GB VRAM: qwen3-coder, codellama:34b"
    echo ""
    echo "Examples:"
    echo "  ./setup-ollama.sh                    # Auto-detect and install"
    echo "  ./setup-ollama.sh --model qwen2.5-coder:14b"
    echo "  ./setup-ollama.sh --check-only"
    echo ""
}

# ============================================================================
# System Detection
# ============================================================================

detect_os() {
    case "$(uname -s)" in
        Darwin*)    echo "macos" ;;
        Linux*)     echo "linux" ;;
        MINGW*|MSYS*|CYGWIN*) echo "windows" ;;
        *)          echo "unknown" ;;
    esac
}

detect_arch() {
    case "$(uname -m)" in
        x86_64|amd64)   echo "amd64" ;;
        arm64|aarch64)  echo "arm64" ;;
        *)              echo "unknown" ;;
    esac
}

detect_gpu() {
    local os=$(detect_os)
    local gpu_info=""
    local vram_gb=0

    case "$os" in
        macos)
            # Check for Apple Silicon (unified memory acts as VRAM)
            if [[ "$(uname -m)" == "arm64" ]]; then
                # Get total memory (Apple Silicon shares RAM with GPU)
                local total_mem=$(sysctl -n hw.memsize 2>/dev/null)
                if [ -n "$total_mem" ]; then
                    vram_gb=$((total_mem / 1024 / 1024 / 1024))
                    # Apple Silicon can use ~75% of RAM for ML
                    vram_gb=$((vram_gb * 3 / 4))
                    gpu_info="Apple Silicon (${vram_gb}GB available for ML)"
                fi
            else
                # Intel Mac - check for discrete GPU
                local gpu=$(system_profiler SPDisplaysDataType 2>/dev/null | grep "Chipset Model" | head -1 | cut -d: -f2 | xargs)
                if [ -n "$gpu" ]; then
                    gpu_info="$gpu"
                    # Try to get VRAM
                    local vram=$(system_profiler SPDisplaysDataType 2>/dev/null | grep "VRAM" | head -1 | grep -oE '[0-9]+' | head -1)
                    if [ -n "$vram" ]; then
                        vram_gb=$vram
                    fi
                fi
            fi
            ;;

        linux)
            # Check for NVIDIA GPU
            if command -v nvidia-smi &> /dev/null; then
                gpu_info=$(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | head -1)
                local vram_mb=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits 2>/dev/null | head -1)
                if [ -n "$vram_mb" ]; then
                    vram_gb=$((vram_mb / 1024))
                fi
            # Check for AMD GPU
            elif command -v rocm-smi &> /dev/null; then
                gpu_info=$(rocm-smi --showproductname 2>/dev/null | grep "Card series" | head -1 | cut -d: -f2 | xargs)
                local vram_mb=$(rocm-smi --showmeminfo vram 2>/dev/null | grep "Total Memory" | head -1 | grep -oE '[0-9]+' | head -1)
                if [ -n "$vram_mb" ]; then
                    vram_gb=$((vram_mb / 1024))
                fi
            # Check lspci for GPU info
            elif command -v lspci &> /dev/null; then
                gpu_info=$(lspci | grep -i "vga\|3d\|display" | head -1 | cut -d: -f3 | xargs)
            fi

            # Fallback: use system RAM for CPU-only inference
            if [ "$vram_gb" -eq 0 ] && [ -f "/proc/meminfo" ]; then
                local total_mem_kb=$(grep MemTotal /proc/meminfo | awk '{print $2}')
                if [ -n "$total_mem_kb" ]; then
                    local total_mem_gb=$((total_mem_kb / 1024 / 1024))
                    # Use ~50% of RAM for CPU inference
                    vram_gb=$((total_mem_gb / 2))
                    gpu_info="${gpu_info:-CPU-only} (${vram_gb}GB RAM available)"
                fi
            fi
            ;;
    esac

    echo "$vram_gb|$gpu_info"
}

recommend_model() {
    local vram_gb=$1

    if [ "$vram_gb" -ge 24 ]; then
        echo "qwen3-coder"
    elif [ "$vram_gb" -ge 16 ]; then
        echo "deepseek-coder-v2:16b"
    elif [ "$vram_gb" -ge 12 ]; then
        echo "qwen2.5-coder:14b"
    elif [ "$vram_gb" -ge 8 ]; then
        echo "qwen2.5-coder:7b"
    else
        echo "qwen2.5-coder:3b"
    fi
}

# ============================================================================
# Ollama Installation
# ============================================================================

check_ollama_installed() {
    if command -v ollama &> /dev/null; then
        return 0
    else
        return 1
    fi
}

check_ollama_running() {
    if curl -s http://localhost:11434/api/tags &> /dev/null; then
        return 0
    else
        return 1
    fi
}

get_ollama_version() {
    ollama --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1
}

install_ollama() {
    local os=$(detect_os)

    print_step "2/5" "Installing Ollama..."

    case "$os" in
        macos)
            if command -v brew &> /dev/null; then
                print_info "Installing via Homebrew..."
                brew install ollama
            else
                print_info "Installing via official installer..."
                curl -fsSL https://ollama.com/install.sh | sh
            fi
            ;;

        linux)
            print_info "Installing via official installer..."
            curl -fsSL https://ollama.com/install.sh | sh
            ;;

        windows)
            print_error "Windows detected. Please install Ollama manually:"
            print_info "  1. Download from: https://ollama.com/download/windows"
            print_info "  2. Run the installer"
            print_info "  3. Re-run this script"
            exit 1
            ;;

        *)
            print_error "Unsupported operating system"
            print_info "Please install Ollama manually from: https://ollama.com/download"
            exit 1
            ;;
    esac

    # Verify installation
    if check_ollama_installed; then
        print_success "Ollama installed successfully (version $(get_ollama_version))"
    else
        print_error "Ollama installation failed"
        exit 1
    fi
}

start_ollama() {
    print_step "3/5" "Starting Ollama server..."

    if check_ollama_running; then
        print_success "Ollama is already running"
        return 0
    fi

    local os=$(detect_os)

    case "$os" in
        macos)
            # Try to start as a background process
            print_info "Starting Ollama in background..."
            ollama serve &>/dev/null &
            sleep 3
            ;;

        linux)
            # Check if systemd service exists
            if systemctl list-unit-files | grep -q ollama; then
                print_info "Starting Ollama via systemd..."
                sudo systemctl start ollama
                sleep 2
            else
                print_info "Starting Ollama in background..."
                ollama serve &>/dev/null &
                sleep 3
            fi
            ;;
    esac

    # Verify it's running
    local retries=5
    while [ $retries -gt 0 ]; do
        if check_ollama_running; then
            print_success "Ollama server is running"
            return 0
        fi
        sleep 2
        retries=$((retries - 1))
    done

    print_warning "Ollama may not have started. Please run 'ollama serve' manually."
    return 1
}

# ============================================================================
# Model Management
# ============================================================================

list_installed_models() {
    ollama list 2>/dev/null | tail -n +2 | awk '{print $1}'
}

check_model_installed() {
    local model=$1
    ollama list 2>/dev/null | grep -q "^$model"
}

pull_model() {
    local model=$1

    print_step "4/5" "Pulling model: $model"
    print_info "This may take several minutes depending on your internet connection..."
    echo ""

    if ollama pull "$model"; then
        print_success "Model $model pulled successfully"
        return 0
    else
        print_error "Failed to pull model $model"
        return 1
    fi
}

estimate_model_size() {
    local model=$1

    case "$model" in
        *":3b"*|*"-3b"*)   echo "~2GB" ;;
        *":7b"*|*"-7b"*)   echo "~4GB" ;;
        *":14b"*|*"-14b"*) echo "~8GB" ;;
        *":16b"*|*"-16b"*) echo "~9GB" ;;
        *":34b"*|*"-34b"*) echo "~20GB" ;;
        *"qwen3-coder"*)   echo "~18GB" ;;
        *)                 echo "varies" ;;
    esac
}

# ============================================================================
# Validation
# ============================================================================

test_model() {
    local model=$1

    print_step "5/5" "Testing model: $model"

    local response=$(curl -s http://localhost:11434/api/generate \
        -d "{\"model\": \"$model\", \"prompt\": \"Write a hello world function in Python. Just the code, no explanation.\", \"stream\": false}" \
        2>/dev/null | grep -o '"response":"[^"]*"' | head -1)

    if [ -n "$response" ]; then
        print_success "Model is working correctly"
        echo ""
        echo -e "${CYAN}Sample response:${NC}"
        echo "$response" | sed 's/"response":"//;s/"$//' | head -5
        return 0
    else
        print_error "Model test failed"
        return 1
    fi
}

# ============================================================================
# Configuration
# ============================================================================

configure_isdlc_provider() {
    local model=$1
    local project_root="${CLAUDE_PROJECT_DIR:-.}"
    local config_file="$project_root/.isdlc/providers.yaml"

    if [ ! -d "$project_root/.isdlc" ]; then
        print_warning "No .isdlc directory found. Run /provider init in Claude Code."
        return 1
    fi

    # Create or update providers.yaml
    if [ -f "$config_file" ]; then
        print_info "Updating existing providers.yaml..."
        # Enable ollama provider (simple sed replacement)
        if grep -q "ollama:" "$config_file"; then
            sed -i.bak 's/ollama:\s*$/ollama:/' "$config_file"
            # Try to set enabled: true under ollama section
            # This is a simplified approach - full YAML editing would need a proper parser
            print_info "Please verify ollama is enabled in $config_file"
        fi
    else
        print_info "Creating providers.yaml with Ollama enabled..."
        mkdir -p "$(dirname "$config_file")"
        cat > "$config_file" << EOF
# iSDLC Provider Configuration
# Generated by setup-ollama.sh

providers:
  ollama:
    enabled: true
    base_url: "http://localhost:11434"
    auth_token: "ollama"
    models:
      - id: "$model"
        alias: "local"
        context_window: 32768
        cost_tier: "free"

defaults:
  provider: "ollama"
  model: "local"

active_mode: "budget"
EOF
        print_success "Created $config_file"
    fi
}

# ============================================================================
# Main Script
# ============================================================================

parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --model)
                REQUESTED_MODEL="$2"
                shift 2
                ;;
            --check-only)
                CHECK_ONLY=true
                shift
                ;;
            --skip-model)
                SKIP_MODEL_PULL=true
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

main() {
    parse_args "$@"
    print_header

    # Step 1: Detect system
    print_step "1/5" "Detecting system configuration..."

    local os=$(detect_os)
    local arch=$(detect_arch)
    local gpu_result=$(detect_gpu)
    local vram_gb=$(echo "$gpu_result" | cut -d'|' -f1)
    local gpu_info=$(echo "$gpu_result" | cut -d'|' -f2)

    print_info "OS: $os ($arch)"
    if [ -n "$gpu_info" ]; then
        print_info "GPU: $gpu_info"
        print_info "Available VRAM: ${vram_gb}GB"
    else
        print_warning "No GPU detected - Ollama will use CPU (slower)"
        vram_gb=8  # Assume 8GB for CPU-only systems
    fi

    # Recommend model based on VRAM
    DEFAULT_MODEL=$(recommend_model "$vram_gb")
    local model="${REQUESTED_MODEL:-$DEFAULT_MODEL}"

    print_info "Recommended model: $DEFAULT_MODEL"
    if [ -n "$REQUESTED_MODEL" ]; then
        print_info "Requested model: $REQUESTED_MODEL"
    fi
    echo ""

    # Check-only mode
    if [ "$CHECK_ONLY" = true ]; then
        echo -e "${CYAN}Checking Ollama status...${NC}"
        echo ""

        if check_ollama_installed; then
            print_success "Ollama is installed (version $(get_ollama_version))"
        else
            print_error "Ollama is not installed"
            exit 1
        fi

        if check_ollama_running; then
            print_success "Ollama server is running"
        else
            print_warning "Ollama server is not running"
        fi

        echo ""
        echo -e "${CYAN}Installed models:${NC}"
        local models=$(list_installed_models)
        if [ -n "$models" ]; then
            echo "$models" | while read -r m; do
                echo "  - $m"
            done
        else
            print_warning "No models installed"
        fi

        exit 0
    fi

    # Step 2: Install Ollama if needed
    if check_ollama_installed; then
        print_step "2/5" "Ollama already installed (version $(get_ollama_version))"
        print_success "Skipping installation"
    else
        install_ollama
    fi

    # Step 3: Start Ollama
    start_ollama

    # Step 4: Pull model
    if [ "$SKIP_MODEL_PULL" = true ]; then
        print_step "4/5" "Skipping model pull (--skip-model specified)"
    elif check_model_installed "$model"; then
        print_step "4/5" "Model $model already installed"
        print_success "Skipping download"
    else
        echo ""
        echo -e "${YELLOW}About to download model: $model${NC}"
        echo -e "${YELLOW}Estimated size: $(estimate_model_size "$model")${NC}"
        echo ""
        read -p "Continue? [Y/n]: " confirm
        confirm=${confirm:-Y}

        if [[ "$confirm" =~ ^[Yy]$ ]]; then
            pull_model "$model"
        else
            print_warning "Model download skipped"
            SKIP_MODEL_PULL=true
        fi
    fi

    # Step 5: Test model
    if [ "$SKIP_MODEL_PULL" = false ]; then
        test_model "$model"
    fi

    # Summary
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║              Ollama Setup Complete!                        ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${CYAN}Status:${NC}"
    echo "  Ollama Version: $(get_ollama_version)"
    echo "  Server: $(check_ollama_running && echo "Running" || echo "Not running")"
    echo "  Model: $model"
    echo ""
    echo -e "${CYAN}Next Steps:${NC}"
    echo "  1. In Claude Code, run: /provider init"
    echo "  2. Then run: /provider set budget"
    echo "  3. Start using iSDLC with local inference!"
    echo ""
    echo -e "${CYAN}Useful Commands:${NC}"
    echo "  ollama serve          # Start server (if not running)"
    echo "  ollama list           # List installed models"
    echo "  ollama pull <model>   # Download another model"
    echo "  ollama run <model>    # Interactive chat with model"
    echo ""

    # Configure iSDLC if possible
    if [ -d ".isdlc" ] || [ -d "${CLAUDE_PROJECT_DIR:-.}/.isdlc" ]; then
        echo -e "${CYAN}Configuring iSDLC...${NC}"
        configure_isdlc_provider "$model"
    fi
}

# Run main
main "$@"

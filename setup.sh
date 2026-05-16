#!/usr/bin/env bash
# =============================================================================
# VerifyTrade — Project Setup Script
# =============================================================================
# Usage: bash setup.sh
# Tested on: macOS 14+ (Sonoma), Node 20+
# =============================================================================

set -euo pipefail  # Exit on error, undefined vars, pipe failures

# ---------------------------------------------------------------------------
# Colours
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

print_header() {
  echo -e "\n${BLUE}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo -e "${CYAN}${BOLD}  VerifyTrade Setup  ${RESET}"
  echo -e "${BLUE}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n"
}

step() { echo -e "${BLUE}▶${RESET} ${BOLD}$1${RESET}"; }
success() { echo -e "${GREEN}✓${RESET} $1"; }
warn() { echo -e "${YELLOW}⚠${RESET}  $1"; }
error() { echo -e "${RED}✗${RESET} $1" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Check prerequisites
# ---------------------------------------------------------------------------
check_prerequisites() {
  step "Checking prerequisites..."

  # Node.js
  if ! command -v node &>/dev/null; then
    error "Node.js not found. Install via: brew install node or https://nodejs.org"
  fi
  NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
  if [ "$NODE_VERSION" -lt 18 ]; then
    error "Node.js 18+ required. Found: $(node -v)"
  fi
  success "Node.js $(node -v)"

  # npm
  if ! command -v npm &>/dev/null; then
    error "npm not found"
  fi
  success "npm $(npm -v)"

  # Git
  if ! command -v git &>/dev/null; then
    error "Git not found. Install via: brew install git"
  fi
  success "Git $(git --version | awk '{print $3}')"
}

# ---------------------------------------------------------------------------
# Setup .env
# ---------------------------------------------------------------------------
setup_env() {
  step "Setting up environment variables..."

  if [ -f ".env" ]; then
    warn ".env already exists — skipping copy (delete it to reset)"
  else
    cp .env.example .env
    success "Created .env from .env.example"
    echo ""
    echo -e "  ${YELLOW}Action required:${RESET} Open ${BOLD}.env${RESET} and fill in:"
    echo -e "    • PRIVATE_KEY          — your deployer wallet key"
    echo -e "    • ARBITRUM_SEPOLIA_RPC_URL — Alchemy or Infura endpoint"
    echo -e "    • ARBISCAN_API_KEY     — from arbiscan.io"
    echo -e "    • NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID — from cloud.walletconnect.com"
    echo ""
  fi
}

# ---------------------------------------------------------------------------
# Install dependencies
# ---------------------------------------------------------------------------
install_dependencies() {
  step "Installing dependencies (this may take 1-2 minutes)..."
  npm install
  success "All dependencies installed"
}

# ---------------------------------------------------------------------------
# Compile contracts
# ---------------------------------------------------------------------------
compile_contracts() {
  step "Compiling smart contracts..."
  if npm run build:contracts 2>/dev/null; then
    success "Contracts compiled — typechain types generated"
  else
    warn "Contract compilation skipped or failed — run: npm run build:contracts"
  fi
}

# ---------------------------------------------------------------------------
# Initialize git (if not already a repo)
# ---------------------------------------------------------------------------
setup_git() {
  if [ ! -d ".git" ]; then
    step "Initializing git repository..."
    git init
    git add .
    git commit -m "chore: initial project setup"
    success "Git repository initialized"
  else
    success "Git repository already exists"
  fi
}

# ---------------------------------------------------------------------------
# Final instructions
# ---------------------------------------------------------------------------
print_next_steps() {
  echo ""
  echo -e "${BLUE}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo -e "${GREEN}${BOLD}  ✓ Setup complete! Here's what to do next:${RESET}"
  echo -e "${BLUE}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo ""
  echo -e "  ${BOLD}1. Configure your environment${RESET}"
  echo -e "     ${CYAN}nano .env${RESET}  (fill in API keys and private key)"
  echo ""
  echo -e "  ${BOLD}2. Start local blockchain${RESET}"
  echo -e "     ${CYAN}npm run node --workspace=contracts${RESET}"
  echo ""
  echo -e "  ${BOLD}3. Deploy contracts locally${RESET}"
  echo -e "     ${CYAN}npm run deploy:local --workspace=contracts${RESET}"
  echo ""
  echo -e "  ${BOLD}4. Start the frontend${RESET}"
  echo -e "     ${CYAN}npm run dev${RESET}  →  http://localhost:3000"
  echo ""
  echo -e "  ${BOLD}5. Run tests${RESET}"
  echo -e "     ${CYAN}npm test${RESET}"
  echo ""
  echo -e "  ${BOLD}6. Deploy to Arbitrum Sepolia${RESET}"
  echo -e "     ${CYAN}npm run deploy:testnet${RESET}"
  echo ""
  echo -e "${BLUE}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo ""
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  print_header
  check_prerequisites
  setup_env
  install_dependencies
  compile_contracts
  setup_git
  print_next_steps
}

main "$@"

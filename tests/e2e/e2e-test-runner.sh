#!/bin/bash
set -e

# Main E2E test runner script that orchestrates the entire test flow

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}   Wallos MCP Server - End-to-End Test Suite${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}\n"

# Change to project root
cd "${PROJECT_ROOT}"

# Cleanup function
cleanup() {
    echo -e "\n${YELLOW}Performing cleanup...${NC}"
    source "${SCRIPT_DIR}/cleanup-test-env.sh"
}

# Register cleanup on exit
trap cleanup EXIT INT TERM

# Step 1: Setup test environment
echo -e "${GREEN}Step 1: Setting up test environment${NC}"
source "${SCRIPT_DIR}/setup-test-env.sh"

# Step 2: Run the E2E tests
echo -e "\n${GREEN}Step 2: Running E2E tests${NC}"
bun run "${SCRIPT_DIR}/run-claude-tests.ts"

# Step 3: Display results
echo -e "\n${GREEN}Step 3: Test Results${NC}"
if [ -f "${E2E_RESULTS_DIR}/test-results.json" ]; then
    cat "${E2E_RESULTS_DIR}/test-results.json"
else
    echo -e "${RED}No test results found${NC}"
fi

echo -e "\n${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}   E2E Test Suite Complete${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Cleaning up E2E test environment...${NC}"

# Stop and remove Wallos test container
echo -e "${YELLOW}Stopping Wallos test instance...${NC}"
docker-compose -f tests/e2e/docker-compose.test.yml down -v

# Remove test directories if they exist
if [ -n "${E2E_TEST_DIR}" ] && [ -d "${E2E_TEST_DIR}" ]; then
    echo -e "${YELLOW}Removing test directory: ${E2E_TEST_DIR}${NC}"
    rm -rf "${E2E_TEST_DIR}"
fi

# Clean up any orphaned volumes
echo -e "${YELLOW}Cleaning up Docker volumes...${NC}"
docker volume prune -f --filter "label=com.docker.compose.project=wallos-e2e-test" 2>/dev/null || true

echo -e "${GREEN}E2E test environment cleaned up!${NC}"
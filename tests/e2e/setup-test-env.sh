#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test configuration
TEST_DIR="/tmp/wallos-mcp-e2e-test-$(date +%s)"
WALLOS_PORT=18282
WALLOS_URL="http://localhost:${WALLOS_PORT}"
MCP_CONFIG_DIR="${TEST_DIR}/mcp-config"
TEST_RESULTS_DIR="${TEST_DIR}/results"

echo -e "${GREEN}Setting up E2E test environment...${NC}"

# Create test directories
mkdir -p "${MCP_CONFIG_DIR}"
mkdir -p "${TEST_RESULTS_DIR}"

# Start Wallos test instance
echo -e "${YELLOW}Starting Wallos test instance...${NC}"
docker-compose -f tests/e2e/docker-compose.test.yml up -d

# Wait for Wallos to be ready
echo -e "${YELLOW}Waiting for Wallos to be ready...${NC}"
for i in {1..30}; do
    if curl -sf "${WALLOS_URL}/api/health" > /dev/null 2>&1; then
        echo -e "${GREEN}Wallos is ready!${NC}"
        break
    fi
    echo -n "."
    sleep 2
done

# Setup initial Wallos user
echo -e "${YELLOW}Setting up Wallos user...${NC}"
WALLOS_SETUP_RESPONSE=$(curl -s -X POST "${WALLOS_URL}/endpoints/user/register.php" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "username=testuser&password=testpass123&email=test@example.com")

echo "Wallos setup response: ${WALLOS_SETUP_RESPONSE}"

# Build the MCP server
echo -e "${YELLOW}Building MCP server...${NC}"
bun run build

# Create MCP server config
cat > "${MCP_CONFIG_DIR}/wallos-mcp.json" <<EOF
{
  "mcpServers": {
    "wallos-test": {
      "command": "bun",
      "args": ["run", "${PWD}/dist/index.js"],
      "env": {
        "WALLOS_URL": "${WALLOS_URL}",
        "WALLOS_USERNAME": "testuser",
        "WALLOS_PASSWORD": "testpass123"
      }
    }
  }
}
EOF

echo -e "${GREEN}E2E test environment setup complete!${NC}"
echo "Test directory: ${TEST_DIR}"
echo "Wallos URL: ${WALLOS_URL}"
echo "MCP config: ${MCP_CONFIG_DIR}/wallos-mcp.json"

# Export variables for test scripts
export E2E_TEST_DIR="${TEST_DIR}"
export E2E_WALLOS_URL="${WALLOS_URL}"
export E2E_MCP_CONFIG="${MCP_CONFIG_DIR}/wallos-mcp.json"
export E2E_RESULTS_DIR="${TEST_RESULTS_DIR}"
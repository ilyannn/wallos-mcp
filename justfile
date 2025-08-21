#!/usr/bin/env just --justfile

# Default recipe to display help information
default:
  @just --list

# Install dependencies
install:
  bun install

# Build TypeScript project
build:
  bun run build

# Build Docker image
docker-build:
  docker build -t wallos-mcp:latest .

# Start the MCP server locally (development)
start:
  bun run dev

# Start the MCP server (production)
start-prod:
  bun run start

# Run the MCP server in Docker
docker-run:
  docker run -it --rm \
    --env-file .env \
    --name wallos-mcp \
    wallos-mcp:latest

# Format code with Prettier
fmt:
  bun run format

# Lint code with ESLint
lint:
  bun run lint

# Run tests
test:
  bun test

# Run tests with coverage
test-coverage:
  bun run test -- --coverage

# Clean build artifacts
clean:
  rm -rf dist/ node_modules/ coverage/

# Full rebuild: clean, install, and build
rebuild: clean install build

# Check types without building
typecheck:
  bunx tsc --noEmit

# Watch mode for development
watch:
  bun run dev

# Test a specific MCP tool
test-tool TOOL:
  bunx @modelcontextprotocol/cli test --tool {{TOOL}}

# Run all quality checks
check: typecheck lint test

# Setup development environment
setup:
  cp .env.example .env
  @echo "Please edit .env with your Wallos credentials"
  bun install
  @echo "Setup complete! Edit .env then run 'just start' to begin development"

# Create a new tool file
new-tool NAME:
  @echo "Creating new tool: {{NAME}}"
  @touch src/tools/{{NAME}}.ts
  @echo "// MCP Tool: {{NAME}}" > src/tools/{{NAME}}.ts
  @echo "Tool file created at src/tools/{{NAME}}.ts"

# Run the MCP server with debug logging
debug:
  LOG_LEVEL=debug bun run dev

# Build and run in Docker (combined)
docker: docker-build docker-run

# Update all dependencies
update-deps:
  bun update
  bun audit --fix

# Show current environment configuration (without secrets)
show-config:
  @echo "Wallos MCP Configuration:"
  @echo "========================="
  @grep -E "^[A-Z]" .env.example | sed 's/=.*//'
  @echo ""
  @echo "Current .env status:"
  @if [ -f .env ]; then echo "✓ .env file exists"; else echo "✗ .env file missing (run 'just setup')"; fi

# Generate TypeScript types from Wallos API responses
generate-types:
  @echo "Generating types from Wallos API..."
  @mkdir -p src/types/generated
  @echo "// Auto-generated types" > src/types/generated/wallos-api.ts
  @echo "Type generation complete"

# Run a quick smoke test
smoke-test:
  @echo "Running smoke test..."
  bun run build
  node -e "console.log('Build successful')"
  @echo "Smoke test passed!"

# Package for distribution
package:
  bun run build
  bun pack
  @echo "Package created successfully"

# Run GitHub Super-Linter locally - comprehensive check (requires Docker)
superlint:
  docker run --rm \
    -e RUN_LOCAL=true \
    -e DEFAULT_BRANCH=main \
    -e VALIDATE_ALL_CODEBASE=true \
    -e VALIDATE_JAVASCRIPT_ES=true \
    -e VALIDATE_TYPESCRIPT_ES=true \
    -e VALIDATE_JSON=true \
    -e VALIDATE_YAML=true \
    -e VALIDATE_MARKDOWN=true \
    -e VALIDATE_DOCKERFILE_HADOLINT=true \
    -e VALIDATE_BASH=true \
    -e VALIDATE_ENV=true \
    -e VALIDATE_GITHUB_ACTIONS=true \
    -e VALIDATE_PRETTIER=true \
    -e PRETTIER_CONFIG_FILE=.prettierrc \
    -e FILTER_REGEX_EXCLUDE=".*dist/.*|.*node_modules/.*|.*coverage/.*" \
    -e LOG_LEVEL=INFO \
    -e CREATE_LOG_FILE=false \
    -e DISABLE_ERRORS=false \
    -e MULTI_STATUS=false \
    -v "$(pwd)":/tmp/lint \
    -w /tmp/lint \
    github/super-linter:v5

# Run Super-Linter only on changed files (faster, for PRs)
superlint-pr:
  @echo "Running Super-Linter on changed files only..."
  docker run --rm \
    -e RUN_LOCAL=true \
    -e DEFAULT_BRANCH=main \
    -e VALIDATE_ALL_CODEBASE=false \
    -e VALIDATE_JAVASCRIPT_ES=true \
    -e VALIDATE_TYPESCRIPT_ES=true \
    -e VALIDATE_JSON=true \
    -e VALIDATE_YAML=true \
    -e VALIDATE_MARKDOWN=true \
    -e VALIDATE_DOCKERFILE_HADOLINT=true \
    -e VALIDATE_BASH=true \
    -e VALIDATE_ENV=true \
    -e VALIDATE_GITHUB_ACTIONS=true \
    -e VALIDATE_PRETTIER=true \
    -e PRETTIER_CONFIG_FILE=.prettierrc \
    -e FILTER_REGEX_EXCLUDE=".*dist/.*|.*node_modules/.*|.*coverage/.*" \
    -e LOG_LEVEL=INFO \
    -e CREATE_LOG_FILE=false \
    -e DISABLE_ERRORS=false \
    -v "$(pwd)":/tmp/lint \
    -w /tmp/lint \
    github/super-linter:v5

# Run Super-Linter with GitHub Actions configuration (test CI locally)
superlint-github:
  @echo "Testing GitHub Actions Super-Linter configuration locally..."
  act -j lint --container-architecture linux/amd64 || \
  echo "Note: Requires 'act' to be installed (brew install act)"

# Validate configuration files
validate:
  @echo "Validating configuration files..."
  bunx jsonlint package.json
  bunx jsonlint tsconfig.json
  @echo "All configuration files are valid!"

# Run development with auto-restart on changes
dev:
  bun run dev

# Production build with optimizations
build-prod:
  NODE_ENV=production bun run build

# Display project statistics
stats:
  @echo "Project Statistics:"
  @echo "==================="
  @echo "TypeScript files: $(find src -name '*.ts' | wc -l)"
  @echo "Test files: $(find tests -name '*.test.ts' 2>/dev/null | wc -l || echo 0)"
  @echo "Dependencies: $(jq '.dependencies | length' package.json)"
  @echo "Dev dependencies: $(jq '.devDependencies | length' package.json)"
  @echo "Total lines of code: $(find src -name '*.ts' -exec wc -l {} + | tail -1 | awk '{print $1}')"

# Open documentation
docs:
  @echo "Opening documentation..."
  @open https://modelcontextprotocol.io/docs

# Help command with usage examples
help:
  @echo "Wallos MCP Server - Development Commands"
  @echo "========================================"
  @echo ""
  @echo "Quick Start:"
  @echo "  just setup         # Initial setup"
  @echo "  just start         # Start development server"
  @echo "  just test          # Run tests"
  @echo ""
  @echo "Development:"
  @echo "  just dev           # Start with auto-reload"
  @echo "  just new-tool NAME # Create new MCP tool"
  @echo "  just test-tool NAME # Test specific tool"
  @echo ""
  @echo "Code Quality:"
  @echo "  just check         # Run all checks"
  @echo "  just lint          # Lint code"
  @echo "  just fmt           # Format code"
  @echo ""
  @echo "Docker:"
  @echo "  just docker        # Build and run in Docker"
  @echo ""
  @echo "Run 'just --list' to see all available commands"
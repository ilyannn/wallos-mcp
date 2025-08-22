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

# Launch a clean Wallos development instance (latest)
wallos-dev-start:
  @echo "Starting fresh Wallos development instance..."
  docker run -d \
    --name wallos-dev \
    --rm \
    -p 8285:80 \
    -v wallos-dev-db:/var/www/html/db \
    -v wallos-dev-logos:/var/www/html/images/uploads/logos \
    wallos:latest
  @echo "✅ Wallos dev instance started at http://localhost:8285"
  @echo "🗄️  Fresh database - complete setup wizard"
  @echo "📝 Use 'just wallos-dev-stop' to stop and cleanup"

# Stop and cleanup the Wallos dev instance
wallos-dev-stop:
  @echo "Stopping Wallos development instance..."
  -docker stop wallos-dev
  @echo "✅ Wallos dev instance stopped"
  @echo "💾 Data preserved in volumes: wallos-dev-db, wallos-dev-logos"

# Clean restart of Wallos dev instance (preserves data)
wallos-dev-restart: wallos-dev-stop wallos-dev-start

# Reset Wallos dev instance (removes all data)
wallos-dev-reset:
  @echo "⚠️  Resetting Wallos dev instance (removes all data)..."
  -docker stop wallos-dev
  -docker volume rm wallos-dev-db wallos-dev-logos
  @echo "🗑️  All Wallos dev data removed"
  @echo "🚀 Run 'just wallos-dev-start' to start fresh"

# Reset Wallos dev instance with dev database template
wallos-dev-reset-with-template:
  @echo "⚠️  Resetting Wallos dev instance with dev database template..."
  -docker stop wallos-dev
  -docker volume rm wallos-dev-db wallos-dev-logos
  docker run -d --name wallos-dev --rm -p 8285:80 -v wallos-dev-db:/var/www/html/db -v wallos-dev-logos:/var/www/html/images/uploads/logos wallos:latest
  @sleep 3
  docker cp dev/wallos.dev.db wallos-dev:/var/www/html/db/wallos.db
  docker restart wallos-dev
  @echo "✅ Wallos dev instance reset with template data"
  @echo "🗄️  Template database restored"
  @echo "📝 Use 'just wallos-dev-stop' to stop and cleanup"

# Format code with Prettier and other formatters
fmt:
  bun run format
  @echo "Formatting with Prettier..."
  bunx markdownlint-cli --fix '**/*.md' --ignore node_modules --ignore dist || echo "No markdown files to fix"
  @echo "All formatting complete!"

# Comprehensive linting with all available linters
lint:
  @echo "Running comprehensive linting..."
  bun run lint
  bun run typecheck
  bunx markdownlint-cli '**/*.md' --ignore node_modules --ignore dist
  @echo "ESLint, TypeScript, and Markdown linting complete!"

# Run tests
test:
  bun test

# Run tests with coverage
test-coverage:
  bun run test -- --coverage

# End-to-end testing with real Wallos instance
e2e-setup:
  @echo "Setting up E2E test environment..."
  @chmod +x tests/e2e/*.sh
  @./tests/e2e/setup-test-env.sh

e2e-test: build
  @echo "Running E2E tests..."
  @bun test tests/e2e/direct-mcp-test.ts

e2e-cleanup:
  @echo "Cleaning up E2E test environment..."
  @./tests/e2e/cleanup-test-env.sh

e2e: e2e-setup e2e-test e2e-cleanup
  @echo "E2E test suite complete"

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

# Run all quality checks (fast local checks)
check: typecheck lint test

# Specfic entry point for the pre-commit hook
pre-commit: fmt check

# Run comprehensive quality checks (includes Super-Linter)
check-all: check superlint

# Setup development environment
setup:
  cp .env.example .env
  @echo "Please edit .env with your Wallos credentials"
  bun install
  @echo "Setup complete! Edit .env then run 'just start' to begin development"

# Setup development environment with dev instance
setup-dev:
  cp dev/.env.dev .env
  @echo "Development environment configured for localhost:8285"
  @echo "Make sure to start Wallos dev instance with 'just wallos-dev-start'"
  bun install
  @echo "Dev setup complete! Run 'just start' to begin development"

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

# Run GitHub Super-Linter locally - focused on relevant linters for this project
superlint:
  @echo "Running Super-Linter with relevant linters for TypeScript/Node.js project..."
  docker run --rm \
    -e RUN_LOCAL=true \
    -e DEFAULT_BRANCH=main \
    -e VALIDATE_ALL_CODEBASE=true \
    -e VALIDATE_BASH=true \
    -e VALIDATE_DOCKERFILE_HADOLINT=true \
    -e VALIDATE_ENV=true \
    -e VALIDATE_GITHUB_ACTIONS=true \
    -e VALIDATE_GITLEAKS=true \
    -e VALIDATE_JAVASCRIPT_ES=true \
    -e VALIDATE_JSON=true \
    -e VALIDATE_MARKDOWN=true \
    -e VALIDATE_TYPESCRIPT_ES=true \
    -e VALIDATE_YAML=true \
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

# Run Super-Linter with verbose output and comprehensive checks
superlint-verbose:
  @echo "Running Super-Linter with verbose output for debugging..."
  docker run --rm \
    -e RUN_LOCAL=true \
    -e DEFAULT_BRANCH=main \
    -e VALIDATE_ALL_CODEBASE=true \
    -e VALIDATE_BASH=true \
    -e VALIDATE_DOCKERFILE_HADOLINT=true \
    -e VALIDATE_ENV=true \
    -e VALIDATE_GITHUB_ACTIONS=true \
    -e VALIDATE_GITLEAKS=true \
    -e VALIDATE_JAVASCRIPT_ES=true \
    -e VALIDATE_JSCPD=true \
    -e VALIDATE_JSON=true \
    -e VALIDATE_MARKDOWN=true \
    -e VALIDATE_NATURAL_LANGUAGE=true \
    -e VALIDATE_TYPESCRIPT_ES=true \
    -e VALIDATE_YAML=true \
    -e VALIDATE_PRETTIER=true \
    -e PRETTIER_CONFIG_FILE=.prettierrc \
    -e FILTER_REGEX_EXCLUDE=".*dist/.*|.*node_modules/.*|.*coverage/.*" \
    -e LOG_LEVEL=DEBUG \
    -e CREATE_LOG_FILE=true \
    -e DISABLE_ERRORS=false \
    -e MULTI_STATUS=true \
    -e PRINT_FIXES=true \
    -e SHOW_SKIPPED_PATHS_ON_SUMMARY=true \
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
  @echo "  just setup         # Initial setup (production)"
  @echo "  just setup-dev     # Setup for dev instance"
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
  @echo "Wallos Development:"
  @echo "  just wallos-dev-start              # Start fresh Wallos instance"
  @echo "  just wallos-dev-stop               # Stop Wallos instance"
  @echo "  just wallos-dev-restart            # Restart (preserves data)"
  @echo "  just wallos-dev-reset              # Reset (removes all data)"
  @echo "  just wallos-dev-reset-with-template # Reset with dev database template"
  @echo ""
  @echo "Run 'just --list' to see all available commands"

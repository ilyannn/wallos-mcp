# End-to-End Testing Suite

This directory contains comprehensive end-to-end tests for the Wallos MCP server
that test the complete integration with a real Wallos instance.

## Architecture

The E2E test suite consists of:

1. **Docker Compose Setup** (`docker-compose.test.yml`)
   - Spins up an isolated Wallos instance on port 18282
   - Uses temporary volumes for test data isolation
   - Includes health checks for readiness

2. **Test Environment Scripts**
   - `setup-test-env.sh` - Initializes Wallos and MCP configuration
   - `cleanup-test-env.sh` - Tears down test environment
   - `e2e-test-runner.sh` - Orchestrates the complete test flow

3. **Test Implementations**
   - `direct-mcp-test.ts` - Direct MCP server integration tests
   - `run-claude-tests.ts` - Claude CLI interaction tests (future)

## Running E2E Tests

### Quick Start

```bash
# Run complete E2E test suite
just e2e

# Or run steps individually:
just e2e-setup    # Start Wallos instance
just e2e-test     # Run tests
just e2e-cleanup  # Clean up
```

### Direct Test Execution

```bash
# Start Wallos test instance
./tests/e2e/setup-test-env.sh

# Run the tests
bun test tests/e2e/direct-mcp-test.ts

# Clean up
./tests/e2e/cleanup-test-env.sh
```

## Test Coverage

### Auto-Renew Default Behavior

The E2E tests specifically verify:

1. **Default to true** - Subscriptions created without `auto_renew` default to
   `true`
2. **Explicit false** - Setting `auto_renew: false` is respected
3. **Explicit true** - Setting `auto_renew: true` works correctly

### Additional Tests

- Master data retrieval from real Wallos instance
- Subscription listing with filters
- Category and payment method creation
- Full subscription lifecycle

## Requirements

- Docker and Docker Compose
- Bun runtime
- Port 18282 available for Wallos test instance

## Test Data

The tests create temporary subscriptions with unique names (using timestamps)
to avoid conflicts. All test data is isolated in Docker volumes that are
cleaned up after tests complete.

## Environment Variables

The test suite uses these environment variables (set automatically):

- `E2E_TEST_DIR` - Temporary directory for test artifacts
- `E2E_WALLOS_URL` - URL of test Wallos instance (<http://localhost:18282>)
- `E2E_MCP_CONFIG` - Path to MCP configuration file
- `E2E_RESULTS_DIR` - Directory for test results

## Troubleshooting

### Wallos Not Starting

If Wallos fails to start:

```bash
# Check Docker logs
docker logs wallos-e2e-test

# Verify port availability
lsof -i :18282

# Manual cleanup if needed
docker-compose -f tests/e2e/docker-compose.test.yml down -v
```

### Tests Skipping

Tests will skip if Wallos is not running. Ensure:

1. Docker is running
2. Port 18282 is available
3. Run `just e2e-setup` first

### Clean State

For a completely clean test:

```bash
# Remove all test volumes
docker volume prune -f --filter "label=com.docker.compose.project=wallos-e2e-test"

# Start fresh
just e2e
```

## CI/CD Integration

These E2E tests can be integrated into CI/CD pipelines:

```yaml
# GitHub Actions example
- name: Run E2E Tests
  run: |
    just e2e-setup
    just e2e-test
  env:
    E2E_WALLOS_URL: http://localhost:18282

- name: Cleanup
  if: always()
  run: just e2e-cleanup
```

## Future Enhancements

- [ ] Claude CLI interaction tests
- [ ] Performance benchmarks
- [ ] Multi-user scenarios
- [ ] Concurrent subscription operations
- [ ] Error recovery testing
- [ ] Network failure simulation

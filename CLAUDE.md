# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with the Wallos MCP server codebase.

## Project Overview

Wallos MCP Server is a Model Context Protocol server that enables Claude Desktop to interact with Wallos subscription management instances. This TypeScript project uses Bun runtime and provides comprehensive tooling for development and deployment.

## Development Commands

Use the `just` command runner for all development tasks:

### Core Development

- `just setup` - Initial project setup (install deps, create .env)
- `just start` - Start development server with auto-reload
- `just dev` - Alias for start
- `just build` - Build TypeScript to JavaScript
- `just test` - Run test suite
- `just check` - Run all quality checks (typecheck, lint, test)

### Code Quality

- `just lint` - Comprehensive linting (ESLint + TypeScript + Markdown)
- `just fmt` - Format code (Prettier + markdownlint)
- `just typecheck` - TypeScript type checking without building
- `just superlint` - Fast Super Linter with project-relevant checks
- `just superlint-verbose` - Comprehensive Super Linter with debug output

### Docker Operations

- `just docker-build` - Build Docker image
- `just docker-run` - Run MCP server in Docker
- `just docker` - Combined build and run

### Testing & Debugging

- `just test-tool TOOL` - Test specific MCP tool
- `just debug` - Start with debug logging
- `just smoke-test` - Quick build verification

### Utilities

- `just clean` - Remove build artifacts
- `just rebuild` - Full clean, install, build cycle
- `just update-deps` - Update and audit dependencies
- `just stats` - Show project statistics

## Architecture

### Tech Stack

- **Runtime**: Bun (fast JavaScript runtime)
- **Language**: TypeScript
- **Framework**: Model Context Protocol SDK
- **HTTP Client**: axios with tough-cookie for session management
- **Testing**: Bun test framework
- **Linting**: ESLint + Prettier + markdownlint
- **CI/CD**: GitHub Actions with multi-platform Docker builds

### Project Structure

```
src/
├── index.ts              # MCP server entry point
├── wallos-client.ts      # Wallos API client with session management
├── tools/               # MCP tool implementations
│   ├── subscriptions.ts # Subscription management tools
│   ├── categories.ts    # Category tools
│   ├── currencies.ts    # Currency tools
│   ├── payments.ts      # Payment method tools
│   ├── household.ts     # Household tools
│   └── analytics.ts     # Statistics and insights
├── types/               # TypeScript type definitions
│   ├── index.ts         # Main types export
│   ├── wallos.ts        # Wallos API types
│   └── mcp.ts           # MCP-specific types
└── utils/               # Utility functions
    ├── session.ts       # Session management
    ├── logger.ts        # Logging utilities
    └── validators.ts    # Input validation
```

## CI/CD Pipeline

### GitHub Actions Workflows

1. **Code Quality & Linting** (`.github/workflows/lint.yml`)
   - Steps: Install → Typecheck → Lint → Format Check → Security Audit
   - Fast feedback on code quality issues
   - Triggers: Push to main, PRs, manual dispatch

2. **Test & Build** (`.github/workflows/test.yml`)
   - Matrix testing: Node.js 18, 20, 22 (compatibility)
   - Steps: Install → Test → Build → Verify
   - Triggers: Push to main, PRs, manual dispatch

3. **Docker Build & Test** (`.github/workflows/docker.yml`)
   - Multi-platform builds (linux/amd64, linux/arm64)
   - Security scanning with Trivy
   - Integration testing with resource limits
   - Automatic publishing to GitHub Container Registry

4. **Super Linter** (`.github/workflows/superlint.yml`)
   - Project-relevant linters: Bash, Dockerfile, Env, GitHub Actions, GitLeaks, JavaScript/TypeScript, JSON, Markdown, YAML, Prettier
   - Smart validation: Full codebase on main, changed files on PRs
   - Consistent with local `just superlint` configuration

### Quality Assurance Strategy

**Local Development**:

```bash
just lint    # Fast comprehensive linting
just fmt     # Auto-formatting
just check   # All quality checks before commit
```

**CI/CD**:

- Automated quality checks on every push and PR
- Security vulnerability scanning for Docker images
- Multi-Node.js version compatibility testing
- Consistent code formatting and linting enforcement

## Configuration Files

- `package.json` - Node.js dependencies and scripts
- `tsconfig.json` - TypeScript compiler configuration
- `justfile` - Development task runner
- `.eslintrc.json` - ESLint configuration
- `.prettierrc` - Prettier formatting rules
- `Dockerfile` - Multi-stage Docker build with Bun
- `.env.example` - Environment variables template

## Environment Variables

```bash
# Required for MCP server
WALLOS_URL=http://localhost:8282
WALLOS_USERNAME=your_username
WALLOS_PASSWORD=your_password

# Optional
LOG_LEVEL=info
SESSION_TIMEOUT=3600000
```

## Development Workflow

1. **Setup**: `just setup` (one-time)
2. **Development**: `just start` and edit code
3. **Quality**: Run `just lint` and `just fmt` before commits
4. **Testing**: `just check` to verify everything works
5. **Docker**: `just docker` to test containerized version

## Security Best Practices

- Credentials stored in environment variables only
- Session-based authentication with Wallos
- Input validation on all tool parameters
- No direct database access (API-only communication)
- Non-root Docker container execution
- Security scanning in CI/CD pipeline

## Troubleshooting

### Common Issues

**Super Linter Errors**: Use `just superlint-verbose` for detailed debugging

**TypeScript Errors**: Run `just typecheck` for detailed type checking

**Docker Build Issues**: Check `just superlint` for Dockerfile validation

**Permission Issues**: Ensure environment variables are properly configured

### Getting Help

- Check GitHub Actions logs for CI/CD issues
- Review `IMPLEMENTATION_NOTES.md` for detailed development guidance
- Use `just --list` to see all available commands

## Related Projects

- **Wallos**: Main subscription management application at `/Users/in/Code/Wallos`
- **MCP SDK**: Model Context Protocol at https://modelcontextprotocol.io

## Notes for Claude Code

- Always run `just lint` before suggesting code changes
- Use `just superlint` to check comprehensive code quality
- Prefer editing existing files over creating new ones
- Follow the established TypeScript patterns in the codebase
- Test changes with `just check` before committing

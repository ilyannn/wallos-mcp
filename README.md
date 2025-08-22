# Wallos MCP Server

![Wallos MCP Server](.github/social-image.png)

An MCP (Model Context Protocol) server that enables Claude Desktop to
interact with your Wallos subscription management instance.

## Overview

This MCP server provides tools for managing subscriptions, categories,
currencies, payment methods, and household members in Wallos through Claude
Desktop. It acts as a bridge between Claude and your self-hosted Wallos
instance.

## Features

- 📊 View and manage subscriptions
- 📁 Organize with categories
- 💱 Handle multiple currencies
- 💳 Manage payment methods
- 👥 Configure household members
- 📈 Access statistics and insights
- 🔔 Check upcoming payments

## Prerequisites

- Wallos instance (self-hosted or Docker)
- Bun runtime (<https://bun.sh>)
- Claude Desktop
- Wallos user credentials

## Installation

1. Clone this repository:

```bash
git clone https://github.com/yourusername/wallos-mcp.git
cd wallos-mcp
```

1. Install dependencies:

```bash
bun install
```

1. Configure environment:

```bash
cp .env.example .env
# Edit .env with your Wallos instance details
```

1. Build the project:

```bash
bun run build
```

1. Add to Claude Desktop config:

```json
{
  "mcpServers": {
    "wallos": {
      "command": "bun",
      "args": ["/path/to/wallos-mcp/dist/index.js"],
      "env": {
        "WALLOS_URL": "http://localhost:8282",
        "WALLOS_USERNAME": "your_username",
        "WALLOS_PASSWORD": "your_password"
      }
    }
  }
}
```

## Available Tools

### create_subscription

Create a new subscription with automatic entity creation. This powerful tool
handles all the complexity of creating related entities automatically.

**Features:**

- 🌍 **Currency by Code**: Specify currencies using codes (USD, EUR, GBP,
  etc.) - automatically creates if doesn't exist
- 📅 **Flexible Frequency**: Natural language billing periods ('daily',
  'weekly', 'monthly', 'quarterly', 'bi-weekly', '3 months')
- 🏷️ **Smart Entity Creation**: Automatically creates missing categories,
  payment methods, and household members
- 👥 **Payer Management**: Specify payer by name with optional email -
  creates household member if needed
- 📆 **Intelligent Date Handling**: Smart calculation of next payment date,
  always ensuring it's in the future

**Parameters:**

- `name` (required): Subscription service name
- `price` (required): Subscription price amount
- `currency_code`: Currency code (e.g., USD, EUR) - creates if needed
- `currency_id`: Use existing currency ID (alternative to currency_code)
- `billing_period`: Flexible period ('monthly', 'quarterly', '2 weeks', etc.)
- `billing_frequency`: Multiplier for billing period (default: 1)
- `category_name`: Category name (creates if needed, prioritized over
  category_id)
- `category_id`: Use existing category ID
- `payment_method_name`: Payment method name (creates if needed)
- `payment_method_id`: Use existing payment method ID
- `payer_user_name`: Household member name (creates if needed)
- `payer_user_email`: Email for new household member
- `payer_user_id`: Use existing household member ID
- `start_date`: Subscription start date (YYYY-MM-DD)
- `next_payment`: Next payment date (auto-calculated if not provided)
- `auto_renew`: Whether subscription auto-renews (default: true)
- `notes`: Additional notes (supports multiline)
- `url`: Service URL
- `notify`: Enable renewal notifications
- `notify_days_before`: Days before renewal to notify

**Example Usage:**

```json
{
  "name": "Netflix Premium",
  "price": 15.99,
  "currency_code": "USD",
  "billing_period": "monthly",
  "category_name": "Entertainment",
  "payment_method_name": "Credit Card",
  "payer_user_name": "John Smith",
  "payer_user_email": "john@family.com",
  "start_date": "2024-01-15",
  "auto_renew": true,
  "notify": true,
  "notify_days_before": 3,
  "notes": "Premium family plan\n4K streaming\n4 simultaneous screens",
  "url": "https://netflix.com"
}
```

### list_subscriptions

View all subscriptions with comprehensive filtering options.

**Parameters:**

- `member_ids`: Comma-separated member IDs (e.g., "1,3,5")
- `category_ids`: Comma-separated category IDs
- `payment_method_ids`: Comma-separated payment method IDs
- `state`: Filter by state ('active' or 'inactive')
- `sort`: Sort field (name, id, next_payment, price, etc.)
- `disabled_to_bottom`: Sort inactive subscriptions to bottom
- `convert_currency`: Convert prices to main currency

### get_master_data

Retrieve all master data (categories, currencies, payment methods, household
members) in a single call.

### Category Management Tools

- `add_category`: Create a new category
- `update_category`: Update category name
- `delete_category`: Remove a category (unless it's the default)

## Implementation Plan

### Phase 1: Core Infrastructure ✅

- [x] Repository setup
- [x] TypeScript configuration
- [x] MCP SDK integration setup
- [x] Complete CI/CD pipeline with GitHub Actions
- [x] Docker build and security scanning
- [x] Comprehensive development tooling (justfile)
- [x] Code quality tools (Super Linter, ESLint, Prettier)
- [ ] Wallos API client with session management
- [ ] Error handling and logging

### Phase 2: Subscription Management

- [x] `list_subscriptions` - View all subscriptions with filters
- [x] `create_subscription` - Create new subscription with automatic entity creation
- [ ] `edit_subscription` - Modify existing subscription
- [ ] `delete_subscription` - Remove subscription
- [ ] `get_subscription` - Detailed subscription info
- [ ] `clone_subscription` - Duplicate subscription
- [ ] `toggle_subscription` - Enable/disable subscription

### Phase 3: Master Data Tools

- [ ] `manage_categories` - CRUD operations for categories
- [ ] `manage_payment_methods` - Add/edit/remove payment methods
- [ ] `manage_currencies` - Currency management with exchange rates
- [ ] `manage_household` - Household member operations

### Phase 4: Analytics & Insights

- [ ] `get_statistics` - Spending statistics and trends
- [ ] `upcoming_payments` - Next payment schedule
- [ ] `spending_by_category` - Category breakdown
- [ ] `get_budget_status` - Budget vs actual spending
- [ ] `export_data` - Export subscriptions to CSV/JSON

### Phase 5: Advanced Features

- [ ] `search_logos` - Find logos for subscriptions
- [ ] `bulk_operations` - Mass update subscriptions
- [ ] `notifications_status` - Check notification settings
- [ ] `calculate_savings` - Identify savings opportunities
- [ ] `sync_exchange_rates` - Update currency rates

## Architecture

### Tech Stack

- **Language**: TypeScript
- **Runtime**: Node.js
- **MCP SDK**: @modelcontextprotocol/sdk
- **HTTP Client**: axios
- **Session Management**: tough-cookie
- **Environment**: dotenv

### Project Structure

```text
wallos-mcp/
├── src/
│   ├── index.ts                 # MCP server entry point
│   ├── wallos-client.ts         # Wallos API wrapper
│   ├── tools/                   # MCP tool implementations
│   │   ├── subscriptions.ts     # Subscription management tools
│   │   ├── categories.ts        # Category tools
│   │   ├── currencies.ts        # Currency tools
│   │   ├── payments.ts          # Payment method tools
│   │   ├── household.ts         # Household tools
│   │   └── analytics.ts         # Statistics and insights
│   ├── types/                   # TypeScript type definitions
│   │   ├── index.ts             # Main types export
│   │   ├── wallos.ts            # Wallos API types
│   │   └── mcp.ts               # MCP-specific types
│   └── utils/                   # Utility functions
│       ├── session.ts           # Session management
│       ├── logger.ts            # Logging utilities
│       └── validators.ts        # Input validation
├── tests/                       # Test files
├── dist/                        # Compiled JavaScript
├── .env.example                 # Environment template
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

### API Communication Flow

1. **Authentication**:
   - MCP server starts → Creates session with Wallos
   - Stores session cookie for subsequent requests
   - Handles session expiry and renewal

2. **Request Flow**:

   ```text
   Claude Desktop → MCP Tool → Wallos Client → Wallos API → SQLite DB
                          ↓                           ↓
                    Response ← JSON Response ← PHP Endpoint
   ```

3. **Session Management**:
   - Persistent session across tool calls
   - Automatic re-authentication on expiry
   - Secure credential storage in environment

## Security Considerations

- Credentials stored in environment variables
- Session-based authentication with Wallos
- Input validation on all tool parameters
- No direct database access (API-only)
- Respects Wallos user permissions

## CI/CD Pipeline

### GitHub Actions Workflows

- **Code Quality & Linting**: TypeScript checking, ESLint, Prettier
  formatting, security audits
- **Test & Build**: Unit testing and build verification with Node.js
  compatibility (18, 20, 22)
- **Docker Build**: Multi-platform builds with security scanning
- **Super Linter**: Comprehensive code quality checks with 10+ linters
- **Automatic Publishing**: Docker images to GitHub Container Registry

### Quality Assurance

```bash
# Local development workflow
just lint     # ESLint + TypeScript + Markdown linting
just fmt      # Prettier + markdownlint formatting
just superlint # Comprehensive Super Linter (fast)
just superlint-verbose # Detailed debugging output
```

All workflows run automatically on pushes and pull requests with smart
validation modes.

## Development

### Quick Start with Just

```bash
# Initial setup (installs deps, creates .env)
just setup

# Start development server
just start

# Run all quality checks
just check

# Build and test
just build && just test
```

### Manual Setup

```bash
# Install dependencies
bun install

# Run in development mode
bun run dev

# Run tests
bun test

# Build for production
bun run build
```

### Testing Tools Locally

```bash
# Start local MCP server
bun run start:local

# Test with MCP client
bunx @modelcontextprotocol/cli test
```

## Tool Reference

For detailed information about available tools, see the
[Available Tools](#available-tools) section above.

### Currently Implemented Tools

#### Subscription Management

- `create_subscription` - Create new subscription with auto entity creation
- `list_subscriptions` - List subscriptions with filters

#### Master Data

- `get_master_data` - Get all categories, currencies, payment methods, household

#### Category Management

- `add_category` - Add new category
- `update_category` - Update category name
- `delete_category` - Delete category (except default)

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Roadmap

- [ ] Batch operations support
- [ ] Caching layer for frequently accessed data
- [ ] WebSocket support for real-time updates
- [ ] Multi-user household support
- [ ] Backup and restore tools
- [ ] Integration with calendar services
- [ ] Natural language subscription entry

## License

MIT License - See LICENSE file for details

## Support

- [Wallos Documentation](https://github.com/ellite/Wallos)
- [MCP Documentation](https://modelcontextprotocol.io)
- [Issues](https://github.com/yourusername/wallos-mcp/issues)

## Acknowledgments

- [Wallos](https://github.com/ellite/Wallos) by Ellite
- [Model Context Protocol](https://modelcontextprotocol.io) by Anthropic

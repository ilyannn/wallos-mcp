# Wallos MCP Server

An MCP (Model Context Protocol) server that enables Claude Desktop to interact with your Wallos subscription management instance.

## Overview

This MCP server provides tools for managing subscriptions, categories, currencies, payment methods, and household members in Wallos through Claude Desktop. It acts as a bridge between Claude and your self-hosted Wallos instance.

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
- Bun runtime (https://bun.sh)
- Claude Desktop
- Wallos user credentials

## Installation

1. Clone this repository:

```bash
git clone https://github.com/yourusername/wallos-mcp.git
cd wallos-mcp
```

2. Install dependencies:

```bash
bun install
```

3. Configure environment:

```bash
cp .env.example .env
# Edit .env with your Wallos instance details
```

4. Build the project:

```bash
bun run build
```

5. Add to Claude Desktop config:

```json
{
  "mcpServers": {
    "wallos": {
      "command": "node",
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

## Implementation Plan

### Phase 1: Core Infrastructure ✅

- [x] Repository setup
- [ ] TypeScript configuration
- [ ] MCP SDK integration
- [ ] Wallos API client with session management
- [ ] Error handling and logging

### Phase 2: Subscription Management

- [ ] `list_subscriptions` - View all subscriptions with filters
- [ ] `add_subscription` - Create new subscription
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

```
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

   ```
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

### Subscription Tools

#### list_subscriptions

Lists all subscriptions with optional filters.

```typescript
Parameters:
- active_only?: boolean
- category_id?: number
- sort_by?: 'name' | 'price' | 'next_payment'
```

#### add_subscription

Creates a new subscription.

```typescript
Parameters:
- name: string
- price: number
- currency_id: number
- frequency: number
- cycle: 'monthly' | 'yearly' | 'weekly'
- category_id: number
- payment_method_id: number
- start_date: string
- notes?: string
- url?: string
```

#### edit_subscription

Updates an existing subscription.

```typescript
Parameters:
- id: number
- updates: Partial<Subscription>
```

### Category Tools

#### manage_categories

Performs CRUD operations on categories.

```typescript
Parameters:
- action: 'list' | 'add' | 'edit' | 'delete' | 'sort'
- name?: string
- category_id?: number
- order?: number[]
```

### Currency Tools

#### manage_currencies

Manages currencies and exchange rates.

```typescript
Parameters:
- action: 'list' | 'add' | 'edit' | 'delete' | 'update_rates'
- currency?: Currency
- currency_id?: number
```

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

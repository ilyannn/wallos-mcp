# Wallos MCP Implementation Notes

## Session Pickup Guide

This document contains key information for continuing development of the Wallos MCP server in a new session.

## Current Status

- ✅ Repository created at `/Users/in/Code/wallos-mcp`
- ✅ Basic project structure established
- ✅ package.json with dependencies configured
- ✅ TypeScript configuration ready
- ✅ Comprehensive README with implementation plan
- ⏳ Next: Implement core MCP server infrastructure

## Key Wallos API Insights

### Authentication

- Session-based authentication using PHP sessions
- Login endpoint likely at `/login.php` or similar
- Session cookie required for all API calls
- User ID stored in `$_SESSION['userId']`

### API Endpoints Structure

All endpoints follow pattern: `/endpoints/{domain}/{action}.php`

Key domains:

- `subscription/` - Individual subscription operations
- `subscriptions/` - Bulk operations
- `categories/` - Category management
- `currencies/` - Currency and exchange rates
- `payments/` - Payment methods
- `household/` - Family members
- `settings/` - User preferences
- `admin/` - Administrative functions

### Request/Response Format

- GET parameters for most operations
- JSON responses
- Actions specified via `?action=` parameter
- User isolation via `user_id` in database

### Important Implementation Considerations

1. **Session Management**
   - Need to POST to login endpoint first
   - Store and maintain session cookie
   - Handle session expiry gracefully

2. **Data Validation**
   - All IDs are integers
   - Dates in YYYY-MM-DD format
   - Some entities have usage protection (can't delete if in use)

3. **Master Data IDs**
   - Category ID 1 is protected (default)
   - Payment method ID 1 is likely default
   - User ID 1 might be admin/first user

4. **File Uploads**
   - Logo upload supports URL fetch or file upload
   - Avatars for household members
   - Images stored in `/images/uploads/logos/`

## Next Steps for Implementation

### Step 1: Create Basic MCP Server

```typescript
// src/index.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { WallosClient } from './wallos-client.js';

// Initialize server
// Set up tools
// Handle authentication
```

### Step 2: Implement Wallos Client

```typescript
// src/wallos-client.ts
class WallosClient {
  - constructor with URL, credentials
  - login() method
  - Session cookie management
  - Generic request method
  - Specific API method wrappers
}
```

### Step 3: Create First Tool

Start with `list_subscriptions` as it's read-only and safe:

```typescript
// src/tools/subscriptions.ts
- Define tool schema
- Implement handler
- Format response for Claude
```

## Testing Strategy

1. Test authentication separately first
2. Use curl to verify Wallos endpoints
3. Implement minimal MCP server with one tool
4. Test with MCP CLI before Claude Desktop
5. Add tools incrementally

## Security Notes

- Never log passwords or session cookies
- Validate all inputs before sending to Wallos
- Use HTTPS in production
- Consider rate limiting
- Implement proper error messages without exposing internals

## Common Wallos Response Patterns

Success:

```json
{
  "success": true,
  "message": "Operation completed",
  "id": 123 // For create operations
}
```

Error:

```json
{
  "success": false,
  "errorMessage": "Specific error message"
}
```

## Development Commands

```bash
# Install dependencies
cd /Users/in/Code/wallos-mcp
bun install

# Start development
bun run dev

# Build
bun run build

# Test single tool
bunx @modelcontextprotocol/cli test --tool list_subscriptions
```

## Session Handoff Checklist

When picking up in a new session:

1. Navigate to `/Users/in/Code/wallos-mcp`
2. Review this document
3. Check Wallos instance is running
4. Install bun dependencies if needed
5. Continue from "Next Steps for Implementation"

## Wallos Instance Details

- Default port: 8282
- Default path: http://localhost:8282
- Database: SQLite at `db/wallos.db`
- Session timeout: Configurable
- API pattern: RESTful with GET parameters

## Resources

- Wallos source: `/Users/in/Code/Wallos`
- MCP docs: https://modelcontextprotocol.io
- Wallos endpoints: `/Users/in/Code/Wallos/endpoints/`

---

Last updated: 2025-08-21
Ready for implementation phase!

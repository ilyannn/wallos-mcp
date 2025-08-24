# Read-Only API Implementation Plan for Wallos MCP Server

## Overview

This document outlines a comprehensive plan to implement all read-only API endpoints from Wallos as MCP tools, providing Claude Desktop with extensive visibility into subscription management data.

## Identified Read-Only Endpoints

Based on the Wallos API documentation analysis, the following read-only endpoints are available:

### 1. Core Data Retrieval

- ✅ `GET /api/subscriptions/get_subscriptions.php` - **Already implemented** as `list_subscriptions`
- ✅ `GET /api/categories/get_categories.php` - **Partially implemented** in `get_master_data`
- ✅ `GET /api/currencies/get_currencies.php` - **Partially implemented** in `get_master_data`
- ✅ `GET /api/payment_methods/get_payment_methods.php` - **Partially implemented** in `get_master_data`
- ✅ `GET /api/household/get_household.php` - **Partially implemented** in `get_master_data`

### 2. User & Settings

- ⏳ `GET /api/users/get_user.php` - User profile information
- ⏳ `GET /api/settings/get_settings.php` - Display and theme settings
- ⏳ `GET /api/notifications/get_notification_settings.php` - Notification configuration

### 3. Financial Analytics

- ⏳ `GET /api/subscriptions/get_monthly_cost.php` - Monthly cost calculation
- ⏳ `GET /api/subscriptions/get_ical_feed.php` - Calendar export

### 4. System Information

- ⏳ `GET /api/status/version.php` - Application version
- ⏳ `GET /api/fixer/get_fixer.php` - Currency exchange settings

### 5. Admin Functions (Conditional)

- ⏳ `GET /api/admin/get_admin_settings.php` - Admin settings (requires admin user)
- ⏳ `GET /api/admin/get_oidc_settings.php` - OIDC/OAuth configuration (requires admin user)

## Implementation Priority

### Phase 1: Core Analytics Tools (High Priority)

These tools provide immediate value for subscription management insights.

#### 1.1 `get_monthly_cost`

**Purpose**: Calculate total spending for any month
**Parameters**:

- `month` (required): 1-12
- `year` (required): e.g., 2025
  **Returns**: Total cost in main currency with localized formatting

#### 1.2 `get_upcoming_payments`

**Purpose**: View payment schedule
**Note**: Needs custom implementation using subscription data
**Parameters**:

- `days_ahead` (optional): Number of days to look ahead (default: 30)
- `convert_currency` (optional): Convert to main currency
  **Returns**: List of upcoming payments sorted by date

#### 1.3 `get_spending_by_category`

**Purpose**: Analyze spending breakdown
**Note**: Needs custom implementation aggregating subscription data
**Parameters**:

- `month` (optional): Specific month or current
- `year` (optional): Specific year or current
- `convert_currency` (optional): Convert to main currency
  **Returns**: Spending per category with percentages

### Phase 2: User Configuration Tools (Medium Priority)

Understanding user preferences and settings.

#### 2.1 `get_user_profile`

**Purpose**: Retrieve authenticated user information
**Returns**: Username, email, language, budget, avatar, TOTP status

#### 2.2 `get_user_settings`

**Purpose**: Get display preferences
**Returns**: Theme settings, currency conversion preferences, UI customization

#### 2.3 `get_notification_settings`

**Purpose**: View all notification configurations
**Returns**: Email, Discord, Telegram, Gotify, Ntfy, Pushover, Webhook settings

### Phase 3: Export & Integration Tools (Medium Priority)

#### 3.1 `export_to_calendar`

**Purpose**: Generate iCalendar feed for subscriptions
**Parameters**:

- `convert_currency` (optional): Include converted prices
  **Returns**: iCal format data or URL

#### 3.2 `export_subscriptions`

**Purpose**: Export subscription data in various formats
**Note**: Custom implementation needed
**Parameters**:

- `format`: 'json', 'csv', 'markdown'
- `include_inactive` (optional): Include cancelled subscriptions
  **Returns**: Formatted data for external use

### Phase 4: System & Advanced Tools (Low Priority)

#### 4.1 `get_system_info`

**Purpose**: Application version and status
**Returns**: Version number, update availability

#### 4.2 `get_currency_settings`

**Purpose**: View exchange rate configuration
**Returns**: Fixer API settings, provider information

#### 4.3 `get_admin_settings` (Conditional)

**Purpose**: View admin configuration
**Note**: Only available for admin users (ID=1)
**Returns**: Registration settings, SMTP config, server settings

## Implementation Strategy

### 1. Tool Structure Template

```typescript
// src/tools/analytics.ts
export const getMonthlyPriceTools = {
  get_monthly_cost: {
    description: 'Calculate total subscription cost for a specific month',
    parameters: {
      month: { type: 'number', required: true, min: 1, max: 12 },
      year: { type: 'number', required: true, min: 2000, max: 2100 },
    },
    handler: async (params, wallosClient) => {
      const response = await wallosClient.getMonthlyPrice(params.month, params.year);
      return {
        month: `${getMonthName(params.month)} ${params.year}`,
        total_cost: response.monthly_cost,
        formatted_cost: response.localized_monthly_cost,
        currency: response.currency_code,
        warnings: response.notes,
      };
    },
  },
};
```

### 2. Client Method Implementation

```typescript
// src/wallos-client.ts
async getMonthlyPrice(month: number, year: number) {
  return this.request('/api/subscriptions/get_monthly_cost.php', {
    month,
    year
  });
}
```

### 3. Aggregation Tools

For tools that don't have direct API endpoints, implement client-side aggregation:

```typescript
// src/tools/analytics.ts
export const getUpcomingPayments = {
  handler: async (params, wallosClient) => {
    const subscriptions = await wallosClient.getSubscriptions();
    const upcoming = subscriptions
      .filter((sub) => sub.auto_renew && !sub.inactive)
      .map((sub) => ({
        name: sub.name,
        next_payment: sub.next_payment,
        price: sub.price,
        days_until: calculateDaysUntil(sub.next_payment),
      }))
      .filter((sub) => sub.days_until <= (params.days_ahead || 30))
      .sort((a, b) => a.days_until - b.days_until);

    return { upcoming_payments: upcoming };
  },
};
```

## Testing Strategy

### 1. Unit Tests

```typescript
// tests/tools/analytics.test.ts
import { test, expect } from 'bun:test';

test('get_monthly_cost calculates correctly', async () => {
  const result = await tool.handler({ month: 1, year: 2025 }, mockClient);
  expect(result.total_cost).toBeDefined();
  expect(result.currency).toBe('EUR');
});
```

### 2. Integration Tests

- Test with live Wallos instance
- Verify currency conversion
- Check date calculations
- Validate aggregation accuracy

### 3. Manual Testing Checklist

- [ ] Test each tool with valid parameters
- [ ] Test error handling with invalid parameters
- [ ] Verify currency conversion works
- [ ] Check date-based filtering
- [ ] Validate admin-only tools restriction

## Error Handling

### Standard Error Responses

```typescript
try {
  const result = await wallosClient.getMonthlyPrice(month, year);
  return formatSuccess(result);
} catch (error) {
  if (error.code === 'INVALID_DATE') {
    return { error: 'Invalid month or year specified' };
  }
  if (error.code === 'NO_DATA') {
    return { error: 'No subscription data found for this period' };
  }
  throw error; // Unexpected errors
}
```

## Documentation Updates

### 1. README.md Additions

- Add new tools to "Available Tools" section
- Include example usage for each tool
- Document parameters and return values

### 2. Tool Descriptions

Each tool should have clear, user-friendly descriptions:

```typescript
description: 'Calculate your total subscription spending for any month, with automatic currency conversion to your main currency';
```

### 3. Claude Prompts

Suggest natural language queries:

- "How much am I spending this month on subscriptions?"
- "Show me my upcoming payments for the next week"
- "What's my spending breakdown by category?"
- "Export my subscriptions to a calendar"

## Implementation Timeline

### Week 1

- [ ] Implement Phase 1 analytics tools
- [ ] Add corresponding client methods
- [ ] Write unit tests

### Week 2

- [ ] Implement Phase 2 user configuration tools
- [ ] Add export functionality
- [ ] Integration testing

### Week 3

- [ ] Implement Phase 3 & 4 tools
- [ ] Complete documentation
- [ ] End-to-end testing

## Success Metrics

### Functionality

- All read-only endpoints accessible via MCP tools
- Accurate data aggregation and calculations
- Proper currency conversion
- Correct date handling

### User Experience

- Intuitive tool names and descriptions
- Clear error messages
- Fast response times (<500ms)
- Helpful example outputs

### Code Quality

- 100% TypeScript type coverage
- Comprehensive test coverage (>80%)
- Clean lint and format checks
- Passing CI/CD pipeline

## Future Enhancements

### 1. Caching Layer

- Cache frequently accessed data
- Implement smart cache invalidation
- Reduce API calls to Wallos

### 2. Advanced Analytics

- Trend analysis over time
- Spending predictions
- Subscription optimization suggestions
- Duplicate detection

### 3. Natural Language Processing

- Parse natural date inputs ("next month", "last quarter")
- Fuzzy matching for subscription names
- Smart filtering suggestions

### 4. Batch Operations

- Get multiple months of data at once
- Bulk export options
- Parallel API calls for performance

## Conclusion

This implementation plan provides a comprehensive roadmap for exposing all Wallos read-only functionality through MCP tools.
By following this phased approach, we can systematically enhance Claude Desktop's ability to provide insights into
subscription management while maintaining code quality and user experience standards.

The priority is on high-value analytics tools that provide immediate insights, followed by configuration and export
tools that enhance the overall utility of the integration.

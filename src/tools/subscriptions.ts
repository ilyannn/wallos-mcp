import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { WallosClient } from '../wallos-client.js';
import { SubscriptionFilters, CreateSubscriptionData, EditSubscriptionData } from '../types/index.js';

export const listSubscriptionsTool: Tool = {
  name: 'list_subscriptions',
  description:
    'List all subscriptions with optional filters for member, category, payment method, state, and sorting',
  inputSchema: {
    type: 'object',
    properties: {
      member_ids: {
        type: 'string',
        description: 'Comma-separated list of member IDs to filter by (e.g., "1,3,5")',
      },
      category_ids: {
        type: 'string',
        description: 'Comma-separated list of category IDs to filter by (e.g., "1,2")',
      },
      payment_method_ids: {
        type: 'string',
        description: 'Comma-separated list of payment method IDs to filter by (e.g., "1,4")',
      },
      state: {
        type: 'string',
        enum: ['active', 'inactive'],
        description:
          'Filter by subscription state: "active" for active subscriptions, "inactive" for inactive ones',
      },
      sort: {
        type: 'string',
        enum: [
          'name',
          'id',
          'next_payment',
          'price',
          'payer_user_id',
          'category_id',
          'payment_method_id',
          'inactive',
          'alphanumeric',
        ],
        description: 'Sort subscriptions by field. Default: next_payment',
        default: 'next_payment',
      },
      disabled_to_bottom: {
        type: 'boolean',
        description: 'Whether to sort inactive subscriptions to the bottom',
        default: false,
      },
      convert_currency: {
        type: 'boolean',
        description: 'Whether to convert prices to the main user currency',
        default: false,
      },
    },
    additionalProperties: false,
  },
};

export async function handleListSubscriptions(
  client: WallosClient,
  args: {
    member_ids?: string;
    category_ids?: string;
    payment_method_ids?: string;
    state?: 'active' | 'inactive';
    sort?:
      | 'name'
      | 'id'
      | 'next_payment'
      | 'price'
      | 'payer_user_id'
      | 'category_id'
      | 'payment_method_id'
      | 'inactive'
      | 'alphanumeric';
    disabled_to_bottom?: boolean;
    convert_currency?: boolean;
  },
): Promise<string> {
  try {
    const filters: SubscriptionFilters = {};

    // Map arguments to filters
    if (args.member_ids) {
      filters.member = args.member_ids;
    }
    if (args.category_ids) {
      filters.category = args.category_ids;
    }
    if (args.payment_method_ids) {
      filters.payment = args.payment_method_ids;
    }
    if (args.state !== undefined) {
      filters.state = args.state === 'active' ? '0' : '1';
    }
    if (args.sort) {
      filters.sort = args.sort;
    }
    if (args.disabled_to_bottom !== undefined) {
      filters.disabled_to_bottom = args.disabled_to_bottom;
    }
    if (args.convert_currency !== undefined) {
      filters.convert_currency = args.convert_currency;
    }

    const response = await client.getSubscriptions(filters);

    if (!response.success) {
      throw new Error(`API error: ${response.title}`);
    }

    if (response.subscriptions.length === 0) {
      return 'No subscriptions found matching the specified filters.';
    }

    // Format the subscriptions for display
    let result = `Found ${response.subscriptions.length} subscription(s):\n\n`;

    for (const sub of response.subscriptions) {
      const status = sub.inactive === 0 ? '🟢 Active' : '🔴 Inactive';
      const autoRenew = sub.auto_renew === 1 ? '✅' : '❌';
      const notify = sub.notify === 1 ? '🔔' : '🔕';

      result += `**${sub.name}** (ID: ${sub.id})\n`;
      result += `  Status: ${status}\n`;
      result += `  Price: ${sub.price} (Currency ID: ${sub.currency_id})\n`;
      result += `  Next Payment: ${sub.next_payment}\n`;
      result += `  Category: ${sub.category_name}\n`;
      result += `  Payment Method: ${sub.payment_method_name}\n`;
      result += `  Payer: ${sub.payer_user_name}\n`;
      result += `  Auto-Renew: ${autoRenew}  Notifications: ${notify}\n`;

      if (sub.url) {
        result += `  URL: ${sub.url}\n`;
      }
      if (sub.notes) {
        result += `  Notes: ${sub.notes}\n`;
      }
      if (sub.replacement_subscription_id) {
        result += `  Replaced by: Subscription ID ${sub.replacement_subscription_id}\n`;
      }

      result += '\n';
    }

    if (response.notes && response.notes.length > 0) {
      result += `\n**Notes:**\n${response.notes.join('\n')}`;
    }

    return result;
  } catch (error) {
    if (error instanceof Error) {
      return `Error listing subscriptions: ${error.message}`;
    }
    return 'Error listing subscriptions: Unknown error occurred';
  }
}

export const createSubscriptionTool: Tool = {
  name: 'create_subscription',
  description:
    'Create a new subscription with automatic creation of categories, payment methods, currencies, and household members as needed',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Name of the subscription service',
      },
      price: {
        type: 'number',
        description: 'Subscription price amount',
      },
      currency_code: {
        type: 'string',
        description:
          "Currency code (e.g., USD, EUR, GBP). Will create currency if it doesn't exist",
      },
      currency_id: {
        type: 'number',
        description: 'Existing currency ID (use this OR currency_code, not both)',
      },
      billing_period: {
        type: 'string',
        description:
          'Billing period: daily, weekly, monthly, yearly, bi-weekly, quarterly, or expressions like "2 weeks", "3 months"',
      },
      billing_frequency: {
        type: 'number',
        description: 'Billing frequency multiplier (e.g., 2 for bi-monthly). Default: 1',
      },
      category_name: {
        type: 'string',
        description:
          "Category name (will create if doesn't exist). Takes priority over category_id",
      },
      category_id: {
        type: 'number',
        description: 'Existing category ID (use this OR category_name)',
      },
      payment_method_name: {
        type: 'string',
        description:
          "Payment method name (will create if doesn't exist). Takes priority over payment_method_id",
      },
      payment_method_id: {
        type: 'number',
        description: 'Existing payment method ID (use this OR payment_method_name)',
      },
      payer_user_name: {
        type: 'string',
        description:
          'Name of the household member who pays. If not found, uses the main user. Takes priority over payer_user_id',
      },
      payer_user_id: {
        type: 'number',
        description: 'Existing household member ID (use this OR payer_user_name)',
      },
      start_date: {
        type: 'string',
        description: 'Subscription start date in YYYY-MM-DD format. Defaults to today',
      },
      next_payment: {
        type: 'string',
        description:
          'Next payment date in YYYY-MM-DD format. If not provided, calculated from start_date',
      },
      auto_renew: {
        type: 'boolean',
        description: 'Whether the subscription auto-renews. Default: true',
      },
      notes: {
        type: 'string',
        description: 'Additional notes about the subscription (supports multiline)',
      },
      url: {
        type: 'string',
        description: 'URL for the subscription service',
      },
      notify: {
        type: 'boolean',
        description: 'Whether to send renewal notifications',
      },
      notify_days_before: {
        type: 'number',
        description: 'Days before renewal to send notification',
      },
    },
    required: ['name', 'price'],
    additionalProperties: false,
  },
};

export async function handleCreateSubscription(
  client: WallosClient,
  args: CreateSubscriptionData,
): Promise<string> {
  try {
    const response = await client.createSubscription(args);

    // Handle both old and new response formats
    if ('status' in response) {
      if (response.status !== 'Success') {
        throw new Error(`Failed to create subscription: ${response.message || 'Unknown error'}`);
      }
    } else if ('success' in response) {
      if (!response.success) {
        throw new Error(
          `Failed to create subscription: ${response.errorMessage || 'Unknown error'}`,
        );
      }
    } else {
      throw new Error('Invalid response format from subscription creation');
    }

    let result = `✅ Successfully created subscription!\n\n`;

    // Add message if available
    if ('message' in response && response.message) {
      result += `**Message:** ${response.message}\n\n`;
    }

    // If we have the full subscription data, display it
    if ('subscription' in response && response.subscription) {
      const sub = response.subscription;
      const status = sub.inactive === 0 ? '🟢 Active' : '🔴 Inactive';
      const autoRenew = sub.auto_renew === 1 ? '✅' : '❌';
      const notify = sub.notify === 1 ? '🔔' : '🔕';

      result += `**${sub.name}** (ID: ${sub.id})\n`;
      result += `  Status: ${status}\n`;
      result += `  Price: ${sub.price} (Currency ID: ${sub.currency_id})\n`;
      result += `  Next Payment: ${sub.next_payment}\n`;
      result += `  Category: ${sub.category_name}\n`;
      result += `  Payment Method: ${sub.payment_method_name}\n`;
      result += `  Payer: ${sub.payer_user_name}\n`;
      result += `  Auto-Renew: ${autoRenew}  Notifications: ${notify}\n`;

      if (sub.url) {
        result += `  URL: ${sub.url}\n`;
      }
      if (sub.notes) {
        result += `  Notes: ${sub.notes}\n`;
      }
    } else {
      // Fallback to displaying input data if subscription data not available
      result += `**Name:** ${args.name}\n`;
      result += `**Price:** ${args.price}`;
      if (args.currency_code) {
        result += ` ${args.currency_code}`;
      } else if (args.currency_id) {
        result += ` (Currency ID: ${args.currency_id})`;
      }
      result += '\n';
    }

    result +=
      "\n💡 **Tip:** Any categories, payment methods, or currencies were automatically created if they didn't exist. Non-existent payers default to the main user.";

    return result;
  } catch (error) {
    if (error instanceof Error) {
      return `❌ Error creating subscription: ${error.message}`;
    }
    return '❌ Error creating subscription: Unknown error occurred';
  }
}

export const editSubscriptionTool: Tool = {
  name: 'edit_subscription',
  description:
    'Edit an existing subscription. Only provide the fields you want to change - all fields are optional.',
  inputSchema: {
    type: 'object',
    properties: {
      id: {
        type: 'number',
        description: 'The ID of the subscription to edit',
      },
      name: {
        type: 'string',
        description: 'New subscription name',
      },
      price: {
        type: 'number',
        description: 'New price amount',
      },
      currency_code: {
        type: 'string',
        description: 'New 3-letter currency code (e.g., USD, EUR)',
      },
      currency_id: {
        type: 'number',
        description: 'New currency ID',
      },
      billing_period: {
        type: 'string',
        enum: ['monthly', 'yearly', 'weekly', 'daily'],
        description: 'New billing period',
      },
      billing_frequency: {
        type: 'number',
        description: 'New billing frequency',
      },
      category_name: {
        type: 'string',
        description: 'New category name',
      },
      category_id: {
        type: 'number',
        description: 'New category ID',
      },
      payment_method_name: {
        type: 'string',
        description: 'New payment method name',
      },
      payment_method_id: {
        type: 'number',
        description: 'New payment method ID',
      },
      payer_user_name: {
        type: 'string',
        description: 'New payer name (must exist, or uses main user)',
      },
      payer_user_id: {
        type: 'number',
        description: 'New payer user ID',
      },
      start_date: {
        type: 'string',
        description: 'New start date in YYYY-MM-DD format',
      },
      next_payment: {
        type: 'string',
        description: 'New next payment date in YYYY-MM-DD format',
      },
      auto_renew: {
        type: 'boolean',
        description: 'Whether the subscription auto-renews',
      },
      notes: {
        type: 'string',
        description: 'New notes',
      },
      url: {
        type: 'string',
        description: 'New URL',
      },
      notify: {
        type: 'boolean',
        description: 'Whether to send renewal notifications',
      },
      notify_days_before: {
        type: 'number',
        description: 'Days before renewal to send notification',
      },
    },
    required: ['id'],
    additionalProperties: false,
  },
};

export async function handleEditSubscription(
  client: WallosClient,
  args: { id: number } & EditSubscriptionData,
): Promise<string> {
  try {
    const { id, ...updateData } = args;
    const response = await client.editSubscription(id, updateData);

    // Handle both old and new response formats
    if ('status' in response) {
      if (response.status !== 'Success') {
        throw new Error(`Failed to edit subscription: ${response.message || 'Unknown error'}`);
      }
    } else if ('success' in response) {
      if (!response.success) {
        throw new Error(
          `Failed to edit subscription: ${response.errorMessage || 'Unknown error'}`,
        );
      }
    } else {
      throw new Error('Invalid response format from subscription edit');
    }

    let result = `✅ Successfully edited subscription!\n\n`;

    // Add message if available
    if ('message' in response && response.message) {
      result += `**Message:** ${response.message}\n\n`;
    }

    // If we have the full subscription data, display it
    if ('subscription' in response && response.subscription) {
      const sub = response.subscription;
      const status = sub.inactive === 0 ? '🟢 Active' : '🔴 Inactive';
      const autoRenew = sub.auto_renew === 1 ? '✅' : '❌';
      const notify = sub.notify === 1 ? '🔔' : '🔕';

      result += `**${sub.name}** (ID: ${sub.id})\n`;
      result += `  Status: ${status}\n`;
      result += `  Price: ${sub.price} (Currency ID: ${sub.currency_id})\n`;
      result += `  Next Payment: ${sub.next_payment}\n`;
      result += `  Category: ${sub.category_name}\n`;
      result += `  Payment Method: ${sub.payment_method_name}\n`;
      result += `  Payer: ${sub.payer_user_name}\n`;
      result += `  Auto-Renew: ${autoRenew}  Notifications: ${notify}\n`;

      if (sub.url) {
        result += `  URL: ${sub.url}\n`;
      }
      if (sub.notes) {
        result += `  Notes: ${sub.notes}\n`;
      }
    } else {
      // Fallback to displaying what was changed
      result += `**Subscription ID:** ${id}\n`;
      result += `**Changes made:**\n`;
      Object.entries(updateData).forEach(([key, value]) => {
        result += `  - ${key}: ${value}\n`;
      });
    }

    return result;
  } catch (error) {
    if (error instanceof Error) {
      return `❌ Error editing subscription: ${error.message}`;
    }
    return '❌ Error editing subscription: Unknown error occurred';
  }
}

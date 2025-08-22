import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { WallosClient } from '../wallos-client.js';
import { SubscriptionFilters } from '../types/index.js';

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

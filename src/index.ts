#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import { WallosClient } from './wallos-client.js';
import { CreateSubscriptionData, EditSubscriptionData } from './types/index.js';

// Type assertion function for MCP arguments with runtime validation
function assertCreateSubscriptionArgs(
  args: Record<string, unknown> | undefined,
): CreateSubscriptionData {
  if (!args) {
    throw new Error('Missing arguments for create_subscription');
  }

  if (typeof args.name !== 'string') {
    throw new Error('create_subscription requires name to be a string');
  }

  if (typeof args.price !== 'number') {
    throw new Error('create_subscription requires price to be a number');
  }

  // Runtime validation passed, safe to cast
  return args as unknown as CreateSubscriptionData;
}
import { getMasterDataTool, handleGetMasterData } from './tools/master-data.js';
import {
  addCategoryTool,
  updateCategoryTool,
  deleteCategoryTool,
  handleAddCategory,
  handleUpdateCategory,
  handleDeleteCategory,
} from './tools/categories.js';
import {
  listSubscriptionsTool,
  handleListSubscriptions,
  createSubscriptionTool,
  handleCreateSubscription,
  editSubscriptionTool,
  handleEditSubscription,
} from './tools/subscriptions.js';

// Get configuration from environment variables
const WALLOS_URL = process.env.WALLOS_URL || 'http://localhost:8282';
const WALLOS_API_KEY = process.env.WALLOS_API_KEY;
const WALLOS_USERNAME = process.env.WALLOS_USERNAME;
const WALLOS_PASSWORD = process.env.WALLOS_PASSWORD;

if (!WALLOS_API_KEY && (!WALLOS_USERNAME || !WALLOS_PASSWORD)) {
  // eslint-disable-next-line no-console
  console.error(
    'Error: Either WALLOS_API_KEY or both WALLOS_USERNAME and WALLOS_PASSWORD are required',
  );
  process.exit(1);
}

// Create Wallos client
const wallosClient = new WallosClient({
  baseUrl: WALLOS_URL,
  apiKey: WALLOS_API_KEY || undefined,
  username: WALLOS_USERNAME,
  password: WALLOS_PASSWORD,
  timeout: 30000, // 30 second timeout
});

// Create the MCP server
const server = new Server(
  {
    name: 'wallos-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// Register tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools = [getMasterDataTool, listSubscriptionsTool];

  // Only register mutation tools if credentials are available
  if (WALLOS_USERNAME && WALLOS_PASSWORD) {
    tools.push(
      addCategoryTool,
      updateCategoryTool,
      deleteCategoryTool,
      createSubscriptionTool,
      editSubscriptionTool,
    );
  }

  return { tools };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  let result: string;

  switch (name) {
    case 'get_master_data':
      result = await handleGetMasterData(wallosClient);
      break;

    case 'list_subscriptions':
      result = await handleListSubscriptions(
        wallosClient,
        args as {
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
      );
      break;

    case 'add_category':
      result = await handleAddCategory(wallosClient, args as { name?: string });
      break;

    case 'update_category':
      result = await handleUpdateCategory(wallosClient, args as { id: number; name: string });
      break;

    case 'delete_category':
      result = await handleDeleteCategory(wallosClient, args as { id: number });
      break;

    case 'create_subscription':
      result = await handleCreateSubscription(wallosClient, assertCreateSubscriptionArgs(args));
      break;

    case 'edit_subscription': {
      if (!args || typeof args.id !== 'number') {
        throw new Error('edit_subscription requires id to be a number');
      }
      const editArgs = args as unknown as { id: number } & EditSubscriptionData;
      result = await handleEditSubscription(wallosClient, editArgs);
      break;
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }

  return {
    content: [
      {
        type: 'text',
        text: result,
      },
    ],
  };
});

// Test connection on startup
async function testConnection(): Promise<void> {
  process.stderr.write('Testing Wallos API connection...\n');
  try {
    const isConnected = await wallosClient.testConnection();
    if (isConnected) {
      process.stderr.write('✅ Successfully connected to Wallos API\n');
    } else {
      process.stderr.write('⚠️  Warning: Could not verify Wallos API connection\n');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    process.stderr.write(`❌ Error connecting to Wallos API: ${errorMessage}\n`);
    process.stderr.write('Please check your WALLOS_URL and WALLOS_API_KEY environment variables\n');
  }
}

// Start the server
async function main(): Promise<void> {
  // Test connection on startup
  await testConnection();

  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.stderr.write('Wallos MCP server started successfully\n');
  process.stderr.write(`Wallos URL: ${WALLOS_URL}\n`);

  if (WALLOS_API_KEY) {
    process.stderr.write(
      'Available tools: get_master_data, list_subscriptions' +
        (WALLOS_USERNAME && WALLOS_PASSWORD
          ? ', add_category, update_category, delete_category, create_subscription, edit_subscription'
          : '') +
        '\n',
    );
    process.stderr.write(
      WALLOS_USERNAME && WALLOS_PASSWORD
        ? 'Full access enabled (API key + session credentials)\n'
        : 'Read-only access (API key only)\n',
    );
  } else if (WALLOS_USERNAME && WALLOS_PASSWORD) {
    process.stderr.write(
      'Available tools: get_master_data, list_subscriptions, add_category, update_category, delete_category, create_subscription, edit_subscription\n',
    );
    process.stderr.write('Full access enabled (username/password - API key will be retrieved)\n');
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  process.stderr.write('Shutting down Wallos MCP server...\n');
  await server.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  process.stderr.write('Shutting down Wallos MCP server...\n');
  await server.close();
  process.exit(0);
});

// Error handling
process.on('uncaughtException', (error) => {
  process.stderr.write(`Uncaught exception: ${error}\n`);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  process.stderr.write(`Unhandled rejection at: ${promise}, reason: ${reason}\n`);
  process.exit(1);
});

// Start the server
main().catch((error) => {
  process.stderr.write(`Failed to start server: ${error}\n`);
  process.exit(1);
});

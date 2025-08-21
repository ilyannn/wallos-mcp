#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

import { WallosClient } from './wallos-client.js';
import { getMasterDataTool, handleGetMasterData } from './tools/master-data.js';

// Get configuration from environment variables
const WALLOS_URL = process.env.WALLOS_URL || 'http://localhost:8282';
const WALLOS_API_KEY = process.env.WALLOS_API_KEY;

if (!WALLOS_API_KEY) {
  // eslint-disable-next-line no-console
  console.error('Error: WALLOS_API_KEY environment variable is required');
  process.exit(1);
}

// Create Wallos client
const wallosClient = new WallosClient({
  baseUrl: WALLOS_URL,
  apiKey: WALLOS_API_KEY,
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
  return {
    tools: [getMasterDataTool],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name } = request.params;

  switch (name) {
    case 'get_master_data': {
      const result = await handleGetMasterData(wallosClient);
      return {
        content: [
          {
            type: 'text',
            text: result,
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// Test connection on startup
async function testConnection(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('Testing Wallos API connection...');
  try {
    const isConnected = await wallosClient.testConnection();
    if (isConnected) {
      // eslint-disable-next-line no-console
      console.log('✅ Successfully connected to Wallos API');
    } else {
      // eslint-disable-next-line no-console
      console.warn('⚠️  Warning: Could not verify Wallos API connection');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    // eslint-disable-next-line no-console
    console.error('❌ Error connecting to Wallos API:', errorMessage);
    // eslint-disable-next-line no-console
    console.error('Please check your WALLOS_URL and WALLOS_API_KEY environment variables');
  }
}

// Start the server
async function main(): Promise<void> {
  // Test connection on startup
  await testConnection();

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // eslint-disable-next-line no-console
  console.log('Wallos MCP server started successfully');
  // eslint-disable-next-line no-console
  console.log(`Wallos URL: ${WALLOS_URL}`);
  // eslint-disable-next-line no-console
  console.log('Available tools: get_master_data');
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  // eslint-disable-next-line no-console
  console.log('Shutting down Wallos MCP server...');
  await server.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  // eslint-disable-next-line no-console
  console.log('Shutting down Wallos MCP server...');
  await server.close();
  process.exit(0);
});

// Error handling
process.on('uncaughtException', (error) => {
  // eslint-disable-next-line no-console
  console.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  // eslint-disable-next-line no-console
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server:', error);
  process.exit(1);
});

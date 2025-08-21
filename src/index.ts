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
  process.stderr.write('Available tools: get_master_data\n');
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

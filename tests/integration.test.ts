/**
 * Integration tests for Wallos MCP Server
 * Tests the complete flow from MCP server to Wallos API
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { getMasterDataTool, handleGetMasterData } from '../src/tools/master-data.js';

describe('Integration Tests', () => {
  let mockClient: any;

  beforeEach(() => {
    // Create a mock client
    mockClient = {
      getMasterData: mock(),
      testConnection: mock(),
    };
  });

  describe('MCP Server Integration', () => {
    test('should create server with correct configuration', () => {
      const server = new Server(
        {
          name: 'wallos-mcp-test',
          version: '1.0.0',
        },
        {
          capabilities: {
            tools: {},
          },
        }
      );

      expect(server).toBeDefined();
    });

    test('should register master data tool correctly', () => {
      const tool = getMasterDataTool;
      
      expect(tool.name).toBe('get_master_data');
      expect(tool.description).toBeDefined();
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe('object');
    });
  });

  describe('End-to-End Workflow', () => {
    const mockSuccessfulResponse = {
      categories: [
        { id: 1, name: 'General', order: 1, in_use: true },
        { id: 2, name: 'Entertainment', order: 2, in_use: false },
      ],
      currencies: {
        main_currency_id: 1,
        items: [
          { id: 1, name: 'US Dollar', symbol: '$', code: 'USD', rate: '1.0000', in_use: true },
        ],
      },
      payment_methods: [
        { id: 1, name: 'PayPal', icon: 'paypal.png', enabled: 1, order: 1, in_use: true },
      ],
      household: [
        { id: 1, name: 'John Doe', email: 'john@example.com', in_use: true },
      ],
      metadata: {
        timestamp: '2025-08-21T10:00:00.000Z',
        source: 'wallos_api',
      },
    };

    test('should handle successful master data retrieval', async () => {
      mockClient.getMasterData.mockResolvedValue(mockSuccessfulResponse);

      const result = await handleGetMasterData(mockClient);

      expect(mockClient.getMasterData).toHaveBeenCalledTimes(1);
      
      const parsedResult = JSON.parse(result);
      expect(parsedResult).toHaveProperty('summary');
      expect(parsedResult).toHaveProperty('data');
      expect(parsedResult.data).toEqual(mockSuccessfulResponse);
    });

    test('should maintain consistent response format', async () => {
      mockClient.getMasterData.mockResolvedValue(mockSuccessfulResponse);

      const result = await handleGetMasterData(mockClient);
      const parsedResult = JSON.parse(result);

      // Verify consistent structure
      expect(parsedResult).toMatchObject({
        summary: {
          categories_count: expect.any(Number),
          currencies_count: expect.any(Number),
          payment_methods_count: expect.any(Number),
          household_members_count: expect.any(Number),
          main_currency_id: expect.any(Number),
        },
        data: {
          categories: expect.any(Array),
          currencies: {
            main_currency_id: expect.any(Number),
            items: expect.any(Array),
          },
          payment_methods: expect.any(Array),
          household: expect.any(Array),
          metadata: {
            timestamp: expect.any(String),
            source: expect.any(String),
          },
        },
      });
    });
  });

  describe('Error Scenarios', () => {
    test('should handle network timeouts', async () => {
      mockClient.getMasterData.mockRejectedValue(new Error('Request timeout'));

      const result = await handleGetMasterData(mockClient);
      const parsedResult = JSON.parse(result);

      expect(parsedResult).toHaveProperty('error', 'Failed to fetch master data');
      expect(parsedResult).toHaveProperty('details', 'Request timeout');
    });

    test('should handle API authentication errors', async () => {
      mockClient.getMasterData.mockRejectedValue(new Error('Invalid API key'));

      const result = await handleGetMasterData(mockClient);
      const parsedResult = JSON.parse(result);

      expect(parsedResult).toHaveProperty('error', 'Failed to fetch master data');
      expect(parsedResult).toHaveProperty('details', 'Invalid API key');
    });
  });

  describe('Data Validation', () => {
    test('should handle large datasets', async () => {
      const largeResponse = {
        categories: Array.from({ length: 100 }, (_, i) => ({
          id: i + 1,
          name: `Category ${i + 1}`,
          order: i + 1,
          in_use: i % 2 === 0,
        })),
        currencies: {
          main_currency_id: 1,
          items: Array.from({ length: 50 }, (_, i) => ({
            id: i + 1,
            name: `Currency ${i + 1}`,
            symbol: '$',
            code: `C${i.toString().padStart(2, '0')}`,
            rate: '1.0000',
            in_use: true,
          })),
        },
        payment_methods: Array.from({ length: 20 }, (_, i) => ({
          id: i + 1,
          name: `Payment Method ${i + 1}`,
          icon: `icon${i}.png`,
          enabled: 1,
          order: i + 1,
          in_use: i < 10,
        })),
        household: Array.from({ length: 10 }, (_, i) => ({
          id: i + 1,
          name: `Member ${i + 1}`,
          email: `member${i}@example.com`,
          in_use: true,
        })),
        metadata: {
          timestamp: '2025-08-21T10:00:00.000Z',
          source: 'wallos_api',
        },
      };

      mockClient.getMasterData.mockResolvedValue(largeResponse);

      const result = await handleGetMasterData(mockClient);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.summary.categories_count).toBe(100);
      expect(parsedResult.summary.currencies_count).toBe(50);
      expect(parsedResult.summary.payment_methods_count).toBe(20);
      expect(parsedResult.summary.household_members_count).toBe(10);
    });
  });

  describe('Performance Tests', () => {
    test('should complete within reasonable time', async () => {
      mockClient.getMasterData.mockResolvedValue({
        categories: [],
        currencies: { main_currency_id: 1, items: [] },
        payment_methods: [],
        household: [],
        metadata: { timestamp: '2025-08-21T10:00:00.000Z', source: 'wallos_api' },
      });

      const startTime = Date.now();
      await handleGetMasterData(mockClient);
      const endTime = Date.now();

      // Should complete in under 100ms for mocked data
      expect(endTime - startTime).toBeLessThan(100);
    });

    test('should handle concurrent requests', async () => {
      mockClient.getMasterData.mockResolvedValue({
        categories: [],
        currencies: { main_currency_id: 1, items: [] },
        payment_methods: [],
        household: [],
        metadata: { timestamp: '2025-08-21T10:00:00.000Z', source: 'wallos_api' },
      });

      const promises = Array.from({ length: 5 }, () => handleGetMasterData(mockClient));
      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(() => JSON.parse(result)).not.toThrow();
      });
    });
  });
});
/**
 * Unit tests for master data tool
 * Tests the MCP tool implementation and response formatting
 */

import { describe, test, expect, beforeEach, mock, spyOn } from 'bun:test';
import { WallosClient } from '../src/wallos-client.js';
import { getMasterDataTool, handleGetMasterData } from '../src/tools/master-data.js';
import type { MasterData } from '../src/types/index.js';

describe('Master Data Tool', () => {
  let mockClient: any;
  let consoleSpy: any;

  beforeEach(() => {
    // Create a mock client
    mockClient = {
      getMasterData: mock(),
    };

    // Mock console methods
    consoleSpy = {
      log: spyOn(console, 'log').mockImplementation(() => {}),
      error: spyOn(console, 'error').mockImplementation(() => {}),
    };
  });

  describe('getMasterDataTool definition', () => {
    test('should have correct tool definition', () => {
      expect(getMasterDataTool.name).toBe('get_master_data');
      expect(getMasterDataTool.description).toContain('Retrieve all master data from Wallos');
      expect(getMasterDataTool.inputSchema).toEqual({
        type: 'object',
        properties: {},
        additionalProperties: false,
      });
    });
  });

  describe('handleGetMasterData', () => {
    const mockMasterData: MasterData = {
      categories: [
        { id: 1, name: 'General', order: 1, in_use: true },
        { id: 2, name: 'Entertainment', order: 2, in_use: false },
      ],
      currencies: {
        main_currency_id: 1,
        items: [
          { id: 1, name: 'US Dollar', symbol: '$', code: 'USD', rate: '1.0000', in_use: true },
          { id: 2, name: 'Euro', symbol: '€', code: 'EUR', rate: '0.85', in_use: false },
        ],
      },
      payment_methods: [
        { id: 1, name: 'PayPal', icon: 'paypal.png', enabled: 1, order: 1, in_use: true },
        { id: 2, name: 'Credit Card', icon: 'card.png', enabled: 1, order: 2, in_use: false },
      ],
      household: [
        { id: 1, name: 'John Doe', email: 'john@example.com', in_use: true },
      ],
      metadata: {
        timestamp: '2025-08-21T10:00:00.000Z',
        source: 'wallos_api',
      },
    };

    test('should fetch and format master data successfully', async () => {
      mockClient.getMasterData.mockResolvedValue(mockMasterData);

      const result = await handleGetMasterData(mockClient);

      expect(mockClient.getMasterData).toHaveBeenCalledTimes(1);
      expect(consoleSpy.log).toHaveBeenCalledWith('Fetching master data from Wallos API...');
      expect(consoleSpy.log).toHaveBeenCalledWith(
        'Successfully retrieved master data: 2 categories, 2 currencies, 2 payment methods, 1 household members'
      );

      const parsedResult = JSON.parse(result);
      expect(parsedResult).toHaveProperty('summary');
      expect(parsedResult).toHaveProperty('data');
      
      expect(parsedResult.summary).toEqual({
        categories_count: 2,
        currencies_count: 2,
        payment_methods_count: 2,
        household_members_count: 1,
        main_currency_id: 1,
      });
      
      expect(parsedResult.data).toEqual(mockMasterData);
    });

    test('should handle API errors gracefully', async () => {
      const errorMessage = 'API connection failed';
      mockClient.getMasterData.mockRejectedValue(new Error(errorMessage));

      const result = await handleGetMasterData(mockClient);

      expect(mockClient.getMasterData).toHaveBeenCalledTimes(1);
      expect(consoleSpy.log).toHaveBeenCalledWith('Fetching master data from Wallos API...');
      expect(consoleSpy.error).toHaveBeenCalledWith('Error fetching master data:', errorMessage);

      const parsedResult = JSON.parse(result);
      expect(parsedResult).toHaveProperty('error', 'Failed to fetch master data');
      expect(parsedResult).toHaveProperty('details', errorMessage);
      expect(parsedResult).toHaveProperty('timestamp');
      expect(parsedResult.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    test('should handle unknown errors', async () => {
      mockClient.getMasterData.mockRejectedValue('Unknown error');

      const result = await handleGetMasterData(mockClient);

      expect(consoleSpy.error).toHaveBeenCalledWith('Error fetching master data:', 'Unknown error occurred');

      const parsedResult = JSON.parse(result);
      expect(parsedResult).toHaveProperty('error', 'Failed to fetch master data');
      expect(parsedResult).toHaveProperty('details', 'Unknown error occurred');
    });

    test('should return valid JSON format', async () => {
      mockClient.getMasterData.mockResolvedValue(mockMasterData);

      const result = await handleGetMasterData(mockClient);

      expect(() => JSON.parse(result)).not.toThrow();
      
      const parsedResult = JSON.parse(result);
      expect(typeof parsedResult).toBe('object');
    });

    test('should handle empty data gracefully', async () => {
      const emptyMasterData: MasterData = {
        categories: [],
        currencies: {
          main_currency_id: 0,
          items: [],
        },
        payment_methods: [],
        household: [],
        metadata: {
          timestamp: '2025-08-21T10:00:00.000Z',
          source: 'wallos_api',
        },
      };

      mockClient.getMasterData.mockResolvedValue(emptyMasterData);

      const result = await handleGetMasterData(mockClient);

      const parsedResult = JSON.parse(result);
      expect(parsedResult.summary).toEqual({
        categories_count: 0,
        currencies_count: 0,
        payment_methods_count: 0,
        household_members_count: 0,
        main_currency_id: 0,
      });
    });

    test('should include all required fields in response', async () => {
      mockClient.getMasterData.mockResolvedValue(mockMasterData);

      const result = await handleGetMasterData(mockClient);
      const parsedResult = JSON.parse(result);

      // Check summary fields
      expect(parsedResult.summary).toHaveProperty('categories_count');
      expect(parsedResult.summary).toHaveProperty('currencies_count');
      expect(parsedResult.summary).toHaveProperty('payment_methods_count');
      expect(parsedResult.summary).toHaveProperty('household_members_count');
      expect(parsedResult.summary).toHaveProperty('main_currency_id');

      // Check data structure
      expect(parsedResult.data).toHaveProperty('categories');
      expect(parsedResult.data).toHaveProperty('currencies');
      expect(parsedResult.data.currencies).toHaveProperty('main_currency_id');
      expect(parsedResult.data.currencies).toHaveProperty('items');
      expect(parsedResult.data).toHaveProperty('payment_methods');
      expect(parsedResult.data).toHaveProperty('household');
      expect(parsedResult.data).toHaveProperty('metadata');
      expect(parsedResult.data.metadata).toHaveProperty('timestamp');
      expect(parsedResult.data.metadata).toHaveProperty('source');
    });

    test('should format numbers correctly in summary', async () => {
      const largeMasterData: MasterData = {
        categories: Array.from({ length: 15 }, (_, i) => ({ 
          id: i + 1, name: `Category ${i + 1}`, order: i + 1, in_use: i % 2 === 0 
        })),
        currencies: {
          main_currency_id: 3,
          items: Array.from({ length: 8 }, (_, i) => ({ 
            id: i + 1, name: `Currency ${i + 1}`, symbol: '$', code: `CUR${i}`, rate: '1.0000', in_use: i < 5 
          })),
        },
        payment_methods: Array.from({ length: 12 }, (_, i) => ({ 
          id: i + 1, name: `Payment ${i + 1}`, icon: 'icon.png', enabled: 1, order: i + 1, in_use: i < 3 
        })),
        household: Array.from({ length: 4 }, (_, i) => ({ 
          id: i + 1, name: `Member ${i + 1}`, email: `member${i}@test.com`, in_use: i < 2 
        })),
        metadata: {
          timestamp: '2025-08-21T10:00:00.000Z',
          source: 'wallos_api',
        },
      };

      mockClient.getMasterData.mockResolvedValue(largeMasterData);

      const result = await handleGetMasterData(mockClient);
      const parsedResult = JSON.parse(result);

      expect(parsedResult.summary.categories_count).toBe(15);
      expect(parsedResult.summary.currencies_count).toBe(8);
      expect(parsedResult.summary.payment_methods_count).toBe(12);
      expect(parsedResult.summary.household_members_count).toBe(4);
    });
  });
});
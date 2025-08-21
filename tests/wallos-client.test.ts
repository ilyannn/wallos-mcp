/**
 * Unit tests for WallosClient
 * Tests API client functionality with mocked HTTP responses
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { WallosClient } from '../src/wallos-client.js';
import type {
  CategoriesResponse,
  CurrenciesResponse,
} from '../src/types/index.js';

// Mock axios
const mockAxiosInstance = {
  get: mock(),
  post: mock(),
  defaults: {},
  interceptors: {
    request: { use: mock() },
    response: { use: mock() },
  },
};

const mockAxios = {
  create: mock(() => mockAxiosInstance),
  isAxiosError: mock(() => false),
};

// Mock the axios module
mock.module('axios', () => ({
  default: mockAxios,
}));

// Mock axios-cookiejar-support
const mockWrapper = mock((instance) => instance);
mock.module('axios-cookiejar-support', () => ({
  wrapper: mockWrapper,
}));

// Mock tough-cookie
const mockCookieJar = {
  getCookies: mock(() => Promise.resolve([])),
};
mock.module('tough-cookie', () => ({
  CookieJar: mock(() => mockCookieJar),
}));

describe('WallosClient', () => {
  let client: WallosClient;
  const mockConfig = {
    baseUrl: 'http://localhost:8282',
    apiKey: 'test-api-key',
    username: 'test-user',
    password: 'test-pass',
    timeout: 5000,
  };

  beforeEach(() => {
    mockAxios.create.mockClear();
    mockAxiosInstance.get.mockClear();
    
    client = new WallosClient(mockConfig);
  });

  describe('constructor', () => {
    test('should create axios instance with correct config', () => {
      expect(mockAxios.create).toHaveBeenCalledWith({
        baseURL: mockConfig.baseUrl,
        timeout: mockConfig.timeout,
        headers: {
          'Content-Type': 'application/json',
        },
        withCredentials: true,
      });
    });

    test('should use default timeout when not provided', () => {
      const configWithoutTimeout = {
        baseUrl: 'http://localhost:8282',
        apiKey: 'test-key',
      };
      
      new WallosClient(configWithoutTimeout);
      
      expect(mockAxios.create).toHaveBeenCalledWith({
        baseURL: configWithoutTimeout.baseUrl,
        timeout: 10000, // default timeout
        headers: {
          'Content-Type': 'application/json',
        },
        withCredentials: true,
      });
    });
  });

  describe('getCategories', () => {
    const mockCategoriesResponse: CategoriesResponse = {
      success: true,
      title: 'categories',
      notes: [],
      categories: [
        { id: 1, name: 'General', order: 1, in_use: true },
        { id: 2, name: 'Entertainment', order: 2, in_use: false },
      ],
    };

    test('should fetch categories successfully', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: mockCategoriesResponse });

      const result = await client.getCategories();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/categories/get_categories.php');
      expect(result).toEqual(mockCategoriesResponse);
    });

    test('should handle API errors', async () => {
      const errorResponse = new Error('Invalid API key');
      mockAxiosInstance.get.mockRejectedValue(errorResponse);

      await expect(client.getCategories()).rejects.toThrow('Invalid API key');
    });
  });

  describe('getCurrencies', () => {
    const mockCurrenciesResponse: CurrenciesResponse = {
      success: true,
      title: 'currencies',
      notes: [],
      main_currency: 1,
      currencies: [
        { id: 1, name: 'US Dollar', symbol: '$', code: 'USD', rate: '1.0000', in_use: true },
        { id: 2, name: 'Euro', symbol: '€', code: 'EUR', rate: '0.85', in_use: false },
      ],
    };

    test('should fetch currencies successfully', async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: mockCurrenciesResponse });

      const result = await client.getCurrencies();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/api/currencies/get_currencies.php');
      expect(result).toEqual(mockCurrenciesResponse);
    });
  });

  describe('getMasterData', () => {
    const mockResponses = {
      categories: {
        success: true,
        title: 'categories',
        notes: [],
        categories: [{ id: 1, name: 'General', order: 1, in_use: true }],
      },
      currencies: {
        success: true,
        title: 'currencies',
        notes: [],
        main_currency: 1,
        currencies: [{ id: 1, name: 'US Dollar', symbol: '$', code: 'USD', rate: '1.0000', in_use: true }],
      },
      payment_methods: {
        success: true,
        title: 'payment_methods',
        notes: [],
        payment_methods: [{ id: 1, name: 'PayPal', icon: 'paypal.png', enabled: 1, order: 1, in_use: true }],
      },
      household: {
        success: true,
        title: 'household',
        notes: [],
        household: [{ id: 1, name: 'John Doe', email: 'john@example.com', in_use: true }],
      },
    };

    test('should fetch all master data successfully', async () => {
      // Mock all API calls
      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: mockResponses.categories })
        .mockResolvedValueOnce({ data: mockResponses.currencies })
        .mockResolvedValueOnce({ data: mockResponses.payment_methods })
        .mockResolvedValueOnce({ data: mockResponses.household });

      const result = await client.getMasterData();

      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(4);
      expect(result.categories).toEqual(mockResponses.categories.categories);
      expect(result.currencies.main_currency_id).toBe(1);
      expect(result.currencies.items).toEqual(mockResponses.currencies.currencies);
      expect(result.payment_methods).toEqual(mockResponses.payment_methods.payment_methods);
      expect(result.household).toEqual(mockResponses.household.household);
      expect(result.metadata.source).toBe('wallos_api');
      expect(result.metadata.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    test('should handle failure in categories API', async () => {
      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: { ...mockResponses.categories, success: false } })
        .mockResolvedValueOnce({ data: mockResponses.currencies })
        .mockResolvedValueOnce({ data: mockResponses.payment_methods })
        .mockResolvedValueOnce({ data: mockResponses.household });

      await expect(client.getMasterData()).rejects.toThrow('Categories API error');
    });

    test('should handle network errors', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Network error'));

      await expect(client.getMasterData()).rejects.toThrow('Failed to fetch master data: Network error');
    });
  });

  describe('testConnection', () => {
    test('should return true when connection is successful', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { success: true, title: 'categories', categories: [], notes: [] },
      });

      const result = await client.testConnection();

      expect(result).toBe(true);
    });

    test('should return false when API returns success: false', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { success: false, title: 'Invalid API key' },
      });

      const result = await client.testConnection();

      expect(result).toBe(false);
    });

    test('should return false when connection fails', async () => {
      mockAxiosInstance.get.mockRejectedValue(new Error('Connection failed'));

      const result = await client.testConnection();

      expect(result).toBe(false);
    });
  });
});
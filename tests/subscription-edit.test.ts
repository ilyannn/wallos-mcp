/**
 * Unit tests for subscription editing functionality
 * Tests editing subscriptions with partial updates
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { WallosClient } from '../src/wallos-client.js';
import type { EditSubscriptionData } from '../src/types/index.js';

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

// Mock axios-cookiejar-support
const mockWrapper = mock((instance) => instance);

// Mock tough-cookie
const mockCookieJar = {
  getCookies: mock(),
};

// Mock modules
mock.module('axios', () => ({
  default: mockAxios,
}));

mock.module('axios-cookiejar-support', () => ({
  wrapper: mockWrapper,
}));

mock.module('tough-cookie', () => ({
  CookieJar: mock(() => mockCookieJar),
}));

// Helper to setup default mocks after reset
const setupDefaultMocks = (subscriptionId?: number) => {
  // Setup default implementation that handles multiple endpoints
  mockAxiosInstance.get.mockImplementation((url) => {
    if (url === '/api/subscriptions/get_subscriptions.php') {
      return Promise.resolve({
        data: {
          success: true,
          subscriptions: subscriptionId ? [{
            id: subscriptionId,
            name: 'Test Subscription',
            price: 10.99,
            category_name: 'Test Category',
            payment_method_name: 'Test Payment',
            payer_user_name: 'Test User',
            inactive: 0,
            auto_renew: 1,
            notify: 0,
            next_payment: '2025-02-01',
            currency_id: 1,
          }] : [],
          notes: [],
        },
      });
    }
    if (url === '/api/household/get_household.php') {
      return Promise.resolve({
        data: {
          success: true,
          household: [
            { id: 1, name: 'Main User', email: 'main@example.com', in_use: true },
          ],
        },
      });
    }
    // For other endpoints, continue with mock chain
    return undefined;
  });
};

describe('Subscription Editing', () => {
  let client: WallosClient;
  let stderrSpy: ReturnType<typeof mock>;
  let consoleWarnSpy: ReturnType<typeof mock>;

  const mockConfig = {
    baseUrl: 'http://localhost:8282',
    username: 'testuser',
    password: 'testpass',
    timeout: 5000,
  };

  beforeEach(() => {
    mockAxios.create.mockClear();
    mockAxiosInstance.get.mockClear();
    mockAxiosInstance.post.mockClear();
    mockCookieJar.getCookies.mockClear();
    mockWrapper.mockClear();

    // Mock process.stderr.write
    stderrSpy = mock(() => true);
    process.stderr.write = stderrSpy;
    
    // Mock console.warn
    consoleWarnSpy = mock(() => undefined);
    console.warn = consoleWarnSpy;

    // Setup successful authentication mock (default)
    mockAxiosInstance.post.mockResolvedValue({
      status: 302,
      headers: {
        'set-cookie': ['PHPSESSID=test-session; path=/'],
      },
    });
    
    // Setup default mock for getSubscriptions endpoint
    mockAxiosInstance.get.mockImplementation((url) => {
      if (url === '/api/subscriptions/get_subscriptions.php') {
        return Promise.resolve({
          data: {
            success: true,
            subscriptions: [],
            notes: [],
          },
        });
      }
      if (url === '/api/household/get_household.php') {
        return Promise.resolve({
          data: {
            success: true,
            household: [
              { id: 1, name: 'Main User', email: 'main@example.com', in_use: true },
            ],
          },
        });
      }
      return Promise.resolve({ data: {} });
    });

    client = new WallosClient(mockConfig);
  });

  describe('Basic Edit Operations', () => {
    test('should edit subscription with name only', async () => {
      const editData: EditSubscriptionData = {
        name: 'Updated Netflix',
      };

      // Reset post mock and set up specific responses
      mockAxiosInstance.post.mockReset();
      
      // First call: authentication
      mockAxiosInstance.post.mockResolvedValueOnce({
        status: 302,
        headers: {
          'set-cookie': ['PHPSESSID=test-session; path=/'],
        },
      });
      
      // Mock subscription edit
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { status: 'Success', message: 'Subscription updated successfully' },
      });

      const result = await client.editSubscription(1, editData);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/endpoints/subscription/edit.php',
        expect.any(URLSearchParams),
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }),
      );

      const lastCall = mockAxiosInstance.post.mock.calls[mockAxiosInstance.post.mock.calls.length - 1];
      const formData = lastCall[1] as URLSearchParams;
      expect(formData.get('id')).toBe('1');
      expect(formData.get('name')).toBe('Updated Netflix');

      expect((result as any).status).toBe('Success');
      expect((result as any).message).toContain('successfully');
    });

    test('should edit subscription with price only', async () => {
      const editData: EditSubscriptionData = {
        price: 19.99,
      };

      mockAxiosInstance.post.mockReset();
      mockAxiosInstance.post.mockResolvedValueOnce({
        status: 302,
        headers: { 'set-cookie': ['PHPSESSID=test-session; path=/'] },
      });
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { status: 'Success', message: 'Subscription updated successfully' },
      });

      const result = await client.editSubscription(2, editData);

      const lastCall = mockAxiosInstance.post.mock.calls[mockAxiosInstance.post.mock.calls.length - 1];
      const formData = lastCall[1] as URLSearchParams;
      expect(formData.get('id')).toBe('2');
      expect(formData.get('price')).toBe('19.99');
      expect(formData.has('name')).toBe(false); // Should not include fields not specified

      expect((result as any).status).toBe('Success');
    });

    test('should edit subscription with multiple fields', async () => {
      const editData: EditSubscriptionData = {
        name: 'Spotify Family',
        price: 14.99,
        notes: 'Updated family plan',
        auto_renew: false,
      };

      mockAxiosInstance.post.mockReset();
      mockAxiosInstance.post.mockResolvedValueOnce({
        status: 302,
        headers: { 'set-cookie': ['PHPSESSID=test-session; path=/'] },
      });
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { status: 'Success', message: 'Subscription updated successfully' },
      });

      const result = await client.editSubscription(3, editData);

      const lastCall = mockAxiosInstance.post.mock.calls[mockAxiosInstance.post.mock.calls.length - 1];
      const formData = lastCall[1] as URLSearchParams;
      expect(formData.get('id')).toBe('3');
      expect(formData.get('name')).toBe('Spotify Family');
      expect(formData.get('price')).toBe('14.99');
      expect(formData.get('notes')).toBe('Updated family plan');
      expect(formData.get('auto_renew')).toBe('0');

      expect((result as any).status).toBe('Success');
    });
  });

  describe('Category and Payment Method Updates', () => {
    test('should update category by name', async () => {
      const editData: EditSubscriptionData = {
        category_name: 'Entertainment',
      };

      mockAxiosInstance.get.mockReset();
      mockAxiosInstance.post.mockReset();
      setupDefaultMocks(4); // Setup default mocks with subscription ID 4

      // Auth
      mockAxiosInstance.post.mockResolvedValueOnce({
        status: 302,
        headers: { 'set-cookie': ['PHPSESSID=test-session; path=/'] },
      });

      // Get categories to find ID (this will be called first and override the default)
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          success: true,
          categories: [
            { id: 1, name: 'General', order: 1, in_use: true },
            { id: 2, name: 'Entertainment', order: 2, in_use: true },
          ],
        },
      });

      // Edit subscription
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { status: 'Success', message: 'Subscription updated successfully' },
      });
      
      // Get subscriptions (called after edit to fetch updated data)
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          success: true,
          subscriptions: [
            {
              id: 4,
              name: 'Updated Subscription',
              price: 10.99,
              category_name: 'Entertainment',
              inactive: 0,
              auto_renew: 1,
              notify: 0,
            },
          ],
          notes: [],
        },
      });

      const result = await client.editSubscription(4, editData);

      const lastCall = mockAxiosInstance.post.mock.calls[mockAxiosInstance.post.mock.calls.length - 1];
      const formData = lastCall[1] as URLSearchParams;
      expect(formData.get('category_id')).toBe('2');

      expect((result as any).status).toBe('Success');
    });

    test('should create new category if not found', async () => {
      const editData: EditSubscriptionData = {
        category_name: 'New Category',
      };

      mockAxiosInstance.get.mockReset();
      mockAxiosInstance.post.mockReset();
      setupDefaultMocks(5);

      // Auth
      mockAxiosInstance.post.mockResolvedValueOnce({
        status: 302,
        headers: { 'set-cookie': ['PHPSESSID=test-session; path=/'] },
      });

      // Get categories (not found)
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { success: true, categories: [] },
      });

      // Create new category
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { success: true, categoryId: 5 },
      });

      // Edit subscription
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { status: 'Success', message: 'Subscription updated successfully' },
      });

      const result = await client.editSubscription(5, editData);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        expect.stringContaining('/endpoints/categories/category.php'),
      );

      const lastCall = mockAxiosInstance.post.mock.calls[mockAxiosInstance.post.mock.calls.length - 1];
      const formData = lastCall[1] as URLSearchParams;
      expect(formData.get('category_id')).toBe('5');

      expect((result as any).status).toBe('Success');
    });

    test('should update payment method by name', async () => {
      const editData: EditSubscriptionData = {
        payment_method_name: 'Credit Card',
      };

      mockAxiosInstance.get.mockReset();
      mockAxiosInstance.post.mockReset();
      setupDefaultMocks(6);

      // Auth
      mockAxiosInstance.post.mockResolvedValueOnce({
        status: 302,
        headers: { 'set-cookie': ['PHPSESSID=test-session; path=/'] },
      });

      // Get payment methods
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          success: true,
          payment_methods: [
            { id: 1, name: 'PayPal', icon: 'paypal.png', enabled: 1, order: 1, in_use: true },
            { id: 2, name: 'Credit Card', icon: 'card.png', enabled: 1, order: 2, in_use: true },
          ],
        },
      });

      // Edit subscription
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { status: 'Success', message: 'Subscription updated successfully' },
      });

      const result = await client.editSubscription(6, editData);

      const lastCall = mockAxiosInstance.post.mock.calls[mockAxiosInstance.post.mock.calls.length - 1];
      const formData = lastCall[1] as URLSearchParams;
      expect(formData.get('payment_method_id')).toBe('2');

      expect((result as any).status).toBe('Success');
    });
  });

  describe('Payer User Updates', () => {
    test('should update payer to existing household member', async () => {
      const editData: EditSubscriptionData = {
        payer_user_name: 'Jane Smith',
      };

      mockAxiosInstance.get.mockReset();
      mockAxiosInstance.post.mockReset();
      setupDefaultMocks(7);

      // Auth
      mockAxiosInstance.post.mockResolvedValueOnce({
        status: 302,
        headers: { 'set-cookie': ['PHPSESSID=test-session; path=/'] },
      });

      // Get household members
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          success: true,
          household: [
            { id: 1, name: 'John Doe', email: 'john@example.com', in_use: true },
            { id: 2, name: 'Jane Smith', email: 'jane@example.com', in_use: true },
          ],
        },
      });

      // Edit subscription
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { status: 'Success', message: 'Subscription updated successfully' },
      });

      const result = await client.editSubscription(7, editData);

      const lastCall = mockAxiosInstance.post.mock.calls[mockAxiosInstance.post.mock.calls.length - 1];
      const formData = lastCall[1] as URLSearchParams;
      expect(formData.get('payer_user_id')).toBe('2');

      expect((result as any).status).toBe('Success');
    });

    test('should use default payer when specified payer not found', async () => {
      const editData: EditSubscriptionData = {
        payer_user_name: 'Non-existent Person',
      };

      mockAxiosInstance.get.mockReset();
      mockAxiosInstance.post.mockReset();
      setupDefaultMocks(8);

      // Auth
      mockAxiosInstance.post.mockResolvedValueOnce({
        status: 302,
        headers: { 'set-cookie': ['PHPSESSID=test-session; path=/'] },
      });

      // Get household members (specified name not found)
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          success: true,
          household: [
            { id: 1, name: 'Main User', email: 'main@example.com', in_use: true },
            { id: 2, name: 'Other User', email: 'other@example.com', in_use: true },
          ],
        },
      });

      // Get household members again to find default
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          success: true,
          household: [
            { id: 1, name: 'Main User', email: 'main@example.com', in_use: true },
            { id: 2, name: 'Other User', email: 'other@example.com', in_use: true },
          ],
        },
      });

      // Edit subscription
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { status: 'Success', message: 'Subscription updated successfully' },
      });

      const result = await client.editSubscription(8, editData);

      const lastCall = mockAxiosInstance.post.mock.calls[mockAxiosInstance.post.mock.calls.length - 1];
      const formData = lastCall[1] as URLSearchParams;
      expect(formData.get('payer_user_id')).toBe('1'); // Should use first household member as default

      expect((result as any).status).toBe('Success');
    });
  });

  describe('Currency Updates', () => {
    test('should update currency by code', async () => {
      const editData: EditSubscriptionData = {
        currency_code: 'GBP',
      };

      mockAxiosInstance.get.mockReset();
      mockAxiosInstance.post.mockReset();
      setupDefaultMocks(9);

      // Auth
      mockAxiosInstance.post.mockResolvedValueOnce({
        status: 302,
        headers: { 'set-cookie': ['PHPSESSID=test-session; path=/'] },
      });

      // Get currencies
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          success: true,
          main_currency: 1,
          currencies: [
            { id: 1, name: 'US Dollar', symbol: '$', code: 'USD', rate: '1.0000', in_use: true },
            { id: 3, name: 'British Pound', symbol: '£', code: 'GBP', rate: '0.75', in_use: true },
          ],
        },
      });

      // Edit subscription
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { status: 'Success', message: 'Subscription updated successfully' },
      });

      const result = await client.editSubscription(9, editData);

      const lastCall = mockAxiosInstance.post.mock.calls[mockAxiosInstance.post.mock.calls.length - 1];
      const formData = lastCall[1] as URLSearchParams;
      expect(formData.get('currency_id')).toBe('3');

      expect((result as any).status).toBe('Success');
    });

    test('should create new currency if not found', async () => {
      const editData: EditSubscriptionData = {
        currency_code: 'JPY',
      };

      mockAxiosInstance.get.mockReset();
      mockAxiosInstance.post.mockReset();
      setupDefaultMocks(10);

      // Auth
      mockAxiosInstance.post.mockResolvedValueOnce({
        status: 302,
        headers: { 'set-cookie': ['PHPSESSID=test-session; path=/'] },
      });

      // Get currencies (JPY not found)
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          success: true,
          main_currency: 1,
          currencies: [
            { id: 1, name: 'US Dollar', symbol: '$', code: 'USD', rate: '1.0000', in_use: true },
          ],
        },
      });

      // Create new currency
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { success: true, currency_id: 4 },
      });

      // Edit subscription
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { status: 'Success', message: 'Subscription updated successfully' },
      });

      const result = await client.editSubscription(10, editData);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        expect.stringContaining('action=add'),
      );
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        expect.stringContaining('code=JPY'),
      );

      const lastCall = mockAxiosInstance.post.mock.calls[mockAxiosInstance.post.mock.calls.length - 1];
      const formData = lastCall[1] as URLSearchParams;
      expect(formData.get('currency_id')).toBe('4');

      expect((result as any).status).toBe('Success');
    });
  });

  describe('Date and Billing Updates', () => {
    test('should update billing period and frequency', async () => {
      const editData: EditSubscriptionData = {
        billing_period: 'quarterly',
      };

      mockAxiosInstance.post.mockReset();
      mockAxiosInstance.post.mockResolvedValueOnce({
        status: 302,
        headers: { 'set-cookie': ['PHPSESSID=test-session; path=/'] },
      });
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { status: 'Success', message: 'Subscription updated successfully' },
      });

      const result = await client.editSubscription(11, editData);

      const lastCall = mockAxiosInstance.post.mock.calls[mockAxiosInstance.post.mock.calls.length - 1];
      const formData = lastCall[1] as URLSearchParams;
      expect(formData.get('cycle')).toBe('3'); // monthly
      expect(formData.get('frequency')).toBe('3'); // every 3 months

      expect((result as any).status).toBe('Success');
    });

    test('should update next payment date', async () => {
      const editData: EditSubscriptionData = {
        next_payment: '2025-02-15',
      };

      mockAxiosInstance.post.mockReset();
      mockAxiosInstance.post.mockResolvedValueOnce({
        status: 302,
        headers: { 'set-cookie': ['PHPSESSID=test-session; path=/'] },
      });
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { status: 'Success', message: 'Subscription updated successfully' },
      });

      const result = await client.editSubscription(12, editData);

      const lastCall = mockAxiosInstance.post.mock.calls[mockAxiosInstance.post.mock.calls.length - 1];
      const formData = lastCall[1] as URLSearchParams;
      expect(formData.get('next_payment')).toBe('2025-02-15');

      expect((result as any).status).toBe('Success');
    });

    test('should update start date', async () => {
      const editData: EditSubscriptionData = {
        start_date: '2025-01-01',
      };

      mockAxiosInstance.get.mockReset();
      mockAxiosInstance.post.mockReset();
      setupDefaultMocks(13);
      
      mockAxiosInstance.post.mockResolvedValueOnce({
        status: 302,
        headers: { 'set-cookie': ['PHPSESSID=test-session; path=/'] },
      });
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { status: 'Success', message: 'Subscription updated successfully' },
      });

      const result = await client.editSubscription(13, editData);

      const lastCall = mockAxiosInstance.post.mock.calls[mockAxiosInstance.post.mock.calls.length - 1];
      const formData = lastCall[1] as URLSearchParams;
      expect(formData.get('start_date')).toBe('2025-01-01');

      expect((result as any).status).toBe('Success');
    });
  });

  describe('Notification Updates', () => {
    test('should update notification settings', async () => {
      const editData: EditSubscriptionData = {
        notify: true,
        notify_days_before: 7,
      };

      mockAxiosInstance.get.mockReset();
      mockAxiosInstance.post.mockReset();
      setupDefaultMocks(14);
      mockAxiosInstance.post.mockResolvedValueOnce({
        status: 302,
        headers: { 'set-cookie': ['PHPSESSID=test-session; path=/'] },
      });
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { status: 'Success', message: 'Subscription updated successfully' },
      });

      const result = await client.editSubscription(14, editData);

      const lastCall = mockAxiosInstance.post.mock.calls[mockAxiosInstance.post.mock.calls.length - 1];
      const formData = lastCall[1] as URLSearchParams;
      expect(formData.get('notify')).toBe('1');
      expect(formData.get('notify_days_before')).toBe('7');

      expect((result as any).status).toBe('Success');
    });

    test('should disable notifications', async () => {
      const editData: EditSubscriptionData = {
        notify: false,
      };

      mockAxiosInstance.get.mockReset();
      mockAxiosInstance.post.mockReset();
      setupDefaultMocks(15);
      mockAxiosInstance.post.mockResolvedValueOnce({
        status: 302,
        headers: { 'set-cookie': ['PHPSESSID=test-session; path=/'] },
      });
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { status: 'Success', message: 'Subscription updated successfully' },
      });

      const result = await client.editSubscription(15, editData);

      const lastCall = mockAxiosInstance.post.mock.calls[mockAxiosInstance.post.mock.calls.length - 1];
      const formData = lastCall[1] as URLSearchParams;
      expect(formData.get('notify')).toBe('0');

      expect((result as any).status).toBe('Success');
    });
  });

  describe('Complex Updates', () => {
    test('should handle comprehensive update with all fields', async () => {
      const editData: EditSubscriptionData = {
        name: 'Complete Update',
        price: 99.99,
        currency_code: 'EUR',
        billing_period: 'yearly',
        category_name: 'Premium Services',
        payment_method_name: 'Bank Transfer',
        payer_user_name: 'Company Account',
        start_date: '2025-01-01',
        next_payment: '2026-01-01',
        auto_renew: true,
        notes: 'Comprehensive subscription update test',
        url: 'https://example.com/subscription',
        notify: true,
        notify_days_before: 30,
      };

      mockAxiosInstance.get.mockReset();
      mockAxiosInstance.post.mockReset();
      setupDefaultMocks(16);

      // Auth
      mockAxiosInstance.post.mockResolvedValueOnce({
        status: 302,
        headers: { 'set-cookie': ['PHPSESSID=test-session; path=/'] },
      });

      // Get currencies
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          success: true,
          main_currency: 1,
          currencies: [
            { id: 2, name: 'Euro', symbol: '€', code: 'EUR', rate: '0.85', in_use: true },
          ],
        },
      });

      // Get categories (not found, will create)
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { success: true, categories: [] },
      });

      // Create category
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { success: true, categoryId: 10 },
      });

      // Get payment methods (not found, will create)
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { success: true, payment_methods: [] },
      });

      // Create payment method
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { success: true, payment_method_id: 5 },
      });

      // Get household members (not found, use default)
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          success: true,
          household: [
            { id: 1, name: 'Default User', email: 'default@example.com', in_use: true },
          ],
        },
      });

      // Get household members again for default
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          success: true,
          household: [
            { id: 1, name: 'Default User', email: 'default@example.com', in_use: true },
          ],
        },
      });

      // Edit subscription
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { status: 'Success', message: 'Subscription updated successfully' },
      });

      const result = await client.editSubscription(16, editData);

      const lastCall = mockAxiosInstance.post.mock.calls[mockAxiosInstance.post.mock.calls.length - 1];
      const formData = lastCall[1] as URLSearchParams;
      
      expect(formData.get('id')).toBe('16');
      expect(formData.get('name')).toBe('Complete Update');
      expect(formData.get('price')).toBe('99.99');
      expect(formData.get('currency_id')).toBe('2');
      expect(formData.get('cycle')).toBe('4'); // yearly
      expect(formData.get('frequency')).toBe('1');
      expect(formData.get('category_id')).toBe('10');
      expect(formData.get('payment_method_id')).toBe('5');
      expect(formData.get('payer_user_id')).toBe('1'); // default user
      expect(formData.get('start_date')).toBe('2025-01-01');
      expect(formData.get('next_payment')).toBe('2026-01-01');
      expect(formData.get('auto_renew')).toBe('1');
      expect(formData.get('notes')).toBe('Comprehensive subscription update test');
      expect(formData.get('url')).toBe('https://example.com/subscription');
      expect(formData.get('notify')).toBe('1');
      expect(formData.get('notify_days_before')).toBe('30');

      expect((result as any).status).toBe('Success');
    });

    test('should handle empty update (no fields)', async () => {
      const editData: EditSubscriptionData = {};

      mockAxiosInstance.post.mockReset();
      mockAxiosInstance.post.mockResolvedValueOnce({
        status: 302,
        headers: { 'set-cookie': ['PHPSESSID=test-session; path=/'] },
      });
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { status: 'Success', message: 'Subscription updated successfully' },
      });

      const result = await client.editSubscription(17, editData);

      const lastCall = mockAxiosInstance.post.mock.calls[mockAxiosInstance.post.mock.calls.length - 1];
      const formData = lastCall[1] as URLSearchParams;
      
      // Should only have the ID, no other fields
      expect(formData.get('id')).toBe('17');
      const keys = Array.from(formData.keys());
      expect(keys.length).toBe(1); // Only 'id' should be present

      expect((result as any).status).toBe('Success');
    });
  });

  describe('Error Handling', () => {
    test('should handle edit failure', async () => {
      const editData: EditSubscriptionData = {
        name: 'Failed Edit',
      };

      mockAxiosInstance.get.mockReset();
      mockAxiosInstance.post.mockReset();
      setupDefaultMocks(18);
      mockAxiosInstance.post.mockResolvedValueOnce({
        status: 302,
        headers: { 'set-cookie': ['PHPSESSID=test-session; path=/'] },
      });
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { status: 'Error', message: 'Failed to update subscription' },
      });

      await expect(client.editSubscription(18, editData)).rejects.toThrow(
        'Failed to edit subscription: Failed to update subscription',
      );
    });

    test('should handle network error', async () => {
      const editData: EditSubscriptionData = {
        name: 'Network Error',
      };

      mockAxiosInstance.post.mockReset();
      mockAxiosInstance.post.mockResolvedValueOnce({
        status: 302,
        headers: { 'set-cookie': ['PHPSESSID=test-session; path=/'] },
      });
      mockAxiosInstance.post.mockRejectedValueOnce(new Error('Network error'));

      await expect(client.editSubscription(19, editData)).rejects.toThrow('Network error');
    });

    test('should handle invalid subscription ID', async () => {
      const editData: EditSubscriptionData = {
        name: 'Invalid ID',
      };

      mockAxiosInstance.post.mockReset();
      mockAxiosInstance.post.mockResolvedValueOnce({
        status: 302,
        headers: { 'set-cookie': ['PHPSESSID=test-session; path=/'] },
      });
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { success: false, errorMessage: 'Subscription not found' },
      });

      await expect(client.editSubscription(999, editData)).rejects.toThrow(
        'Failed to edit subscription: Subscription not found',
      );
    });
  });

  describe('Response Format Handling', () => {
    test('should handle new response format with subscription data', async () => {
      const editData: EditSubscriptionData = {
        name: 'Updated with Full Data',
      };

      mockAxiosInstance.post.mockReset();
      mockAxiosInstance.post.mockResolvedValueOnce({
        status: 302,
        headers: { 'set-cookie': ['PHPSESSID=test-session; path=/'] },
      });
      
      // Mock response with full subscription data
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          success: true,
          message: 'Subscription updated successfully',
          subscription: {
            id: 20,
            name: 'Updated with Full Data',
            price: 15.99,
            currency_id: 1,
            next_payment: '2025-02-01',
            category_name: 'Entertainment',
            payment_method_name: 'Credit Card',
            payer_user_name: 'John Doe',
            auto_renew: 1,
            notify: 1,
            inactive: 0,
            url: 'https://example.com',
            notes: 'Test notes',
          },
        },
      });

      const result = await client.editSubscription(20, editData);

      expect((result as any).success).toBe(true);
      expect((result as any).message).toContain('successfully');
      expect((result as any).subscription).toBeDefined();
      expect((result as any).subscription.name).toBe('Updated with Full Data');
    });

    test('should handle old response format', async () => {
      const editData: EditSubscriptionData = {
        name: 'Old Format Response',
      };

      mockAxiosInstance.post.mockReset();
      mockAxiosInstance.post.mockResolvedValueOnce({
        status: 302,
        headers: { 'set-cookie': ['PHPSESSID=test-session; path=/'] },
      });
      
      // Mock old response format
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: {
          status: 'Success',
          message: 'Subscription updated',
        },
      });

      const result = await client.editSubscription(21, editData);

      expect((result as any).status).toBe('Success');
      expect((result as any).message).toBe('Subscription updated');
    });
  });
});
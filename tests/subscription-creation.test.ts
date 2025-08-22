/**
 * Unit tests for subscription creation functionality
 * Tests creating subscriptions with automatic category and payment method creation
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { WallosClient } from '../src/wallos-client.js';
import type { CreateSubscriptionData } from '../src/types/index.js';

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

describe('Subscription Creation', () => {
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

    client = new WallosClient(mockConfig);
  });

  describe('Payment Method Creation', () => {
    test('should create payment method with default name', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { success: true, payment_method_id: 5 },
      });

      const result = await client.addPaymentMethod();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        expect.stringContaining('/endpoints/payments/add.php?action=add'),
      );
      expect((result as any).success).toBe(true);
      expect((result as any).payment_method_id).toBe(5);
    });

    test('should create payment method with custom name', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { success: true, payment_method_id: 6 },
      });

      const result = await client.addPaymentMethod('Stripe');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        expect.stringContaining('action=add'),
      );
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        expect.stringContaining('name=Stripe'),
      );
      expect(result.payment_method_id).toBe(6);
    });
  });

  describe('Subscription Creation with Existing IDs', () => {
    test('should create subscription with existing category and payment method IDs', async () => {
      const subscriptionData: CreateSubscriptionData = {
        name: 'Netflix Premium',
        price: 15.99,
        currency_id: 1,
        billing_period: 'monthly',
        category_id: 2,
        payment_method_id: 3,
        auto_renew: true,
        notes: 'Family plan',
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
      
      // Mock subscription creation
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { status: 'Success', message: 'Subscription added successfully' },
      });

      const result = await client.createSubscription(subscriptionData);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/endpoints/subscription/add.php',
        expect.any(URLSearchParams),
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }),
      );

      expect((result as any).status).toBe('Success');
      expect((result as any).message).toContain('successfully');
    });
  });

  describe('Subscription Creation with Auto Category/Payment Creation', () => {
    test('should create category and payment method automatically', async () => {
      const subscriptionData: CreateSubscriptionData = {
        name: 'Spotify Premium',
        price: 9.99,
        currency_id: 1,
        billing_period: 'monthly',
        category_name: 'Music Streaming',
        payment_method_name: 'Apple Pay',
        notify: true,
        notify_days_before: 3,
      };

      // Reset mocks
      mockAxiosInstance.get.mockReset();
      mockAxiosInstance.post.mockReset();

      // First call: authentication
      mockAxiosInstance.post.mockResolvedValueOnce({
        status: 302,
        headers: {
          'set-cookie': ['PHPSESSID=test-session; path=/'],
        },
      });

      // Mock get categories (to check if exists)
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { success: true, categories: [] }, // No existing categories
      });

      // Mock category creation
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { success: true, categoryId: 8 },
      });

      // Mock get payment methods (to check if exists)
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { success: true, payment_methods: [] }, // No existing payment methods
      });

      // Mock payment method creation
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { success: true, payment_method_id: 7 },
      });

      // Mock subscription creation
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { status: 'Success', message: 'Subscription added successfully' },
      });

      const result = await client.createSubscription(subscriptionData);

      // Verify category creation was called
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        expect.stringContaining('/endpoints/categories/category.php'),
      );

      // Verify payment method creation was called
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        expect.stringContaining('/endpoints/payments/add.php'),
      );

      // Verify subscription creation was called
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/endpoints/subscription/add.php',
        expect.any(URLSearchParams),
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }),
      );

      expect((result as any).status).toBe('Success');
      expect((result as any).message).toContain('successfully');
    });

    test('should handle category creation failure', async () => {
      const subscriptionData: CreateSubscriptionData = {
        name: 'Failed Service',
        price: 5.00,
        currency_id: 1,
        billing_period: 'monthly',
        category_name: 'Test Category',
      };

      // Reset mocks
      mockAxiosInstance.get.mockReset();
      mockAxiosInstance.post.mockReset();

      // First call: authentication
      mockAxiosInstance.post.mockResolvedValueOnce({
        status: 302,
        headers: {
          'set-cookie': ['PHPSESSID=test-session; path=/'],
        },
      });

      // Mock get categories (to check if exists)
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { success: true, categories: [] }, // No existing categories
      });

      // Mock failed category creation
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { success: false, errorMessage: 'Category creation failed' },
      });

      await expect(client.createSubscription(subscriptionData)).rejects.toThrow(
        'Failed to create category: Category creation failed',
      );
    });

    test('should handle payment method creation failure', async () => {
      const subscriptionData: CreateSubscriptionData = {
        name: 'Failed Service',
        price: 5.00,
        currency_id: 1,
        billing_period: 'monthly',
        category_id: 1,
        payment_method_name: 'Test Payment',
      };

      // Reset mocks
      mockAxiosInstance.get.mockReset();
      mockAxiosInstance.post.mockReset();

      // First call: authentication
      mockAxiosInstance.post.mockResolvedValueOnce({
        status: 302,
        headers: {
          'set-cookie': ['PHPSESSID=test-session; path=/'],
        },
      });

      // Mock get payment methods (to check if exists)
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { success: true, payment_methods: [] }, // No existing payment methods
      });

      // Mock failed payment method creation
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { success: false, errorMessage: 'Payment method creation failed' },
      });

      await expect(client.createSubscription(subscriptionData)).rejects.toThrow(
        'Failed to create payment method: Payment method creation failed',
      );
    });
  });

  describe('Helper Methods', () => {
    test('should find category by name', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          success: true,
          categories: [
            { id: 1, name: 'General', order: 1, in_use: true },
            { id: 2, name: 'Entertainment', order: 2, in_use: true },
          ],
        },
      });

      const categoryId = await client.findCategoryByName('Entertainment');
      expect(categoryId).toBe(2);

      const nonExistentId = await client.findCategoryByName('Non-existent');
      expect(nonExistentId).toBeNull();
    });

    test('should find payment method by name', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          success: true,
          payment_methods: [
            { id: 1, name: 'PayPal', icon: 'paypal.png', enabled: 1, order: 1, in_use: true },
            { id: 2, name: 'Credit Card', icon: 'card.png', enabled: 1, order: 2, in_use: true },
          ],
        },
      });

      const paymentId = await client.findPaymentMethodByName('PayPal');
      expect(paymentId).toBe(1);

      const nonExistentId = await client.findPaymentMethodByName('Non-existent');
      expect(nonExistentId).toBeNull();
    });
  });

  describe('Payment Method Management', () => {
    test('should update payment method name', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { success: true, message: 'Payment method updated' },
      });

      const result = await client.updatePaymentMethod(2, 'Updated Payment');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        expect.stringContaining('action=edit'),
      );
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        expect.stringContaining('paymentMethodId=2'),
      );
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        expect.stringContaining('name=Updated+Payment'),
      );
      expect((result as any).success).toBe(true);
    });

    test('should delete payment method', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { success: true, message: 'Payment method removed' },
      });

      const result = await client.deletePaymentMethod(3);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        expect.stringContaining('action=delete'),
      );
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        expect.stringContaining('paymentMethodId=3'),
      );
      expect((result as any).success).toBe(true);
    });
  });

  describe('Household Member Management', () => {
    test('should create household member with name and email', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { success: true, household_member_id: 3 },
      });

      const result = await client.addHouseholdMember('John Doe', 'john@example.com');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        expect.stringContaining('action=add'),
      );
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        expect.stringContaining('name=John+Doe'),
      );
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        expect.stringContaining('email=john%40example.com'),
      );
      expect((result as any).success).toBe(true);
      expect(result.household_member_id).toBe(3);
    });

    test('should generate default email if not provided', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { success: true, household_member_id: 4 },
      });

      const result = await client.addHouseholdMember('Jane Smith');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        expect.stringContaining('email=jane.smith%40household.local'),
      );
      expect((result as any).success).toBe(true);
    });

    test('should find household member by name', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          success: true,
          household: [
            { id: 1, name: 'John Doe', email: 'john@example.com', in_use: true },
            { id: 2, name: 'Jane Smith', email: 'jane@example.com', in_use: true },
          ],
        },
      });

      const memberId = await client.findHouseholdMemberByName('Jane Smith');
      expect(memberId).toBe(2);

      const nonExistentId = await client.findHouseholdMemberByName('Non-existent');
      expect(nonExistentId).toBeNull();
    });
  });

  describe('Currency Management', () => {
    test('should create currency with code', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { success: true, currency_id: 5 },
      });

      const result = await client.addCurrency('EUR');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        expect.stringContaining('action=add'),
      );
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        expect.stringContaining('code=EUR'),
      );
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        expect.stringContaining('name=Euro'),
      );
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        expect.stringContaining('symbol=%E2%82%AC'), // URL encoded €
      );
      expect((result as any).success).toBe(true);
      expect(result.currency_id).toBe(5);
    });

    test('should find currency by code', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          success: true,
          main_currency: 1,
          currencies: [
            { id: 1, name: 'US Dollar', symbol: '$', code: 'USD', rate: '1.0000', in_use: true },
            { id: 2, name: 'Euro', symbol: '€', code: 'EUR', rate: '0.85', in_use: true },
          ],
        },
      });

      const currencyId = await client.findCurrencyByCode('EUR');
      expect(currencyId).toBe(2);

      const nonExistentId = await client.findCurrencyByCode('GBP');
      expect(nonExistentId).toBeNull();
    });
  });

  describe('Subscription with Payer User Name', () => {
    test('should create subscription with payer name', async () => {
      const subscriptionData: CreateSubscriptionData = {
        name: 'Family Netflix',
        price: 19.99,
        billing_period: 'monthly',
        payer_user_name: 'Dad',
        payer_user_email: 'dad@family.com',
        start_date: '2025-01-01',
        notes: `This is a family subscription
Shared between all family members
Renews monthly`,
      };

      // Reset mocks
      mockAxiosInstance.get.mockReset();
      mockAxiosInstance.post.mockReset();

      // Authentication
      mockAxiosInstance.post.mockResolvedValueOnce({
        status: 302,
        headers: { 'set-cookie': ['PHPSESSID=test-session; path=/'] },
      });

      // Get main currency
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { success: true, main_currency: 1, currencies: [] },
      });

      // Get household members (not found)
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { success: true, household: [] },
      });

      // Create household member
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { success: true, household_member_id: 5 },
      });

      // Create subscription
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { status: 'Success', message: 'Subscription added successfully' },
      });

      const result = await client.createSubscription(subscriptionData);

      expect((result as any).status).toBe('Success');
      expect((result as any).message).toContain('successfully');

      // Verify subscription creation was called with POST
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/endpoints/subscription/add.php',
        expect.any(URLSearchParams),
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }),
      );
    });
  });

  describe('Subscription with Currency Code', () => {
    test('should create subscription with currency code', async () => {
      const subscriptionData: CreateSubscriptionData = {
        name: 'International Service',
        price: 99.99,
        currency_code: 'EUR',
        billing_period: 'monthly',
        category_name: 'Services',
      };

      // Reset mocks
      mockAxiosInstance.get.mockReset();
      mockAxiosInstance.post.mockReset();

      // Authentication
      mockAxiosInstance.post.mockResolvedValueOnce({
        status: 302,
        headers: { 'set-cookie': ['PHPSESSID=test-session; path=/'] },
      });

      // Get currencies (to find EUR)
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          success: true,
          main_currency: 1,
          currencies: [
            { id: 1, name: 'US Dollar', symbol: '$', code: 'USD', rate: '1.0000', in_use: true },
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

      // Create subscription
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { status: 'Success', message: 'Subscription added successfully' },
      });

      const result = await client.createSubscription(subscriptionData);

      expect((result as any).status).toBe('Success');
      expect((result as any).message).toContain('successfully');
    });
  });

  describe('Frequency Parsing', () => {
    test('should parse various frequency formats', async () => {
      const testCases = [
        { input: 'daily', expectedCycle: 1, expectedFreq: 1 },
        { input: 'd', expectedCycle: 1, expectedFreq: 1 },
        { input: 'weekly', expectedCycle: 2, expectedFreq: 1 },
        { input: 'w', expectedCycle: 2, expectedFreq: 1 },
        { input: 'monthly', expectedCycle: 3, expectedFreq: 1 },
        { input: 'm', expectedCycle: 3, expectedFreq: 1 },
        { input: 'yearly', expectedCycle: 4, expectedFreq: 1 },
        { input: 'y', expectedCycle: 4, expectedFreq: 1 },
        { input: 'quarterly', expectedCycle: 3, expectedFreq: 3 },
        { input: 'bi-weekly', expectedCycle: 2, expectedFreq: 2 },
        { input: '2 weeks', expectedCycle: 2, expectedFreq: 2 },
        { input: '3 months', expectedCycle: 3, expectedFreq: 3 },
        { input: '1 year', expectedCycle: 4, expectedFreq: 1 },
      ];

      for (const testCase of testCases) {
        const subscriptionData: CreateSubscriptionData = {
          name: `Test ${testCase.input}`,
          price: 10,
          billing_period: testCase.input,
        };

        // Reset mocks
        mockAxiosInstance.get.mockReset();
        mockAxiosInstance.post.mockReset();

        // Setup auth
        mockAxiosInstance.post.mockResolvedValueOnce({
          status: 302,
          headers: { 'set-cookie': ['PHPSESSID=test-session; path=/'] },
        });

        // Get main currency
        mockAxiosInstance.get.mockResolvedValueOnce({
          data: { success: true, main_currency: 1, currencies: [] },
        });

        // Create subscription
        mockAxiosInstance.post.mockResolvedValueOnce({
          data: { status: 'Success', message: 'Subscription added successfully' },
        });

        await client.createSubscription(subscriptionData);

        // Verify the cycle and frequency parameters were set correctly
        const lastCall = mockAxiosInstance.post.mock.calls[mockAxiosInstance.post.mock.calls.length - 1];
        const formData = lastCall[1] as URLSearchParams;
        expect(formData.get('cycle')).toBe(testCase.expectedCycle.toString());
        expect(formData.get('frequency')).toBe(testCase.expectedFreq.toString());
      }
    });

    test('should warn for unparseable frequency', async () => {
      const subscriptionData: CreateSubscriptionData = {
        name: 'Test Unknown',
        price: 10,
        billing_period: 'unknown-frequency',
      };

      // Reset mocks
      mockAxiosInstance.get.mockReset();
      mockAxiosInstance.post.mockReset();

      // Setup auth
      mockAxiosInstance.post.mockResolvedValueOnce({
        status: 302,
        headers: { 'set-cookie': ['PHPSESSID=test-session; path=/'] },
      });

      // Get main currency
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { success: true, main_currency: 1, currencies: [] },
      });

      // Create subscription
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { status: 'Success', message: 'Subscription added successfully' },
      });

      // Mock process.stderr.write
      const stderrSpy = mock(() => true);
      process.stderr.write = stderrSpy;

      await client.createSubscription(subscriptionData);

      // Should have warned about unparseable frequency
      expect(stderrSpy).toHaveBeenCalledWith(
        'Warning: Unable to parse billing period "unknown-frequency", defaulting to monthly\n'
      );

      // Should default to monthly (cycle: 3, frequency: 1)
      const lastCall = mockAxiosInstance.post.mock.calls[mockAxiosInstance.post.mock.calls.length - 1];
      const formData = lastCall[1] as URLSearchParams;
      expect(formData.get('cycle')).toBe('3');
      expect(formData.get('frequency')).toBe('1');
    });
  });

  describe('Auto-Renew Defaults', () => {
    test('should default auto_renew to true when not specified', async () => {
      const subscriptionData: CreateSubscriptionData = {
        name: 'Test Auto-Renew Default',
        price: 12.99,
        billing_period: 'monthly',
        // Deliberately omitting auto_renew to test default behavior
      };

      // Reset mocks
      mockAxiosInstance.get.mockReset();
      mockAxiosInstance.post.mockReset();

      // Setup auth
      mockAxiosInstance.post.mockResolvedValueOnce({
        status: 302,
        headers: { 'set-cookie': ['PHPSESSID=test-session; path=/'] },
      });

      // Get main currency
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { success: true, main_currency: 1, currencies: [] },
      });

      // Create subscription
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { status: 'Success', message: 'Subscription added successfully' },
      });

      await client.createSubscription(subscriptionData);

      // Verify auto_renew was set to '1' (true) by default
      const lastCall = mockAxiosInstance.post.mock.calls[mockAxiosInstance.post.mock.calls.length - 1];
      const formData = lastCall[1] as URLSearchParams;
      expect(formData.get('auto_renew')).toBe('1');
    });

    test('should respect explicit auto_renew: false', async () => {
      const subscriptionData: CreateSubscriptionData = {
        name: 'Test Auto-Renew False',
        price: 9.99,
        billing_period: 'monthly',
        auto_renew: false, // Explicitly set to false
      };

      // Reset mocks
      mockAxiosInstance.get.mockReset();
      mockAxiosInstance.post.mockReset();

      // Setup auth
      mockAxiosInstance.post.mockResolvedValueOnce({
        status: 302,
        headers: { 'set-cookie': ['PHPSESSID=test-session; path=/'] },
      });

      // Get main currency
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { success: true, main_currency: 1, currencies: [] },
      });

      // Create subscription
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { status: 'Success', message: 'Subscription added successfully' },
      });

      await client.createSubscription(subscriptionData);

      // Verify auto_renew was set to '0' (false)
      const lastCall = mockAxiosInstance.post.mock.calls[mockAxiosInstance.post.mock.calls.length - 1];
      const formData = lastCall[1] as URLSearchParams;
      expect(formData.get('auto_renew')).toBe('0');
    });

    test('should respect explicit auto_renew: true', async () => {
      const subscriptionData: CreateSubscriptionData = {
        name: 'Test Auto-Renew True',
        price: 15.99,
        billing_period: 'monthly',
        auto_renew: true, // Explicitly set to true
      };

      // Reset mocks
      mockAxiosInstance.get.mockReset();
      mockAxiosInstance.post.mockReset();

      // Setup auth
      mockAxiosInstance.post.mockResolvedValueOnce({
        status: 302,
        headers: { 'set-cookie': ['PHPSESSID=test-session; path=/'] },
      });

      // Get main currency
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: { success: true, main_currency: 1, currencies: [] },
      });

      // Create subscription
      mockAxiosInstance.post.mockResolvedValueOnce({
        data: { status: 'Success', message: 'Subscription added successfully' },
      });

      await client.createSubscription(subscriptionData);

      // Verify auto_renew was set to '1' (true)
      const lastCall = mockAxiosInstance.post.mock.calls[mockAxiosInstance.post.mock.calls.length - 1];
      const formData = lastCall[1] as URLSearchParams;
      expect(formData.get('auto_renew')).toBe('1');
    });
  });
});
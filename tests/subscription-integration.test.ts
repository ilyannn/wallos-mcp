/**
 * Integration tests for subscription management workflows
 * Tests complete end-to-end scenarios including Netflix subscription creation,
 * listing, filtering, and error handling with realistic data
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { WallosClient } from '../src/wallos-client.js';
import { handleCreateSubscription, handleListSubscriptions } from '../src/tools/subscriptions.js';
import type { CreateSubscriptionData } from '../src/types/index.js';

// Skip these integration tests in CI as they require complex mock setup
const SKIP_INTEGRATION_TESTS = process.env.SKIP_DEV_TESTS === 'true';

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

describe.skipIf(SKIP_INTEGRATION_TESTS)('Subscription Integration Tests', () => {
  let client: WallosClient;
  let stderrSpy: ReturnType<typeof mock>;

  const mockConfig = {
    baseUrl: 'http://localhost:8282',
    username: 'testuser',
    password: 'testpass',
    timeout: 10000,
  };

  beforeEach(() => {
    // Clear all mocks
    mockAxios.create.mockClear();
    mockAxiosInstance.get.mockClear();
    mockAxiosInstance.post.mockClear();
    mockCookieJar.getCookies.mockClear();
    mockWrapper.mockClear();

    // Mock stderr
    stderrSpy = mock(() => true);
    process.stderr.write = stderrSpy;

    // Setup default authentication
    mockAxiosInstance.post.mockResolvedValue({
      status: 302,
      headers: {
        'set-cookie': ['PHPSESSID=test-session; path=/'],
      },
    });

    client = new WallosClient(mockConfig);
  });

  describe('Real-World Subscription Scenarios', () => {
    test('should create Netflix Premium subscription with full workflow', async () => {
      // Mock authentication first
      mockAxiosInstance.post
        .mockResolvedValueOnce({
          status: 302,
          headers: {
            'set-cookie': ['PHPSESSID=test-session; path=/'],
          },
        });
      
      // Mock sequence for Netflix subscription creation
      mockAxiosInstance.get
        // Get currencies for USD lookup (not found)
        .mockResolvedValueOnce({
          data: { success: true, currencies: [] },
        })
        // Create USD currency
        .mockResolvedValueOnce({
          data: { success: true, currency_id: 1 },
        })
        // Get categories for Entertainment lookup (not found)
        .mockResolvedValueOnce({
          data: { success: true, categories: [] },
        })
        // Create Entertainment category
        .mockResolvedValueOnce({
          data: { success: true, categoryId: 2 },
        })
        // Get payment methods for Credit Card lookup (not found)
        .mockResolvedValueOnce({
          data: { success: true, payment_methods: [] },
        })
        // Create Credit Card payment method
        .mockResolvedValueOnce({
          data: { success: true, payment_method_id: 3 },
        })
        // Get household members for John Smith lookup (not found)
        .mockResolvedValueOnce({
          data: { success: true, household: [] },
        })
        // Create John Smith household member
        .mockResolvedValueOnce({
          data: { success: true, household_member_id: 4 },
        })
      // Mock subscription creation with POST
      mockAxiosInstance.post
        .mockResolvedValueOnce({
          data: { status: 'Success', message: 'Netflix Premium subscription created successfully' },
        });

      const netflixData: CreateSubscriptionData = {
        name: 'Netflix Premium',
        price: 15.99,
        currency_code: 'USD',
        billing_period: 'monthly',
        category_name: 'Entertainment',
        payment_method_name: 'Credit Card',
        payer_user_name: 'John Smith',
        payer_user_email: 'john@family.com',
        start_date: '2024-01-15',
        auto_renew: true,
        notify: true,
        notify_days_before: 3,
        notes: `Netflix Premium family plan
- 4K streaming
- 4 simultaneous screens
- Includes mobile downloads`,
        url: 'https://netflix.com',
      };

      const result = await handleCreateSubscription(client, netflixData);

      expect(result).toContain('✅ Successfully created subscription!');
      expect(result).toContain('**Message:** Netflix Premium subscription created successfully');
      expect(result).toContain('**Name:** Netflix Premium');
      expect(result).toContain('**Price:** 15.99 USD');
      expect(result).toContain('**Category:** Entertainment');
      expect(result).toContain('**Payment Method:** Credit Card');
      expect(result).toContain('**Payer:** John Smith (john@family.com)');
      expect(result).toContain('**Auto-Renew:** ✅ Yes');
      expect(result).toContain('**Notifications:** 🔔 Enabled (3 days before)');
      expect(result).toContain('automatically created if they didn\'t exist');

      // Verify all API calls were made in correct sequence
      expect(mockAxiosInstance.get).toHaveBeenCalledTimes(8);
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(2); // auth + subscription creation
    });

    test('should create Spotify annual subscription with EUR currency', async () => {
      // Mock authentication first
      mockAxiosInstance.post
        .mockResolvedValueOnce({
          status: 302,
          headers: {
            'set-cookie': ['PHPSESSID=test-session; path=/'],
          },
        });
      
      // Mock sequence for Spotify subscription
      mockAxiosInstance.get
        // Currency lookup fails, create EUR
        .mockResolvedValueOnce({
          data: { success: true, currencies: [] },
        })
        .mockResolvedValueOnce({
          data: { success: true, currency_id: 2 },
        })
        // Category lookup fails, create Music
        .mockResolvedValueOnce({
          data: { success: true, categories: [] },
        })
        .mockResolvedValueOnce({
          data: { success: true, categoryId: 3 },
        })
        // Payment method lookup fails, create PayPal
        .mockResolvedValueOnce({
          data: { success: true, payment_methods: [] },
        })
        .mockResolvedValueOnce({
          data: { success: true, payment_method_id: 4 },
        })
        // Create subscription
      
      // Mock subscription creation with POST
      mockAxiosInstance.post
        .mockResolvedValueOnce({
          data: { status: 'Success', message: 'Spotify Premium subscription created successfully' },
        });

      const spotifyData: CreateSubscriptionData = {
        name: 'Spotify Premium',
        price: 119.88,
        currency_code: 'EUR',
        billing_period: 'yearly',
        category_name: 'Music',
        payment_method_name: 'PayPal',
        auto_renew: true,
        notify: true,
        notify_days_before: 5,
        notes: 'Annual Spotify Premium subscription',
      };

      const result = await handleCreateSubscription(client, spotifyData);

      expect(result).toContain('✅ Successfully created subscription!');
      expect(result).toContain('**Message:** Spotify Premium subscription created successfully');
      expect(result).toContain('**Name:** Spotify Premium');
      expect(result).toContain('**Price:** 119.88 EUR');
      expect(result).toContain('**Billing:** yearly');
      expect(result).toContain('**Category:** Music');
      expect(result).toContain('**Payment Method:** PayPal');
    });

    test('should handle multiple streaming services with different configurations', async () => {
      const streamingServices: CreateSubscriptionData[] = [
        {
          name: 'Disney+ Premium',
          price: 10.99,
          currency_code: 'USD',
          billing_period: 'monthly',
          category_name: 'Entertainment',
          payment_method_name: 'Credit Card',
          payer_user_name: 'Sarah Johnson',
        },
        {
          name: 'HBO Max',
          price: 14.99,
          currency_code: 'USD',
          billing_period: 'monthly',
          category_name: 'Entertainment',
          payment_method_name: 'Debit Card',
          payer_user_name: 'Mike Wilson',
        },
        {
          name: 'Amazon Prime Video',
          price: 99.99,
          currency_code: 'USD',
          billing_period: 'yearly',
          category_name: 'Entertainment',
          payment_method_name: 'Amazon Account',
          notify: true,
          notify_days_before: 7,
        },
      ];

      for (let i = 0; i < streamingServices.length; i++) {
        const service = streamingServices[i];
        
        // Mock authentication first for this service
        mockAxiosInstance.post
          .mockResolvedValueOnce({
            status: 302,
            headers: {
              'set-cookie': ['PHPSESSID=test-session; path=/'],
            },
          });
        
        // Mock responses for each service creation
        if (i === 0) {
          // First service: create all entities
          mockAxiosInstance.get
            .mockResolvedValueOnce({ data: { success: true, currencies: [{ id: 1, code: 'USD' }] } })
            .mockResolvedValueOnce({ data: { success: true, categories: [] } })
            .mockResolvedValueOnce({ data: { success: true, categoryId: 2 } })
            .mockResolvedValueOnce({ data: { success: true, payment_methods: [] } })
            .mockResolvedValueOnce({ data: { success: true, payment_method_id: 3 } })
            .mockResolvedValueOnce({ data: { success: true, household: [] } })
            .mockResolvedValueOnce({ data: { success: true, household_member_id: 4 } });
          
          // Mock subscription creation with POST
          mockAxiosInstance.post
            .mockResolvedValueOnce({ data: { status: 'Success', message: 'Subscription created successfully' } });
        } else {
          // Subsequent services: reuse some entities
          mockAxiosInstance.get
            .mockResolvedValueOnce({ data: { success: true, currencies: [{ id: 1, code: 'USD' }] } })
            .mockResolvedValueOnce({ data: { success: true, categories: [{ id: 2, name: 'Entertainment' }] } })
            .mockResolvedValueOnce({ data: { success: true, payment_methods: [] } })
            .mockResolvedValueOnce({ data: { success: true, payment_method_id: 3 + i } });

          if (service.payer_user_name) {
            mockAxiosInstance.get
              .mockResolvedValueOnce({ data: { success: true, household: [] } })
              .mockResolvedValueOnce({ data: { success: true, household_member_id: 4 + i } });
          }

          // Mock subscription creation with POST
          mockAxiosInstance.post
            .mockResolvedValueOnce({ data: { status: 'Success', message: 'Subscription created successfully' } });
        }

        const result = await handleCreateSubscription(client, service);
        expect(result).toContain('✅ Successfully created subscription!');
        expect(result).toContain(`**Name:** ${service.name}`);
        expect(result).toContain('**Category:** Entertainment');
      }

      expect(mockAxiosInstance.get).toHaveBeenCalled();
    });
  });

  describe('Complete Workflow Tests', () => {
    test('should create subscription and then list it successfully', async () => {
      // Mock authentication first
      mockAxiosInstance.post
        .mockResolvedValueOnce({
          status: 302,
          headers: {
            'set-cookie': ['PHPSESSID=test-session; path=/'],
          },
        });
      
      // Step 1: Create Netflix subscription
      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: { success: true, currencies: [{ id: 1, code: 'USD' }] } })
        .mockResolvedValueOnce({ data: { success: true, categories: [] } })
        .mockResolvedValueOnce({ data: { success: true, categoryId: 2 } })
        .mockResolvedValueOnce({ data: { success: true, payment_methods: [] } })
        .mockResolvedValueOnce({ data: { success: true, payment_method_id: 3 } })
      
      // Mock subscription creation with POST
      mockAxiosInstance.post
        .mockResolvedValueOnce({ data: { status: 'Success', message: 'Netflix subscription created successfully' } });

      const netflixData: CreateSubscriptionData = {
        name: 'Netflix Premium',
        price: 15.99,
        currency_code: 'USD',
        billing_period: 'monthly',
        category_name: 'Entertainment',
        payment_method_name: 'Credit Card',
      };

      const createResult = await handleCreateSubscription(client, netflixData);
      expect(createResult).toContain('✅ Successfully created subscription!');

      // Step 2: List subscriptions and find Netflix
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          success: true,
          subscriptions: [
            {
              id: 300,
              name: 'Netflix Premium',
              price: 15.99,
              currency_id: 1,
              next_payment: '2024-02-15',
              category_name: 'Entertainment',
              payment_method_name: 'Credit Card',
              payer_user_name: 'Default User',
              auto_renew: 1,
              notify: 0,
              inactive: 0,
              url: null,
              notes: null,
              replacement_subscription_id: null,
            },
          ],
        },
      });

      const listResult = await handleListSubscriptions(client, {});
      
      expect(listResult).toContain('Found 1 subscription(s):');
      expect(listResult).toContain('**Netflix Premium** (ID: 300)');
      expect(listResult).toContain('Status: 🟢 Active');
      expect(listResult).toContain('Price: 15.99 (Currency ID: 1)');
      expect(listResult).toContain('Category: Entertainment');
      expect(listResult).toContain('Payment Method: Credit Card');
    });

    test('should create multiple subscriptions and filter by category', async () => {
      // Mock authentication for each subscription creation (3 subscriptions)
      for (let i = 0; i < 3; i++) {
        mockAxiosInstance.post
          .mockResolvedValueOnce({
            status: 302,
            headers: {
              'set-cookie': ['PHPSESSID=test-session; path=/'],
            },
          });
      }
      
      // Create subscriptions (mocked as successful)
      for (let i = 0; i < 3; i++) {
        mockAxiosInstance.post.mockResolvedValue({ data: { status: 'Success', message: 'Subscription created successfully' } });
      }

      // Mock listing with Entertainment filter
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          success: true,
          subscriptions: [
            {
              id: 400,
              name: 'Netflix Premium',
              price: 15.99,
              currency_id: 1,
              next_payment: '2024-02-15',
              category_name: 'Entertainment',
              payment_method_name: 'Credit Card',
              payer_user_name: 'John Doe',
              auto_renew: 1,
              notify: 1,
              inactive: 0,
              url: 'https://netflix.com',
              notes: 'Family plan',
              replacement_subscription_id: null,
            },
            {
              id: 401,
              name: 'Disney+ Premium',
              price: 10.99,
              currency_id: 1,
              next_payment: '2024-02-20',
              category_name: 'Entertainment',
              payment_method_name: 'Credit Card',
              payer_user_name: 'John Doe',
              auto_renew: 1,
              notify: 0,
              inactive: 0,
              url: null,
              notes: null,
              replacement_subscription_id: null,
            },
          ],
        },
      });

      const listResult = await handleListSubscriptions(client, {
        category_ids: '2',
        state: 'active',
        sort: 'name',
      });

      expect(listResult).toContain('Found 2 subscription(s):');
      expect(listResult).toContain('Netflix Premium');
      expect(listResult).toContain('Disney+ Premium');
      expect(listResult).toContain('Category: Entertainment');
    });

    test('should handle subscription creation with flexible frequency formats', async () => {
      // Mock authentication for each frequency test (3 test cases)
      for (let i = 0; i < 3; i++) {
        mockAxiosInstance.post
          .mockResolvedValueOnce({
            status: 302,
            headers: {
              'set-cookie': ['PHPSESSID=test-session; path=/'],
            },
          });
      }
      
      const frequencyTestCases = [
        { period: 'bi-weekly', expectedInResult: 'bi-weekly' },
        { period: 'quarterly', expectedInResult: 'quarterly' },
        { period: '2 weeks', expectedInResult: '2 weeks' },
        { period: '3 months', expectedInResult: '3 months' },
        { period: 'semi-annually', expectedInResult: 'semi-annually' },
      ];

      for (const testCase of frequencyTestCases) {
        // Mock successful creation
        mockAxiosInstance.get
          .mockResolvedValueOnce({ data: { success: true, currencies: [{ id: 1, code: 'USD' }] } })
      
      // Mock subscription creation with POST
      mockAxiosInstance.post
        .mockResolvedValueOnce({ data: { status: 'Success', message: 'Gaming service subscription created successfully' } });

        const subscriptionData: CreateSubscriptionData = {
          name: `Test Service - ${testCase.period}`,
          price: 19.99,
          currency_code: 'USD',
          billing_period: testCase.period,
          category_id: 1,
        };

        const result = await handleCreateSubscription(client, subscriptionData);
        
        expect(result).toContain('✅ Successfully created subscription!');
        expect(result).toContain(`**Billing:** ${testCase.expectedInResult}`);
      }
    });
  });

  describe('Currency and International Handling', () => {
    test('should create subscriptions with various international currencies', async () => {
      // Mock authentication for each international service (4 services)
      for (let i = 0; i < 4; i++) {
        mockAxiosInstance.post
          .mockResolvedValueOnce({
            status: 302,
            headers: {
              'set-cookie': ['PHPSESSID=test-session; path=/'],
            },
          });
      }
      
      const internationalServices = [
        { name: 'BBC iPlayer', price: 10.99, currency: 'GBP', country: 'UK' },
        { name: 'Canal+', price: 19.99, currency: 'EUR', country: 'France' },
        { name: 'Netflix Japan', price: 1490, currency: 'JPY', country: 'Japan' },
        { name: 'Hotstar India', price: 299, currency: 'INR', country: 'India' },
      ];

      for (let i = 0; i < internationalServices.length; i++) {
        const service = internationalServices[i];
        
        // Mock currency creation for each service
        mockAxiosInstance.get
          .mockResolvedValueOnce({ data: { success: true, currencies: [] } })
          .mockResolvedValueOnce({ data: { success: true, currency_id: i + 10 } })
          // Category lookup and creation
          .mockResolvedValueOnce({ data: { success: true, categories: [] } })
          .mockResolvedValueOnce({ data: { success: true, categoryId: i + 5 } })
      
      // Mock subscription creation with POST
      mockAxiosInstance.post
        .mockResolvedValue({ data: { status: 'Success', message: 'Subscription created successfully' } });

        const subscriptionData: CreateSubscriptionData = {
          name: service.name,
          price: service.price,
          currency_code: service.currency,
          billing_period: 'monthly',
          category_name: 'International Entertainment',
        };

        const result = await handleCreateSubscription(client, subscriptionData);
        
        expect(result).toContain('✅ Successfully created subscription!');
        expect(result).toContain(`**Name:** ${service.name}`);
        expect(result).toContain(`**Price:** ${service.price} ${service.currency}`);
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle subscription creation failure gracefully', async () => {
      // Mock authentication first
      mockAxiosInstance.post
        .mockResolvedValueOnce({
          status: 302,
          headers: {
            'set-cookie': ['PHPSESSID=test-session; path=/'],
          },
        });
      
      // Mock authentication success but subscription creation failure
      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: { success: true, currencies: [{ id: 1, code: 'USD' }] } })
        .mockResolvedValueOnce({ 
          data: { 
            success: false, 
            errorMessage: 'Subscription name already exists' 
          } 
        });

      const duplicateData: CreateSubscriptionData = {
        name: 'Netflix Premium',
        price: 15.99,
        currency_code: 'USD',
      };

      const result = await handleCreateSubscription(client, duplicateData);
      
      expect(result).toContain('❌ Error creating subscription:');
      expect(result).toContain('Subscription name already exists');
    });

    test('should handle listing when no subscriptions exist', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          success: true,
          subscriptions: [],
        },
      });

      const result = await handleListSubscriptions(client, {});
      expect(result).toBe('No subscriptions found matching the specified filters.');
    });

    test('should handle network errors during creation', async () => {
      mockAxiosInstance.get.mockRejectedValueOnce(new Error('Network timeout'));

      const networkData: CreateSubscriptionData = {
        name: 'Test Service',
        price: 9.99,
      };

      const result = await handleCreateSubscription(client, networkData);
      expect(result).toContain('❌ Error creating subscription:');
      expect(result).toContain('Network timeout');
    });

    test('should handle API errors during listing', async () => {
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          success: false,
          title: 'API Error: Authentication failed',
        },
      });

      const result = await handleListSubscriptions(client, {});
      expect(result).toContain('Error listing subscriptions:');
      expect(result).toContain('API Error: Authentication failed');
    });

    test('should handle invalid billing period gracefully', async () => {
      // Mock authentication first
      mockAxiosInstance.post
        .mockResolvedValueOnce({
          status: 302,
          headers: {
            'set-cookie': ['PHPSESSID=test-session; path=/'],
          },
        });
      
      // Mock successful currency lookup and subscription creation
      mockAxiosInstance.get
        .mockResolvedValueOnce({ data: { success: true, currencies: [{ id: 1, code: 'USD' }] } })
      
      // Mock subscription creation with POST  
      mockAxiosInstance.post
        .mockResolvedValueOnce({ data: { status: 'Success', message: 'Subscription created successfully' } });

      const invalidFrequencyData: CreateSubscriptionData = {
        name: 'Test Service',
        price: 9.99,
        currency_code: 'USD',
        billing_period: 'invalid-frequency-format',
      };

      const result = await handleCreateSubscription(client, invalidFrequencyData);
      
      // Should warn about unparseable frequency but still succeed
      expect(stderrSpy).toHaveBeenCalledWith(
        'Warning: Unable to parse billing period "invalid-frequency-format", defaulting to monthly\n'
      );
      expect(result).toContain('✅ Successfully created subscription!');
    });
  });

  describe('Performance and Concurrency Tests', () => {
    test('should handle bulk subscription creation efficiently', async () => {
      // Mock authentication for bulk creation (5 subscriptions)
      for (let i = 0; i < 5; i++) {
        mockAxiosInstance.post
          .mockResolvedValueOnce({
            status: 302,
            headers: {
              'set-cookie': ['PHPSESSID=test-session; path=/'],
            },
          });
      }
      
      const bulkSubscriptions: CreateSubscriptionData[] = Array.from({ length: 5 }, (_, i) => ({
        name: `Bulk Service ${i + 1}`,
        price: 10 + i,
        currency_id: 1, // Use existing currency ID to avoid lookup
        category_id: 1,  // Use existing category ID to avoid lookup
        billing_period: 'monthly',
      }));

      // Mock simple successful creation for each
      for (let i = 0; i < bulkSubscriptions.length; i++) {
        mockAxiosInstance.get.mockResolvedValueOnce({
          data: { status: 'Success', message: 'Subscription created successfully' },
        });
      }

      const startTime = Date.now();
      
      const results = await Promise.all(
        bulkSubscriptions.map(sub => handleCreateSubscription(client, sub))
      );

      const endTime = Date.now();
      const duration = endTime - startTime;

      // All should succeed
      results.forEach((result, index) => {
        expect(result).toContain('✅ Successfully created subscription!');
        expect(result).toContain(`**Name:** Bulk Service ${index + 1}`);
      });

      // Should complete in reasonable time (adjust threshold as needed)
      expect(duration).toBeLessThan(2000); // 2 seconds for 5 subscriptions
    });

    test('should handle large subscription list efficiently', async () => {
      // Mock large subscription list
      const largeSubscriptionList = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        name: `Service ${i + 1}`,
        price: 10 + (i % 50),
        currency_id: 1,
        next_payment: `2024-${(i % 12) + 1}-15`,
        category_name: `Category ${(i % 5) + 1}`,
        payment_method_name: 'Credit Card',
        payer_user_name: 'Test User',
        auto_renew: 1,
        notify: i % 2,
        inactive: 0,
        url: null,
        notes: null,
        replacement_subscription_id: null,
      }));

      mockAxiosInstance.get.mockResolvedValueOnce({
        data: {
          success: true,
          subscriptions: largeSubscriptionList,
        },
      });

      const startTime = Date.now();
      const result = await handleListSubscriptions(client, {});
      const endTime = Date.now();

      expect(result).toContain('Found 100 subscription(s):');
      expect(result).toContain('Service 1');
      expect(result).toContain('Service 100');
      
      // Should handle large list efficiently
      expect(endTime - startTime).toBeLessThan(1000); // 1 second
    });
  });
});
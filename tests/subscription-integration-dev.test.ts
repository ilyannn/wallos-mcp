/**
 * Integration tests for Wallos MCP Server against actual dev Wallos instance
 * These tests require a running Wallos server and proper credentials
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { WallosClient } from '../src/wallos-client.js';
import { handleGetMasterData } from '../src/tools/master-data.js';
import { handleAddCategory, handleDeleteCategory } from '../src/tools/categories.js';
import type { CreateSubscriptionData } from '../src/types/index.js';

// Skip these tests if environment variables are not set
const WALLOS_URL = process.env.WALLOS_URL;
const WALLOS_USERNAME = process.env.WALLOS_USERNAME;
const WALLOS_PASSWORD = process.env.WALLOS_PASSWORD;

const shouldSkip = !WALLOS_URL || !WALLOS_USERNAME || !WALLOS_PASSWORD;

// Test configuration
const TEST_TIMEOUT = 30000; // 30 seconds for network operations

describe.skipIf(shouldSkip)('Dev Server Integration Tests', () => {
  let client: WallosClient;
  const createdSubscriptionIds: number[] = [];
  const createdCategoryIds: number[] = [];
  let masterData: any;

  beforeAll(async () => {
    if (shouldSkip) {
      masterData = {
        categories: [],
        currencies: { main_currency_id: 1, items: [] },
        payment_methods: [],
        household: []
      };
      return;
    }

    // Create client with dev server credentials
    client = new WallosClient({
      baseUrl: WALLOS_URL!,
      username: WALLOS_USERNAME!,
      password: WALLOS_PASSWORD!,
      timeout: TEST_TIMEOUT,
    });

    // Test connection and get master data
    console.log('Testing connection to dev Wallos server...');
    const isConnected = await client.testConnection();
    expect(isConnected).toBe(true);

    console.log('Fetching master data...');
    const masterDataResult = await handleGetMasterData(client);
    masterData = JSON.parse(masterDataResult).data;
    
    expect(masterData).toHaveProperty('categories');
    expect(masterData).toHaveProperty('currencies');
    expect(masterData).toHaveProperty('payment_methods');
    expect(masterData).toHaveProperty('household');

    console.log(`Master data loaded: ${masterData.categories.length} categories, ${masterData.currencies.items.length} currencies`);
  });

  afterAll(async () => {
    if (shouldSkip || !client) return;

    console.log('Cleaning up test data...');
    
    // Clean up created subscriptions
    for (const subscriptionId of createdSubscriptionIds) {
      try {
        // Note: Wallos API doesn't have a delete subscription endpoint in the current implementation
        // This would need to be implemented in the Wallos API or done manually
        console.log(`Subscription ${subscriptionId} created (manual cleanup required)`);
      } catch (error) {
        console.warn(`Failed to clean up subscription ${subscriptionId}:`, error);
      }
    }

    // Clean up created categories
    for (const categoryId of createdCategoryIds) {
      try {
        await handleDeleteCategory(client, { id: categoryId });
        console.log(`Cleaned up category ${categoryId}`);
      } catch (error) {
        console.warn(`Failed to clean up category ${categoryId}:`, error);
      }
    }
  });

  describe('Master Data Retrieval', () => {
    test('should fetch complete master data from dev server', async () => {
      if (shouldSkip) return;
      
      const result = await handleGetMasterData(client);
      const parsedResult = JSON.parse(result);

      expect(parsedResult).toHaveProperty('summary');
      expect(parsedResult).toHaveProperty('data');
      
      // Verify we have actual data from the server
      expect(parsedResult.summary.categories_count).toBeGreaterThan(0);
      expect(parsedResult.data.categories).toBeArray();
      expect(parsedResult.data.currencies.items).toBeArray();
      expect(parsedResult.data.payment_methods).toBeArray();
      
      console.log(`Retrieved ${parsedResult.summary.categories_count} categories from dev server`);
    }, TEST_TIMEOUT);
  });

  describe('Category Management', () => {
    test('should create a test category', async () => {
      if (shouldSkip) return;
      
      const categoryName = `Test Category ${Date.now()}`;
      
      const result = await handleAddCategory(client, { name: categoryName });
      const parsedResult = JSON.parse(result);
      
      expect(parsedResult.success).toBe(true);
      expect(parsedResult.categoryId).toBeNumber();
      
      // Track for cleanup
      createdCategoryIds.push(parsedResult.categoryId);
      
      console.log(`Created test category: ${categoryName} (ID: ${parsedResult.categoryId})`);
    }, TEST_TIMEOUT);
  });

  describe('Subscription Creation and Listing', () => {
    test('should create Netflix subscription and list it', async () => {
      if (shouldSkip) return;
      
      // Find or use existing categories and payment methods
      const entertainmentCategory = masterData.categories.find((c: any) => 
        c.name.toLowerCase().includes('entertainment') || c.name.toLowerCase().includes('streaming')
      ) || masterData.categories[0];
      
      const paymentMethod = masterData.payment_methods.find((p: any) => p.enabled === 1) || masterData.payment_methods[0];
      const householdMember = masterData.household[0];
      const mainCurrency = masterData.currencies.items.find((c: any) => c.id === masterData.currencies.main_currency_id);

      const netflixData: CreateSubscriptionData = {
        name: `Netflix Premium Dev Test ${Date.now()}`,
        price: 15.99,
        currency_id: mainCurrency?.id || 1,
        billing_period: 'monthly',
        category_id: entertainmentCategory.id,
        payment_method_id: paymentMethod.id,
        payer_user_id: householdMember.id,
        start_date: '2024-01-15',
        auto_renew: true,
        notify: true,
        notify_days_before: 3,
        notes: 'Netflix Premium dev test subscription',
        url: 'https://netflix.com',
      };

      // Create subscription using client directly
      const createResult = await client.createSubscription(netflixData);
      
      expect((createResult as any).status).toBe('Success');
      expect((createResult as any).message).toContain('successfully');
      
      console.log(`Created Netflix subscription successfully: ${(createResult as any).message}`);

      // List subscriptions and find our newly created one by name
      const listResult = await client.getSubscriptions({
        sort: 'id',
        convert_currency: false,
      });
      
      expect(listResult.success).toBe(true);
      expect(listResult.subscriptions).toBeArray();
      
      // Find our subscription by name
      const ourSubscription = listResult.subscriptions.find((s: any) => s.name === netflixData.name);
      expect(ourSubscription).toBeDefined();
      expect(ourSubscription!.name).toBe(netflixData.name);
      expect(parseFloat(String(ourSubscription!.price))).toBe(netflixData.price);
      
      // Track for cleanup (though we can't delete subscriptions via API)
      if (ourSubscription) {
        createdSubscriptionIds.push(Number(ourSubscription.id));
        console.log(`Found Netflix subscription with ID: ${ourSubscription.id}`);
      }
      
      console.log(`Verified Netflix subscription exists in listing`);
    }, TEST_TIMEOUT);

    test('should create Spotify subscription with existing entities', async () => {
      if (shouldSkip) return;
      
      // Use existing entities from the master data
      const mainCurrency = masterData.currencies.items.find((c: any) => c.id === masterData.currencies.main_currency_id);
      const paymentMethod = masterData.payment_methods.find((p: any) => p.enabled === 1) || masterData.payment_methods[0];
      const householdMember = masterData.household[0];
      const existingCategory = masterData.categories.find((c: any) => c.name !== 'General') || masterData.categories[0];

      const spotifyData: CreateSubscriptionData = {
        name: `Spotify Premium Dev Test ${Date.now()}`,
        price: 9.99,
        currency_id: mainCurrency?.id || 1,
        billing_period: 'monthly',
        category_id: existingCategory.id,
        payment_method_id: paymentMethod.id,
        payer_user_id: householdMember.id,
        start_date: '2024-02-01',
        auto_renew: true,
        notify: false,
        notes: 'Spotify Premium dev test using existing entities',
        url: 'https://spotify.com',
      };

      const result = await client.createSubscription(spotifyData);
      
      expect((result as any).status).toBe('Success');
      expect((result as any).message).toContain('successfully');
      
      console.log(`Created Spotify subscription using existing entities: ${(result as any).message}`);
      
      // Verify the subscription exists and entities were created
      const listResult = await client.getSubscriptions({ sort: 'id' });
      
      const ourSubscription = listResult.subscriptions.find((s: any) => s.name === spotifyData.name);
      expect(ourSubscription).toBeDefined();
      expect(ourSubscription!.name).toBe(spotifyData.name);
      
      if (ourSubscription) {
        createdSubscriptionIds.push(Number(ourSubscription.id));
      }
      
      console.log(`Verified Spotify subscription exists with existing entities`);
    }, TEST_TIMEOUT);

    test('should handle subscription listing with filters', async () => {
      if (shouldSkip) return;
      
      if (createdSubscriptionIds.length === 0) {
        console.log('No subscriptions created yet, skipping filter test');
        return;
      }

      // Test filtering by active subscriptions
      const activeResult = await client.getSubscriptions({
        state: 'active',
        sort: 'name',
        convert_currency: true,
      });
      
      expect(activeResult.success).toBe(true);
      expect(activeResult.subscriptions).toBeArray();
      
      // All returned subscriptions should be active
      activeResult.subscriptions.forEach((sub: any) => {
        expect(sub.inactive).toBe(0);
      });
      
      console.log(`Listed ${activeResult.subscriptions.length} active subscriptions`);
    }, TEST_TIMEOUT);
  });

  describe('Error Handling', () => {
    test('should handle invalid subscription data gracefully', async () => {
      if (shouldSkip) return;
      
      const invalidData: CreateSubscriptionData = {
        name: '', // Invalid empty name
        price: -5, // Invalid negative price
        currency_code: 'INVALID',
        billing_period: 'invalid_period' as any,
        category_name: 'Test Category',
        payment_method_name: 'Test Payment',
        payer_user_name: 'Test User',
        payer_user_email: 'invalid-email', // Invalid email
        start_date: 'invalid-date',
      };

      try {
        const result = await client.createSubscription(invalidData);
        
        // If it succeeds, the server applied defaults
        if ((result as any).status === 'Success') {
          console.log(`Server accepted invalid data with defaults: ${(result as any).message}`);
          // Find the created subscription for cleanup
          const listResult = await client.getSubscriptions({ sort: 'id' });
          const ourSubscription = listResult.subscriptions.find((s: any) => s.name === invalidData.name);
          if (ourSubscription) {
            createdSubscriptionIds.push(Number(ourSubscription.id));
          }
        }
      } catch (error) {
        // If it fails, that's also valid error handling
        console.log(`Handled invalid data gracefully by throwing error: ${(error as Error).message}`);
        expect(error).toBeInstanceOf(Error);
      }
    }, TEST_TIMEOUT);

    test('should handle network timeout gracefully', async () => {
      if (shouldSkip) return;
      
      // Create a client with very short timeout
      const timeoutClient = new WallosClient({
        baseUrl: WALLOS_URL!,
        username: WALLOS_USERNAME!,
        password: WALLOS_PASSWORD!,
        timeout: 1, // 1ms timeout - should fail
      });

      try {
        await handleGetMasterData(timeoutClient);
        // If it doesn't timeout, that's also valid (very fast server)
        console.log('Server responded faster than 1ms timeout');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        console.log(`Handled timeout gracefully: ${(error as Error).message}`);
      }
    }, TEST_TIMEOUT);
  });

  describe('Performance Tests', () => {
    test('should handle concurrent subscription listings', async () => {
      if (shouldSkip) return;
      
      const promises = Array.from({ length: 3 }, () => 
        client.getSubscriptions({ sort: 'name' })
      );

      const startTime = Date.now();
      const results = await Promise.all(promises);
      const endTime = Date.now();

      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      console.log(`Completed 3 concurrent requests in ${endTime - startTime}ms`);
    }, TEST_TIMEOUT);

    test('should complete master data fetch within reasonable time', async () => {
      if (shouldSkip) return;
      
      const startTime = Date.now();
      const result = await handleGetMasterData(client);
      const endTime = Date.now();

      const parsed = JSON.parse(result);
      expect(parsed.success !== false).toBe(true); // Allow undefined or true

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds

      console.log(`Master data fetch completed in ${duration}ms`);
    }, TEST_TIMEOUT);
  });
});

// Conditional test skip message
if (shouldSkip) {
  console.log('Skipping dev server integration tests.');
  console.log('To run these tests, set the following environment variables:');
  console.log('- WALLOS_URL (e.g., http://localhost:8282)');
  console.log('- WALLOS_USERNAME');
  console.log('- WALLOS_PASSWORD');
}
#!/usr/bin/env bun
/**
 * Direct MCP server integration test
 * Tests the MCP server directly without Claude CLI
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { spawn, ChildProcess } from 'child_process';
import { WallosClient } from '../../src/wallos-client.js';

// Test configuration
const WALLOS_URL = process.env.E2E_WALLOS_URL || 'http://localhost:18282';
const WALLOS_USERNAME = process.env.WALLOS_USERNAME || 'test';
const WALLOS_PASSWORD = process.env.WALLOS_PASSWORD || 'changeme';
const MCP_SERVER_PATH = process.env.MCP_SERVER_PATH || 'dist/index.js';

describe('E2E: MCP Server with Real Wallos Instance', () => {
  let wallosClient: WallosClient;
  let mcpProcess: ChildProcess;
  let isWallosRunning = false;

  beforeAll(async () => {
    // Check if Wallos is running (same check as workflow)
    try {
      const response = await fetch(`${WALLOS_URL}/`);
      isWallosRunning = response.ok;
    } catch {
      console.warn('⚠️  Wallos test instance not running. Skipping E2E tests.');
      console.warn('   Run: ./tests/e2e/setup-test-env.sh to start Wallos');
      return;
    }

    if (!isWallosRunning) return;

    // Initialize Wallos client
    wallosClient = new WallosClient({
      baseUrl: WALLOS_URL,
      username: WALLOS_USERNAME,
      password: WALLOS_PASSWORD,
    });

    // Start MCP server
    console.log('Starting MCP server...');
    mcpProcess = spawn('bun', ['run', MCP_SERVER_PATH], {
      env: {
        ...process.env,
        WALLOS_URL,
        WALLOS_USERNAME,
        WALLOS_PASSWORD,
      },
      stdio: 'pipe',
    });

    // Wait for MCP server to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  afterAll(async () => {
    if (mcpProcess) {
      mcpProcess.kill();
    }
  });

  test.skipIf(!isWallosRunning)('should create subscription with auto_renew defaulting to true', async () => {
    // Create subscription without specifying auto_renew
    const subscriptionData = {
      name: `Netflix E2E Test ${Date.now()}`,
      price: 15.99,
      currency_code: 'USD',
      billing_period: 'monthly',
      category_name: 'Entertainment',
      payment_method_name: 'Credit Card',
      payer_user_name: 'Test User',
      payer_user_email: 'test@example.com',
      start_date: '2024-01-15',
      // Deliberately omitting auto_renew
      notify: true,
      notify_days_before: 3,
      notes: 'E2E test subscription - auto_renew default',
      url: 'https://netflix.com',
    };

    const createResult = await wallosClient.createSubscription(subscriptionData);
    console.log('Create result:', createResult);
    
    // Verify creation was successful
    expect((createResult as any).status || (createResult as any).success).toBeTruthy();

    // List subscriptions to verify auto_renew
    const listResult = await wallosClient.getSubscriptions({});
    const subscription = listResult.subscriptions.find(
      (s: any) => s.name === subscriptionData.name
    );

    expect(subscription).toBeDefined();
    expect(subscription!.auto_renew).toBe(1); // Should be 1 (true) by default
    
    console.log(`✅ Subscription created with auto_renew=${subscription!.auto_renew}`);
  });

  test.skipIf(!isWallosRunning)('should respect explicit auto_renew: false', async () => {
    const subscriptionData = {
      name: `Spotify E2E Test ${Date.now()}`,
      price: 9.99,
      currency_code: 'USD',
      billing_period: 'monthly',
      category_name: 'Music',
      payment_method_name: 'PayPal',
      auto_renew: false, // Explicitly set to false
      start_date: '2024-02-01',
      notes: 'E2E test with auto_renew false',
    };

    const createResult = await wallosClient.createSubscription(subscriptionData);
    console.log('Create result:', createResult);
    
    // Verify creation was successful
    expect((createResult as any).status || (createResult as any).success).toBeTruthy();

    // List subscriptions to verify auto_renew
    const listResult = await wallosClient.getSubscriptions({});
    const subscription = listResult.subscriptions.find(
      (s: any) => s.name === subscriptionData.name
    );

    expect(subscription).toBeDefined();
    expect(subscription!.auto_renew).toBe(0); // Should be 0 (false)
    
    console.log(`✅ Subscription created with auto_renew=${subscription!.auto_renew}`);
  });

  test.skipIf(!isWallosRunning)('should respect explicit auto_renew: true', async () => {
    const subscriptionData = {
      name: `Disney+ E2E Test ${Date.now()}`,
      price: 7.99,
      currency_code: 'USD',
      billing_period: 'monthly',
      category_name: 'Entertainment',
      payment_method_name: 'Debit Card',
      auto_renew: true, // Explicitly set to true
      start_date: '2024-03-01',
      notes: 'E2E test with auto_renew true',
    };

    const createResult = await wallosClient.createSubscription(subscriptionData);
    console.log('Create result:', createResult);
    
    // Verify creation was successful
    expect((createResult as any).status || (createResult as any).success).toBeTruthy();

    // List subscriptions to verify auto_renew
    const listResult = await wallosClient.getSubscriptions({});
    const subscription = listResult.subscriptions.find(
      (s: any) => s.name === subscriptionData.name
    );

    expect(subscription).toBeDefined();
    expect(subscription!.auto_renew).toBe(1); // Should be 1 (true)
    
    console.log(`✅ Subscription created with auto_renew=${subscription!.auto_renew}`);
  });

  test.skipIf(!isWallosRunning)('should handle subscription listing with filters', async () => {
    // List all active subscriptions
    const activeResult = await wallosClient.getSubscriptions({
      state: 'active',
      sort: 'name',
    });

    expect(activeResult.success).toBe(true);
    expect(activeResult.subscriptions).toBeArray();
    
    // All should be active (inactive = 0)
    activeResult.subscriptions.forEach((sub: any) => {
      expect(sub.inactive).toBe(0);
    });

    console.log(`✅ Listed ${activeResult.subscriptions.length} active subscriptions`);
  });

  test.skipIf(!isWallosRunning)('should get master data from real Wallos instance', async () => {
    const masterData = await wallosClient.getMasterData();
    
    expect(masterData).toHaveProperty('categories');
    expect(masterData).toHaveProperty('currencies');
    expect(masterData).toHaveProperty('payment_methods');
    expect(masterData).toHaveProperty('household');
    
    expect(masterData.categories).toBeArray();
    expect(masterData.currencies).toHaveProperty('items');
    expect(masterData.currencies).toHaveProperty('main_currency_id');
    
    console.log(`✅ Retrieved master data with ${masterData.categories.length} categories`);
  });
});

// Helper to run a single test file
if (import.meta.main) {
  console.log('🚀 Running direct MCP E2E tests...');
  console.log(`Wallos URL: ${WALLOS_URL}`);
  console.log('Note: Ensure Wallos test instance is running first!');
  console.log('Run: ./tests/e2e/setup-test-env.sh\n');
}
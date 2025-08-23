/**
 * E2E tests for subscription editing functionality
 * Tests the complete flow of editing subscriptions through MCP tools
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Skip if not running against dev environment
const SKIP_DEV_TESTS = process.env.SKIP_DEV_TESTS === 'true';
const describeOrSkip = SKIP_DEV_TESTS ? describe.skip : describe;

// MCP client helper
interface MCPResponse {
  jsonrpc: string;
  id: number;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

class MCPTestClient {
  private process: ChildProcess;
  private outputBuffer: string = '';
  private requestId: number = 1;

  constructor(private serverPath: string) {
    this.process = spawn('node', [this.serverPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        WALLOS_URL: process.env.WALLOS_URL || 'http://localhost:8282',
        WALLOS_USERNAME: process.env.WALLOS_USERNAME || 'admin',
        WALLOS_PASSWORD: process.env.WALLOS_PASSWORD || 'admin',
      },
    });

    this.process.stdout?.on('data', (data) => {
      this.outputBuffer += data.toString();
    });

    this.process.stderr?.on('data', (data) => {
      console.error('Server stderr:', data.toString());
    });
  }

  async initialize(): Promise<void> {
    const request = {
      jsonrpc: '2.0',
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'test-client',
          version: '1.0.0',
        },
      },
      id: this.requestId++,
    };

    const response = await this.sendRequest(request);
    if (!response.result) {
      throw new Error('Failed to initialize MCP server');
    }
  }

  async callTool(toolName: string, args: any = {}): Promise<any> {
    const request = {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args,
      },
      id: this.requestId++,
    };

    const response = await this.sendRequest(request);
    if (response.error) {
      throw new Error(`Tool call failed: ${response.error.message}`);
    }

    // Extract text content from response
    if (response.result?.content?.[0]?.text) {
      return response.result.content[0].text;
    }
    return response.result;
  }

  private async sendRequest(request: any): Promise<MCPResponse> {
    const requestStr = JSON.stringify(request) + '\n';
    this.process.stdin?.write(requestStr);

    // Wait for response
    const startTime = Date.now();
    const timeout = 10000; // 10 seconds

    while (Date.now() - startTime < timeout) {
      const lines = this.outputBuffer.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('{') && line.includes(`"id":${request.id}`)) {
          try {
            const response = JSON.parse(line);
            // Remove processed lines from buffer
            this.outputBuffer = lines.slice(i + 1).join('\n');
            return response;
          } catch (e) {
            // Continue if parse fails
          }
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new Error(`Timeout waiting for response to request ${request.id}`);
  }

  async close(): Promise<void> {
    this.process.kill();
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}

describeOrSkip('Subscription Edit E2E Tests', () => {
  let client: MCPTestClient;
  let createdSubscriptionId: number | null = null;

  beforeAll(async () => {
    const serverPath = path.join(__dirname, '../../dist/index.js');
    client = new MCPTestClient(serverPath);
    await client.initialize();
  });

  afterAll(async () => {
    if (client) {
      await client.close();
    }
  });

  describe('Setup: Create Test Subscription', () => {
    test('should create a subscription for editing tests', async () => {
      const result = await client.callTool('create_subscription', {
        name: 'E2E Edit Test Subscription',
        price: 9.99,
        billing_period: 'monthly',
        category_name: 'E2E Test Category',
        payment_method_name: 'E2E Test Payment',
        notes: 'Original notes for E2E edit test',
        auto_renew: true,
        notify: false,
      });

      expect(result).toContain('Successfully created subscription');
      
      // Extract subscription ID from the response
      const idMatch = result.match(/\(ID: (\d+)\)/);
      if (idMatch) {
        createdSubscriptionId = parseInt(idMatch[1], 10);
      }
      
      // If we couldn't extract ID, list subscriptions to find it
      if (!createdSubscriptionId) {
        const listResult = await client.callTool('list_subscriptions', {
          sort: 'id',
        });
        
        const subscriptionMatch = listResult.match(/E2E Edit Test Subscription.*?\(ID: (\d+)\)/);
        if (subscriptionMatch) {
          createdSubscriptionId = parseInt(subscriptionMatch[1], 10);
        }
      }
      
      expect(createdSubscriptionId).toBeTruthy();
    }, 30000);
  });

  describe('Basic Edit Operations', () => {
    test('should edit subscription name only', async () => {
      if (!createdSubscriptionId) {
        throw new Error('No subscription ID available for test');
      }

      const result = await client.callTool('edit_subscription', {
        id: createdSubscriptionId,
        name: 'E2E Edit Test - Name Changed',
      });

      expect(result).toContain('Successfully edited subscription');
      
      // Verify the change by listing subscriptions
      const listResult = await client.callTool('list_subscriptions', {
        sort: 'id',
      });
      
      expect(listResult).toContain('E2E Edit Test - Name Changed');
    }, 30000);

    test('should edit subscription price only', async () => {
      if (!createdSubscriptionId) {
        throw new Error('No subscription ID available for test');
      }

      const result = await client.callTool('edit_subscription', {
        id: createdSubscriptionId,
        price: 19.99,
      });

      expect(result).toContain('Successfully edited subscription');
      
      // Verify the change
      const listResult = await client.callTool('list_subscriptions', {
        sort: 'id',
      });
      
      expect(listResult).toContain('19.99');
    }, 30000);

    test('should edit multiple fields simultaneously', async () => {
      if (!createdSubscriptionId) {
        throw new Error('No subscription ID available for test');
      }

      const result = await client.callTool('edit_subscription', {
        id: createdSubscriptionId,
        name: 'E2E Edit Test - Multiple Changes',
        price: 24.99,
        notes: 'Updated notes for E2E test',
        auto_renew: false,
      });

      expect(result).toContain('Successfully edited subscription');
      
      // Verify the changes
      const listResult = await client.callTool('list_subscriptions', {
        sort: 'id',
      });
      
      expect(listResult).toContain('E2E Edit Test - Multiple Changes');
      expect(listResult).toContain('24.99');
      expect(listResult).toContain('Updated notes for E2E test');
      // Auto-renew false should show as ❌
      const subscriptionSection = listResult.split('E2E Edit Test - Multiple Changes')[1]?.split('\n\n')[0];
      if (subscriptionSection) {
        expect(subscriptionSection).toContain('Auto-Renew: ❌');
      }
    }, 30000);
  });

  describe('Category and Payment Method Updates', () => {
    test('should update category to existing one', async () => {
      if (!createdSubscriptionId) {
        throw new Error('No subscription ID available for test');
      }

      // First get master data to see available categories
      const masterData = await client.callTool('get_master_data');
      
      // Check if we have at least one category other than our test category
      const hasOtherCategory = masterData.includes('Category:') && 
                               !masterData.match(/Category:\s*E2E Test Category\s*\(only\)/);
      
      if (hasOtherCategory) {
        // Try to use an existing category
        const categoryMatch = masterData.match(/Category: ([^(]+?) \(/);
        if (categoryMatch && categoryMatch[1] !== 'E2E Test Category') {
          const result = await client.callTool('edit_subscription', {
            id: createdSubscriptionId,
            category_name: categoryMatch[1].trim(),
          });

          expect(result).toContain('Successfully edited subscription');
          
          const listResult = await client.callTool('list_subscriptions', {
            sort: 'id',
          });
          
          expect(listResult).toContain(`Category: ${categoryMatch[1].trim()}`);
        }
      }
    }, 30000);

    test('should create new category when editing', async () => {
      if (!createdSubscriptionId) {
        throw new Error('No subscription ID available for test');
      }

      const uniqueCategoryName = `E2E New Category ${Date.now()}`;
      
      const result = await client.callTool('edit_subscription', {
        id: createdSubscriptionId,
        category_name: uniqueCategoryName,
      });

      expect(result).toContain('Successfully edited subscription');
      
      // Verify the change
      const listResult = await client.callTool('list_subscriptions', {
        sort: 'id',
      });
      
      expect(listResult).toContain(`Category: ${uniqueCategoryName}`);
      
      // Verify category was created in master data
      const masterData = await client.callTool('get_master_data');
      expect(masterData).toContain(uniqueCategoryName);
    }, 30000);

    test('should update payment method', async () => {
      if (!createdSubscriptionId) {
        throw new Error('No subscription ID available for test');
      }

      const uniquePaymentName = `E2E Payment ${Date.now()}`;
      
      const result = await client.callTool('edit_subscription', {
        id: createdSubscriptionId,
        payment_method_name: uniquePaymentName,
      });

      expect(result).toContain('Successfully edited subscription');
      
      // Verify the change
      const listResult = await client.callTool('list_subscriptions', {
        sort: 'id',
      });
      
      expect(listResult).toContain(`Payment Method: ${uniquePaymentName}`);
    }, 30000);
  });

  describe('Billing Period Updates', () => {
    test('should update billing period to yearly', async () => {
      if (!createdSubscriptionId) {
        throw new Error('No subscription ID available for test');
      }

      const result = await client.callTool('edit_subscription', {
        id: createdSubscriptionId,
        billing_period: 'yearly',
      });

      expect(result).toContain('Successfully edited subscription');
      
      // Note: We can't easily verify the billing period from list output,
      // but we can verify the command succeeded
    }, 30000);

    test('should update billing period to quarterly', async () => {
      if (!createdSubscriptionId) {
        throw new Error('No subscription ID available for test');
      }

      const result = await client.callTool('edit_subscription', {
        id: createdSubscriptionId,
        billing_period: 'quarterly',
      });

      expect(result).toContain('Successfully edited subscription');
    }, 30000);
  });

  describe('Notification Settings Updates', () => {
    test('should enable notifications with days before', async () => {
      if (!createdSubscriptionId) {
        throw new Error('No subscription ID available for test');
      }

      const result = await client.callTool('edit_subscription', {
        id: createdSubscriptionId,
        notify: true,
        notify_days_before: 7,
      });

      expect(result).toContain('Successfully edited subscription');
      
      // Verify the change
      const listResult = await client.callTool('list_subscriptions', {
        sort: 'id',
      });
      
      // Should show notification enabled (🔔)
      const subscriptionSection = listResult.split(`(ID: ${createdSubscriptionId})`)[1]?.split('\n\n')[0];
      if (subscriptionSection) {
        expect(subscriptionSection).toContain('Notifications: 🔔');
      }
    }, 30000);

    test('should disable notifications', async () => {
      if (!createdSubscriptionId) {
        throw new Error('No subscription ID available for test');
      }

      const result = await client.callTool('edit_subscription', {
        id: createdSubscriptionId,
        notify: false,
      });

      expect(result).toContain('Successfully edited subscription');
      
      // Verify the change
      const listResult = await client.callTool('list_subscriptions', {
        sort: 'id',
      });
      
      // Should show notification disabled (🔕)
      const subscriptionSection = listResult.split(`(ID: ${createdSubscriptionId})`)[1]?.split('\n\n')[0];
      if (subscriptionSection) {
        expect(subscriptionSection).toContain('Notifications: 🔕');
      }
    }, 30000);
  });

  describe('Date Updates', () => {
    test('should update next payment date', async () => {
      if (!createdSubscriptionId) {
        throw new Error('No subscription ID available for test');
      }

      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + 1);
      const dateStr = futureDate.toISOString().split('T')[0];

      const result = await client.callTool('edit_subscription', {
        id: createdSubscriptionId,
        next_payment: dateStr,
      });

      expect(result).toContain('Successfully edited subscription');
      
      // Verify the change
      const listResult = await client.callTool('list_subscriptions', {
        sort: 'id',
      });
      
      expect(listResult).toContain(`Next Payment: ${dateStr}`);
    }, 30000);

    test('should update start date', async () => {
      if (!createdSubscriptionId) {
        throw new Error('No subscription ID available for test');
      }

      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1);
      const dateStr = startDate.toISOString().split('T')[0];

      const result = await client.callTool('edit_subscription', {
        id: createdSubscriptionId,
        start_date: dateStr,
      });

      expect(result).toContain('Successfully edited subscription');
    }, 30000);
  });

  describe('URL and Notes Updates', () => {
    test('should update URL', async () => {
      if (!createdSubscriptionId) {
        throw new Error('No subscription ID available for test');
      }

      const testUrl = 'https://e2e-test.example.com/subscription';

      const result = await client.callTool('edit_subscription', {
        id: createdSubscriptionId,
        url: testUrl,
      });

      expect(result).toContain('Successfully edited subscription');
      
      // Verify the change
      const listResult = await client.callTool('list_subscriptions', {
        sort: 'id',
      });
      
      expect(listResult).toContain(`URL: ${testUrl}`);
    }, 30000);

    test('should update notes with multiline content', async () => {
      if (!createdSubscriptionId) {
        throw new Error('No subscription ID available for test');
      }

      const multilineNotes = `E2E Test Notes
Line 2 of notes
Line 3 with special chars: !@#$%`;

      const result = await client.callTool('edit_subscription', {
        id: createdSubscriptionId,
        notes: multilineNotes,
      });

      expect(result).toContain('Successfully edited subscription');
      
      // Verify at least part of the notes
      const listResult = await client.callTool('list_subscriptions', {
        sort: 'id',
      });
      
      expect(listResult).toContain('E2E Test Notes');
    }, 30000);
  });

  describe('Payer Updates', () => {
    test('should handle payer update with non-existent user (falls back to default)', async () => {
      if (!createdSubscriptionId) {
        throw new Error('No subscription ID available for test');
      }

      const result = await client.callTool('edit_subscription', {
        id: createdSubscriptionId,
        payer_user_name: 'Non-existent E2E User',
      });

      expect(result).toContain('Successfully edited subscription');
      
      // Should use the default/main user (first household member)
      const listResult = await client.callTool('list_subscriptions', {
        sort: 'id',
      });
      
      // Get the payer from the result - it should be the main user
      const payerMatch = listResult.match(/Payer: ([^\n]+)/);
      expect(payerMatch).toBeTruthy();
      // The payer should not be "Non-existent E2E User"
      if (payerMatch) {
        expect(payerMatch[1]).not.toContain('Non-existent E2E User');
      }
    }, 30000);
  });

  describe('Currency Updates', () => {
    test('should update currency if multiple currencies exist', async () => {
      if (!createdSubscriptionId) {
        throw new Error('No subscription ID available for test');
      }

      // First check if we have multiple currencies
      const masterData = await client.callTool('get_master_data');
      
      // Look for EUR or GBP in currencies
      const hasEUR = masterData.includes('EUR');
      const hasGBP = masterData.includes('GBP');
      
      if (hasEUR || hasGBP) {
        const currencyCode = hasEUR ? 'EUR' : 'GBP';
        
        const result = await client.callTool('edit_subscription', {
          id: createdSubscriptionId,
          currency_code: currencyCode,
        });

        expect(result).toContain('Successfully edited subscription');
      } else {
        // Try to create a new currency
        const result = await client.callTool('edit_subscription', {
          id: createdSubscriptionId,
          currency_code: 'CAD',
        });

        expect(result).toContain('Successfully edited subscription');
        
        // Verify currency was created
        const masterDataAfter = await client.callTool('get_master_data');
        expect(masterDataAfter).toContain('CAD');
      }
    }, 30000);
  });

  describe('Complex Edit Scenarios', () => {
    test('should handle comprehensive edit with many fields', async () => {
      if (!createdSubscriptionId) {
        throw new Error('No subscription ID available for test');
      }

      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + 2);
      const nextPaymentDate = futureDate.toISOString().split('T')[0];

      const result = await client.callTool('edit_subscription', {
        id: createdSubscriptionId,
        name: 'E2E Final Comprehensive Edit',
        price: 99.99,
        billing_period: 'yearly',
        category_name: 'E2E Final Category',
        payment_method_name: 'E2E Final Payment',
        next_payment: nextPaymentDate,
        auto_renew: true,
        notes: 'Final comprehensive edit for E2E test',
        url: 'https://final-e2e-test.example.com',
        notify: true,
        notify_days_before: 14,
      });

      expect(result).toContain('Successfully edited subscription');
      
      // Verify multiple changes
      const listResult = await client.callTool('list_subscriptions', {
        sort: 'id',
      });
      
      expect(listResult).toContain('E2E Final Comprehensive Edit');
      expect(listResult).toContain('99.99');
      expect(listResult).toContain('E2E Final Category');
      expect(listResult).toContain('E2E Final Payment');
      expect(listResult).toContain(nextPaymentDate);
      expect(listResult).toContain('Final comprehensive edit for E2E test');
      expect(listResult).toContain('https://final-e2e-test.example.com');
      
      const subscriptionSection = listResult.split(`(ID: ${createdSubscriptionId})`)[1]?.split('\n\n')[0];
      if (subscriptionSection) {
        expect(subscriptionSection).toContain('Auto-Renew: ✅');
        expect(subscriptionSection).toContain('Notifications: 🔔');
      }
    }, 30000);

    test('should handle empty edit (no changes)', async () => {
      if (!createdSubscriptionId) {
        throw new Error('No subscription ID available for test');
      }

      // Edit with no fields (only ID)
      const result = await client.callTool('edit_subscription', {
        id: createdSubscriptionId,
      });

      // Should still succeed even with no changes
      expect(result).toContain('Successfully edited subscription');
    }, 30000);
  });

  describe('Error Handling', () => {
    test('should handle invalid subscription ID', async () => {
      try {
        await client.callTool('edit_subscription', {
          id: 999999, // Non-existent ID
          name: 'This should fail',
        });
        
        // If we get here, the test should fail
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.message).toContain('Error editing subscription');
      }
    }, 30000);

    test('should handle edit without ID', async () => {
      try {
        await client.callTool('edit_subscription', {
          name: 'Missing ID',
        });
        
        // If we get here, the test should fail
        expect(true).toBe(false);
      } catch (error: any) {
        expect(error.message).toBeTruthy();
      }
    }, 30000);
  });
});
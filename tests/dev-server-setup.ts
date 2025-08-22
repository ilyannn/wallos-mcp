/**
 * Development server test utilities
 * Provides helpers for setting up and managing dev server tests
 */

/**
 * Check if development server environment is properly configured
 */
export function isDevServerConfigured(): boolean {
  const requiredEnvVars = ['WALLOS_URL', 'WALLOS_USERNAME', 'WALLOS_PASSWORD'];
  return requiredEnvVars.every(envVar => process.env[envVar]);
}

/**
 * Get development server configuration
 */
export function getDevServerConfig() {
  if (!isDevServerConfigured()) {
    throw new Error('Development server not configured. Set WALLOS_URL, WALLOS_USERNAME, and WALLOS_PASSWORD environment variables.');
  }

  return {
    baseUrl: process.env.WALLOS_URL!,
    username: process.env.WALLOS_USERNAME!,
    password: process.env.WALLOS_PASSWORD!,
    timeout: 30000,
  };
}

/**
 * Print configuration instructions for dev server tests
 */
export function printDevServerInstructions(): void {
  console.log('\n📋 To run dev server integration tests:');
  console.log('1. Start your local Wallos development server');
  console.log('2. Set environment variables:');
  console.log('   export WALLOS_URL=http://localhost:8282');
  console.log('   export WALLOS_USERNAME=your_username');
  console.log('   export WALLOS_PASSWORD=your_password');
  console.log('3. Run tests: just test tests/subscription-integration-dev.test.ts\n');
}

/**
 * Generate unique test names with timestamps
 */
export function generateTestName(prefix: string): string {
  return `${prefix} ${Date.now()}`;
}

/**
 * Test data generators for common scenarios
 */
export const TestDataGenerators = {
  netflix: (timestamp: number = Date.now()) => ({
    name: `Netflix Premium Test ${timestamp}`,
    price: 15.99,
    currency_code: 'USD',
    billing_period: 'monthly' as const,
    category_name: 'Entertainment',
    payment_method_name: 'Credit Card',
    payer_user_name: 'Test User',
    payer_user_email: 'test@example.com',
    start_date: '2024-01-15',
    auto_renew: true,
    notify: true,
    notify_days_before: 3,
    notes: 'Netflix Premium test subscription',
    url: 'https://netflix.com',
  }),

  spotify: (timestamp: number = Date.now()) => ({
    name: `Spotify Premium Test ${timestamp}`,
    price: 9.99,
    currency_code: 'USD',
    billing_period: 'monthly' as const,
    category_name: 'Music Streaming',
    payment_method_name: 'PayPal',
    payer_user_name: 'Test User',
    payer_user_email: 'test@example.com',
    start_date: '2024-02-01',
    auto_renew: true,
    notify: false,
    notes: 'Spotify Premium test subscription',
    url: 'https://spotify.com',
  }),

  customSubscription: (overrides: Partial<any> = {}) => {
    const timestamp = Date.now();
    return {
      name: `Custom Test ${timestamp}`,
      price: 12.99,
      currency_code: 'USD',
      billing_period: 'monthly' as const,
      category_name: 'Test Category',
      payment_method_name: 'Test Payment',
      payer_user_name: 'Test User',
      payer_user_email: 'test@example.com',
      start_date: '2024-01-01',
      auto_renew: false,
      notify: false,
      ...overrides,
    };
  },
};
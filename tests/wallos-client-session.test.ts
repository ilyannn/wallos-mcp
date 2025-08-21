/**
 * Unit tests for WallosClient session authentication
 * Tests session-based authentication and mutation operations
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { WallosClient } from '../src/wallos-client.js';

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

describe('WallosClient Session Authentication', () => {
  let client: WallosClient;
  let stderrSpy: any;

  const mockConfig = {
    baseUrl: 'http://localhost:8282',
    apiKey: 'test-api-key',
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

    client = new WallosClient(mockConfig);
  });

  describe('Session Authentication', () => {
    test('should authenticate successfully with valid credentials', async () => {
      // Mock successful login
      mockAxiosInstance.post.mockResolvedValue({
        status: 302,
        headers: { location: '/dashboard' },
      });

      // Mock session cookie
      const mockSessionCookie = {
        key: 'PHPSESSID',
        value: 'test-session-id',
      };
      mockCookieJar.getCookies.mockResolvedValue([mockSessionCookie]);

      // Mock successful category add with session
      mockAxiosInstance.get.mockResolvedValue({
        data: { success: true, categoryId: 10 },
      });

      const result = await client.addCategory('Test Category');

      // Verify login was called
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/login.php',
        expect.any(URLSearchParams),
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }),
      );

      // Verify cookie jar was checked
      expect(mockCookieJar.getCookies).toHaveBeenCalled();

      // Verify success message
      expect(stderrSpy).toHaveBeenCalledWith('Successfully authenticated with Wallos\n');

      // Verify result
      expect(result.success).toBe(true);
      expect(result.categoryId).toBe(10);
    });

    test('should fail authentication with invalid credentials', async () => {
      // Mock failed login (no session cookie)
      mockAxiosInstance.post.mockResolvedValue({
        status: 200,
        data: 'Invalid credentials',
      });

      mockCookieJar.getCookies.mockResolvedValue([]); // No cookies

      // Try to add category
      await expect(client.addCategory('Test')).rejects.toThrow(
        'Failed to authenticate: No session cookie received',
      );
    });

    test('should throw error when credentials are missing', async () => {
      const clientWithoutCreds = new WallosClient({
        baseUrl: 'http://localhost:8282',
        apiKey: 'test-api-key',
      });

      await expect(clientWithoutCreds.addCategory('Test')).rejects.toThrow(
        'Session credentials (WALLOS_USERNAME and WALLOS_PASSWORD) required for mutation operations',
      );
    });

    test('should reuse existing session when not expired', async () => {
      // First call - authenticate
      mockAxiosInstance.post.mockResolvedValue({ status: 302 });
      mockCookieJar.getCookies.mockResolvedValue([
        { key: 'PHPSESSID', value: 'session1' },
      ]);
      mockAxiosInstance.get.mockResolvedValue({
        data: { success: true, categoryId: 1 },
      });

      await client.addCategory('Category 1');
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);

      // Second call - should reuse session
      mockAxiosInstance.get.mockResolvedValue({
        data: { success: true, categoryId: 2 },
      });

      await client.addCategory('Category 2');
      // Login should not be called again
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(1);
    });
  });

  describe('Category Mutations', () => {
    beforeEach(() => {
      // Setup successful authentication mock
      mockAxiosInstance.post.mockResolvedValue({ status: 302 });
      mockCookieJar.getCookies.mockResolvedValue([
        { key: 'PHPSESSID', value: 'test-session' },
      ]);
    });

    test('should add category with default name', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { success: true, categoryId: 5 },
      });

      const result = await client.addCategory();

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        expect.stringContaining('/endpoints/categories/category.php?action=add'),
      );
      expect(result.success).toBe(true);
      expect(result.categoryId).toBe(5);
    });

    test('should add category with custom name', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { success: true, categoryId: 6 },
      });

      const result = await client.addCategory('Entertainment');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        expect.stringContaining('action=add'),
      );
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        expect.stringContaining('name=Entertainment'),
      );
      expect(result.categoryId).toBe(6);
    });

    test('should update category name', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { success: true, message: 'Category saved' },
      });

      const result = await client.updateCategory(2, 'Updated Name');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        expect.stringContaining('action=edit'),
      );
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        expect.stringContaining('categoryId=2'),
      );
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        expect.stringContaining('name=Updated+Name'),
      );
      expect(result.success).toBe(true);
    });

    test('should delete category', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { success: true, message: 'Category removed' },
      });

      const result = await client.deleteCategory(3);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        expect.stringContaining('action=delete'),
      );
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        expect.stringContaining('categoryId=3'),
      );
      expect(result.success).toBe(true);
    });

    test('should prevent deleting default category', async () => {
      await expect(client.deleteCategory(1)).rejects.toThrow(
        'Cannot delete the default category (ID: 1)',
      );

      expect(mockAxiosInstance.get).not.toHaveBeenCalled();
    });

    test('should handle category in use error', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          success: false,
          errorMessage: 'Category is in use by subscriptions',
        },
      });

      const result = await client.deleteCategory(2);

      expect(result.success).toBe(false);
      expect(result.errorMessage).toBe('Category is in use by subscriptions');
    });
  });

  describe('Error Handling', () => {
    test('should handle network errors during authentication', async () => {
      mockAxiosInstance.post.mockRejectedValue(new Error('Network error'));

      await expect(client.addCategory('Test')).rejects.toThrow('Network error');
    });

    test('should handle axios errors properly', async () => {
      const axiosError = new Error('Request failed');
      (axiosError as any).isAxiosError = true;
      (axiosError as any).response = { status: 401 };

      mockAxios.isAxiosError.mockReturnValue(true);
      mockAxiosInstance.post.mockRejectedValue(axiosError);

      await expect(client.addCategory('Test')).rejects.toThrow(
        'Authentication failed: Request failed',
      );
    });

    test('should handle malformed server responses', async () => {
      mockAxiosInstance.post.mockResolvedValue({ status: 302 });
      mockCookieJar.getCookies.mockResolvedValue([
        { key: 'PHPSESSID', value: 'session' },
      ]);

      // Return malformed response
      mockAxiosInstance.get.mockResolvedValue({
        data: 'Not JSON',
      });

      const result = await client.addCategory('Test');

      // Should return the raw response (string gets returned as-is)
      expect(result as any).toBe('Not JSON');
    });
  });

  describe('Client Configuration', () => {
    test('should work without username and password for read operations', async () => {
      const readOnlyClient = new WallosClient({
        baseUrl: 'http://localhost:8282',
        apiKey: 'test-api-key',
      });

      mockAxiosInstance.get.mockResolvedValue({
        data: {
          success: true,
          categories: [{ id: 1, name: 'General' }],
        },
      });

      const result = await readOnlyClient.getCategories();
      expect(result.success).toBe(true);
      expect(result.categories).toHaveLength(1);
    });

    test('should include API key in read requests', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { success: true, categories: [] },
      });

      await client.getCategories();

      // Check that interceptor was set up
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalled();
    });
  });
});
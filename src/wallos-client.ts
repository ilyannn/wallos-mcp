import axios, { AxiosInstance, AxiosError } from 'axios';
import * as tough from 'tough-cookie';
import { wrapper } from 'axios-cookiejar-support';
import {
  WallosClientConfig,
  CategoriesResponse,
  CurrenciesResponse,
  PaymentMethodsResponse,
  HouseholdResponse,
  WallosError,
  MasterData,
  SessionInfo,
  CategoryMutationResponse,
} from './types/index.js';

export class WallosClient {
  private client: AxiosInstance;
  private apiKey?: string;
  private username?: string;
  private password?: string;
  private session?: SessionInfo;
  private cookieJar: tough.CookieJar;

  constructor(config: WallosClientConfig) {
    if (!config.apiKey && (!config.username || !config.password)) {
      throw new Error('Either apiKey or both username and password must be provided');
    }

    this.apiKey = config.apiKey;
    this.username = config.username;
    this.password = config.password;
    this.cookieJar = new tough.CookieJar();

    const axiosInstance = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout || 10000,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true,
    });

    this.client = wrapper(axiosInstance) as AxiosInstance;

    // Attach cookie jar to the wrapped client
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.client as any).defaults.jar = this.cookieJar;

    // Add request interceptor to include API key and session cookies
    this.client.interceptors.request.use(async (config) => {
      // Add session cookie if available
      if (this.session && this.session.cookie) {
        config.headers = config.headers || {};
        config.headers.Cookie = `PHPSESSID=${this.session.cookie}`;
      }

      // Ensure we have an API key for API endpoints
      if (config.url && config.url.startsWith('/api/')) {
        await this.ensureApiKey();
        if (config.method === 'get') {
          config.params = { ...config.params, api_key: this.apiKey };
        } else {
          config.data = { ...config.data, api_key: this.apiKey };
        }
      }
      return config;
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.data) {
          const wallosError = error.response.data as WallosError;
          throw new Error(wallosError.title || 'Unknown Wallos API error');
        }
        throw error;
      },
    );
  }

  /**
   * Get all categories
   */
  async getCategories(): Promise<CategoriesResponse> {
    const response = await this.client.get('/api/categories/get_categories.php');
    return response.data;
  }

  /**
   * Get all currencies
   */
  async getCurrencies(): Promise<CurrenciesResponse> {
    const response = await this.client.get('/api/currencies/get_currencies.php');
    return response.data;
  }

  /**
   * Get all payment methods
   */
  async getPaymentMethods(): Promise<PaymentMethodsResponse> {
    const response = await this.client.get('/api/payment_methods/get_payment_methods.php');
    return response.data;
  }

  /**
   * Get all household members
   */
  async getHousehold(): Promise<HouseholdResponse> {
    const response = await this.client.get('/api/household/get_household.php');
    return response.data;
  }

  /**
   * Get all master data in a single call
   */
  async getMasterData(): Promise<MasterData> {
    try {
      // Fetch all data in parallel
      const [categoriesRes, currenciesRes, paymentMethodsRes, householdRes] = await Promise.all([
        this.getCategories(),
        this.getCurrencies(),
        this.getPaymentMethods(),
        this.getHousehold(),
      ]);

      // Check if all requests were successful
      if (!categoriesRes.success) {
        throw new Error(`Categories API error: ${categoriesRes.title}`);
      }
      if (!currenciesRes.success) {
        throw new Error(`Currencies API error: ${currenciesRes.title}`);
      }
      if (!paymentMethodsRes.success) {
        throw new Error(`Payment methods API error: ${paymentMethodsRes.title}`);
      }
      if (!householdRes.success) {
        throw new Error(`Household API error: ${householdRes.title}`);
      }

      // Aggregate the response
      const masterData: MasterData = {
        categories: categoriesRes.categories,
        currencies: {
          main_currency_id: currenciesRes.main_currency,
          items: currenciesRes.currencies,
        },
        payment_methods: paymentMethodsRes.payment_methods,
        household: householdRes.household,
        metadata: {
          timestamp: new Date().toISOString(),
          source: 'wallos_api',
        },
      };

      return masterData;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch master data: ${error.message}`);
      }
      throw new Error('Failed to fetch master data: Unknown error');
    }
  }

  /**
   * Test the connection to Wallos API
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.getCategories();
      return response.success;
    } catch {
      return false;
    }
  }

  /**
   * Authenticate with session credentials
   */
  private async authenticateWithSession(): Promise<void> {
    if (!this.username || !this.password) {
      throw new Error('Username and password required for mutation operations');
    }

    try {
      // Submit login form
      const loginResponse = await this.client.post(
        '/login.php',
        new URLSearchParams({
          username: this.username,
          password: this.password,
          rememberme: 'on',
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          maxRedirects: 0,
          validateStatus: (status) => status >= 200 && status < 400,
        },
      );

      // Extract PHPSESSID from Set-Cookie headers
      let sessionCookieValue: string | undefined;

      if (loginResponse.headers['set-cookie']) {
        const setCookieHeaders = loginResponse.headers['set-cookie'];
        for (const cookieHeader of setCookieHeaders) {
          if (cookieHeader.startsWith('PHPSESSID=')) {
            // Extract the cookie value (before the first semicolon)
            sessionCookieValue = cookieHeader.split(';')[0].split('=')[1];
            break;
          }
        }
      }

      if (!sessionCookieValue) {
        throw new Error('Failed to authenticate: No session cookie received');
      }

      // Store session info
      this.session = {
        cookie: sessionCookieValue,
        expiresAt: new Date(Date.now() + 3600000), // 1 hour default
      };

      process.stderr.write('Successfully authenticated with Wallos\n');
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`Authentication failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Ensure we have an API key (retrieve it if needed)
   */
  private async ensureApiKey(): Promise<void> {
    if (this.apiKey) {
      return; // Already have API key
    }

    if (!this.username || !this.password) {
      throw new Error('API key or username/password required for API access');
    }

    // Authenticate with session to retrieve API key
    await this.ensureSession();

    // Generate a new API key using the regenerate endpoint
    try {
      const response = await this.client.post('/endpoints/user/regenerateapikey.php', {});
      if (response.data && response.data.success && response.data.apiKey) {
        this.apiKey = response.data.apiKey;
        process.stderr.write('Successfully retrieved API key from Wallos\n');
      } else {
        throw new Error('Failed to generate API key from server');
      }
    } catch (error) {
      throw new Error(
        `Failed to obtain API key: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Ensure we have a valid session for mutation operations
   */
  private async ensureSession(): Promise<void> {
    // Check if we have session credentials
    if (!this.username || !this.password) {
      throw new Error(
        'Session credentials (WALLOS_USERNAME and WALLOS_PASSWORD) required for mutation operations',
      );
    }

    // Check if we need to authenticate or refresh
    if (!this.session || new Date() >= this.session.expiresAt) {
      await this.authenticateWithSession();
    }
  }

  /**
   * Add a new category
   */
  async addCategory(name?: string): Promise<CategoryMutationResponse> {
    await this.ensureSession();

    const params = new URLSearchParams({ action: 'add' });
    if (name) {
      params.append('name', name);
    }

    const response = await this.client.get(`/endpoints/categories/category.php?${params}`);
    return response.data;
  }

  /**
   * Update an existing category
   */
  async updateCategory(id: number, name: string): Promise<CategoryMutationResponse> {
    await this.ensureSession();

    const params = new URLSearchParams({
      action: 'edit',
      categoryId: id.toString(),
      name: name,
    });

    const response = await this.client.get(`/endpoints/categories/category.php?${params}`);
    return response.data;
  }

  /**
   * Delete a category
   */
  async deleteCategory(id: number): Promise<CategoryMutationResponse> {
    if (id === 1) {
      throw new Error('Cannot delete the default category (ID: 1)');
    }

    await this.ensureSession();

    const params = new URLSearchParams({
      action: 'delete',
      categoryId: id.toString(),
    });

    const response = await this.client.get(`/endpoints/categories/category.php?${params}`);
    return response.data;
  }
}

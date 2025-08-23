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
  SubscriptionsResponse,
  SubscriptionFilters,
  CreateSubscriptionData,
  SubscriptionMutationResponse,
  PaymentMethodMutationResponse,
  CurrencyMutationResponse,
  HouseholdMemberMutationResponse,
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
   * Get subscriptions with optional filters
   */
  async getSubscriptions(filters?: SubscriptionFilters): Promise<SubscriptionsResponse> {
    const params: Record<string, string> = {};

    if (filters) {
      if (filters.member) params.member = filters.member;
      if (filters.category) params.category = filters.category;
      if (filters.payment) params.payment = filters.payment;
      if (filters.state !== undefined) params.state = filters.state;
      if (filters.disabled_to_bottom !== undefined)
        params.disabled_to_bottom = filters.disabled_to_bottom.toString();
      if (filters.sort) params.sort = filters.sort;
      if (filters.convert_currency !== undefined)
        params.convert_currency = filters.convert_currency.toString();
    }

    const response = await this.client.get('/api/subscriptions/get_subscriptions.php', { params });
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

  /**
   * Add a new payment method
   */
  async addPaymentMethod(name?: string): Promise<PaymentMethodMutationResponse> {
    await this.ensureSession();

    const params = new URLSearchParams({ action: 'add' });
    if (name) {
      params.append('name', name);
    }

    const response = await this.client.get(`/endpoints/payments/add.php?${params}`);
    return response.data;
  }

  /**
   * Update an existing payment method
   */
  async updatePaymentMethod(id: number, name: string): Promise<PaymentMethodMutationResponse> {
    await this.ensureSession();

    const params = new URLSearchParams({
      action: 'edit',
      paymentMethodId: id.toString(),
      name: name,
    });

    const response = await this.client.get(`/endpoints/payments/add.php?${params}`);
    return response.data;
  }

  /**
   * Delete a payment method
   */
  async deletePaymentMethod(id: number): Promise<PaymentMethodMutationResponse> {
    await this.ensureSession();

    const params = new URLSearchParams({
      action: 'delete',
      paymentMethodId: id.toString(),
    });

    const response = await this.client.get(`/endpoints/payments/add.php?${params}`);
    return response.data;
  }

  /**
   * Add a new currency
   */
  async addCurrency(
    code: string,
    name?: string,
    symbol?: string,
  ): Promise<CurrencyMutationResponse> {
    await this.ensureSession();

    const params = new URLSearchParams({ action: 'add' });
    params.append('code', code);

    if (name) {
      params.append('name', name);
    } else {
      // Default names for common currencies
      const defaultNames: Record<string, string> = {
        USD: 'US Dollar',
        EUR: 'Euro',
        GBP: 'British Pound',
        JPY: 'Japanese Yen',
        CAD: 'Canadian Dollar',
        AUD: 'Australian Dollar',
        CHF: 'Swiss Franc',
        CNY: 'Chinese Yuan',
        INR: 'Indian Rupee',
        MXN: 'Mexican Peso',
      };
      params.append('name', defaultNames[code.toUpperCase()] || code);
    }

    if (symbol) {
      params.append('symbol', symbol);
    } else {
      // Default symbols for common currencies
      const defaultSymbols: Record<string, string> = {
        USD: '$',
        EUR: '€',
        GBP: '£',
        JPY: '¥',
        CAD: 'C$',
        AUD: 'A$',
        CHF: 'CHF',
        CNY: '¥',
        INR: '₹',
        MXN: '$',
      };
      params.append('symbol', defaultSymbols[code.toUpperCase()] || code);
    }

    const response = await this.client.get(`/endpoints/currency/currency.php?${params}`);
    return response.data;
  }

  /**
   * Helper method to find currency by code
   */
  async findCurrencyByCode(code: string): Promise<number | null> {
    const currenciesResponse = await this.getCurrencies();
    if (currenciesResponse.success) {
      const currency = currenciesResponse.currencies.find(
        (curr) => curr.code.toUpperCase() === code.toUpperCase(),
      );
      return currency ? currency.id : null;
    }
    return null;
  }

  /**
   * Add a new household member
   */
  async addHouseholdMember(name: string, email?: string): Promise<HouseholdMemberMutationResponse> {
    await this.ensureSession();

    const params = new URLSearchParams({ action: 'add' });
    params.append('name', name);

    if (email) {
      params.append('email', email);
    } else {
      // Generate a default email if not provided
      const sanitizedName = name.toLowerCase().replace(/\s+/g, '.');
      params.append('email', `${sanitizedName}@household.local`);
    }

    const response = await this.client.get(`/endpoints/household/household.php?${params}`);
    return response.data;
  }

  /**
   * Helper method to find household member by name
   */
  async findHouseholdMemberByName(name: string): Promise<number | null> {
    const householdResponse = await this.getHousehold();
    if (householdResponse.success) {
      const member = householdResponse.household.find(
        (m) => m.name.toLowerCase() === name.toLowerCase(),
      );
      return member ? member.id : null;
    }
    return null;
  }

  /**
   * Parse billing period to Wallos cycle value and frequency
   * Wallos uses: cycle (1=daily, 2=weekly, 3=monthly, 4=yearly) and frequency (multiplier)
   * We support flexible input like 'monthly', 'bi-weekly', '3 months', etc.
   */
  private parseBillingPeriod(
    period?: string | number,
    frequency?: number,
  ): { cycle: number; frequency: number } {
    // Default to monthly
    if (!period) {
      return { cycle: 3, frequency: frequency || 1 };
    }

    // If period is already a number (1-4), use it directly
    if (typeof period === 'number' && period >= 1 && period <= 4) {
      return { cycle: period, frequency: frequency || 1 };
    }

    // Parse string period
    const periodStr = String(period).toLowerCase().trim();

    // Direct period mappings
    const periodMap: Record<string, { cycle: number; frequency: number }> = {
      daily: { cycle: 1, frequency: 1 },
      d: { cycle: 1, frequency: 1 },
      day: { cycle: 1, frequency: 1 },
      weekly: { cycle: 2, frequency: 1 },
      w: { cycle: 2, frequency: 1 },
      week: { cycle: 2, frequency: 1 },
      biweekly: { cycle: 2, frequency: 2 },
      'bi-weekly': { cycle: 2, frequency: 2 },
      fortnightly: { cycle: 2, frequency: 2 },
      monthly: { cycle: 3, frequency: 1 },
      m: { cycle: 3, frequency: 1 },
      month: { cycle: 3, frequency: 1 },
      quarterly: { cycle: 3, frequency: 3 },
      q: { cycle: 3, frequency: 3 },
      quarter: { cycle: 3, frequency: 3 },
      semiannually: { cycle: 3, frequency: 6 },
      'semi-annually': { cycle: 3, frequency: 6 },
      halfyearly: { cycle: 3, frequency: 6 },
      'half-yearly': { cycle: 3, frequency: 6 },
      annually: { cycle: 4, frequency: 1 },
      yearly: { cycle: 4, frequency: 1 },
      y: { cycle: 4, frequency: 1 },
      year: { cycle: 4, frequency: 1 },
    };

    // Check direct mapping
    if (periodMap[periodStr]) {
      const result = periodMap[periodStr];
      // If explicit frequency provided, override
      return frequency ? { ...result, frequency } : result;
    }

    // Check for patterns like "2 weeks", "3 months", etc.
    const match = periodStr.match(/^(\d+)\s*(day|week|month|year)s?$/);
    if (match) {
      const num = parseInt(match[1]);
      const unit = match[2];
      const unitMap: Record<string, number> = {
        day: 1,
        week: 2,
        month: 3,
        year: 4,
      };
      return { cycle: unitMap[unit], frequency: num };
    }

    // Default to monthly if unable to parse
    process.stderr.write(
      `Warning: Unable to parse billing period "${period}", defaulting to monthly\n`,
    );
    return { cycle: 3, frequency: frequency || 1 };
  }

  /**
   * Create a new subscription with automatic category, payment method, and currency creation if needed
   */
  async createSubscription(data: CreateSubscriptionData): Promise<SubscriptionMutationResponse> {
    await this.ensureSession();

    // Determine currency ID (create if needed)
    let currencyId = data.currency_id;
    if (!currencyId) {
      if (data.currency_code) {
        // First try to find existing currency by code
        const foundCurrencyId = await this.findCurrencyByCode(data.currency_code);

        if (foundCurrencyId) {
          currencyId = foundCurrencyId;
        } else {
          // If not found, create it
          const currencyResult = await this.addCurrency(data.currency_code);
          if (
            ('success' in currencyResult && currencyResult.success) ||
            ('status' in currencyResult && currencyResult.status === 'Success')
          ) {
            if ('currency_id' in currencyResult && currencyResult.currency_id) {
              currencyId = currencyResult.currency_id;
            }
          } else {
            const errorMsg =
              ('errorMessage' in currencyResult && currencyResult.errorMessage) ||
              ('message' in currencyResult && currencyResult.message) ||
              'Unknown error';
            throw new Error(`Failed to create currency ${data.currency_code}: ${errorMsg}`);
          }
        }
      } else {
        // Default to currency ID 1 (typically main currency)
        const currenciesRes = await this.getCurrencies();
        currencyId = currenciesRes.main_currency || 1;
      }
    }

    // Determine category ID (always use category_name if provided, even if category_id exists)
    let categoryId: number | undefined;
    if (data.category_name) {
      // First try to find existing category
      const foundCategoryId = await this.findCategoryByName(data.category_name);

      if (foundCategoryId) {
        categoryId = foundCategoryId;
      } else {
        // If not found, create it
        const categoryResult = await this.addCategory(data.category_name);
        if (categoryResult.success && categoryResult.categoryId) {
          categoryId = categoryResult.categoryId;
        } else {
          throw new Error(
            `Failed to create category: ${categoryResult.errorMessage || 'Unknown error'}`,
          );
        }
      }
    } else if (data.category_id) {
      // Only use category_id if category_name not provided
      categoryId = data.category_id;
    }

    // Determine payment method ID (create if needed)
    let paymentMethodId = data.payment_method_id;
    if (!paymentMethodId && data.payment_method_name) {
      // First try to find existing payment method
      const foundPaymentMethodId = await this.findPaymentMethodByName(data.payment_method_name);

      if (foundPaymentMethodId) {
        paymentMethodId = foundPaymentMethodId;
      } else {
        // If not found, create it
        const paymentResult = await this.addPaymentMethod(data.payment_method_name);
        if (
          ('success' in paymentResult && paymentResult.success) ||
          ('status' in paymentResult && paymentResult.status === 'Success')
        ) {
          if ('payment_method_id' in paymentResult && paymentResult.payment_method_id) {
            paymentMethodId = paymentResult.payment_method_id;
          }
        } else {
          const errorMsg =
            ('errorMessage' in paymentResult && paymentResult.errorMessage) ||
            ('message' in paymentResult && paymentResult.message) ||
            'Unknown error';
          throw new Error(`Failed to create payment method: ${errorMsg}`);
        }
      }
    }

    // Determine payer user ID - use existing or default to main user
    let payerUserId: number | undefined;
    if (data.payer_user_name) {
      // Try to find existing household member
      const foundMemberId = await this.findHouseholdMemberByName(data.payer_user_name);

      if (foundMemberId) {
        payerUserId = foundMemberId;
      } else {
        // If not found, use the main user (first household member)
        const householdResponse = await this.getHousehold();
        if (householdResponse.success && householdResponse.household.length > 0) {
          payerUserId = householdResponse.household[0].id;
        }
      }
    } else if (data.payer_user_id) {
      // Use provided payer_user_id
      payerUserId = data.payer_user_id;
    } else {
      // Default to main user (first household member)
      const householdResponse = await this.getHousehold();
      if (householdResponse.success && householdResponse.household.length > 0) {
        payerUserId = householdResponse.household[0].id;
      }
    }

    // Parse billing period and frequency
    const { cycle, frequency } = this.parseBillingPeriod(
      data.billing_period,
      data.billing_frequency,
    );

    // Handle dates
    let startDate = data.start_date;
    let nextPayment = data.next_payment;

    if (!startDate && !nextPayment) {
      // Default to today if neither provided
      const today = new Date().toISOString().split('T')[0];
      startDate = today;
      nextPayment = today;
    } else if (startDate && !nextPayment) {
      // Calculate next_payment from start_date, ensuring it's in the future
      const start = new Date(startDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Reset to start of day for fair comparison

      // eslint-disable-next-line prefer-const
      let next = new Date(start);

      // Keep adding cycles until we reach a future date
      while (next <= today) {
        switch (cycle) {
          case 1: // Daily
            next.setDate(next.getDate() + frequency);
            break;
          case 2: // Weekly
            next.setDate(next.getDate() + frequency * 7);
            break;
          case 3: // Monthly
            next.setMonth(next.getMonth() + frequency);
            break;
          case 4: // Yearly
            next.setFullYear(next.getFullYear() + frequency);
            break;
        }
      }

      nextPayment = next.toISOString().split('T')[0];
    } else if (!startDate && nextPayment) {
      // Use next_payment as start_date if only next_payment provided
      startDate = nextPayment;
    }

    // Ensure currencyId is set
    if (!currencyId) {
      throw new Error('Currency ID could not be determined');
    }

    // Prepare form data for POST request
    const formData = new URLSearchParams({
      name: data.name,
      price: data.price.toString(),
      currency_id: currencyId.toString(),
      cycle: cycle.toString(),
      frequency: frequency.toString(),
    });

    if (categoryId) {
      formData.append('category_id', categoryId.toString());
    }
    if (paymentMethodId) {
      formData.append('payment_method_id', paymentMethodId.toString());
    }
    if (payerUserId) {
      formData.append('payer_user_id', payerUserId.toString());
    }
    if (startDate) {
      formData.append('start_date', startDate);
    }
    if (nextPayment) {
      formData.append('next_payment', nextPayment);
    }
    // Default auto_renew to true if not specified
    const autoRenew = data.auto_renew !== undefined ? data.auto_renew : true;
    formData.append('auto_renew', autoRenew ? '1' : '0');
    if (data.notes) {
      formData.append('notes', data.notes);
    }
    if (data.url) {
      formData.append('url', data.url);
    }
    if (data.notify !== undefined) {
      formData.append('notifications', data.notify ? '1' : '0'); // PHP expects 'notifications'
    }
    if (data.notify_days_before !== undefined) {
      formData.append('notify_days_before', data.notify_days_before.toString());
    }

    const response = await this.client.post('/endpoints/subscription/add.php', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    // After successful creation, fetch the full subscription data
    // We need to get all subscriptions and find the one we just created
    const subscriptionsResponse = await this.getSubscriptions();
    if (subscriptionsResponse.success && subscriptionsResponse.subscriptions.length > 0) {
      // Find the subscription we just created (should be the most recent one with our name)
      const newSubscription = subscriptionsResponse.subscriptions.find(
        (sub) => sub.name === data.name,
      );
      if (newSubscription) {
        return {
          ...response.data,
          subscription: newSubscription,
        };
      }
    }

    return response.data;
  }

  /**
   * Helper method to find category by name
   */
  async findCategoryByName(name: string): Promise<number | null> {
    const categoriesResponse = await this.getCategories();
    if (categoriesResponse.success) {
      const category = categoriesResponse.categories.find(
        (cat) => cat.name.toLowerCase() === name.toLowerCase(),
      );
      return category ? category.id : null;
    }
    return null;
  }

  /**
   * Helper method to find payment method by name
   */
  async findPaymentMethodByName(name: string): Promise<number | null> {
    const paymentMethodsResponse = await this.getPaymentMethods();
    if (paymentMethodsResponse.success) {
      const paymentMethod = paymentMethodsResponse.payment_methods.find(
        (pm) => pm.name.toLowerCase() === name.toLowerCase(),
      );
      return paymentMethod ? paymentMethod.id : null;
    }
    return null;
  }

  /**
   * Edit an existing subscription
   */
  async editSubscription(
    id: number,
    data: Partial<CreateSubscriptionData>,
  ): Promise<SubscriptionMutationResponse> {
    await this.ensureSession();

    // Handle currency conversion
    let currencyId: number | undefined;
    if (data.currency_code) {
      const foundCurrencyId = await this.findCurrencyByCode(data.currency_code);
      if (foundCurrencyId) {
        currencyId = foundCurrencyId;
      } else {
        // Create if doesn't exist
        const currencyResult = await this.addCurrency(data.currency_code);
        if (
          ('success' in currencyResult && currencyResult.success) ||
          ('status' in currencyResult && currencyResult.status === 'Success')
        ) {
          if ('currency_id' in currencyResult && currencyResult.currency_id) {
            currencyId = currencyResult.currency_id;
          }
        } else {
          const errorMsg =
            ('errorMessage' in currencyResult && currencyResult.errorMessage) ||
            ('message' in currencyResult && currencyResult.message) ||
            'Unknown error';
          throw new Error(`Failed to create currency: ${errorMsg}`);
        }
      }
    } else if (data.currency_id) {
      currencyId = data.currency_id;
    }

    // Handle category
    let categoryId: number | undefined;
    if (data.category_name) {
      const foundCategoryId = await this.findCategoryByName(data.category_name);
      if (foundCategoryId) {
        categoryId = foundCategoryId;
      } else {
        // Create if doesn't exist
        const categoryResult = await this.addCategory(data.category_name);
        if (
          ('success' in categoryResult && categoryResult.success) ||
          ('status' in categoryResult && categoryResult.status === 'Success')
        ) {
          if ('categoryId' in categoryResult && categoryResult.categoryId) {
            categoryId = categoryResult.categoryId;
          }
        }
      }
    } else if (data.category_id) {
      categoryId = data.category_id;
    }

    // Handle payment method
    let paymentMethodId: number | undefined;
    if (data.payment_method_name) {
      const foundPaymentMethodId = await this.findPaymentMethodByName(data.payment_method_name);
      if (foundPaymentMethodId) {
        paymentMethodId = foundPaymentMethodId;
      } else {
        // Create if doesn't exist
        const paymentResult = await this.addPaymentMethod(data.payment_method_name);
        if (
          ('success' in paymentResult && paymentResult.success) ||
          ('status' in paymentResult && paymentResult.status === 'Success')
        ) {
          if ('payment_method_id' in paymentResult && paymentResult.payment_method_id) {
            paymentMethodId = paymentResult.payment_method_id;
          }
        }
      }
    } else if (data.payment_method_id) {
      paymentMethodId = data.payment_method_id;
    }

    // Handle payer - use existing or default to main user
    let payerUserId: number | undefined;
    if (data.payer_user_name) {
      const foundMemberId = await this.findHouseholdMemberByName(data.payer_user_name);
      if (foundMemberId) {
        payerUserId = foundMemberId;
      } else {
        // Use main user
        const householdResponse = await this.getHousehold();
        if (householdResponse.success && householdResponse.household.length > 0) {
          payerUserId = householdResponse.household[0].id;
        }
      }
    } else if (data.payer_user_id) {
      payerUserId = data.payer_user_id;
    }

    // Prepare form data for POST request - only include fields that are provided
    const formData = new URLSearchParams();
    formData.append('id', id.toString());

    if (data.name !== undefined) {
      formData.append('name', data.name);
    }
    if (data.price !== undefined) {
      formData.append('price', data.price.toString());
    }
    if (currencyId !== undefined) {
      formData.append('currency_id', currencyId.toString());
    }
    if (data.billing_period !== undefined || data.billing_frequency !== undefined) {
      const { cycle, frequency } = this.parseBillingPeriod(
        data.billing_period,
        data.billing_frequency,
      );
      formData.append('cycle', cycle.toString());
      formData.append('frequency', frequency.toString());
    }
    if (categoryId !== undefined) {
      formData.append('category_id', categoryId.toString());
    }
    if (paymentMethodId !== undefined) {
      formData.append('payment_method_id', paymentMethodId.toString());
    }
    if (payerUserId !== undefined) {
      formData.append('payer_user_id', payerUserId.toString());
    }
    if (data.start_date !== undefined) {
      formData.append('start_date', data.start_date);
    }
    if (data.next_payment !== undefined) {
      formData.append('next_payment', data.next_payment);
    }
    if (data.auto_renew !== undefined) {
      formData.append('auto_renew', data.auto_renew ? '1' : '0');
    }
    if (data.notes !== undefined) {
      formData.append('notes', data.notes);
    }
    if (data.url !== undefined) {
      formData.append('url', data.url);
    }
    if (data.notify !== undefined) {
      formData.append('notify', data.notify ? '1' : '0');
    }
    if (data.notify_days_before !== undefined) {
      formData.append('notify_days_before', data.notify_days_before.toString());
    }

    const response = await this.client.post('/endpoints/subscription/edit.php', formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });

    // Check for errors in response
    if ('status' in response.data && response.data.status === 'Error') {
      throw new Error(`Failed to edit subscription: ${response.data.message || 'Unknown error'}`);
    }
    if ('success' in response.data && response.data.success === false) {
      throw new Error(`Failed to edit subscription: ${response.data.errorMessage || 'Unknown error'}`);
    }

    // After successful edit, fetch the full subscription data
    const subscriptionsResponse = await this.getSubscriptions();
    if (subscriptionsResponse.success && subscriptionsResponse.subscriptions.length > 0) {
      const updatedSubscription = subscriptionsResponse.subscriptions.find((sub) => sub.id === id);
      if (updatedSubscription) {
        return {
          ...response.data,
          subscription: updatedSubscription,
        };
      }
    }

    return response.data;
  }
}

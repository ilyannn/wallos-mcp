import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  WallosClientConfig,
  CategoriesResponse,
  CurrenciesResponse,
  PaymentMethodsResponse,
  HouseholdResponse,
  WallosError,
  MasterData,
} from './types/index.js';

export class WallosClient {
  private client: AxiosInstance;
  private apiKey: string;

  constructor(config: WallosClientConfig) {
    this.apiKey = config.apiKey;
    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout || 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor to include API key
    this.client.interceptors.request.use((config) => {
      if (config.method === 'get') {
        config.params = { ...config.params, api_key: this.apiKey };
      } else {
        config.data = { ...config.data, api_key: this.apiKey };
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
}

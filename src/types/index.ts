// Wallos API response types
export interface WallosResponse {
  success: boolean;
  title: string;
  notes: string[];
}

export interface Category {
  id: number;
  name: string;
  order: number;
  in_use: boolean;
}

export interface CategoriesResponse extends WallosResponse {
  categories: Category[];
}

export interface Currency {
  id: number;
  name: string;
  symbol: string;
  code: string;
  rate: string;
  in_use: boolean;
}

export interface CurrenciesResponse extends WallosResponse {
  main_currency: number;
  currencies: Currency[];
}

export interface PaymentMethod {
  id: number;
  name: string;
  icon: string;
  enabled: number;
  order: number;
  in_use: boolean;
}

export interface PaymentMethodsResponse extends WallosResponse {
  payment_methods: PaymentMethod[];
}

export interface HouseholdMember {
  id: number;
  name: string;
  email: string;
  in_use: boolean;
}

export interface HouseholdResponse extends WallosResponse {
  household: HouseholdMember[];
}

// Master data aggregated response
export interface MasterData {
  categories: Category[];
  currencies: {
    main_currency_id: number;
    items: Currency[];
  };
  payment_methods: PaymentMethod[];
  household: HouseholdMember[];
  metadata: {
    timestamp: string;
    source: string;
  };
}

// Mutation response types
export interface MutationResponse {
  success: boolean;
  message?: string;
  errorMessage?: string;
  id?: number;
  categoryId?: number;
}

export interface CategoryMutationResponse extends MutationResponse {
  categoryId?: number;
}

// Session types
export interface SessionInfo {
  cookie: string;
  expiresAt: Date;
  userId?: number;
}

// Error types
export interface WallosError {
  success: false;
  title: string;
  errorMessage?: string;
}

export interface WallosClientConfig {
  baseUrl: string;
  apiKey?: string;
  username?: string;
  password?: string;
  timeout?: number;
}

// Subscription types
export interface Subscription {
  id: number;
  name: string;
  logo: string;
  price: number;
  currency_id: number;
  start_date: string;
  next_payment: string;
  cycle: number;
  frequency: number;
  auto_renew: number;
  notes: string;
  payment_method_id: number;
  payer_user_id: number;
  category_id: number;
  notify: number;
  url: string;
  inactive: number;
  notify_days_before: number | null;
  user_id: number;
  cancelation_date: string | null;
  cancellation_date: string;
  category_name: string;
  payer_user_name: string;
  payment_method_name: string;
  replacement_subscription_id?: number;
}

export interface SubscriptionsResponse extends WallosResponse {
  subscriptions: Subscription[];
}

export interface SubscriptionFilters {
  member?: string; // comma-separated member IDs
  category?: string; // comma-separated category IDs
  payment?: string; // comma-separated payment method IDs
  state?: '0' | '1'; // 0 = active, 1 = inactive
  disabled_to_bottom?: boolean;
  sort?:
    | 'name'
    | 'id'
    | 'next_payment'
    | 'price'
    | 'payer_user_id'
    | 'category_id'
    | 'payment_method_id'
    | 'inactive'
    | 'alphanumeric';
  convert_currency?: boolean;
}

// Subscription creation types
export interface CreateSubscriptionData {
  name: string;
  price: number;
  currency_id?: number; // use existing currency ID
  currency_code?: string; // currency code (e.g., 'USD', 'EUR') - will create if needed
  billing_period?: string | number; // Flexible: 'daily', 'weekly', 'monthly', 'yearly', or 1-4
  billing_frequency?: number; // Multiplier: how many periods (e.g., 2 for bi-weekly, 3 for quarterly)
  category_name?: string; // if provided, will create category if needed
  payment_method_name?: string; // if provided, will create payment method if needed
  category_id?: number; // use existing category
  payment_method_id?: number; // use existing payment method
  payer_user_id?: number; // use existing payer user ID
  payer_user_name?: string; // payer name - will find or create household member
  payer_user_email?: string; // optional email when creating new household member
  start_date?: string; // YYYY-MM-DD format - subscription start date
  next_payment?: string; // YYYY-MM-DD format - if not provided, calculated from start_date + cycle
  auto_renew?: boolean;
  notes?: string;
  url?: string;
  notify?: boolean;
  notify_days_before?: number;
}

export interface SubscriptionMutationResponse extends MutationResponse {
  subscription_id?: number;
}

export interface PaymentMethodMutationResponse extends MutationResponse {
  payment_method_id?: number;
}

export interface CurrencyMutationResponse extends MutationResponse {
  currency_id?: number;
}

export interface HouseholdMemberMutationResponse extends MutationResponse {
  household_member_id?: number;
}

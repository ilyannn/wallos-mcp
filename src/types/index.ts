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

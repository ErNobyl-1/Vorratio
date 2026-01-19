const API_BASE = '/api';

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;

  const headers: Record<string, string> = {
    ...options.headers as Record<string, string>,
  };

  // Only set Content-Type for requests with a body
  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (response.status === 401) {
    window.location.href = '/login';
    throw new Error('Not authenticated');
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'Request failed');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

// Settings
export interface AppSettings {
  locale: 'en' | 'de';
  defaultShopDay: number;
  currency: string;
}

export const settings = {
  get: () =>
    request<AppSettings>('/settings'),

  update: (data: Partial<AppSettings>) =>
    request<AppSettings>('/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

// Auth
export const auth = {
  login: (password: string) =>
    request<{ success: boolean }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    }),

  logout: () =>
    request<{ success: boolean }>('/auth/logout', {
      method: 'POST',
    }),

  status: () =>
    request<{ authenticated: boolean }>('/auth/status'),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ success: boolean }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),
};

// Locations
export interface StorageLocation {
  id: string;
  name: string;
  icon: string | null;
  sortOrder: number;
  articleCount?: number;
}

export const locations = {
  list: () =>
    request<StorageLocation[]>('/locations'),

  get: (id: string) =>
    request<StorageLocation & { articles: Article[] }>(`/locations/${id}`),

  create: (data: { name: string; icon?: string; sortOrder?: number }) =>
    request<StorageLocation>('/locations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<{ name: string; icon: string | null; sortOrder: number }>) =>
    request<StorageLocation>(`/locations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<void>(`/locations/${id}`, {
      method: 'DELETE',
    }),
};

// Products (specific variants of articles with barcodes)
export interface Product {
  id: string;
  articleId: string;
  article?: Article;
  name: string;
  barcode: string | null;
  brand: string | null;
  packageSize: number | null;
  packageUnit: string | null;
  imageUrl: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProductInput {
  articleId: string;
  name: string;
  barcode?: string | null;
  brand?: string | null;
  packageSize?: number | null;
  packageUnit?: string | null;
  imageUrl?: string | null;
  notes?: string | null;
}

// Articles
export interface Article {
  id: string;
  name: string;
  defaultUnit: string;
  packageSize: number;
  packageUnit: string;
  locationId: string | null;
  location: StorageLocation | null;
  minStock: number | null;
  defaultExpiryDays: number | null;
  calories: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  fiber: number | null;
  category: string | null;
  isConsumable: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  // Computed fields
  totalStock?: number;
  earliestExpiry?: string | null;
  batchCount?: number;
  isLowStock?: boolean;
  batches?: Batch[];
  allBatches?: Batch[]; // All batches including depleted ones for history
  products?: Product[];
  lastPurchasePrice?: number | null;
  avgPrice?: number | null;
}

export interface CreateArticleInput {
  name: string;
  defaultUnit?: string;
  packageSize?: number;
  packageUnit?: string;
  locationId?: string | null;
  minStock?: number | null;
  defaultExpiryDays?: number | null;
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  fiber?: number | null;
  category?: string | null;
  isConsumable?: boolean;
}

export const articles = {
  list: (params?: { locationId?: string; category?: string; search?: string; lowStock?: boolean }) => {
    const query = new URLSearchParams();
    if (params?.locationId) query.set('locationId', params.locationId);
    if (params?.category) query.set('category', params.category);
    if (params?.search) query.set('search', params.search);
    if (params?.lowStock) query.set('lowStock', 'true');
    const queryString = query.toString();
    return request<Article[]>(`/articles${queryString ? `?${queryString}` : ''}`);
  },

  get: (id: string) =>
    request<Article & { consumptionLogs: ConsumptionLog[]; recipeIngredients: any[] }>(`/articles/${id}`),

  getExpiring: (days: number = 7) =>
    request<Batch[]>(`/articles/expiring?days=${days}`),

  create: (data: CreateArticleInput) =>
    request<Article>('/articles', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<CreateArticleInput>) =>
    request<Article>(`/articles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<void>(`/articles/${id}`, {
      method: 'DELETE',
    }),

  consume: (id: string, quantity: number, source: string = 'MANUAL', notes?: string) =>
    request<{ consumed: number; remaining: number; logs: ConsumptionLog[] }>(`/articles/${id}/consume`, {
      method: 'POST',
      body: JSON.stringify({ quantity, source, notes }),
    }),

  correctStock: (id: string, actualStock: number, notes?: string) =>
    request<{ message: string; previousStock: number; newStock: number; difference: number }>(`/articles/${id}/correct-stock`, {
      method: 'POST',
      body: JSON.stringify({ actualStock, notes }),
    }),
};

// Batches
export interface Batch {
  id: string;
  articleId: string;
  article?: { id: string; name: string; defaultUnit: string; location?: StorageLocation };
  quantity: number;
  initialQuantity: number;
  purchaseDate: string;
  expiryDate: string | null;
  purchasePrice: number | null;
  notes: string | null;
  createdAt: string;
}

export interface CreateBatchInput {
  articleId: string;
  quantity: number;
  purchaseDate?: string;
  expiryDate?: string | null;
  purchasePrice?: number | null;
  notes?: string | null;
}

export const batches = {
  list: (params?: { articleId?: string; hasStock?: boolean }) => {
    const query = new URLSearchParams();
    if (params?.articleId) query.set('articleId', params.articleId);
    if (params?.hasStock) query.set('hasStock', 'true');
    const queryString = query.toString();
    return request<Batch[]>(`/batches${queryString ? `?${queryString}` : ''}`);
  },

  get: (id: string) =>
    request<Batch & { consumptionLogs: ConsumptionLog[] }>(`/batches/${id}`),

  create: (data: CreateBatchInput) =>
    request<Batch>('/batches', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<{ quantity: number; purchaseDate: string; expiryDate: string | null; purchasePrice: number | null; notes: string | null }>) =>
    request<Batch>(`/batches/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<void>(`/batches/${id}`, {
      method: 'DELETE',
    }),

  consume: (id: string, quantity: number, source: string = 'MANUAL', notes?: string) =>
    request<{ batch: Batch; log: ConsumptionLog }>(`/batches/${id}/consume`, {
      method: 'POST',
      body: JSON.stringify({ quantity, source, notes }),
    }),

  // Update purchase data (separate from stock editing)
  // This edits the purchase transaction: initialQuantity, price, dates
  updatePurchase: (id: string, data: Partial<{
    initialQuantity: number;
    purchaseDate: string;
    expiryDate: string | null;
    purchasePrice: number | null;
    notes: string | null;
  }>) =>
    request<Batch & { consumed: number; hasBeenConsumed: boolean }>(`/batches/${id}/purchase`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
};

// Consumption
export interface ConsumptionLog {
  id: string;
  articleId: string;
  batchId: string | null;
  quantity: number;
  consumedAt: string;
  source: string;
  recipeId: string | null;
  notes: string | null;
}

export const consumption = {
  update: (id: string, data: Partial<{ quantity: number; consumedAt: string; notes: string | null }>) =>
    request<ConsumptionLog>(`/consumption/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<void>(`/consumption/${id}`, {
      method: 'DELETE',
    }),
};

// Dashboard
export interface DashboardData {
  expiring: {
    expired: Batch[];
    expiringSoon: Batch[];
  };
  lowStock: (Article & { totalStock: number; shortfall: number })[];
  todaysMeals: any[];
  shoppingList: {
    id: string;
    name: string;
    shopDate: string;
    totalItems: number;
    purchasedItems: number;
    estimatedTotal: number;
  } | null;
  stats: {
    totalArticles: number;
    activeBatches: number;
    locations: number;
    recipes: number;
  };
}

export const dashboard = {
  get: () =>
    request<DashboardData>('/dashboard'),
};

// Recipes
export interface RecipeIngredient {
  id: string;
  recipeId: string;
  articleId: string | null;
  article: { id: string; name: string; defaultUnit: string } | null;
  categoryMatch: string | null;
  quantity: number;
  unit: string;
  notes: string | null;
  optional: boolean;
}

export interface RecipeNutrition {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface Recipe {
  id: string;
  name: string;
  description: string | null;
  servings: number;
  prepTime: number | null;
  cookTime: number | null;
  instructions: string | null;
  imageUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  ingredients?: RecipeIngredient[];
  // Computed nutrition (total for entire recipe)
  nutrition?: RecipeNutrition;
  // Computed nutrition per serving
  nutritionPerServing?: RecipeNutrition;
  // Legacy fields (deprecated, use nutrition/nutritionPerServing instead)
  totalCalories?: number;
  totalProtein?: number;
  totalCarbs?: number;
  totalFat?: number;
  totalFiber?: number;
}

export interface CreateRecipeInput {
  name: string;
  description?: string | null;
  servings?: number;
  prepTime?: number | null;
  cookTime?: number | null;
  instructions?: string | null;
  imageUrl?: string | null;
  ingredients?: {
    articleId?: string | null;
    categoryMatch?: string | null;
    quantity: number;
    unit: string;
    notes?: string | null;
    optional?: boolean;
  }[];
}

export interface CookResult {
  success: boolean;
  message?: string;
  consumed: { articleId: string; name: string; consumed: number; unit: string; originalQuantity?: number; originalUnit?: string }[];
  missing?: { articleId?: string | null; name?: string; categoryMatch?: string | null; needed: number; available?: number; unit: string; error?: string }[];
}

export const recipes = {
  list: (params?: { search?: string; activeOnly?: boolean }) => {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.activeOnly !== undefined) query.set('activeOnly', String(params.activeOnly));
    const queryString = query.toString();
    return request<Recipe[]>(`/recipes${queryString ? `?${queryString}` : ''}`);
  },

  get: (id: string) =>
    request<Recipe>(`/recipes/${id}`),

  create: (data: CreateRecipeInput) =>
    request<Recipe>('/recipes', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<CreateRecipeInput>) =>
    request<Recipe>(`/recipes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<void>(`/recipes/${id}`, {
      method: 'DELETE',
    }),

  cook: (id: string, servings?: number) =>
    request<CookResult>(`/recipes/${id}/cook`, {
      method: 'POST',
      body: JSON.stringify({ servings }),
    }),

  suggestions: (limit?: number) =>
    request<Recipe[]>(`/recipes/suggestions${limit ? `?limit=${limit}` : ''}`),
};

// Meal Plan
export type MealType = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';

export interface MealPlanNutrition {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface MealPlanEntry {
  id: string;
  date: string;
  mealType: MealType;
  recipeId: string;
  recipe: {
    id: string;
    name: string;
    servings: number;
    prepTime?: number | null;
    cookTime?: number | null;
    imageUrl?: string | null;
  };
  servings: number;
  notes: string | null;
  completedAt: string | null;
  createdAt: string;
  nutrition?: MealPlanNutrition;
}

export interface CreateMealPlanInput {
  date: string;
  mealType: MealType;
  recipeId: string;
  servings: number;
  notes?: string | null;
}

export interface AggregatedIngredient {
  articleId: string | null;
  articleName: string | null;
  categoryMatch: string | null;
  unit: string;
  totalQuantity: number;
  recipes: string[];
}

export const mealPlan = {
  list: (from: string, to: string) =>
    request<MealPlanEntry[]>(`/meal-plan?from=${from}&to=${to}`),

  get: (id: string) =>
    request<MealPlanEntry>(`/meal-plan/${id}`),

  create: (data: CreateMealPlanInput) =>
    request<MealPlanEntry>('/meal-plan', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<{ servings: number; notes: string | null }>) =>
    request<MealPlanEntry>(`/meal-plan/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<void>(`/meal-plan/${id}`, {
      method: 'DELETE',
    }),

  complete: (id: string) =>
    request<MealPlanEntry>(`/meal-plan/${id}/complete`, {
      method: 'POST',
    }),

  uncomplete: (id: string) =>
    request<MealPlanEntry>(`/meal-plan/${id}/uncomplete`, {
      method: 'POST',
    }),

  getIngredients: (from: string, to: string) =>
    request<AggregatedIngredient[]>(`/meal-plan/ingredients?from=${from}&to=${to}`),
};

// Shopping Lists
export type ShoppingItemReason = 'RECIPE' | 'LOW_STOCK' | 'FORECAST' | 'MANUAL';

export interface ShoppingListItem {
  id: string;
  shoppingListId: string;
  articleId: string | null;
  article: { id: string; name: string; defaultUnit: string; category: string | null; packageSize?: number; packageUnit?: string } | null;
  customName: string | null;
  quantity: number;
  purchasedQuantity?: number | null;
  recommendedPacks?: number;
  unit: string;
  reason: ShoppingItemReason;
  estimatedPrice: number | null;
  actualPrice: number | null;
  purchaseDate: string | null;
  expiryDate: string | null;
  purchased: boolean;
  purchasedAt: string | null;
  createdAt: string;
}

export interface ShoppingList {
  id: string;
  name: string;
  shopDate: string;
  planUntil: string;
  completedAt: string | null;
  createdAt: string;
  items?: ShoppingListItem[];
  totalItems?: number;
  purchasedItems?: number;
  estimatedTotal?: number;
}

export interface CreateShoppingListInput {
  name?: string;
  shopDate: string;
  planUntil: string;
}

export interface AddShoppingItemInput {
  articleId?: string;
  customName?: string;
  quantity: number;
  unit: string;
  reason: ShoppingItemReason;
  estimatedPrice?: number | null;
}

export const shoppingLists = {
  list: () =>
    request<ShoppingList[]>('/shopping-lists'),

  getActive: () =>
    request<ShoppingList>('/shopping-lists/active'),

  get: (id: string) =>
    request<ShoppingList>(`/shopping-lists/${id}`),

  generate: (data: CreateShoppingListInput) =>
    request<ShoppingList>('/shopping-lists/generate', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  addItem: (listId: string, data: AddShoppingItemInput) =>
    request<ShoppingListItem>(`/shopping-lists/${listId}/items`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateItem: (listId: string, itemId: string, data: Partial<{
    purchased: boolean;
    quantity: number;
    neededQuantity: number;
    purchasedQuantity: number;
    actualPrice: number;
    purchaseDate: string | null;
    expiryDate: string | null;
  }>) =>
    request<ShoppingListItem>(`/shopping-lists/${listId}/items/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteItem: (listId: string, itemId: string) =>
    request<void>(`/shopping-lists/${listId}/items/${itemId}`, {
      method: 'DELETE',
    }),

  complete: (id: string) =>
    request<ShoppingList>(`/shopping-lists/${id}/complete`, {
      method: 'POST',
    }),

  delete: (id: string) =>
    request<void>(`/shopping-lists/${id}`, {
      method: 'DELETE',
    }),
};

// Products
export const products = {
  listForArticle: (articleId: string) =>
    request<Product[]>(`/articles/${articleId}/products`),

  get: (id: string) =>
    request<Product>(`/products/${id}`),

  create: (data: CreateProductInput) =>
    request<Product>('/products', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<Omit<CreateProductInput, 'articleId'>>) =>
    request<Product>(`/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<void>(`/products/${id}`, {
      method: 'DELETE',
    }),
};

// Units
export interface Unit {
  id: string;
  symbol: string;
  name: string;
  isDefault: boolean;
  conversionGroup: string | null;
  conversionFactor: number;
  convertsToUnitId: string | null;
  convertsToUnit: { id: string; symbol: string; name: string } | null;
  convertsToAmount: number | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUnitInput {
  symbol: string;
  name: string;
  conversionGroup?: string | null;
  conversionFactor?: number;
  convertsToUnitId?: string | null;
  convertsToAmount?: number | null;
}

export interface UnitConversionResult {
  from: { symbol: string; quantity: number };
  to: { symbol: string; quantity: number };
}

export const units = {
  list: () =>
    request<Unit[]>('/units'),

  get: (id: string) =>
    request<Unit>(`/units/${id}`),

  create: (data: CreateUnitInput) =>
    request<Unit>('/units', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<CreateUnitInput & { sortOrder: number }>) =>
    request<Unit>(`/units/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request<void>(`/units/${id}`, {
      method: 'DELETE',
    }),

  convert: (from: string, to: string, quantity: number) =>
    request<UnitConversionResult>(`/units/convert?from=${from}&to=${to}&quantity=${quantity}`),
};

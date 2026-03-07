/**
 * Central API client for the Go backend.
 * All requests go through the Go gateway at http://localhost:8080.
 */

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8080";

// ─── Token helpers ───────────────────────────────────────────────────────────

export function getToken(): string | null {
  return localStorage.getItem("auth_token");
}

export function setToken(token: string): void {
  localStorage.setItem("auth_token", token);
}

export function removeToken(): void {
  localStorage.removeItem("auth_token");
  localStorage.removeItem("auth_user");
}

export function getStoredUser(): User | null {
  try {
    const raw = localStorage.getItem("auth_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setStoredUser(user: User): void {
  localStorage.setItem("auth_user", JSON.stringify(user));
}

// ─── Core fetch wrapper ──────────────────────────────────────────────────────

async function request<T>(
  path: string,
  options: RequestInit = {},
  _requireAuth = true
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    removeToken();
    window.location.href = "/auth";
    throw new Error("Unauthorized");
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.error ?? data?.message ?? `HTTP ${res.status}`);
  }

  return data as T;
}

function get<T>(path: string, requireAuth = false) {
  return request<T>(path, { method: "GET" }, requireAuth);
}

function post<T>(path: string, body: unknown, requireAuth = true) {
  return request<T>(path, { method: "POST", body: JSON.stringify(body) }, requireAuth);
}

function put<T>(path: string, body: unknown, requireAuth = true) {
  return request<T>(path, { method: "PUT", body: JSON.stringify(body) }, requireAuth);
}

function del<T>(path: string, requireAuth = true) {
  return request<T>(path, { method: "DELETE" }, requireAuth);
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  phone?: string;
  avatar_url?: string;
  role: string;
  user_type: "buyer" | "seller" | "admin";
  created_at: string;
}

export interface Store {
  id: string;
  owner_id?: string;
  name: string;
  slug?: string;
  description?: string;
  // Image — backend uses image_url, frontend components may use logo_url
  image_url?: string;
  logo_url?: string;
  banner_url?: string;
  // Category — backend uses store_type, frontend may use category
  store_type?: string;
  category?: string;
  location?: string;
  // Contact
  whatsapp_phone?: string;
  whatsapp?: string;
  phone?: string;
  email?: string;
  instagram?: string;
  facebook?: string;
  twitter?: string;
  website?: string;
  // Settings
  delivery_fee?: number;
  payment_options?: string[];
  is_active: boolean;
  is_verified?: boolean;
  subscription_status?: string;
  subscription_expires_at?: string;
  // M-Pesa
  mpesa_enabled?: boolean;
  mpesa_type?: string;
  mpesa_number?: string;
  mpesa_till_number?: string;
  mpesa_account_number?: string;
  mpesa_bank_name?: string;
  mpesa_api_key?: string;
  mpesa_status?: string;
  mpesa_approved_at?: string;
  // Stats
  rating?: number;
  avg_rating?: number;
  total_ratings?: number;
  follower_count?: number;
  product_count?: number;
  created_at: string;
}

export interface Product {
  id: string;
  store_id?: string;
  store_name?: string;
  store_slug?: string;
  name: string;
  description?: string;
  price: number;
  category?: string;
  quality?: string;
  // Images
  image_url?: string;
  image_urls?: string[];
  images?: string[];
  // Stock
  in_stock?: boolean;
  stock_quantity?: number;
  is_active?: boolean;
  // Pricing
  tags?: string[];
  discount_percentage?: number;
  discount_price?: number;
  created_at: string;
  // Nested store added by normalization
  store?: {
    id: string;
    name: string;
    slug?: string;
    whatsapp?: string;
    whatsapp_phone?: string;
    mpesa_api_key?: string;
    mpesa_enabled?: boolean;
    mpesa_status?: string;
    is_active?: boolean;
    is_verified?: boolean;
    subscription_status?: string;
    created_at: string;
  };
}

export interface CartItem {
  id: string;
  user_id: string;
  product_id: string;
  quantity: number;
  created_at: string;
  // Flat fields from backend
  product_name?: string;
  price?: number;
  image_url?: string;
  store_id?: string;
  store_name?: string;
  store_slug?: string;
  whatsapp_phone?: string;
  mpesa_enabled?: boolean;
  mpesa_status?: string;
  // Nested product added by normalization for component compatibility
  product?: Product;
}

export interface WishlistItem {
  id: string;
  user_id: string;
  product_id: string;
  created_at: string;
  // Flat fields from backend
  product_name?: string;
  price?: number;
  image_url?: string;
  store_name?: string;
  // Nested product added by normalization
  product?: Product;
}

export interface Order {
  id: string;
  user_id: string;
  store_id?: string;
  status: string;
  total_amount: number;
  shipping_address?: string;
  payment_method?: string;
  payment_status?: string;
  delivery_address?: string;
  notes?: string;
  created_at: string;
  items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  price: number;
  unit_price?: number;
  created_at: string;
  product_name?: string;
  image_url?: string;
  product?: Product;
}

export interface Rating {
  id: string;
  store_id: string;
  user_id?: string;
  buyer_id?: string;
  rating: number;
  review?: string;
  comment?: string;
  created_at: string;
  user?: User;
}

export interface Complaint {
  id: string;
  store_id: string;
  user_id?: string;
  subject?: string;
  message?: string;
  status?: string;
  submitted_at?: string;
  created_at?: string;
}

export interface MpesaRequest {
  id: string;
  store_id?: string;
  user_id?: string;
  phone_number?: string;
  phone?: string;
  amount: number;
  external_reference?: string;
  order_reference?: string;
  transaction_reference?: string;
  checkout_request_id?: string;
  mpesa_receipt_number?: string;
  status: string;
  result_desc?: string;
  created_at: string;
}

// ─── Normalization helpers ────────────────────────────────────────────────────

function normalizeStore(s: any): Store {
  if (!s) return s;
  return {
    ...s,
    name: s.name ?? "",
    logo_url: s.logo_url ?? s.image_url,
    image_url: s.image_url ?? s.logo_url,
    category: s.category ?? s.store_type,
    store_type: s.store_type ?? s.category,
    whatsapp: s.whatsapp ?? s.whatsapp_phone,
    whatsapp_phone: s.whatsapp_phone ?? s.whatsapp,
    mpesa_till_number: s.mpesa_till_number ?? s.mpesa_number,
    mpesa_number: s.mpesa_number ?? s.mpesa_till_number,
    mpesa_api_key:
      s.mpesa_api_key ??
      (s.mpesa_enabled && s.mpesa_status === "approved" ? "enabled" : undefined),
    is_verified: s.is_verified ?? false,
    subscription_status:
      s.subscription_status ?? (s.is_active !== false ? "active" : "inactive"),
  };
}

function normalizeProduct(p: any): Product {
  if (!p) return p;
  const imageUrls: string[] = p.image_urls?.length
    ? p.image_urls
    : p.images?.length
    ? p.images
    : [];
  const images = imageUrls.length
    ? imageUrls
    : p.image_url
    ? [p.image_url]
    : [];
  const inStock =
    p.in_stock !== undefined
      ? p.in_stock
      : p.is_active !== undefined
      ? p.is_active
      : true;
  return {
    ...p,
    name: p.name ?? "",
    price: Number(p.price ?? 0),
    image_url: p.image_url ?? images[0],
    image_urls: imageUrls,
    images,
    in_stock: inStock,
    stock_quantity: p.stock_quantity ?? (inStock ? 999 : 0),
    is_active: p.is_active ?? inStock,
    tags: p.tags ?? [],
    discount_percentage: Number(p.discount_percentage ?? 0),
    discount_price:
      (p.discount_percentage ?? 0) > 0
        ? Number(p.price ?? 0) * (1 - Number(p.discount_percentage ?? 0) / 100)
        : undefined,
    store:
      p.store ??
      (p.store_name
        ? {
            id: p.store_id ?? "",
            name: p.store_name,
            slug: p.store_slug,
            is_active: true,
            is_verified: false,
            subscription_status: "active",
            created_at: p.created_at,
          }
        : undefined),
  };
}

function normalizeCartItem(item: any): CartItem {
  if (!item) return item;
  const mpesaOk = item.mpesa_enabled && item.mpesa_status === "approved";
  return {
    ...item,
    product: item.product ?? {
      id: item.product_id ?? "",
      store_id: item.store_id,
      name: item.product_name ?? "",
      price: Number(item.price ?? 0),
      image_url: item.image_url,
      image_urls: item.image_url ? [item.image_url] : [],
      images: item.image_url ? [item.image_url] : [],
      in_stock: true,
      stock_quantity: 999,
      is_active: true,
      tags: [],
      discount_percentage: 0,
      created_at: item.created_at,
      store: item.store_id
        ? {
            id: item.store_id,
            name: item.store_name ?? "",
            slug: item.store_slug,
            whatsapp: item.whatsapp_phone,
            whatsapp_phone: item.whatsapp_phone,
            mpesa_api_key: mpesaOk ? "enabled" : undefined,
            mpesa_enabled: item.mpesa_enabled,
            mpesa_status: item.mpesa_status,
            is_active: true,
            is_verified: false,
            subscription_status: "active",
            created_at: item.created_at,
          }
        : undefined,
    },
  };
}

function normalizeWishlistItem(item: any): WishlistItem {
  if (!item) return item;
  return {
    ...item,
    product: item.product ?? {
      id: item.product_id ?? "",
      name: item.product_name ?? "",
      price: Number(item.price ?? 0),
      image_url: item.image_url,
      image_urls: item.image_url ? [item.image_url] : [],
      images: item.image_url ? [item.image_url] : [],
      in_stock: true,
      stock_quantity: 999,
      is_active: true,
      tags: [],
      discount_percentage: 0,
      created_at: item.created_at,
      store: item.store_name
        ? {
            id: "",
            name: item.store_name,
            is_active: true,
            is_verified: false,
            subscription_status: "active",
            created_at: item.created_at,
          }
        : undefined,
    },
  };
}

// ─── Auth API ────────────────────────────────────────────────────────────────

export const authApi = {
  register: (body: {
    email: string;
    password: string;
    full_name: string;
    phone?: string;
    user_type?: "buyer" | "seller";
  }) => post<{ token: string; user: User }>("/auth/register", body, false),

  login: (email: string, password: string) =>
    post<{ token: string; user: User }>("/auth/login", { email, password }, false),

  me: async () => {
    const res = await get<{ user: User }>("/auth/me", true);
    return res.user;
  },

  updateProfile: async (body: Partial<Pick<User, "full_name" | "phone" | "avatar_url">>) => {
    const res = await put<{ user: User }>("/auth/profile", body);
    return res.user;
  },

  changePassword: (current_password: string, new_password: string) =>
    put<{ message: string }>("/auth/change-password", { current_password, new_password }),

  deleteAccount: () => del<{ message: string }>("/auth/account"),

  validate: (token: string) =>
    post<{ valid: boolean; user_id: string; email: string; user_type: string }>(
      "/auth/validate",
      { token },
      false
    ),
};

// ─── Store API ───────────────────────────────────────────────────────────────

export const storeApi = {
  list: async (params?: {
    category?: string;
    store_type?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) => {
    const qs = new URLSearchParams();
    const storeType = params?.store_type ?? params?.category;
    if (storeType) qs.set("store_type", storeType);
    if (params?.search) qs.set("search", params.search);
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.offset) qs.set("offset", String(params.offset));
    const q = qs.toString();
    const res = await get<{ stores: any[] }>(`/stores${q ? "?" + q : ""}`, false);
    return (res.stores ?? []).map(normalizeStore);
  },

  getBySlug: async (slug: string) => {
    const res = await get<{
      store: any;
      product_count?: number;
      follower_count?: number;
      avg_rating?: number;
    }>(`/stores/${slug}`, false);
    const store = res.store ?? res;
    return normalizeStore({
      ...store,
      rating: res.avg_rating ?? store.rating ?? 3.0,
      avg_rating: res.avg_rating ?? store.avg_rating ?? 3.0,
      follower_count: res.follower_count ?? store.follower_count ?? 0,
      product_count: res.product_count ?? store.product_count ?? 0,
    });
  },

  getMyStore: async () => {
    const res = await get<{ store: any }>("/stores/me/store", true);
    return res.store ? normalizeStore(res.store) : (null as unknown as Store);
  },

  create: async (body: any) => {
    const backendBody: any = {
      name: body.name ?? "",
      description: body.description ?? "",
      location: body.location ?? "",
      image_url: body.image_url ?? body.logo_url ?? "",
      store_type: body.store_type ?? body.category ?? "",
      delivery_fee: body.delivery_fee ?? 0,
      whatsapp_phone: body.whatsapp_phone ?? body.whatsapp ?? "",
      payment_options: body.payment_options ?? ["POD"],
      mpesa_enabled: body.mpesa_enabled ?? false,
      mpesa_type: body.mpesa_type ?? "",
      mpesa_number: body.mpesa_number ?? body.mpesa_till_number ?? "",
      mpesa_account_number: body.mpesa_account_number ?? "",
      mpesa_bank_name: body.mpesa_bank_name ?? "",
    };
    const res = await post<{ store: any }>("/stores", backendBody);
    return normalizeStore(res.store ?? res);
  },

  update: async (slugOrId: string, body: any) => {
    const backendBody: any = { ...body };
    if (body.logo_url && !body.image_url) backendBody.image_url = body.logo_url;
    if (body.category && !body.store_type) backendBody.store_type = body.category;
    if (body.whatsapp && !body.whatsapp_phone) backendBody.whatsapp_phone = body.whatsapp;
    if (body.mpesa_till_number && !body.mpesa_number) backendBody.mpesa_number = body.mpesa_till_number;
    delete backendBody.logo_url;
    delete backendBody.banner_url;
    delete backendBody.category;
    delete backendBody.whatsapp;
    delete backendBody.mpesa_till_number;
    const res = await put<{ store: any }>(`/stores/${slugOrId}`, backendBody);
    return normalizeStore(res.store ?? res);
  },

  delete: (slugOrId: string) =>
    del<{ message: string }>(`/stores/${slugOrId}`),

  follow: (storeId: string) =>
    post<{ message: string }>(`/stores/${storeId}/follow`, {}),

  unfollow: (storeId: string) =>
    del<{ message: string }>(`/stores/${storeId}/follow`),

  followStatus: (storeId: string) =>
    get<{ following: boolean }>(`/stores/${storeId}/follow/status`, true),

  getRatings: async (storeId: string) => {
    const res = await get<{ ratings: Rating[]; average?: number }>(
      `/stores/${storeId}/ratings`,
      false
    );
    return res.ratings ?? [];
  },

  addRating: (storeId: string, body: { rating: number; review?: string }) =>
    post<any>(`/stores/${storeId}/ratings`, {
      rating: body.rating,
      comment: body.review ?? "",
      review: body.review ?? "",
    }),

  getComplaints: async (storeId: string) => {
    const res = await get<{ complaints: Complaint[] }>(
      `/stores/${storeId}/complaints`,
      true
    );
    return res.complaints ?? [];
  },

  addComplaint: (storeId: string, body: { subject?: string; message: string }) =>
    post<any>(`/stores/${storeId}/complaints`, { message: body.message }),
};

// ─── Product API ─────────────────────────────────────────────────────────────

export const productApi = {
  list: async (params?: {
    in_stock?: boolean;
    category?: string;
    store_id?: string;
    search?: string;
    has_discount?: boolean;
    ids?: string[];
    limit?: number;
    offset?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.in_stock != null) qs.set("in_stock", String(params.in_stock));
    if (params?.category) qs.set("category", params.category);
    if (params?.store_id) qs.set("store_id", params.store_id);
    if (params?.search) qs.set("search", params.search);
    if (params?.has_discount != null)
      qs.set("has_discount", String(params.has_discount));
    // Use "ids" (not "ids[]") to match Go's c.QueryArray("ids")
    if (params?.ids?.length) params.ids.forEach((id) => qs.append("ids", id));
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.offset) qs.set("offset", String(params.offset));
    const q = qs.toString();
    const res = await get<{ products: any[] }>(
      `/products${q ? "?" + q : ""}`,
      false
    );
    return (res.products ?? []).map(normalizeProduct);
  },

  get: async (id: string) => {
    const res = await get<{ product: any }>(`/products/${id}`, false);
    return normalizeProduct(res.product ?? res);
  },

  create: async (body: any) => {
    const res = await post<{ product: any }>("/products", body);
    return normalizeProduct(res.product ?? res);
  },

  update: async (id: string, body: any) => {
    const res = await put<{ product: any }>(`/products/${id}`, body);
    return normalizeProduct(res.product ?? res);
  },

  delete: (id: string) => del<{ message: string }>(`/products/${id}`),

  categories: async () => {
    const res = await get<{ categories: string[] }>("/products/categories", false);
    return res.categories ?? [];
  },

  getComparisons: async () => {
    const res = await get<{ products: any[] }>("/products/comparisons", true);
    return (res.products ?? []).map(normalizeProduct);
  },

  addComparison: (productId: string) =>
    post<{ message: string }>("/products/comparisons", { product_id: productId }),

  removeComparison: (productId: string) =>
    del<{ message: string }>(`/products/comparisons/${productId}`),
};

// ─── Cart API ────────────────────────────────────────────────────────────────

export const cartApi = {
  get: async () => {
    const res = await get<{ items: any[]; total_quantity?: number }>("/cart", true);
    return (res.items ?? []).map(normalizeCartItem);
  },

  add: (product_id: string, quantity = 1) =>
    post<any>("/cart", { product_id, quantity }),

  update: (itemId: string, quantity: number) =>
    put<any>(`/cart/${itemId}`, { quantity }),

  remove: (itemId: string) => del<{ message: string }>(`/cart/${itemId}`),

  clear: () => del<{ message: string }>("/cart"),
};

// ─── Wishlist API ────────────────────────────────────────────────────────────

export const wishlistApi = {
  get: async () => {
    const res = await get<{ items: any[] }>("/wishlist", true);
    return (res.items ?? []).map(normalizeWishlistItem);
  },

  add: (product_id: string) => post<any>("/wishlist", { product_id }),

  remove: (itemId: string) => del<{ message: string }>(`/wishlist/${itemId}`),
};

// ─── Order API ───────────────────────────────────────────────────────────────

export const orderApi = {
  create: async (body: {
    store_id?: string;
    shipping_address?: string;
    delivery_address?: string;
    payment_method?: string;
    notes?: string;
  }) => {
    const res = await post<any>("/orders", {
      shipping_address: body.shipping_address ?? body.delivery_address ?? "",
    });
    return res as Order;
  },

  list: async () => {
    const res = await get<{ orders: Order[] }>("/orders", true);
    return res.orders ?? [];
  },

  get: async (id: string) => {
    const res = await get<{ order: Order }>(`/orders/${id}`, true);
    return (res.order ?? res) as Order;
  },
};

// ─── Payment API ─────────────────────────────────────────────────────────────

export const paymentApi = {
  mpesaInitiate: async (body: {
    store_id: string;
    phone: string;
    amount: number;
    order_reference: string;
  }) => {
    const res = await post<{
      success?: boolean;
      payment_id?: string;
      external_reference?: string;
      transaction_reference?: string;
      message?: string;
    }>("/payments/mpesa/initiate", {
      store_id: body.store_id,
      phone_number: body.phone,
      amount: body.amount,
      external_reference: body.order_reference,
    });
    return {
      ...res,
      checkout_request_id:
        res.transaction_reference ??
        res.external_reference ??
        res.payment_id ??
        "",
      request_id: res.payment_id ?? "",
    };
  },

  mpesaStatus: async (checkoutRequestIdOrRef: string, storeId: string) => {
    const res = await post<{
      status: string;
      external_reference?: string;
      mpesa_receipt_number?: string;
      result_desc?: string;
    }>("/payments/mpesa/status", {
      transaction_reference: checkoutRequestIdOrRef,
      external_reference: checkoutRequestIdOrRef,
      store_id: storeId,
    });
    return {
      ...res,
      status: res.status ?? "pending",
    };
  },

  history: async () => {
    const res = await get<{ payments: any[] }>("/payments/history", true);
    return (res.payments ?? []).map((p) => ({
      ...p,
      phone: p.phone_number ?? p.phone ?? "",
      order_reference: p.external_reference ?? p.order_reference ?? "",
      checkout_request_id: p.transaction_reference ?? "",
    })) as MpesaRequest[];
  },

  storeHistory: async (storeId: string) => {
    const res = await get<{ payments: any[] }>(
      `/payments/store/${storeId}/history`,
      true
    );
    return (res.payments ?? []).map((p) => ({
      ...p,
      phone: p.phone_number ?? p.phone ?? "",
      order_reference: p.external_reference ?? p.order_reference ?? "",
      checkout_request_id: p.transaction_reference ?? "",
    })) as MpesaRequest[];
  },
};

// ─── Admin API ───────────────────────────────────────────────────────────────

export const adminApi = {
  stats: () => get<Record<string, number>>("/admin/stats", true),

  stores: async (params?: { status?: string; search?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.search) qs.set("search", params.search);
    const q = qs.toString();
    const res = await get<{ stores: any[] }>(
      `/admin/stores${q ? "?" + q : ""}`,
      true
    );
    return res.stores ?? [];
  },

  users: async () => {
    const res = await get<{ users: any[] }>("/admin/users", true);
    return res.users ?? [];
  },

  products: async () => {
    const res = await get<{ products: any[] }>("/admin/products", true);
    return res.products ?? [];
  },

  deleteProduct: (id: string) =>
    del<{ message: string }>(`/admin/products/${id}`),

  complaints: async () => {
    const res = await get<{ complaints: any[] }>("/admin/complaints", true);
    return res.complaints ?? [];
  },

  updateComplaint: async (id: string, status: string) => {
    // Backend only has DELETE for complaints — map "resolved" to DELETE
    if (status === "resolved" || status === "deleted") {
      return del<{ message: string }>(`/admin/complaints/${id}`);
    }
    return put<any>(`/admin/complaints/${id}`, { status });
  },

  pendingMpesa: async () => {
    const res = await get<{ stores: any[] }>("/admin/mpesa/pending", true);
    return res.stores ?? [];
  },

  // Backend expects { api_key } — was mistakenly { mpesa_api_key } before
  approveMpesa: (storeId: string, apiKey: string) =>
    put<{ message: string }>(`/admin/mpesa/${storeId}/approve`, { api_key: apiKey }),

  rejectMpesa: (storeId: string, reason: string) =>
    put<{ message: string }>(`/admin/mpesa/${storeId}/reject`, { reason }),

  getSetting: async (key: string) => {
    const res = await get<{ key: string; value: any }>(
      `/admin/settings/${key}`,
      true
    ).catch(() => null);
    if (!res) return null;
    return {
      key: res.key,
      // Always return value as a JSON string so callers can safely JSON.parse it
      value:
        typeof res.value === "string" ? res.value : JSON.stringify(res.value),
    };
  },

  setSetting: async (key: string, value: string) => {
    let parsedValue: any = {};
    try {
      parsedValue = JSON.parse(value);
    } catch {
      parsedValue = value;
    }
    // Send the parsed object directly — backend stores the whole request body as JSONB
    return put<any>(`/admin/settings/${key}`, parsedValue);
  },

  deleteStore: (storeId: string) =>
    del<{ message: string }>(`/admin/stores/${storeId}`),

  toggleStore: (storeId: string, isActive: boolean) =>
    request<{ message: string }>(
      `/admin/stores/${storeId}/activate`,
      { method: "PATCH", body: JSON.stringify({ is_active: isActive }) }
    ),

  deleteUser: (userId: string) =>
    del<{ message: string }>(`/admin/users/${userId}`),

  updateUserRole: (userId: string, body: { role?: string; user_type?: string }) =>
    put<{ message: string }>(`/admin/users/${userId}/role`, body),

  promote: (email: string, setupToken: string) =>
    post<{ message: string }>(
      "/admin/promote",
      { email, admin_token: setupToken },
      false
    ),
};

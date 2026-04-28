// src/services/api.ts
import axios from "axios";

const _rawBase = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");

export const apiClient = axios.create({
  baseURL: `${_rawBase}/api/v1`,
  headers: { "Content-Type": "application/json" },
  timeout: 10_000,
});

export interface Product {
  name:           string;
  price_per_unit: number;
  unit:           string;
  available:      boolean;
}

export interface DBProduct {
  id:         string;
  name_ar:    string;
  name_fr:    string | null;
  category:   string;
  price_mad:  number;
  unit:       string;
  in_stock:    boolean;
  image_url:   string;
  image_status:string;
  visible:     boolean;
  created_at: string | null;
}

export interface DBProductUpdate {
  price_mad?:  number;
  in_stock?:   boolean;
  name_ar?:    string;
  name_fr?:    string;
  unit?:       string;
  category?:   string;
}

export interface DBProductUpdateResponse extends DBProduct {}

export interface ProductUpdate {
  price_per_unit?: number;
  available?:      boolean;
}
export interface ProductUpdateResponse {
  message:        string;
  product_name:   string;
  price_per_unit: number;
  available:      boolean;
}

export interface CheckoutItem {
  name:           string;
  quantity:       number;
  price_per_unit: number;
}
export interface CheckoutOrderPayload {
  customer_phone:   string;
  delivery_address: string;
  items:            CheckoutItem[];
  total_price:      number;
}
export interface CheckoutOrderResponse {
  message:     string;
  order_id:    string;
  status:      string;
  total_price: number;
}

export type OrderStatus =
  | "pending"
  | "preparing"
  | "out_for_delivery"
  | "delivered"
  | "completed"
  | "cancelled";

export interface OrderItem {
  item_name?:     string;
  name?:          string;
  quantity:       number;
  unit?:          string;
  price_per_unit: number;
  line_total?:    number;
}
export interface Order {
  id:               string;
  customer_phone:   string;
  customer_name?:   string;
  delivery_address?: string;
  items:            OrderItem[];
  total_price:      number;
  status:           OrderStatus;
  created_at:       string;
}
export interface OrderStatusUpdateResponse {
  message:    string;
  order_id:   string;
  new_status: OrderStatus;
}

// ── Analytics ─────────────────────────────────────────────────────────────────
export type AnalyticsPeriod = "today" | "week" | "month" | "all";

export interface StatusBreakdown {
  pending:          number;
  preparing:        number;
  out_for_delivery: number;
  delivered:        number;
  completed:        number;
  cancelled:        number;
}
export interface TopItem {
  name:     string;
  qty_sold: number;
  revenue:  number;
}
export interface AnalyticsData {
  total_revenue:     number;
  total_orders:      number;
  orders_by_status:  StatusBreakdown;
  top_selling_items: TopItem[];
  avg_order_value:   number;
  completion_rate:   number;
  period:            string;
}

// ── Envelope helper ───────────────────────────────────────────────────────────
interface ApiEnvelope {
  products?: unknown; data?: unknown; items?: unknown;
  orders?: unknown;   results?: unknown;
}
function toArray<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  const e = raw as ApiEnvelope;
  if (Array.isArray(e?.products)) return e.products as T[];
  if (Array.isArray(e?.data))     return e.data     as T[];
  if (Array.isArray(e?.items))    return e.items    as T[];
  if (Array.isArray(e?.orders))   return e.orders   as T[];
  if (Array.isArray(e?.results))  return e.results  as T[];
  return [];
}

export async function getCatalog(): Promise<Product[]> {
  const r = await apiClient.get<unknown>("/catalog");
  return toArray<Product>(r.data);
}
export async function getAvailableCatalog(): Promise<Product[]> {
  const r = await apiClient.get<unknown>("/catalog", { params: { available_only: true } });
  return toArray<Product>(r.data);
}
export async function updateProduct(name: string, updates: ProductUpdate): Promise<ProductUpdateResponse> {
  const r = await apiClient.patch<ProductUpdateResponse>("/catalog", { product_name: name, ...updates });
  return r.data;
}

export async function getProducts(options?: { availableOnly?: boolean; category?: string }): Promise<DBProduct[]> {
  const params: Record<string, string | boolean> = {};
  if (options?.availableOnly) params.available_only = true;
  if (options?.category)      params.category       = options.category;
  const r = await apiClient.get<unknown>("/products", { params });
  return toArray<DBProduct>(r.data);
}
export async function updateProductById(id: string, updates: DBProductUpdate): Promise<DBProductUpdateResponse> {
  const r = await apiClient.patch<DBProductUpdateResponse>(`/products/${id}`, updates);
  return r.data;
}

export async function getAnalytics(period: AnalyticsPeriod = "all"): Promise<AnalyticsData> {
  const r = await apiClient.get<AnalyticsData>("/analytics", { params: { period } });
  return r.data;
}

export async function createOrder(payload: CheckoutOrderPayload): Promise<CheckoutOrderResponse> {
  const r = await apiClient.post<CheckoutOrderResponse>("/orders", payload);
  return r.data;
}
export async function getOrders(status?: OrderStatus, limit = 50): Promise<Order[]> {
  const params: Record<string, string | number> = { limit };
  if (status) params.status = status;
  const r = await apiClient.get<unknown>("/orders", { params });
  return toArray<Order>(r.data).map((o: Order) => ({
    ...o,
    id: o.id || (o as unknown as Record<string,string>)["_id"] || "",
    status: (o.status?.toLowerCase() as OrderStatus) || "pending",
  }));
}
export async function updateOrderStatus(orderId: string, status: OrderStatus): Promise<OrderStatusUpdateResponse> {
  const r = await apiClient.patch<OrderStatusUpdateResponse>(`/orders/${orderId}/status`, null, { params: { status } });
  return r.data;
}
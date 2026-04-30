// ============================================================
// FarmDirect — Shared TypeScript Types
// ============================================================

export type UserRole = 'farmer' | 'consumer'

export type OrderStatus =
  | 'pending_payment'
  | 'paid'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'confirmed_delivery'
  | 'completed'
  | 'cancelled'
  | 'refunded'

export type ProductCategory =
  | 'vegetables'
  | 'fruits'
  | 'grains'
  | 'dairy'
  | 'spices'
  | 'pulses'
  | 'other'

// ─── Database Row Types ────────────────────────────────────────

export interface Profile {
  id: string
  role: UserRole
  full_name: string
  phone: string | null
  avatar_url: string | null
  address: string | null
  city: string
  state: string
  pincode: string | null
  bio: string | null
  farm_name: string | null
  is_verified: boolean
  created_at: string
  updated_at: string
}

export interface Product {
  id: string
  farmer_id: string
  name: string
  description: string | null
  category: ProductCategory
  price_per_unit: number
  unit: string
  stock_quantity: number
  min_order_qty: number
  images: string[]
  is_organic: boolean
  is_available: boolean
  harvest_date: string | null
  tags: string[]
  created_at: string
  updated_at: string
  // Joined
  farmer?: Profile
  avg_rating?: number
  review_count?: number
}

export interface Order {
  id: string
  consumer_id: string
  status: OrderStatus
  total_amount: number
  delivery_address: string
  delivery_city: string
  delivery_pincode: string | null
  notes: string | null
  payment_reference: string | null
  escrow_released_at: string | null
  delivered_at: string | null
  created_at: string
  updated_at: string
  // Joined
  consumer?: Profile
  items?: OrderItem[]
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string
  farmer_id: string
  quantity: number
  unit_price: number
  subtotal: number
  created_at: string
  // Joined
  product?: Product
  farmer?: Profile
}

export interface Review {
  id: string
  product_id: string
  consumer_id: string
  order_id: string
  rating: number
  comment: string | null
  created_at: string
  // Joined
  consumer?: Profile
}

export interface CartItem {
  id: string
  consumer_id: string
  product_id: string
  quantity: number
  created_at: string
  // Joined
  product?: Product
}

// ─── API Response Types ────────────────────────────────────────

export interface ApiResponse<T> {
  data: T | null
  error: string | null
}

export interface PaginatedResponse<T> {
  data: T[]
  count: number
  page: number
  pageSize: number
  error: string | null
}

// ─── Form / Input Types ─────────────────────────────────────────

export interface ProductFormData {
  name: string
  description: string
  category: ProductCategory
  price_per_unit: number
  unit: string
  stock_quantity: number
  min_order_qty: number
  is_organic: boolean
  harvest_date: string
  tags: string
  images: File[]
}

export interface CheckoutFormData {
  delivery_address: string
  delivery_city: string
  delivery_pincode: string
  notes: string
}

export interface RegisterFormData {
  email: string
  password: string
  full_name: string
  role: UserRole
  phone: string
  farm_name?: string
}

// ─── Cart State (client-side) ──────────────────────────────────

export interface CartState {
  items: CartItem[]
  total: number
  itemCount: number
}

// ─── Marketplace Filters ───────────────────────────────────────

export interface ProductFilters {
  category?: ProductCategory | 'all'
  search?: string
  minPrice?: number
  maxPrice?: number
  isOrganic?: boolean
  sortBy?: 'price_asc' | 'price_desc' | 'newest' | 'rating'
  page?: number
}

// ─── Supabase Database Type (for typed client) ─────────────────

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Omit<Profile, 'created_at' | 'updated_at'>
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>
      }
      products: {
        Row: Product
        Insert: Omit<Product, 'id' | 'created_at' | 'updated_at' | 'farmer' | 'avg_rating' | 'review_count'>
        Update: Partial<Omit<Product, 'id' | 'farmer_id' | 'created_at' | 'farmer' | 'avg_rating' | 'review_count'>>
      }
      orders: {
        Row: Order
        Insert: Omit<Order, 'id' | 'created_at' | 'updated_at' | 'consumer' | 'items'>
        Update: Partial<Omit<Order, 'id' | 'consumer_id' | 'created_at' | 'consumer' | 'items'>>
      }
      order_items: {
        Row: OrderItem
        Insert: Omit<OrderItem, 'id' | 'subtotal' | 'created_at' | 'product' | 'farmer'>
        Update: never
      }
      reviews: {
        Row: Review
        Insert: Omit<Review, 'id' | 'created_at' | 'consumer'>
        Update: never
      }
      cart_items: {
        Row: CartItem
        Insert: Omit<CartItem, 'id' | 'created_at' | 'product'>
        Update: Pick<CartItem, 'quantity'>
      }
    }
  }
}

// ─── Constants ─────────────────────────────────────────────────

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  vegetables: 'Vegetables',
  fruits: 'Fruits',
  grains: 'Grains & Cereals',
  dairy: 'Dairy',
  spices: 'Spices & Herbs',
  pulses: 'Pulses & Legumes',
  other: 'Other',
}

export const CATEGORY_EMOJIS: Record<ProductCategory, string> = {
  vegetables: '🥦',
  fruits: '🍎',
  grains: '🌾',
  dairy: '🥛',
  spices: '🌶️',
  pulses: '🫘',
  other: '🧺',
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: 'Awaiting Payment',
  paid: 'Payment Received',
  processing: 'Being Prepared',
  shipped: 'Out for Delivery',
  delivered: 'Delivered',
  confirmed_delivery: 'Delivery Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
}

export const UNITS = ['kg', 'g', 'litre', 'ml', 'dozen', 'piece', 'bundle', 'box'] as const
export type Unit = (typeof UNITS)[number]

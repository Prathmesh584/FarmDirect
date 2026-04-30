'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, SlidersHorizontal, Leaf, X, ShoppingCart, Star, ChevronLeft, ChevronRight } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Product, ProductCategory, ProductFilters } from '@/types'
import { CATEGORY_LABELS, CATEGORY_EMOJIS } from '@/types'

const PAGE_SIZE = 12

const CATEGORIES: Array<{ value: ProductCategory | 'all'; label: string; emoji: string }> = [
  { value: 'all',        label: 'All',       emoji: '🛒' },
  { value: 'vegetables', label: 'Vegetables', emoji: '🥦' },
  { value: 'fruits',     label: 'Fruits',     emoji: '🍎' },
  { value: 'grains',     label: 'Grains',     emoji: '🌾' },
  { value: 'dairy',      label: 'Dairy',      emoji: '🥛' },
  { value: 'spices',     label: 'Spices',     emoji: '🌶️' },
  { value: 'pulses',     label: 'Pulses',     emoji: '🫘' },
]

export default function MarketplacePage() {
  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [addingToCart, setAddingToCart] = useState<string | null>(null)
  const [cartFeedback, setCartFeedback] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  const [filters, setFilters] = useState<ProductFilters>({
    category: 'all',
    search: '',
    sortBy: 'newest',
    isOrganic: false,
    page: 1,
  })

  const searchInputRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  // ── Fetch products ─────────────────────────────────────────
  const fetchProducts = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.category && filters.category !== 'all') params.set('category', filters.category)
      if (filters.search) params.set('search', filters.search)
      if (filters.isOrganic) params.set('isOrganic', 'true')
      if (filters.sortBy) params.set('sortBy', filters.sortBy)
      if (filters.page) params.set('page', String(filters.page))

      const res = await fetch(`/api/products?${params}`)
      const json = await res.json()

      if (json.error) throw new Error(json.error)
      setProducts(json.data ?? [])
      setTotal(json.count ?? 0)
    } catch (err) {
      console.error('Fetch products error:', err)
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => { fetchProducts() }, [fetchProducts])

  // ── Realtime inventory subscription ───────────────────────
  useEffect(() => {
    const channel = supabase
      .channel('marketplace-inventory')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'products' },
        (payload) => {
          setProducts(prev =>
            prev.map(p =>
              p.id === payload.new.id
                ? { ...p, stock_quantity: payload.new.stock_quantity, is_available: payload.new.is_available }
                : p
            )
          )
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase])

  // ── Debounced search ───────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters(f => ({ ...f, page: 1 }))
    }, 350)
    return () => clearTimeout(timer)
  }, [filters.search])

  // ── Add to cart ────────────────────────────────────────────
  const handleAddToCart = async (product: Product) => {
    if (product.stock_quantity === 0) return
    setAddingToCart(product.id)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/auth/login?redirectTo=/marketplace'
        return
      }

      // Upsert cart item
      const { error } = await supabase
        .from('cart_items')
        .upsert(
          { consumer_id: user.id, product_id: product.id, quantity: 1 },
          { onConflict: 'consumer_id,product_id', ignoreDuplicates: false }
        )

      if (error) throw error

      setCartFeedback(product.name)
      setTimeout(() => setCartFeedback(null), 2500)
    } catch (err) {
      console.error('Add to cart error:', err)
    } finally {
      setAddingToCart(null)
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="min-h-screen bg-cream">
      {/* ── Cart Feedback Toast ─────────────────────────────── */}
      {cartFeedback && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-green-deep text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-2 toast-enter">
          <ShoppingCart size={16} />
          <span className="text-sm font-medium">{cartFeedback} added to cart!</span>
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="bg-green-deep py-14">
        <div className="section text-center">
          <h1 className="font-serif text-4xl sm:text-5xl text-white mb-4">
            Fresh Marketplace
          </h1>
          <p className="text-white/70 mb-8">
            {total > 0 ? `${total} fresh products` : 'Loading products...'} from Bhopal&apos;s farmers
          </p>

          {/* Search bar */}
          <div className="max-w-xl mx-auto relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
            <input
              ref={searchInputRef}
              type="search"
              placeholder="Search vegetables, fruits, grains…"
              value={filters.search ?? ''}
              onChange={e => setFilters(f => ({ ...f, search: e.target.value, page: 1 }))}
              className="input pl-11 pr-12 py-3.5 text-base shadow-sm"
            />
            {filters.search && (
              <button
                onClick={() => setFilters(f => ({ ...f, search: '', page: 1 }))}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-soil">
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="section py-8">
        {/* ── Category Pills ──────────────────────────────── */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide mb-6">
          {CATEGORIES.map(cat => (
            <button
              key={cat.value}
              onClick={() => setFilters(f => ({ ...f, category: cat.value, page: 1 }))}
              className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                filters.category === cat.value
                  ? 'bg-green-deep text-white border-green-deep'
                  : 'bg-white text-soil-mid border-border hover:border-green-mid hover:text-green-deep'
              }`}>
              <span>{cat.emoji}</span> {cat.label}
            </button>
          ))}
        </div>

        {/* ── Toolbar ─────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFilters(f => !f)}
              className={`btn-secondary text-xs gap-1.5 ${showFilters ? 'border-green-mid text-green-deep bg-green-light' : ''}`}>
              <SlidersHorizontal size={14} /> Filters
            </button>

            {filters.isOrganic && (
              <button
                onClick={() => setFilters(f => ({ ...f, isOrganic: false, page: 1 }))}
                className="flex items-center gap-1 text-xs text-green-deep bg-green-light px-3 py-1.5 rounded-full border border-green-mid/30">
                <Leaf size={11} /> Organic only <X size={11} />
              </button>
            )}
          </div>

          <select
            value={filters.sortBy}
            onChange={e => setFilters(f => ({ ...f, sortBy: e.target.value as ProductFilters['sortBy'], page: 1 }))}
            className="input w-auto text-sm py-2">
            <option value="newest">Newest First</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="rating">Top Rated</option>
          </select>
        </div>

        {/* ── Filter Panel ─────────────────────────────────── */}
        {showFilters && (
          <div className="card p-5 mb-6 animate-fade-in">
            <div className="flex items-center gap-6 flex-wrap">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={filters.isOrganic}
                  onChange={e => setFilters(f => ({ ...f, isOrganic: e.target.checked, page: 1 }))}
                  className="rounded accent-green-mid w-4 h-4"
                />
                <Leaf size={14} className="text-green-mid" />
                <span className="text-sm text-soil-mid">Organic only</span>
              </label>

              <div className="flex items-center gap-2">
                <label className="text-sm text-muted">Price:</label>
                <input
                  type="number"
                  placeholder="Min ₹"
                  onChange={e => setFilters(f => ({ ...f, minPrice: e.target.value ? Number(e.target.value) : undefined, page: 1 }))}
                  className="input w-24 text-sm py-1.5"
                />
                <span className="text-muted">–</span>
                <input
                  type="number"
                  placeholder="Max ₹"
                  onChange={e => setFilters(f => ({ ...f, maxPrice: e.target.value ? Number(e.target.value) : undefined, page: 1 }))}
                  className="input w-24 text-sm py-1.5"
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Product Grid ─────────────────────────────────── */}
        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="card overflow-hidden">
                <div className="skeleton h-44" />
                <div className="p-4 space-y-2">
                  <div className="skeleton h-4 w-3/4" />
                  <div className="skeleton h-3 w-1/2" />
                  <div className="skeleton h-5 w-1/3 mt-2" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-24">
            <div className="text-6xl mb-4">🌿</div>
            <h3 className="font-serif text-2xl text-soil mb-2">No products found</h3>
            <p className="text-muted mb-6">
              {filters.search
                ? `No results for "${filters.search}"`
                : 'No products in this category yet'}
            </p>
            <button
              onClick={() => setFilters({ category: 'all', search: '', sortBy: 'newest', page: 1 })}
              className="btn-secondary">
              Clear filters
            </button>
          </div>
        ) : (
          <div className="stagger grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {products.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                onAddToCart={handleAddToCart}
                isAdding={addingToCart === product.id}
              />
            ))}
          </div>
        )}

        {/* ── Pagination ───────────────────────────────────── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-12">
            <button
              disabled={filters.page === 1}
              onClick={() => setFilters(f => ({ ...f, page: (f.page ?? 1) - 1 }))}
              className="btn-secondary px-3 py-2 disabled:opacity-40">
              <ChevronLeft size={16} />
            </button>

            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const page = i + 1
              return (
                <button
                  key={page}
                  onClick={() => setFilters(f => ({ ...f, page }))}
                  className={`w-9 h-9 rounded-lg text-sm font-medium transition-all ${
                    filters.page === page
                      ? 'bg-green-deep text-white'
                      : 'bg-white border border-border text-soil-mid hover:border-green-mid'
                  }`}>
                  {page}
                </button>
              )
            })}

            <button
              disabled={filters.page === totalPages}
              onClick={() => setFilters(f => ({ ...f, page: (f.page ?? 1) + 1 }))}
              className="btn-secondary px-3 py-2 disabled:opacity-40">
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Product Card Component ─────────────────────────────────────
function ProductCard({
  product,
  onAddToCart,
  isAdding,
}: {
  product: Product
  onAddToCart: (p: Product) => void
  isAdding: boolean
}) {
  const isOutOfStock = product.stock_quantity === 0
  const isLowStock = product.stock_quantity > 0 && product.stock_quantity <= 5

  return (
    <div className={`card card-hover flex flex-col ${isOutOfStock ? 'opacity-70' : ''}`}>
      {/* Image */}
      <Link href={`/marketplace/${product.id}`} className="block relative h-44 bg-cream-dark overflow-hidden group">
        {product.images[0] ? (
          <Image
            src={product.images[0]}
            alt={product.name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl">
            {CATEGORY_EMOJIS[product.category]}
          </div>
        )}

        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {product.is_organic && (
            <span className="badge badge-green text-xs"><Leaf size={9} /> Organic</span>
          )}
        </div>
        {isOutOfStock && (
          <div className="absolute inset-0 bg-soil/40 flex items-center justify-center">
            <span className="bg-white text-soil font-semibold text-sm px-3 py-1 rounded-full">
              Out of Stock
            </span>
          </div>
        )}
        {isLowStock && (
          <span className="absolute top-2 right-2 badge badge-terra text-xs">
            Only {product.stock_quantity} left
          </span>
        )}
      </Link>

      {/* Body */}
      <div className="p-4 flex flex-col flex-1">
        <p className="text-xs text-muted uppercase tracking-wide mb-1">
          {CATEGORY_LABELS[product.category]}
        </p>
        <Link href={`/marketplace/${product.id}`}>
          <h3 className="font-semibold text-soil hover:text-green-deep transition-colors truncate">
            {product.name}
          </h3>
        </Link>

        {/* Rating */}
        {product.avg_rating && (
          <div className="flex items-center gap-1 mt-1">
            <Star size={11} className="text-gold fill-current" />
            <span className="text-xs text-muted">
              {product.avg_rating.toFixed(1)} ({product.review_count})
            </span>
          </div>
        )}

        <div className="mt-auto pt-3 flex items-center justify-between">
          <div>
            <span className="font-bold text-green-deep text-lg">₹{product.price_per_unit}</span>
            <span className="text-muted text-sm">/{product.unit}</span>
          </div>

          <button
            onClick={() => onAddToCart(product)}
            disabled={isOutOfStock || isAdding}
            className="btn-terra text-xs px-3 py-2 disabled:opacity-50">
            {isAdding ? (
              <span className="inline-block w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
            ) : (
              <><ShoppingCart size={13} /> Add</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

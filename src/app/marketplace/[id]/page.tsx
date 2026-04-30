'use client'

import { useEffect, useState, use } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Leaf, Star, ShoppingCart, ChevronLeft, Package, Calendar,
  MapPin, ShieldCheck, Minus, Plus, AlertCircle
} from 'lucide-react'
import type { Product, Review } from '@/types'
import { CATEGORY_LABELS, CATEGORY_EMOJIS, ORDER_STATUS_LABELS } from '@/types'

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const supabase = createClient()

  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [qty, setQty] = useState(1)
  const [adding, setAdding] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/products/${id}`)
      .then(r => r.json())
      .then(({ data, error }) => {
        if (error || !data) { router.push('/marketplace'); return }
        setProduct(data)
        setQty(data.min_order_qty ?? 1)
      })
      .finally(() => setLoading(false))
  }, [id, router])

  // Realtime stock
  useEffect(() => {
    if (!product) return
    const ch = supabase.channel(`product-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'products', filter: `id=eq.${id}` },
        payload => {
          setProduct(prev => prev ? {
            ...prev,
            stock_quantity: payload.new.stock_quantity,
            is_available: payload.new.is_available,
          } : prev)
        })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [product, id, supabase])

  const handleAddToCart = async () => {
    setError(null)
    if (!product || product.stock_quantity === 0) return
    if (qty > product.stock_quantity) {
      setError(`Only ${product.stock_quantity} ${product.unit} available`)
      return
    }

    setAdding(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push(`/auth/login?redirectTo=/marketplace/${id}`); return }

      // Check user role
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role === 'farmer') { setError('Farmers cannot buy products.'); return }

      const { error: upsertErr } = await supabase.from('cart_items').upsert(
        { consumer_id: user.id, product_id: id, quantity: qty },
        { onConflict: 'consumer_id,product_id' }
      )
      if (upsertErr) throw upsertErr

      setFeedback('Added to cart!')
      setTimeout(() => setFeedback(null), 2500)
    } catch {
      setError('Failed to add to cart. Please try again.')
    } finally {
      setAdding(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-cream py-10">
        <div className="section max-w-5xl">
          <div className="grid md:grid-cols-2 gap-10">
            <div className="skeleton aspect-square rounded-xl" />
            <div className="space-y-4">
              <div className="skeleton h-8 w-3/4" />
              <div className="skeleton h-5 w-1/2" />
              <div className="skeleton h-12 w-1/3" />
              <div className="skeleton h-32" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!product) return null

  const farmer = product.farmer as any
  const reviews = (product as any).reviews as Review[] ?? []
  const avgRating = reviews.length
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : null
  const outOfStock = product.stock_quantity === 0 || !product.is_available

  return (
    <div className="min-h-screen bg-cream py-10">
      {/* Toast */}
      {feedback && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-green-deep text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-2 toast-enter">
          <ShoppingCart size={16} /> <span className="text-sm font-medium">{feedback}</span>
        </div>
      )}

      <div className="section max-w-5xl">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm text-muted mb-8">
          <Link href="/marketplace" className="hover:text-soil flex items-center gap-1 transition-colors">
            <ChevronLeft size={14} /> Marketplace
          </Link>
          <span>/</span>
          <span className="capitalize">{CATEGORY_LABELS[product.category]}</span>
          <span>/</span>
          <span className="text-soil truncate max-w-[200px]">{product.name}</span>
        </nav>

        <div className="grid md:grid-cols-2 gap-12">
          {/* Images */}
          <div>
            <div className="relative aspect-square rounded-2xl overflow-hidden bg-cream-dark mb-3">
              {product.images[0] ? (
                <Image src={product.images[0]} alt={product.name} fill className="object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-8xl">
                  {CATEGORY_EMOJIS[product.category]}
                </div>
              )}
              {outOfStock && (
                <div className="absolute inset-0 bg-soil/50 flex items-center justify-center">
                  <span className="bg-white font-semibold px-4 py-2 rounded-full text-soil">Out of Stock</span>
                </div>
              )}
            </div>
            {product.images.length > 1 && (
              <div className="grid grid-cols-4 gap-2">
                {product.images.slice(1, 5).map((img, i) => (
                  <div key={i} className="aspect-square rounded-lg overflow-hidden bg-cream-dark">
                    <Image src={img} alt={`${product.name} ${i + 2}`} width={100} height={100} className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div>
            <div className="flex flex-wrap gap-2 mb-3">
              <span className="badge badge-terra">{CATEGORY_EMOJIS[product.category]} {CATEGORY_LABELS[product.category]}</span>
              {product.is_organic && <span className="badge badge-green"><Leaf size={10} /> Organic</span>}
            </div>

            <h1 className="font-serif text-3xl text-soil mb-2">{product.name}</h1>

            {avgRating && (
              <div className="flex items-center gap-2 mb-4">
                <div className="flex">
                  {[1,2,3,4,5].map(s => (
                    <Star key={s} size={14} className={s <= Math.round(avgRating) ? 'text-gold fill-current' : 'text-border'} />
                  ))}
                </div>
                <span className="text-sm text-muted">{avgRating.toFixed(1)} ({reviews.length} reviews)</span>
              </div>
            )}

            <div className="flex items-baseline gap-1 mb-6">
              <span className="font-serif text-4xl font-bold text-green-deep">₹{product.price_per_unit}</span>
              <span className="text-muted text-lg">/{product.unit}</span>
            </div>

            {product.description && (
              <p className="text-soil-mid text-sm leading-relaxed mb-6">{product.description}</p>
            )}

            {/* Meta */}
            <div className="grid grid-cols-2 gap-3 mb-6 text-sm">
              <div className="flex items-center gap-2 text-muted">
                <Package size={14} />
                <span>{outOfStock ? <span className="text-red-500 font-medium">Out of stock</span> : `${product.stock_quantity} ${product.unit} available`}</span>
              </div>
              {product.harvest_date && (
                <div className="flex items-center gap-2 text-muted">
                  <Calendar size={14} />
                  <span>Harvested {new Date(product.harvest_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-muted">
                <ShieldCheck size={14} />
                <span>Escrow-protected</span>
              </div>
              <div className="flex items-center gap-2 text-muted">
                <MapPin size={14} />
                <span>{farmer?.city ?? 'Bhopal'}</span>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-600 rounded-xl p-3 mb-4 text-sm">
                <AlertCircle size={15} className="flex-shrink-0 mt-0.5" /> {error}
              </div>
            )}

            {/* Quantity + Cart */}
            {!outOfStock && (
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center border border-border rounded-lg overflow-hidden">
                  <button onClick={() => setQty(q => Math.max(product.min_order_qty, q - 1))}
                    className="px-3 py-2.5 text-soil-mid hover:bg-cream-dark transition-colors">
                    <Minus size={16} />
                  </button>
                  <span className="px-4 py-2.5 font-medium text-soil min-w-[48px] text-center">{qty}</span>
                  <button onClick={() => setQty(q => Math.min(product.stock_quantity, q + 1))}
                    className="px-3 py-2.5 text-soil-mid hover:bg-cream-dark transition-colors">
                    <Plus size={16} />
                  </button>
                </div>
                <span className="text-sm text-muted">Min: {product.min_order_qty} {product.unit}</span>
              </div>
            )}

            <button onClick={handleAddToCart} disabled={outOfStock || adding}
              className="btn-terra w-full py-3.5 text-base disabled:opacity-60">
              {adding ? (
                <span className="flex items-center gap-2 justify-center">
                  <span className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                  Adding…
                </span>
              ) : outOfStock ? 'Out of Stock' : (
                <><ShoppingCart size={18} /> Add {qty} {product.unit} to Cart — ₹{(product.price_per_unit * qty).toFixed(2)}</>
              )}
            </button>

            {/* Farmer card */}
            {farmer && (
              <div className="card p-4 mt-6">
                <p className="text-xs text-muted uppercase tracking-wide mb-2">Sold by</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-deep text-white flex items-center justify-center font-medium text-sm">
                    {farmer.full_name?.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-soil text-sm">{farmer.farm_name ?? farmer.full_name}</p>
                    <p className="text-xs text-muted">{farmer.city} {farmer.is_verified && '· ✓ Verified'}</p>
                  </div>
                </div>
                {farmer.bio && <p className="text-xs text-muted mt-3 leading-relaxed">{farmer.bio}</p>}
              </div>
            )}
          </div>
        </div>

        {/* Reviews */}
        {reviews.length > 0 && (
          <section className="mt-16">
            <h2 className="font-serif text-2xl text-soil mb-6">Customer Reviews</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              {reviews.map((review: any) => (
                <div key={review.id} className="card p-5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-green-deep/20 text-green-deep flex items-center justify-center text-xs font-medium">
                        {review.consumer?.full_name?.charAt(0)}
                      </div>
                      <span className="text-sm font-medium text-soil">{review.consumer?.full_name}</span>
                    </div>
                    <div className="flex">
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} size={12} className={s <= review.rating ? 'text-gold fill-current' : 'text-border'} />
                      ))}
                    </div>
                  </div>
                  {review.comment && <p className="text-sm text-muted leading-relaxed">{review.comment}</p>}
                  <p className="text-xs text-muted mt-2">{new Date(review.created_at).toLocaleDateString('en-IN')}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import {
  Plus, Package, ShoppingBag, TrendingUp, Star, Edit2, ToggleLeft, ToggleRight, Leaf
} from 'lucide-react'
import type { Product, OrderItem } from '@/types'
import { CATEGORY_EMOJIS, ORDER_STATUS_LABELS } from '@/types'

export const revalidate = 0 // always fresh for dashboard

export default async function FarmerDashboard() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'farmer') redirect('/marketplace')

  // Fetch products
  const { data: products } = await supabase
    .from('products')
    .select('*, reviews(rating)')
    .eq('farmer_id', user.id)
    .order('created_at', { ascending: false })

  // Fetch recent order items for this farmer
  const { data: recentOrderItems } = await supabase
    .from('order_items')
    .select(`
      *,
      product:products(name, images, unit),
      order:orders(id, status, created_at, consumer:profiles!consumer_id(full_name))
    `)
    .eq('farmer_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  // Compute stats
  const totalProducts = products?.length ?? 0
  const activeProducts = products?.filter(p => p.is_available && p.stock_quantity > 0).length ?? 0
  const totalRevenue = (recentOrderItems ?? []).reduce((sum, item) => sum + (item.subtotal ?? 0), 0)
  const totalOrders = new Set((recentOrderItems ?? []).map(i => i.order_id)).size

  const allReviews = (products ?? []).flatMap((p: any) => p.reviews ?? [])
  const avgRating = allReviews.length
    ? (allReviews.reduce((s: number, r: any) => s + r.rating, 0) / allReviews.length).toFixed(1)
    : '—'

  return (
    <div className="min-h-screen bg-cream-dark">
      {/* ── Top Bar ─────────────────────────────────────────── */}
      <div className="bg-green-deep text-white py-8">
        <div className="section flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-white/60 text-sm mb-1">Welcome back,</p>
            <h1 className="font-serif text-3xl">
              {profile?.farm_name ?? profile?.full_name}
            </h1>
            <p className="text-white/60 text-sm mt-1">{profile?.city}, {profile?.state}</p>
          </div>
          <Link href="/dashboard/products/new" className="btn-terra flex items-center gap-2">
            <Plus size={16} /> Add New Product
          </Link>
        </div>
      </div>

      <div className="section py-8">
        {/* ── Stats Row ──────────────────────────────────────── */}
        <div className="stagger grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { icon: Package,    label: 'Total Products',   value: totalProducts,         sub: `${activeProducts} active` },
            { icon: ShoppingBag, label: 'Recent Orders',   value: totalOrders,            sub: 'last 10 items' },
            { icon: TrendingUp, label: 'Revenue Earned',   value: `₹${totalRevenue.toLocaleString()}`, sub: 'from recent orders' },
            { icon: Star,       label: 'Average Rating',   value: avgRating,              sub: `from ${allReviews.length} reviews` },
          ].map(({ icon: Icon, label, value, sub }) => (
            <div key={label} className="card p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 rounded-lg bg-green-light flex items-center justify-center">
                  <Icon size={18} className="text-green-deep" />
                </div>
              </div>
              <div className="font-serif text-2xl text-soil font-bold">{value}</div>
              <div className="text-xs text-muted mt-1">{label}</div>
              <div className="text-xs text-muted opacity-70">{sub}</div>
            </div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* ── My Products ──────────────────────────────────── */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-2xl text-soil">My Products</h2>
              <Link href="/dashboard/products/new" className="btn-secondary text-xs">
                <Plus size={13} /> Add Product
              </Link>
            </div>

            {(!products || products.length === 0) ? (
              <div className="card p-12 text-center">
                <div className="text-5xl mb-4">🌱</div>
                <h3 className="font-serif text-xl text-soil mb-2">No products yet</h3>
                <p className="text-muted text-sm mb-6">Start by listing your first product to reach consumers.</p>
                <Link href="/dashboard/products/new" className="btn-primary">
                  <Plus size={15} /> Add Your First Product
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {products.map((product: any) => (
                  <DashboardProductRow key={product.id} product={product} />
                ))}
              </div>
            )}
          </div>

          {/* ── Recent Orders ─────────────────────────────────── */}
          <div>
            <h2 className="font-serif text-2xl text-soil mb-4">Recent Orders</h2>

            {(!recentOrderItems || recentOrderItems.length === 0) ? (
              <div className="card p-8 text-center">
                <ShoppingBag size={32} className="mx-auto text-muted mb-3" />
                <p className="text-muted text-sm">No orders yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentOrderItems.map((item: any) => (
                  <div key={item.id} className="card p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-cream-dark flex items-center justify-center text-xl flex-shrink-0 overflow-hidden">
                        {item.product?.images?.[0]
                          ? <Image src={item.product.images[0]} alt="" width={40} height={40} className="w-full h-full object-cover" />
                          : <span>📦</span>
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-soil truncate">{item.product?.name}</p>
                        <p className="text-xs text-muted">
                          {item.quantity} {item.product?.unit} · ₹{item.subtotal}
                        </p>
                        <p className="text-xs text-muted mt-0.5">
                          by {item.order?.consumer?.full_name ?? 'Consumer'}
                        </p>
                      </div>
                      <span className={`badge text-xs mt-0.5 ${statusBadgeClass(item.order?.status)}`}>
                        {ORDER_STATUS_LABELS[item.order?.status as keyof typeof ORDER_STATUS_LABELS] ?? item.order?.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function DashboardProductRow({ product }: { product: any }) {
  const reviews: Array<{ rating: number }> = product.reviews ?? []
  const avgRating = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null

  return (
    <div className="card p-4 flex items-center gap-4">
      {/* Image */}
      <div className="w-14 h-14 rounded-lg bg-cream-dark flex-shrink-0 overflow-hidden flex items-center justify-center text-2xl">
        {product.images?.[0]
          ? <Image src={product.images[0]} alt={product.name} width={56} height={56} className="w-full h-full object-cover" />
          : <span>{CATEGORY_EMOJIS[product.category as keyof typeof CATEGORY_EMOJIS]}</span>
        }
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium text-soil truncate">{product.name}</p>
          {product.is_organic && (
            <span className="badge badge-green text-xs"><Leaf size={9} /> Organic</span>
          )}
        </div>
        <p className="text-sm text-green-deep font-semibold">
          ₹{product.price_per_unit}/{product.unit}
        </p>
        <div className="flex items-center gap-3 mt-1">
          <span className={`text-xs ${product.stock_quantity === 0 ? 'text-red-500 font-medium' : product.stock_quantity <= 5 ? 'text-amber-600' : 'text-muted'}`}>
            {product.stock_quantity} in stock
          </span>
          {avgRating && (
            <span className="flex items-center gap-0.5 text-xs text-gold">
              <Star size={10} fill="currentColor" /> {avgRating}
            </span>
          )}
          <span className={`text-xs ${product.is_available ? 'text-green-mid' : 'text-muted'}`}>
            {product.is_available ? '● Active' : '○ Hidden'}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <Link
          href={`/dashboard/products/${product.id}/edit`}
          className="p-2 rounded-lg text-muted hover:text-soil hover:bg-cream-dark transition-colors"
          title="Edit">
          <Edit2 size={15} />
        </Link>
      </div>
    </div>
  )
}

function statusBadgeClass(status: string) {
  const map: Record<string, string> = {
    pending_payment: 'status-pending',
    paid: 'status-paid',
    processing: 'status-processing',
    shipped: 'status-shipped',
    delivered: 'status-delivered',
    completed: 'status-completed',
    cancelled: 'status-cancelled',
  }
  return map[status] ?? 'bg-gray-100 text-gray-600'
}

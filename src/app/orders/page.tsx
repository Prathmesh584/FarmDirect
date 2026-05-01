'use client'

import { useState, useEffect, Suspense } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Package, CheckCircle, Clock, Truck, ShieldCheck, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react'
import type { Order } from '@/types'
import { ORDER_STATUS_LABELS, CATEGORY_EMOJIS } from '@/types'

function statusColor(status: string) {
  const map: Record<string, string> = {
    pending_payment: 'status-pending',
    paid: 'status-paid',
    processing: 'status-processing',
    shipped: 'status-shipped',
    delivered: 'status-delivered',
    confirmed_delivery: 'status-delivered',
    completed: 'status-completed',
    cancelled: 'status-cancelled',
  }
  return map[status] ?? 'bg-gray-100 text-gray-600'
}

function statusIcon(status: string) {
  if (['completed', 'confirmed_delivery', 'delivered'].includes(status)) return <CheckCircle size={14} />
  if (['shipped'].includes(status)) return <Truck size={14} />
  if (['cancelled'].includes(status)) return <AlertCircle size={14} />
  return <Clock size={14} />
}

function OrdersContent() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const searchParams = useSearchParams()
  const successId = searchParams.get('success')
  const router = useRouter()
  const supabase = createClient() as any

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login?redirectTo=/orders'); return }

      const res = await fetch('/api/orders')
      const json = await res.json()
      setOrders(json.data ?? [])
      setLoading(false)

      // Auto-expand the new order
      if (successId) setExpanded(successId)
    }
    load()
  }, [supabase, router, successId])

  async function confirmDelivery(orderId: string) {
    setConfirming(orderId)
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'confirm_delivery' }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'completed' } : o))
    } catch (err: any) {
      alert(err.message)
    } finally {
      setConfirming(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1,2,3].map(i => <div key={i} className="skeleton h-28 rounded-xl" />)}
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="card p-16 text-center">
        <Package size={52} className="mx-auto text-muted mb-5" />
        <h2 className="font-serif text-2xl text-soil mb-3">No orders yet</h2>
        <p className="text-muted text-sm mb-8">Your order history will appear here.</p>
        <Link href="/marketplace" className="btn-primary px-8">Start Shopping</Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {successId && (
        <div className="flex items-center gap-3 bg-green-light border border-green-mid/30 text-green-deep rounded-xl p-4 animate-fade-in">
          <CheckCircle size={18} />
          <div>
            <p className="font-medium text-sm">Order placed successfully!</p>
            <p className="text-xs opacity-80">Your payment is held in escrow. Confirm delivery once you receive your items.</p>
          </div>
        </div>
      )}

      {orders.map(order => {
        const isOpen = expanded === order.id
        const items = order.items ?? []
        const canConfirm = ['delivered', 'shipped'].includes(order.status)

        return (
          <div key={order.id} className="card overflow-hidden">
            {/* Order header */}
            <button onClick={() => setExpanded(isOpen ? null : order.id)}
              className="w-full flex items-center gap-4 p-5 text-left hover:bg-cream/50 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <p className="font-medium text-soil text-sm">
                    Order #{order.id.slice(0, 8).toUpperCase()}
                  </p>
                  <span className={`badge text-xs flex items-center gap-1 ${statusColor(order.status)}`}>
                    {statusIcon(order.status)}
                    {ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS]}
                  </span>
                </div>
                <p className="text-xs text-muted mt-1">
                  Placed {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="font-semibold text-green-deep">₹{order.total_amount.toFixed(2)}</p>
                <p className="text-xs text-muted">{items.length} item{items.length > 1 ? 's' : ''}</p>
              </div>
              <div className="text-muted flex-shrink-0">
                {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </div>
            </button>

            {/* Expanded details */}
            {isOpen && (
              <div className="border-t border-border p-5 animate-fade-in">
                {/* Escrow banner */}
                {['paid', 'processing', 'shipped', 'delivered'].includes(order.status) && (
                  <div className="flex items-start gap-2 bg-green-light border border-green-mid/20 rounded-xl p-3 mb-5 text-xs text-green-deep">
                    <ShieldCheck size={14} className="flex-shrink-0 mt-0.5" />
                    <span>
                      <strong>Escrow active</strong> — Your payment of ₹{order.total_amount.toFixed(2)} is safely held.
                      It will be released to the farmer only after you confirm delivery.
                    </span>
                  </div>
                )}

                {/* Items */}
                <div className="space-y-3 mb-5">
                  {items.map((item: any) => (
                    <div key={item.id} className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-cream-dark flex-shrink-0 flex items-center justify-center text-xl">
                        {item.product?.images?.[0]
                          ? <Image src={item.product.images[0]} alt="" width={48} height={48} className="w-full h-full object-cover" />
                          : <span>{CATEGORY_EMOJIS[item.product?.category as keyof typeof CATEGORY_EMOJIS ]}</span>
                        }
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-soil">{item.product?.name}</p>
                        <p className="text-xs text-muted">by {item.farmer?.farm_name ?? item.farmer?.full_name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-soil">{item.quantity} {item.product?.unit}</p>
                        <p className="text-xs text-green-deep font-medium">₹{item.subtotal}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Delivery address */}
                <div className="text-xs text-muted bg-cream rounded-lg p-3 mb-4">
                  <span className="font-medium text-soil-mid">Delivery: </span>
                  {order.delivery_address}, {order.delivery_city}
                  {order.delivery_pincode && ` — ${order.delivery_pincode}`}
                </div>

                {/* Confirm delivery button */}
                {canConfirm && (
                  <button onClick={() => confirmDelivery(order.id)}
                    disabled={confirming === order.id}
                    className="btn-primary w-full py-3">
                    {confirming === order.id ? (
                      <span className="flex items-center gap-2 justify-center">
                        <span className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                        Confirming…
                      </span>
                    ) : (
                      <><CheckCircle size={16} /> Confirm Delivery & Release Payment</>
                    )}
                  </button>
                )}

                {order.status === 'completed' && order.delivered_at && (
                  <div className="flex items-center gap-2 text-green-deep text-sm">
                    <CheckCircle size={15} />
                    <span>Delivered on {new Date(order.delivered_at).toLocaleDateString('en-IN')}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function OrdersPage() {
  return (
    <div className="min-h-screen bg-cream-dark py-10">
      <div className="section max-w-3xl">
        <h1 className="font-serif text-3xl text-soil mb-8">My Orders</h1>
        <Suspense fallback={<div className="space-y-4">{[1,2,3].map(i => <div key={i} className="skeleton h-28 rounded-xl" />)}</div>}>
          <OrdersContent />
        </Suspense>
      </div>
    </div>
  )
}

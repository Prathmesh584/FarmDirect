'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ShoppingCart, Trash2, Plus, Minus, ArrowRight, ShieldCheck, AlertCircle, MapPin } from 'lucide-react'
import type { CartItem } from '@/types'
import { CATEGORY_EMOJIS } from '@/types'

export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({ address: '', city: 'Bhopal', pincode: '', notes: '' })
  const router = useRouter()
  const supabase = createClient() as any

  useEffect(() => {
    loadCart()
  }, [])

  async function loadCart() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/auth/login?redirectTo=/cart'); return }

    const { data } = await supabase
      .from('cart_items')
      .select('*, product:products(id, name, images, price_per_unit, unit, stock_quantity, is_available, category, farmer_id)')
      .eq('consumer_id', user.id)
      .order('created_at', { ascending: true })

    setItems((data ?? []) as unknown as CartItem[])
    setLoading(false)
  }

  async function updateQty(itemId: string, newQty: number, maxStock: number) {
    if (newQty < 1 || newQty > maxStock) return
    await supabase.from('cart_items').update({ quantity: newQty }).eq('id', itemId)
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, quantity: newQty } : i))
  }

  async function removeItem(itemId: string) {
    await supabase.from('cart_items').delete().eq('id', itemId)
    setItems(prev => prev.filter(i => i.id !== itemId))
  }

  async function placeOrder() {
    setError(null)
    if (items.length === 0) { setError('Your cart is empty.'); return }
    if (!form.address.trim()) { setError('Delivery address is required.'); return }

    setPlacing(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          delivery_address: form.address,
          delivery_city: form.city,
          delivery_pincode: form.pincode,
          notes: form.notes,
        }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)

      router.push(`/orders?success=${json.data.id}`)
    } catch (err: any) {
      setError(err.message ?? 'Failed to place order. Please try again.')
    } finally {
      setPlacing(false)
    }
  }

  const total = items.reduce((sum, item) => {
    const p = item.product as any
    return sum + (p?.price_per_unit ?? 0) * item.quantity
  }, 0)

  const hasStockIssue = items.some(item => {
    const p = item.product as any
    return !p?.is_available || p?.stock_quantity < item.quantity
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-cream-dark py-10">
        <div className="section max-w-4xl">
          <div className="skeleton h-8 w-40 mb-8" />
          <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-4">
              {[1,2,3].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}
            </div>
            <div className="skeleton h-64 rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream-dark py-10">
      <div className="section max-w-4xl">
        <div className="flex items-center gap-3 mb-8">
          <ShoppingCart size={24} className="text-green-deep" />
          <h1 className="font-serif text-3xl text-soil">Your Cart</h1>
          {items.length > 0 && (
            <span className="badge badge-green">{items.length} item{items.length > 1 ? 's' : ''}</span>
          )}
        </div>

        {items.length === 0 ? (
          <div className="card p-16 text-center">
            <ShoppingCart size={52} className="mx-auto text-muted mb-5" />
            <h2 className="font-serif text-2xl text-soil mb-3">Your cart is empty</h2>
            <p className="text-muted text-sm mb-8">Browse fresh produce from local Bhopal farmers.</p>
            <Link href="/marketplace" className="btn-primary px-8">
              Browse Marketplace <ArrowRight size={16} />
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-8">
            {/* Items */}
            <div className="md:col-span-2 space-y-3">
              {items.map(item => {
                const p = item.product as any
                const isUnavailable = !p?.is_available || p?.stock_quantity < item.quantity
                return (
                  <div key={item.id} className={`card p-4 flex gap-4 ${isUnavailable ? 'border-red-200 bg-red-50' : ''}`}>
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-cream-dark flex-shrink-0 flex items-center justify-center text-2xl">
                      {p?.images?.[0]
                        ? <Image src={p.images[0]} alt={p.name} width={64} height={64} className="w-full h-full object-cover" />
                        : <span>{CATEGORY_EMOJIS[p?.category as keyof typeof CATEGORY_EMOJIS]}</span>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link href={`/marketplace/${p?.id}`} className="font-medium text-soil hover:text-green-deep transition-colors truncate block">
                        {p?.name}
                      </Link>
                      <p className="text-sm text-green-deep font-semibold mt-0.5">₹{p?.price_per_unit}/{p?.unit}</p>
                      {isUnavailable && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                          <AlertCircle size={11} /> {!p?.is_available ? 'No longer available' : `Only ${p?.stock_quantity} in stock`}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        <div className="flex items-center border border-border rounded-lg">
                          <button onClick={() => updateQty(item.id, item.quantity - 1, p?.stock_quantity ?? 0)}
                            className="px-2 py-1 text-muted hover:text-soil transition-colors"><Minus size={13} /></button>
                          <span className="px-3 py-1 text-sm font-medium text-soil">{item.quantity}</span>
                          <button onClick={() => updateQty(item.id, item.quantity + 1, p?.stock_quantity ?? 0)}
                            className="px-2 py-1 text-muted hover:text-soil transition-colors"><Plus size={13} /></button>
                        </div>
                        <span className="text-sm font-semibold text-soil">
                          ₹{(p?.price_per_unit * item.quantity).toFixed(2)}
                        </span>
                        <button onClick={() => removeItem(item.id)} className="ml-auto text-muted hover:text-red-500 transition-colors p-1">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Summary + Checkout */}
            <div className="space-y-4">
              <div className="card p-5">
                <h2 className="font-medium text-soil mb-4">Order Summary</h2>
                <div className="space-y-2 text-sm mb-4">
                  <div className="flex justify-between text-muted">
                    <span>Subtotal ({items.length} items)</span>
                    <span>₹{total.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-muted">
                    <span>Delivery</span>
                    <span className="text-green-mid">Free</span>
                  </div>
                  <div className="border-t border-border pt-3 flex justify-between font-semibold text-soil text-base">
                    <span>Total</span>
                    <span className="text-green-deep">₹{total.toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex items-start gap-2 bg-green-light rounded-lg p-3 text-xs text-green-deep mb-4">
                  <ShieldCheck size={13} className="flex-shrink-0 mt-0.5" />
                  <span>Payment held in escrow until you confirm delivery</span>
                </div>
              </div>

              {/* Delivery form */}
              <div className="card p-5">
                <h2 className="font-medium text-soil mb-4 flex items-center gap-2"><MapPin size={15} /> Delivery Details</h2>
                <div className="space-y-3">
                  <textarea
                    value={form.address}
                    onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                    placeholder="House/flat no., street, locality…"
                    rows={3}
                    className="input resize-none text-sm"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                      placeholder="City" className="input text-sm" />
                    <input value={form.pincode} onChange={e => setForm(f => ({ ...f, pincode: e.target.value }))}
                      placeholder="Pincode" className="input text-sm" maxLength={6} />
                  </div>
                  <textarea
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Delivery notes (optional)"
                    rows={2}
                    className="input resize-none text-sm"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-600 rounded-xl p-3 text-sm">
                  <AlertCircle size={15} className="flex-shrink-0 mt-0.5" /> {error}
                </div>
              )}

              <button onClick={placeOrder}
                disabled={placing || hasStockIssue || items.length === 0}
                className="btn-primary w-full py-3.5 text-base disabled:opacity-60">
                {placing ? (
                  <span className="flex items-center gap-2 justify-center">
                    <span className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                    Placing order…
                  </span>
                ) : (
                  <>Place Order — ₹{total.toFixed(2)} <ArrowRight size={16} /></>
                )}
              </button>
              {hasStockIssue && (
                <p className="text-xs text-red-500 text-center">Remove or update unavailable items first</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

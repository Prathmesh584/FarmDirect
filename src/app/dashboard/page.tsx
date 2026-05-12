'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import type { Profile, Product, ProductCategory } from '@/types'
import { CATEGORY_LABELS, UNITS } from '@/types'

// ── Icons (inline SVG to avoid import issues) ─────────────────
const Icon = {
  plus:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="M12 5v14M5 12h14"/></svg>,
  image:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>,
  x:        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path d="M18 6 6 18M6 6l12 12"/></svg>,
  leaf:     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>,
  check:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6"><path d="M20 6 9 17l-5-5"/></svg>,
  package:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="m7.5 4.27 9 5.15M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/></svg>,
  orders:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>,
  rupee:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="M6 3h12M6 8h12M15 21 6 13h3a6 6 0 0 0 0-12"/></svg>,
  eye:      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>,
  trash:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  alert:    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  gallery:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>,
  camera:   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>,
}

const CATEGORIES = Object.entries(CATEGORY_LABELS) as [ProductCategory, string][]

const PRICE_HINTS: Partial<Record<ProductCategory, string>> = {
  vegetables: '₹20–₹80 / kg',
  fruits:     '₹40–₹200 / kg',
  grains:     '₹30–₹100 / kg',
  dairy:      '₹50–₹120 / litre',
  spices:     '₹100–₹500 / kg',
  pulses:     '₹60–₹150 / kg',
}

type Tab = 'products' | 'add' | 'orders'

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient() as any
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [profile, setProfile]   = useState<Profile | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState<Tab>('products')

  // ── Form state ────────────────────────────────────────────────
  const [form, setForm] = useState({
    name: '', description: '', category: 'vegetables' as ProductCategory,
    price_per_unit: '', unit: 'kg', stock_quantity: '', min_order_qty: '1',
    is_organic: false, harvest_date: '', tags: '',
  })
  const [imageFiles, setImageFiles]       = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [submitting, setSubmitting]       = useState(false)
  const [uploading, setUploading]         = useState(false)
  const [formError, setFormError]         = useState<string | null>(null)
  const [formSuccess, setFormSuccess]     = useState(false)
  const [dragOver, setDragOver]           = useState(false)

  const [orders, setOrders]           = useState<any[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null)
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)

  const set = (field: string, value: unknown) => setForm(f => ({ ...f, [field]: value }))

  // ── Load profile + products ───────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: profileData } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()

      if (!profileData || profileData.role !== 'farmer') {
        router.push('/marketplace'); return
      }

      setProfile(profileData as Profile)

      const { data: productsData } = await supabase
        .from('products').select('*').eq('farmer_id', user.id).order('created_at', { ascending: false })

      setProducts((productsData ?? []) as Product[])
      setLoading(false)
    }
    load()
  }, [])

  // ── Load farmer orders ───────────────────────────────────────
  const loadOrders = async () => {
    setOrdersLoading(true)
    const res = await fetch('/api/orders')
    const json = await res.json()
    setOrders(json.data ?? [])
    setOrdersLoading(false)
  }

  useEffect(() => {
    if (tab === 'orders') loadOrders()
  }, [tab])

  // ── Image handling ────────────────────────────────────────────
  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return
    const newFiles: File[] = []
    const newPreviews: string[] = []
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return
      if (file.size > 5 * 1024 * 1024) { setFormError(`${file.name} exceeds 5 MB`); return }
      newFiles.push(file)
      newPreviews.push(URL.createObjectURL(file))
    })
    setImageFiles(prev => [...prev, ...newFiles].slice(0, 4))
    setImagePreviews(prev => [...prev, ...newPreviews].slice(0, 4))
    setFormError(null)
  }, [])

  const removeImage = (idx: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== idx))
    setImagePreviews(prev => { URL.revokeObjectURL(prev[idx]); return prev.filter((_, i) => i !== idx) })
  }

  // ── Submit ────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!form.name.trim()) return setFormError('Product name is required')
    if (!form.price_per_unit || Number(form.price_per_unit) <= 0) return setFormError('Valid price is required')
    if (!form.stock_quantity) return setFormError('Stock quantity is required')

    setSubmitting(true)
    try {
      const uploadedUrls: string[] = []
      if (imageFiles.length > 0) {
        setUploading(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')
        for (const file of imageFiles) {
          const ext = file.name.split('.').pop()
          const path = `products/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
          const { data, error: uploadErr } = await supabase.storage
            .from('product-images').upload(path, file, { cacheControl: '3600', upsert: false })
          if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`)
          const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(data.path)
          uploadedUrls.push(urlData.publicUrl)
        }
        setUploading(false)
      }

      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          price_per_unit: Number(form.price_per_unit),
          stock_quantity: Number(form.stock_quantity),
          min_order_qty:  Number(form.min_order_qty),
          images: uploadedUrls,
          tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
          harvest_date: form.harvest_date || null,
        }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)

      setFormSuccess(true)
      setForm({ name: '', description: '', category: 'vegetables', price_per_unit: '', unit: 'kg', stock_quantity: '', min_order_qty: '1', is_organic: false, harvest_date: '', tags: '' })
      setImageFiles([]); setImagePreviews([])

      // Refresh products list
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase.from('products').select('*').eq('farmer_id', user.id).order('created_at', { ascending: false })
        setProducts((data ?? []) as Product[])
      }
      setTimeout(() => { setFormSuccess(false); setTab('products') }, 2000)
    } catch (err: any) {
      setFormError(err.message ?? 'Failed to create product')
      setUploading(false)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Delete product ────────────────────────────────────────────
  const deleteProduct = async (id: string) => {
    if (!confirm('Delete this product?')) return
    await supabase.from('products').delete().eq('id', id)
    setProducts(prev => prev.filter(p => p.id !== id))
  }

  // ── Update order status ──────────────────────────────────────
  const updateOrderStatus = async (orderId: string, action: string, status?: string) => {
    setUpdatingOrder(orderId)
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, status }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      await loadOrders()
    } catch (err: any) {
      alert(err.message ?? 'Failed to update order')
    } finally {
      setUpdatingOrder(null)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f7f3ee]">
      <div className="text-[#6b7c5c] text-sm animate-pulse">Loading your farm dashboard…</div>
    </div>
  )

  const totalRevenue = products.reduce((sum, p) => sum + (p.price_per_unit * p.stock_quantity), 0)
  const activeProducts = products.filter(p => p.is_available).length

  return (
    <div className="min-h-screen bg-[#f7f3ee] font-sans">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,600;1,9..144,400&family=DM+Sans:wght@300;400;500&display=swap');
        .font-display { font-family: 'Fraunces', serif; }
        .font-body { font-family: 'DM Sans', sans-serif; }
        .card { background: white; border-radius: 16px; border: 1px solid #e8e0d5; }
        .tab-active { background: #2d4a1e; color: white; }
        .tab-inactive { background: transparent; color: #6b7c5c; }
        .input-field { width: 100%; padding: 10px 14px; border: 1.5px solid #e0d8ce; border-radius: 10px; background: #faf8f5; font-family: 'DM Sans', sans-serif; font-size: 14px; color: #2c3320; outline: none; transition: border-color 0.2s; }
        .input-field:focus { border-color: #5a7a3a; background: white; }
        .input-field::placeholder { color: #aaa49a; }
        .btn-primary { background: #2d4a1e; color: white; border: none; border-radius: 12px; padding: 12px 24px; font-family: 'DM Sans', sans-serif; font-weight: 500; cursor: pointer; transition: background 0.2s; width: 100%; font-size: 15px; }
        .btn-primary:hover:not(:disabled) { background: #3d6228; }
        .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
        .badge-organic { background: #e8f5e0; color: #3d6228; border-radius: 20px; padding: 2px 10px; font-size: 11px; font-weight: 500; }
        select.input-field { appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7c5c' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; padding-right: 36px; }
      `}</style>

      {/* ── Header ──────────────────────────────────────────── */}
      <div style={{ background: 'linear-gradient(135deg, #2d4a1e 0%, #3d6228 100%)' }} className="text-white px-6 pt-8 pb-6">
        <div className="max-w-3xl mx-auto">
          <p className="text-green-300 text-xs font-body uppercase tracking-widest mb-1">Farm Dashboard</p>
          <h1 className="font-display text-3xl font-light">
            {profile?.farm_name ?? profile?.full_name ?? 'Your Farm'}
          </h1>
          <p className="text-green-200 text-sm font-body mt-1">{profile?.city}, {profile?.state}</p>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 mt-6">
            {[
              { label: 'Products', value: products.length, icon: Icon.package },
              { label: 'Active', value: activeProducts, icon: Icon.eye },
              { label: 'Est. Value', value: `₹${totalRevenue.toLocaleString('en-IN')}`, icon: Icon.rupee },
            ].map(stat => (
              <div key={stat.label} className="bg-white/10 rounded-14 p-3 rounded-xl">
                <div className="text-green-200 mb-1">{stat.icon}</div>
                <div className="font-display text-xl font-semibold">{stat.value}</div>
                <div className="text-green-300 text-xs font-body">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────── */}
      <div className="max-w-3xl mx-auto px-4 -mt-1">
        <div className="flex gap-2 bg-white border border-[#e8e0d5] rounded-2xl p-1.5 shadow-sm">
          {([
            { id: 'products', label: 'My Products', icon: Icon.package },
            { id: 'add',      label: 'Add Product', icon: Icon.plus },
            { id: 'orders',   label: 'Orders',      icon: Icon.orders },
          ] as { id: Tab; label: string; icon: React.ReactNode }[]).map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-body font-medium transition-all ${tab === t.id ? 'tab-active' : 'tab-inactive hover:bg-[#f5f0ea]'}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ── Products Tab ─────────────────────────────────── */}
        {tab === 'products' && (
          <div className="mt-4 pb-8 space-y-3">
            {products.length === 0 ? (
              <div className="card p-12 text-center">
                <div className="text-5xl mb-4">🌱</div>
                <h3 className="font-display text-xl text-[#2c3320] mb-2">No products yet</h3>
                <p className="text-[#8a9070] text-sm font-body mb-4">Start listing your farm produce to reach consumers</p>
                <button onClick={() => setTab('add')}
                  className="inline-flex items-center gap-2 bg-[#2d4a1e] text-white px-5 py-2.5 rounded-xl text-sm font-body font-medium">
                  {Icon.plus} Add your first product
                </button>
              </div>
            ) : (
              products.map(product => (
                <div key={product.id} className="card p-4 flex gap-4 items-start">
                  {/* Image */}
                  <div className="w-20 h-20 rounded-12 overflow-hidden flex-shrink-0 bg-[#f0ebe3] rounded-xl relative">
                    {product.images?.[0] ? (
                      <Image src={product.images[0]} alt={product.name} fill className="object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl">🌿</div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-body font-medium text-[#2c3320] text-sm leading-tight">{product.name}</h3>
                      <div className="flex gap-1 flex-shrink-0">
                        <button onClick={() => deleteProduct(product.id)}
                          className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors">
                          {Icon.trash}
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-[#5a7a3a] font-body font-semibold text-sm">₹{product.price_per_unit}/{product.unit}</span>
                      <span className="text-[#aaa] text-xs">•</span>
                      <span className="text-[#8a9070] text-xs font-body">Stock: {product.stock_quantity}</span>
                      {product.is_organic && <span className="badge-organic">{Icon.leaf} Organic</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-body ${product.is_available ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {product.is_available ? 'Active' : 'Hidden'}
                      </span>
                      <span className="text-[#c8bfb0] text-xs font-body capitalize">{product.category}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── Add Product Tab ──────────────────────────────── */}
        {tab === 'add' && (
          <div className="mt-4 pb-8">
            {formSuccess ? (
              <div className="card p-12 text-center">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4 text-green-600">
                  {Icon.check}
                </div>
                <h3 className="font-display text-2xl text-[#2c3320] mb-2">Product Listed!</h3>
                <p className="text-[#8a9070] text-sm font-body">Your product is now live on the marketplace</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {formError && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 rounded-xl p-3.5 text-sm font-body">
                    {Icon.alert} {formError}
                  </div>
                )}

                {/* Basic Info */}
                <div className="card p-5 space-y-4">
                  <h2 className="font-display text-lg text-[#2c3320]">Product Details</h2>

                  <div>
                    <label className="block text-xs font-body font-medium text-[#6b7c5c] mb-1.5 uppercase tracking-wide">Product Name *</label>
                    <input className="input-field" value={form.name} onChange={e => set('name', e.target.value)}
                      placeholder="e.g. Fresh Tomatoes, Desi Ghee, Basmati Rice" required />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-body font-medium text-[#6b7c5c] mb-1.5 uppercase tracking-wide">Category *</label>
                      <select className="input-field" value={form.category} onChange={e => set('category', e.target.value as ProductCategory)}>
                        {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-body font-medium text-[#6b7c5c] mb-1.5 uppercase tracking-wide">Unit *</label>
                      <select className="input-field" value={form.unit} onChange={e => set('unit', e.target.value)}>
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-body font-medium text-[#6b7c5c] mb-1.5 uppercase tracking-wide">Description</label>
                    <textarea className="input-field" value={form.description} onChange={e => set('description', e.target.value)}
                      placeholder="How is it grown? What makes it special? Freshness, taste, method…"
                      rows={3} style={{ resize: 'none' }} />
                  </div>

                  <div>
                    <label className="block text-xs font-body font-medium text-[#6b7c5c] mb-1.5 uppercase tracking-wide">Tags</label>
                    <input className="input-field" value={form.tags} onChange={e => set('tags', e.target.value)}
                      placeholder="seasonal, pesticide-free, local, organic (comma separated)" />
                  </div>
                </div>

                {/* Pricing */}
                <div className="card p-5 space-y-4">
                  <h2 className="font-display text-lg text-[#2c3320]">Pricing & Stock</h2>

                  {PRICE_HINTS[form.category] && (
                    <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700 font-body">
                      💡 Market reference: {PRICE_HINTS[form.category]}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-body font-medium text-[#6b7c5c] mb-1.5 uppercase tracking-wide">Price (₹) *</label>
                      <input className="input-field" type="number" value={form.price_per_unit}
                        onChange={e => set('price_per_unit', e.target.value)}
                        placeholder="0.00" min="0.01" step="0.01" required />
                    </div>
                    <div>
                      <label className="block text-xs font-body font-medium text-[#6b7c5c] mb-1.5 uppercase tracking-wide">Stock Qty *</label>
                      <input className="input-field" type="number" value={form.stock_quantity}
                        onChange={e => set('stock_quantity', e.target.value)}
                        placeholder="0" min="0" required />
                    </div>
                    <div>
                      <label className="block text-xs font-body font-medium text-[#6b7c5c] mb-1.5 uppercase tracking-wide">Min Order</label>
                      <input className="input-field" type="number" value={form.min_order_qty}
                        onChange={e => set('min_order_qty', e.target.value)}
                        placeholder="1" min="1" />
                    </div>
                    <div>
                      <label className="block text-xs font-body font-medium text-[#6b7c5c] mb-1.5 uppercase tracking-wide">Harvest Date</label>
                      <input className="input-field" type="date" value={form.harvest_date}
                        onChange={e => set('harvest_date', e.target.value)} />
                    </div>
                  </div>

                  {/* Organic toggle */}
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <div onClick={() => set('is_organic', !form.is_organic)}
                      className={`relative w-11 h-6 rounded-full transition-colors ${form.is_organic ? 'bg-[#5a7a3a]' : 'bg-[#d8d0c7]'}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.is_organic ? 'translate-x-6' : 'translate-x-1'}`} />
                    </div>
                    <span className="text-sm font-body text-[#4a5a35]">{Icon.leaf} Certified organic product</span>
                  </label>
                </div>

                {/* Image Upload */}
                <div className="card p-5 space-y-4">
                  <div>
                    <h2 className="font-display text-lg text-[#2c3320]">Product Photos</h2>
                    <p className="text-xs text-[#8a9070] font-body mt-0.5">Upload up to 4 photos • JPG, PNG, WebP • Max 5 MB each</p>
                  </div>

                  {/* Upload buttons — camera + gallery */}
                  <div className="grid grid-cols-2 gap-3">
                    <button type="button"
                      onClick={() => { if (fileInputRef.current) { fileInputRef.current.accept = 'image/*'; fileInputRef.current.capture = 'environment'; fileInputRef.current.click() } }}
                      className="flex items-center justify-center gap-2 py-3 px-4 border-2 border-dashed border-[#c8c0b0] rounded-xl text-sm text-[#6b7c5c] font-body hover:border-[#5a7a3a] hover:text-[#3d6228] transition-colors bg-[#faf8f5]">
                      {Icon.camera} Take Photo
                    </button>
                    <button type="button"
                      onClick={() => { if (fileInputRef.current) { fileInputRef.current.removeAttribute('capture'); fileInputRef.current.click() } }}
                      className="flex items-center justify-center gap-2 py-3 px-4 border-2 border-dashed border-[#c8c0b0] rounded-xl text-sm text-[#6b7c5c] font-body hover:border-[#5a7a3a] hover:text-[#3d6228] transition-colors bg-[#faf8f5]">
                      {Icon.gallery} Choose from Gallery
                    </button>
                  </div>

                  {/* Drag & drop zone */}
                  <div
                    onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
                    onClick={() => { if (fileInputRef.current) { fileInputRef.current.removeAttribute('capture'); fileInputRef.current.click() } }}
                    className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${dragOver ? 'border-[#5a7a3a] bg-green-50' : 'border-[#e0d8ce] hover:border-[#5a7a3a]'}`}>
                    <div className="text-[#b0a898] mb-2">{Icon.image}</div>
                    <p className="text-xs text-[#8a9070] font-body">or drag & drop images here</p>
                  </div>

                  <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden"
                    onChange={e => handleFiles(e.target.files)} />

                  {/* Previews */}
                  {imagePreviews.length > 0 && (
                    <div className="grid grid-cols-4 gap-2">
                      {imagePreviews.map((src, i) => (
                        <div key={i} className="relative aspect-square rounded-xl overflow-hidden group">
                          <Image src={src} alt={`Preview ${i + 1}`} fill className="object-cover" />
                          <button type="button" onClick={() => removeImage(i)}
                            className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            {Icon.x}
                          </button>
                          {i === 0 && (
                            <span className="absolute bottom-1 left-1 bg-[#2d4a1e] text-white text-xs px-1.5 py-0.5 rounded-md font-body">Cover</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button type="submit" disabled={submitting} className="btn-primary">
                  {submitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      {uploading ? 'Uploading photos…' : 'Publishing…'}
                    </span>
                  ) : 'Publish Product'}
                </button>
              </form>
            )}
          </div>
        )}

        {/* ── Orders Tab ───────────────────────────────────── */}
        {tab === 'orders' && (
          <div className="mt-4 pb-8 space-y-3">
            {ordersLoading ? (
              <div className="card p-8 text-center text-[#8a9070] font-body text-sm animate-pulse">Loading orders…</div>
            ) : orders.length === 0 ? (
              <div className="card p-12 text-center">
                <div className="text-5xl mb-4">📦</div>
                <h3 className="font-display text-xl text-[#2c3320] mb-2">No orders yet</h3>
                <p className="text-[#8a9070] text-sm font-body">When consumers order your products, they'll appear here</p>
              </div>
            ) : orders.map((order: any) => {
              const isExpanded = expandedOrder === order.id
              const items = order.items ?? []
              const statusColors: Record<string, string> = {
                paid: 'bg-blue-50 text-blue-700',
                processing: 'bg-amber-50 text-amber-700',
                shipped: 'bg-purple-50 text-purple-700',
                delivered: 'bg-green-50 text-green-700',
                completed: 'bg-green-100 text-green-800',
                cancelled: 'bg-red-50 text-red-500',
              }
              const statusColor = statusColors[order.status] ?? 'bg-gray-100 text-gray-600'
              const canProcess = order.status === 'paid'
              const canShip = order.status === 'processing'
              const canCancel = ['paid', 'processing'].includes(order.status)
              const isUpdating = updatingOrder === order.id

              return (
                <div key={order.id} className="card overflow-hidden">
                  {/* Order header */}
                  <button onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                    className="w-full flex items-center gap-3 p-4 text-left hover:bg-[#faf8f5] transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-body font-medium text-[#2c3320] text-sm">
                          #{order.id.slice(0, 8).toUpperCase()}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-body font-medium ${statusColor}`}>
                          {order.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs text-[#8a9070] font-body mt-0.5">
                        {new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {' · '}{items.length} item{items.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-body font-semibold text-[#3d6228] text-sm">₹{order.total_amount?.toFixed(2)}</p>
                      <p className="text-xs text-[#8a9070]">{isExpanded ? '▲' : '▼'}</p>
                    </div>
                  </button>

                  {/* Expanded */}
                  {isExpanded && (
                    <div className="border-t border-[#f0e8dc] p-4 space-y-4">

                      {/* Items */}
                      <div className="space-y-2">
                        {items.map((item: any) => (
                          <div key={item.id} className="flex items-center gap-3 bg-[#faf8f5] rounded-xl p-3">
                            <div className="w-10 h-10 rounded-lg bg-[#f0ebe3] flex items-center justify-center text-lg flex-shrink-0">
                              {item.product?.images?.[0]
                                ? <img src={item.product.images[0]} alt="" className="w-full h-full object-cover rounded-lg" />
                                : '🌿'}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-body font-medium text-[#2c3320] truncate">{item.product?.name}</p>
                              <p className="text-xs text-[#8a9070] font-body">{item.quantity} {item.product?.unit} · ₹{item.unit_price}/{item.product?.unit}</p>
                            </div>
                            <p className="text-sm font-body font-semibold text-[#3d6228]">₹{item.subtotal}</p>
                          </div>
                        ))}
                      </div>

                      {/* Delivery address */}
                      <div className="bg-[#f5f0ea] rounded-xl p-3">
                        <p className="text-xs font-body font-medium text-[#6b7c5c] uppercase tracking-wide mb-1">Delivery Address</p>
                        <p className="text-sm font-body text-[#2c3320]">{order.delivery_address}</p>
                        <p className="text-xs text-[#8a9070] font-body">{order.delivery_city}{order.delivery_pincode ? ` - ${order.delivery_pincode}` : ''}</p>
                      </div>

                      {/* Consumer note */}
                      {order.notes && (
                        <div className="bg-amber-50 rounded-xl p-3">
                          <p className="text-xs font-body font-medium text-amber-700 mb-1">Note from consumer</p>
                          <p className="text-sm font-body text-amber-800">{order.notes}</p>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex gap-2 flex-wrap">
                        {canProcess && (
                          <button disabled={isUpdating}
                            onClick={() => updateOrderStatus(order.id, 'update_status', 'processing')}
                            className="flex-1 py-2.5 px-4 bg-[#2d4a1e] text-white rounded-xl text-sm font-body font-medium disabled:opacity-50 hover:bg-[#3d6228] transition-colors">
                            {isUpdating ? '…' : '✅ Accept & Process'}
                          </button>
                        )}
                        {canShip && (
                          <button disabled={isUpdating}
                            onClick={() => updateOrderStatus(order.id, 'update_status', 'shipped')}
                            className="flex-1 py-2.5 px-4 bg-[#5a7a3a] text-white rounded-xl text-sm font-body font-medium disabled:opacity-50 hover:bg-[#4a6a2a] transition-colors">
                            {isUpdating ? '…' : '🚚 Mark as Shipped'}
                          </button>
                        )}
                        {canCancel && (
                          <button disabled={isUpdating}
                            onClick={() => { if (confirm('Cancel this order?')) updateOrderStatus(order.id, 'cancel') }}
                            className="py-2.5 px-4 bg-red-50 text-red-600 border border-red-100 rounded-xl text-sm font-body font-medium disabled:opacity-50 hover:bg-red-100 transition-colors">
                            {isUpdating ? '…' : 'Cancel'}
                          </button>
                        )}
                        {order.status === 'completed' && (
                          <div className="flex items-center gap-2 text-green-700 text-sm font-body">
                            ✅ Order completed · Payment released
                          </div>
                        )}
                        {order.status === 'cancelled' && (
                          <div className="flex items-center gap-2 text-red-500 text-sm font-body">
                            ❌ Order cancelled
                          </div>
                        )}
                        {order.status === 'shipped' && (
                          <div className="flex items-center gap-2 text-purple-600 text-sm font-body">
                            🚚 Shipped · Waiting for consumer to confirm delivery
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

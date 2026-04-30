'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { ChevronLeft, AlertCircle, CheckCircle, Trash2, Leaf, Info } from 'lucide-react'
import type { ProductCategory } from '@/types'
import { CATEGORY_LABELS, UNITS } from '@/types'

const CATEGORIES = Object.entries(CATEGORY_LABELS) as [ProductCategory, string][]

const PRICE_HINTS: Partial<Record<ProductCategory, string>> = {
  vegetables: '₹20–₹80 per kg typical',
  fruits: '₹40–₹200 per kg typical',
  grains: '₹30–₹100 per kg typical',
  dairy: '₹50–₹120 per litre typical',
  spices: '₹100–₹500 per kg typical',
  pulses: '₹60–₹150 per kg typical',
}

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const supabase = createClient()

  const [form, setForm] = useState({
    name: '', description: '', category: 'vegetables' as ProductCategory,
    price_per_unit: '', unit: 'kg', stock_quantity: '', min_order_qty: '1',
    is_organic: false, is_available: true, harvest_date: '', tags: '',
  })
  const [existingImages, setExistingImages] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const set = (k: string, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/products/${id}`)
      const { data, error } = await res.json()
      if (error || !data) { router.push('/dashboard'); return }

      setForm({
        name: data.name,
        description: data.description ?? '',
        category: data.category,
        price_per_unit: String(data.price_per_unit),
        unit: data.unit,
        stock_quantity: String(data.stock_quantity),
        min_order_qty: String(data.min_order_qty),
        is_organic: data.is_organic,
        is_available: data.is_available,
        harvest_date: data.harvest_date ?? '',
        tags: (data.tags ?? []).join(', '),
      })
      setExistingImages(data.images ?? [])
      setLoading(false)
    }
    load()
  }, [id, router])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!form.name.trim()) return setError('Product name is required')
    if (Number(form.price_per_unit) <= 0) return setError('Valid price is required')

    setSaving(true)
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          price_per_unit: Number(form.price_per_unit),
          stock_quantity: Number(form.stock_quantity),
          min_order_qty: Number(form.min_order_qty),
          images: existingImages,
          tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
          harvest_date: form.harvest_date || null,
        }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)

      setSuccess(true)
      setTimeout(() => router.push('/dashboard'), 1200)
    } catch (err: any) {
      setError(err.message ?? 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this product? This cannot be undone.')) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message)
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-cream-dark py-10">
        <div className="section max-w-2xl">
          <div className="skeleton h-8 w-48 mb-8" />
          <div className="card p-8 space-y-4">
            {[1,2,3,4,5].map(i => <div key={i} className="skeleton h-10 rounded-lg" />)}
          </div>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen bg-cream-dark flex items-center justify-center">
        <div className="card p-12 text-center max-w-sm">
          <CheckCircle size={48} className="mx-auto text-green-mid mb-4" />
          <h2 className="font-serif text-2xl text-soil mb-2">Saved!</h2>
          <p className="text-muted text-sm">Redirecting to dashboard…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream-dark py-10">
      <div className="section max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-cream-dark text-muted hover:text-soil transition-colors">
              <ChevronLeft size={20} />
            </button>
            <div>
              <h1 className="font-serif text-3xl text-soil">Edit Product</h1>
              <p className="text-muted text-sm mt-1">Update your listing details</p>
            </div>
          </div>
          <button onClick={handleDelete} disabled={deleting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-red-600 border border-red-200 hover:bg-red-50 text-sm transition-all disabled:opacity-50">
            <Trash2 size={14} /> {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6">
            <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          {/* Basic Info */}
          <div className="card p-6">
            <h2 className="font-medium text-soil mb-5">Basic Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-soil-mid mb-1.5">Product Name *</label>
                <input type="text" value={form.name} onChange={e => set('name', e.target.value)} className="input" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-soil-mid mb-1.5">Category *</label>
                <select value={form.category} onChange={e => set('category', e.target.value)} className="input">
                  {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-soil-mid mb-1.5">Description</label>
                <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3} className="input resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-soil-mid mb-1.5">Tags (comma-separated)</label>
                <input type="text" value={form.tags} onChange={e => set('tags', e.target.value)} className="input" />
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="card p-6">
            <h2 className="font-medium text-soil mb-5">Pricing & Inventory</h2>
            {PRICE_HINTS[form.category] && (
              <div className="flex items-start gap-2 bg-gold-light rounded-lg p-3 mb-4 text-sm text-amber-800">
                <Info size={15} className="flex-shrink-0 mt-0.5" />
                <span>Market reference: {PRICE_HINTS[form.category]}</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-soil-mid mb-1.5">Price per Unit (₹) *</label>
                <input type="number" value={form.price_per_unit} onChange={e => set('price_per_unit', e.target.value)} min="0.01" step="0.01" className="input" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-soil-mid mb-1.5">Unit *</label>
                <select value={form.unit} onChange={e => set('unit', e.target.value)} className="input">
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-soil-mid mb-1.5">Stock Available *</label>
                <input type="number" value={form.stock_quantity} onChange={e => set('stock_quantity', e.target.value)} min="0" className="input" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-soil-mid mb-1.5">Min Order</label>
                <input type="number" value={form.min_order_qty} onChange={e => set('min_order_qty', e.target.value)} min="1" className="input" />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-soil-mid mb-1.5">Harvest Date</label>
              <input type="date" value={form.harvest_date} onChange={e => set('harvest_date', e.target.value)} className="input" />
            </div>
            <div className="flex gap-6 mt-5">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div className={`relative w-10 h-5 rounded-full transition-colors ${form.is_organic ? 'bg-green-mid' : 'bg-border'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.is_organic ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  <input type="checkbox" className="sr-only" checked={form.is_organic} onChange={e => set('is_organic', e.target.checked)} />
                </div>
                <Leaf size={14} className={form.is_organic ? 'text-green-mid' : 'text-muted'} />
                <span className="text-sm text-soil-mid">Organic</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div className={`relative w-10 h-5 rounded-full transition-colors ${form.is_available ? 'bg-green-mid' : 'bg-border'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.is_available ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  <input type="checkbox" className="sr-only" checked={form.is_available} onChange={e => set('is_available', e.target.checked)} />
                </div>
                <span className="text-sm text-soil-mid">Listed (visible to buyers)</span>
              </label>
            </div>
          </div>

          {/* Existing Images */}
          {existingImages.length > 0 && (
            <div className="card p-6">
              <h2 className="font-medium text-soil mb-4">Product Images</h2>
              <div className="grid grid-cols-4 gap-3">
                {existingImages.map((img, i) => (
                  <div key={i} className="relative aspect-square rounded-lg overflow-hidden group">
                    <Image src={img} alt={`Image ${i+1}`} fill className="object-cover" />
                    <button type="button" onClick={() => setExistingImages(prev => prev.filter((_, idx) => idx !== i))}
                      className="absolute inset-0 bg-soil/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity">
                      <Trash2 size={18} />
                    </button>
                    {i === 0 && <span className="absolute bottom-1 left-1 bg-green-deep text-white text-xs px-1.5 py-0.5 rounded">Cover</span>}
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted mt-2">Hover an image and click the trash icon to remove it.</p>
            </div>
          )}

          <button type="submit" disabled={saving} className="btn-primary w-full py-3.5 text-base">
            {saving ? (
              <span className="flex items-center gap-2 justify-center">
                <span className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                Saving…
              </span>
            ) : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  )
}

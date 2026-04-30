'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { Upload, X, Leaf, AlertCircle, CheckCircle, ChevronLeft, Info } from 'lucide-react'
import type { ProductCategory } from '@/types'
import { CATEGORY_LABELS, UNITS } from '@/types'

const CATEGORIES = Object.entries(CATEGORY_LABELS) as [ProductCategory, string][]

// Suggested prices by category (₹/kg or unit)
const PRICE_HINTS: Partial<Record<ProductCategory, string>> = {
  vegetables: '₹20–₹80 per kg typical',
  fruits:     '₹40–₹200 per kg typical',
  grains:     '₹30–₹100 per kg typical',
  dairy:      '₹50–₹120 per litre typical',
  spices:     '₹100–₹500 per kg typical',
  pulses:     '₹60–₹150 per kg typical',
}

export default function NewProductPage() {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    name: '',
    description: '',
    category: 'vegetables' as ProductCategory,
    price_per_unit: '',
    unit: 'kg',
    stock_quantity: '',
    min_order_qty: '1',
    is_organic: false,
    harvest_date: '',
    tags: '',
  })

  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [imageFiles, setImageFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const set = (field: string, value: unknown) =>
    setForm(f => ({ ...f, [field]: value }))

  // ── Image Handling ─────────────────────────────────────────
  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return
    const MAX_SIZE = 5 * 1024 * 1024 // 5 MB
    const newFiles: File[] = []
    const newPreviews: string[] = []

    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) {
        setError('Only image files are allowed')
        return
      }
      if (file.size > MAX_SIZE) {
        setError(`${file.name} exceeds 5 MB limit`)
        return
      }
      newFiles.push(file)
      newPreviews.push(URL.createObjectURL(file))
    })

    setImageFiles(prev => [...prev, ...newFiles].slice(0, 4))
    setImagePreviews(prev => [...prev, ...newPreviews].slice(0, 4))
    setError(null)
  }, [])

  const removeImage = (idx: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== idx))
    setImagePreviews(prev => {
      URL.revokeObjectURL(prev[idx])
      return prev.filter((_, i) => i !== idx)
    })
  }

  // ── Submit ──────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Client-side validation
    if (!form.name.trim()) return setError('Product name is required')
    if (!form.price_per_unit || Number(form.price_per_unit) <= 0) return setError('Valid price is required')
    if (!form.stock_quantity || Number(form.stock_quantity) < 0) return setError('Stock quantity is required')

    setSubmitting(true)

    try {
      // 1. Upload images to Supabase Storage
      const uploadedUrls: string[] = []

      if (imageFiles.length > 0) {
        setUploading(true)
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error('Not authenticated')

        for (const file of imageFiles) {
          const ext = file.name.split('.').pop()
          const path = `products/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

          const { data, error: uploadErr } = await supabase.storage
            .from('product-images')
            .upload(path, file, { cacheControl: '3600', upsert: false })

          if (uploadErr) throw new Error(`Image upload failed: ${uploadErr.message}`)

          const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(data.path)
          uploadedUrls.push(urlData.publicUrl)
        }
        setUploading(false)
      }

      // 2. Create product via API
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

      setSuccess(true)
      setTimeout(() => router.push('/dashboard'), 1500)
    } catch (err: any) {
      setError(err.message ?? 'Failed to create product. Please try again.')
      setUploading(false)
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-cream-dark flex items-center justify-center">
        <div className="card p-12 text-center max-w-sm">
          <CheckCircle size={48} className="mx-auto text-green-mid mb-4" />
          <h2 className="font-serif text-2xl text-soil mb-2">Product Listed!</h2>
          <p className="text-muted text-sm">Redirecting to dashboard…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream-dark py-10">
      <div className="section max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-cream-dark text-muted hover:text-soil transition-colors">
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 className="font-serif text-3xl text-soil">List a New Product</h1>
            <p className="text-muted text-sm mt-1">Share your fresh produce with consumers in Bhopal</p>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6 animate-fade-in">
            <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ── Section: Basic Info ─────────────────────────── */}
          <div className="card p-6">
            <h2 className="font-medium text-soil mb-5 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-green-deep text-white text-xs flex items-center justify-center">1</span>
              Basic Information
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-soil-mid mb-1.5">Product Name *</label>
                <input type="text" value={form.name} onChange={e => set('name', e.target.value)}
                  placeholder="e.g. Fresh Tomatoes, Desi Ghee, Basmati Rice"
                  className="input" required />
              </div>

              <div>
                <label className="block text-sm font-medium text-soil-mid mb-1.5">Category *</label>
                <select value={form.category} onChange={e => set('category', e.target.value as ProductCategory)} className="input">
                  {CATEGORIES.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-soil-mid mb-1.5">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => set('description', e.target.value)}
                  placeholder="Describe your product — freshness, how it's grown, special properties…"
                  rows={3}
                  className="input resize-none" />
              </div>

              <div>
                <label className="block text-sm font-medium text-soil-mid mb-1.5">Tags (comma-separated)</label>
                <input type="text" value={form.tags} onChange={e => set('tags', e.target.value)}
                  placeholder="e.g. seasonal, pesticide-free, local"
                  className="input" />
              </div>
            </div>
          </div>

          {/* ── Section: Pricing & Stock ───────────────────── */}
          <div className="card p-6">
            <h2 className="font-medium text-soil mb-5 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-green-deep text-white text-xs flex items-center justify-center">2</span>
              Pricing & Inventory
            </h2>

            {PRICE_HINTS[form.category] && (
              <div className="flex items-start gap-2 bg-gold-light rounded-lg p-3 mb-4 text-sm text-amber-800">
                <Info size={15} className="flex-shrink-0 mt-0.5" />
                <span>Market reference: {PRICE_HINTS[form.category]}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-soil-mid mb-1.5">Price per Unit (₹) *</label>
                <input type="number" value={form.price_per_unit} onChange={e => set('price_per_unit', e.target.value)}
                  placeholder="0.00" min="0.01" step="0.01" className="input" required />
              </div>

              <div>
                <label className="block text-sm font-medium text-soil-mid mb-1.5">Unit *</label>
                <select value={form.unit} onChange={e => set('unit', e.target.value)} className="input">
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-soil-mid mb-1.5">Stock Available *</label>
                <input type="number" value={form.stock_quantity} onChange={e => set('stock_quantity', e.target.value)}
                  placeholder="0" min="0" step="1" className="input" required />
              </div>

              <div>
                <label className="block text-sm font-medium text-soil-mid mb-1.5">Minimum Order</label>
                <input type="number" value={form.min_order_qty} onChange={e => set('min_order_qty', e.target.value)}
                  placeholder="1" min="1" step="1" className="input" />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-soil-mid mb-1.5">Harvest Date</label>
              <input type="date" value={form.harvest_date} onChange={e => set('harvest_date', e.target.value)} className="input" />
            </div>

            <label className="flex items-center gap-3 mt-5 cursor-pointer select-none group">
              <div className={`relative w-10 h-5 rounded-full transition-colors ${form.is_organic ? 'bg-green-mid' : 'bg-border'}`}>
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.is_organic ? 'translate-x-5' : 'translate-x-0.5'}`} />
                <input type="checkbox" className="sr-only" checked={form.is_organic} onChange={e => set('is_organic', e.target.checked)} />
              </div>
              <Leaf size={16} className={form.is_organic ? 'text-green-mid' : 'text-muted'} />
              <span className="text-sm font-medium text-soil-mid">This product is certified organic</span>
            </label>
          </div>

          {/* ── Section: Images ────────────────────────────── */}
          <div className="card p-6">
            <h2 className="font-medium text-soil mb-5 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-green-deep text-white text-xs flex items-center justify-center">3</span>
              Product Images <span className="text-xs font-normal text-muted ml-1">(up to 4, max 5 MB each)</span>
            </h2>

            {/* Drop Zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                dragOver
                  ? 'border-green-mid bg-green-light'
                  : 'border-border hover:border-green-mid hover:bg-green-light/50'
              }`}>
              <Upload size={28} className="mx-auto text-muted mb-3" />
              <p className="text-sm font-medium text-soil-mid">
                {dragOver ? 'Drop images here' : 'Click or drag images here'}
              </p>
              <p className="text-xs text-muted mt-1">JPG, PNG, WebP — max 5 MB each</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={e => handleFiles(e.target.files)}
              />
            </div>

            {/* Image Previews */}
            {imagePreviews.length > 0 && (
              <div className="grid grid-cols-4 gap-3 mt-4">
                {imagePreviews.map((src, i) => (
                  <div key={i} className="relative aspect-square rounded-lg overflow-hidden group">
                    <Image src={src} alt={`Preview ${i + 1}`} fill className="object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute top-1 right-1 bg-soil/70 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <X size={12} />
                    </button>
                    {i === 0 && (
                      <span className="absolute bottom-1 left-1 bg-green-deep text-white text-xs px-1.5 py-0.5 rounded">
                        Cover
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit */}
          <button type="submit" disabled={submitting} className="btn-primary w-full py-3.5 text-base">
            {submitting ? (
              <span className="flex items-center gap-2 justify-center">
                <span className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                {uploading ? 'Uploading images…' : 'Creating listing…'}
              </span>
            ) : (
              'Publish Product'
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

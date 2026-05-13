import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Leaf, MapPin, ShieldCheck, Package, Phone, ArrowLeft, ShoppingCart } from 'lucide-react'
import { CATEGORY_EMOJIS, CATEGORY_LABELS } from '@/types'
import type { Profile, Product } from '@/types'

export const revalidate = 300

async function getFarm(id: string): Promise<{ farm: Profile; products: Product[] } | null> {
  try {
    const supabase = (await createClient()) as any

    const { data: farm } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .eq('role', 'farmer')
      .single()

    if (!farm) return null

    const { data: products } = await supabase
      .from('products')
      .select('*')
      .eq('farmer_id', id)
      .eq('is_available', true)
      .gt('stock_quantity', 0)
      .order('category')
      .order('created_at', { ascending: false })

    return { farm, products: products ?? [] }
  } catch {
    return null
  }
}

export default async function FarmPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await getFarm(id)
  if (!result) notFound()

  const { farm, products } = result

  // Group products by category
  const grouped = products.reduce((acc, product) => {
    if (!acc[product.category]) acc[product.category] = []
    acc[product.category].push(product)
    return acc
  }, {} as Record<string, Product[]>)

  const categories = Object.keys(grouped)

  return (
    <div className="min-h-screen bg-cream-dark">
      {/* Farm Hero */}
      <div style={{ background: 'linear-gradient(135deg, #2d4a1e 0%, #4a6e2a 100%)' }} className="py-10 text-white">
        <div className="section">
          <Link href="/farms"
            className="inline-flex items-center gap-2 text-green-300 hover:text-white text-sm mb-6 transition-colors">
            <ArrowLeft size={15} /> All Farms
          </Link>

          <div className="flex items-start gap-5">
            <div className="w-20 h-20 rounded-3xl bg-white/20 flex items-center justify-center text-4xl flex-shrink-0">
              🌾
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="font-serif text-3xl md:text-4xl">
                  {farm.farm_name ?? farm.full_name}
                </h1>
                {farm.is_verified && (
                  <span className="flex items-center gap-1.5 bg-white/20 text-white text-sm px-3 py-1 rounded-full">
                    <ShieldCheck size={14} /> Verified Farm
                  </span>
                )}
              </div>

              <p className="text-green-200 text-sm mt-1.5 flex items-center gap-1.5">
                <MapPin size={14} /> {farm.city}, {farm.state}
                {farm.pincode && ` — ${farm.pincode}`}
              </p>

              {farm.phone && (
                <p className="text-green-200 text-sm mt-1 flex items-center gap-1.5">
                  <Phone size={14} /> {farm.phone}
                </p>
              )}

              {farm.bio && (
                <p className="text-green-100 text-sm mt-3 max-w-2xl leading-relaxed">{farm.bio}</p>
              )}

              {/* Stats */}
              <div className="flex items-center gap-6 mt-4">
                <div>
                  <p className="font-serif text-2xl font-semibold">{products.length}</p>
                  <p className="text-green-300 text-xs">Products</p>
                </div>
                <div>
                  <p className="font-serif text-2xl font-semibold">{categories.length}</p>
                  <p className="text-green-300 text-xs">Categories</p>
                </div>
                <div>
                  <p className="font-serif text-2xl font-semibold">
                    {products.filter(p => p.is_organic).length}
                  </p>
                  <p className="text-green-300 text-xs">Organic</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Products */}
      <div className="section py-8">
        {products.length === 0 ? (
          <div className="card p-16 text-center">
            <Package size={48} className="mx-auto text-muted mb-4" />
            <h2 className="font-serif text-2xl text-soil mb-2">No products listed yet</h2>
            <p className="text-muted text-sm">This farmer hasn't listed any products yet. Check back soon!</p>
          </div>
        ) : (
          <div className="space-y-10">
            {categories.map(category => (
              <div key={category}>
                {/* Category header */}
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">{CATEGORY_EMOJIS[category as keyof typeof CATEGORY_EMOJIS]}</span>
                  <h2 className="font-serif text-2xl text-soil">
                    {CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS]}
                  </h2>
                  <span className="text-xs text-muted bg-cream px-2.5 py-1 rounded-full">
                    {grouped[category].length} items
                  </span>
                </div>

                {/* Product grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {grouped[category].map(product => (
                    <Link key={product.id} href={`/marketplace/${product.id}`}
                      className="card overflow-hidden hover:shadow-md transition-all hover:-translate-y-0.5 group block">

                      {/* Image */}
                      <div className="relative aspect-[4/3] bg-cream-dark overflow-hidden">
                        {product.images?.[0] ? (
                          <Image src={product.images[0]} alt={product.name} fill
                            className="object-cover group-hover:scale-105 transition-transform duration-300" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-4xl">
                            {CATEGORY_EMOJIS[product.category]}
                          </div>
                        )}
                        {product.is_organic && (
                          <span className="absolute top-2 left-2 flex items-center gap-1 bg-green-deep text-white text-xs px-2 py-0.5 rounded-full">
                            <Leaf size={10} /> Organic
                          </span>
                        )}
                        {product.stock_quantity <= 5 && (
                          <span className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                            Low Stock
                          </span>
                        )}
                      </div>

                      {/* Details */}
                      <div className="p-3">
                        <h3 className="font-medium text-soil text-sm leading-tight mb-1">{product.name}</h3>

                        {product.description && (
                          <p className="text-xs text-muted line-clamp-2 mb-2 leading-relaxed">
                            {product.description}
                          </p>
                        )}

                        <div className="flex items-center justify-between mt-2">
                          <div>
                            <span className="text-green-deep font-semibold text-sm">₹{product.price_per_unit}</span>
                            <span className="text-muted text-xs">/{product.unit}</span>
                          </div>
                          <span className="text-xs text-muted">{product.stock_quantity} left</span>
                        </div>

                        {product.tags?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {product.tags.slice(0, 2).map(tag => (
                              <span key={tag} className="text-xs bg-cream-dark text-muted px-1.5 py-0.5 rounded">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="mt-3 flex items-center justify-center gap-1.5 bg-green-deep text-white text-xs py-2 rounded-lg group-hover:bg-green-mid transition-colors">
                          <ShoppingCart size={12} /> Add to Cart
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

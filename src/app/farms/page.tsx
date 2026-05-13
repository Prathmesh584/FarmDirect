import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { MapPin, ShieldCheck, Package, Leaf } from 'lucide-react'
import { CATEGORY_EMOJIS } from '@/types'
import type { Profile, Product } from '@/types'

export const revalidate = 300

interface FarmWithProducts extends Profile {
  products: Product[]
  product_count: number
}

async function getFarms(): Promise<FarmWithProducts[]> {
  try {
    const supabase = (await createClient()) as any
    const { data: farmers } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'farmer')
      .order('is_verified', { ascending: false })

    if (!farmers?.length) return []

    const farmsWithProducts = await Promise.all(
      farmers.map(async (farmer: Profile) => {
        const { data: products } = await supabase
          .from('products')
          .select('*')
          .eq('farmer_id', farmer.id)
          .eq('is_available', true)
          .gt('stock_quantity', 0)
          .order('created_at', { ascending: false })
          .limit(4)

        const { count } = await supabase
          .from('products')
          .select('*', { count: 'exact', head: true })
          .eq('farmer_id', farmer.id)
          .eq('is_available', true)

        return { ...farmer, products: products ?? [], product_count: count ?? 0 }
      })
    )

    return farmsWithProducts.filter(f => f.product_count > 0)
  } catch {
    return []
  }
}

export default async function FarmsPage() {
  const farms = await getFarms()

  return (
    <div className="min-h-screen bg-cream-dark">
      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg, #2d4a1e 0%, #4a6e2a 100%)' }} className="py-14 text-white">
        <div className="section text-center">
          <p className="text-green-300 text-xs uppercase tracking-widest font-medium mb-3">Browse Local Farms</p>
          <h1 className="font-serif text-4xl md:text-5xl mb-4">Farm Shops Near You</h1>
          <p className="text-green-200 text-base max-w-xl mx-auto">
            Discover farmers in Bhopal and Madhya Pradesh. Browse their full inventory and order directly from the source.
          </p>
        </div>
      </div>

      <div className="section py-10">
        {farms.length === 0 ? (
          <div className="card p-16 text-center">
            <div className="text-5xl mb-4">🌱</div>
            <h2 className="font-serif text-2xl text-soil mb-2">No farms listed yet</h2>
            <p className="text-muted text-sm">Farmers are joining soon. Check back later!</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {farms.map(farm => (
              <Link key={farm.id} href={`/farms/${farm.id}`}
                className="card overflow-hidden hover:shadow-lg transition-all hover:-translate-y-0.5 group block">

                {/* Farm Header */}
                <div style={{ background: 'linear-gradient(135deg, #3d6228 0%, #5a7a3a 100%)' }}
                  className="p-5 text-white">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center text-2xl flex-shrink-0">
                      🌾
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="font-serif text-xl leading-tight">
                          {farm.farm_name ?? farm.full_name}
                        </h2>
                        {farm.is_verified && (
                          <span className="flex items-center gap-1 bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">
                            <ShieldCheck size={11} /> Verified
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-green-200 text-sm mt-1">
                        <MapPin size={13} /> {farm.city}, {farm.state}
                      </div>
                      <div className="flex items-center gap-1 text-green-200 text-xs mt-1">
                        <Package size={12} /> {farm.product_count} product{farm.product_count !== 1 ? 's' : ''} available
                      </div>
                    </div>
                  </div>
                  {farm.bio && (
                    <p className="text-green-100 text-sm mt-3 line-clamp-2 leading-relaxed">{farm.bio}</p>
                  )}
                </div>

                {/* Product preview */}
                <div className="p-4">
                  {farm.products.length > 0 && (
                    <>
                      <div className="grid grid-cols-4 gap-2 mb-3">
                        {farm.products.slice(0, 4).map(product => (
                          <div key={product.id} className="relative aspect-square rounded-xl overflow-hidden bg-cream-dark">
                            {product.images?.[0] ? (
                              <Image src={product.images[0]} alt={product.name} fill
                                className="object-cover group-hover:scale-105 transition-transform duration-300" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-2xl">
                                {CATEGORY_EMOJIS[product.category]}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {farm.products.slice(0, 4).map(product => (
                          <span key={product.id} className="text-xs bg-cream-dark text-soil-mid px-2.5 py-1 rounded-full">
                            {product.name}
                            {product.is_organic && <Leaf size={10} className="inline ml-1 text-green-600" />}
                          </span>
                        ))}
                        {farm.product_count > 4 && (
                          <span className="text-xs bg-green-light text-green-deep px-2.5 py-1 rounded-full font-medium">
                            +{farm.product_count - 4} more
                          </span>
                        )}
                      </div>
                    </>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted">Tap to view all products</span>
                    <span className="text-sm text-green-deep font-medium group-hover:underline">Visit Shop →</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

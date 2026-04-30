import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { ArrowRight, Leaf, ShieldCheck, Truck, Star, Users, TrendingUp } from 'lucide-react'
import type { Product } from '@/types'
import { CATEGORY_EMOJIS } from '@/types'

// Featured products for hero section (ISR — revalidate every 10 minutes)
export const revalidate = 600

async function getFeaturedProducts(): Promise<Product[]> {
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        farmer:profiles!farmer_id(full_name, farm_name, city),
        reviews(rating)
      `)
      .eq('is_available', true)
      .gt('stock_quantity', 0)
      .order('created_at', { ascending: false })
      .limit(6)

    if (error) throw error
    return (data ?? []) as unknown as Product[]
  } catch {
    return []
  }
}

const STATS = [
  { icon: Users, label: 'Registered Farmers', value: '200+' },
  { icon: Leaf, label: 'Products Listed', value: '1,400+' },
  { icon: TrendingUp, label: 'Orders Delivered', value: '8,000+' },
  { icon: Star, label: 'Average Rating', value: '4.8 ★' },
]

const TRUST_FEATURES = [
  {
    icon: ShieldCheck,
    title: 'Escrow-Protected Payments',
    desc: 'Your money is held safely until you confirm delivery — no risk, ever.',
  },
  {
    icon: Truck,
    title: 'Same-Day Delivery in Bhopal',
    desc: 'Order before noon, receive your fresh produce the same afternoon.',
  },
  {
    icon: Leaf,
    title: 'Certified Organic Options',
    desc: 'Browse verified organic produce, clearly labelled on every listing.',
  },
]

const CATEGORIES = [
  { key: 'vegetables', label: 'Vegetables', color: 'bg-emerald-50 border-emerald-200' },
  { key: 'fruits',     label: 'Fruits',     color: 'bg-rose-50 border-rose-200' },
  { key: 'grains',     label: 'Grains',     color: 'bg-amber-50 border-amber-200' },
  { key: 'dairy',      label: 'Dairy',      color: 'bg-blue-50 border-blue-200' },
  { key: 'spices',     label: 'Spices',     color: 'bg-orange-50 border-orange-200' },
  { key: 'pulses',     label: 'Pulses',     color: 'bg-yellow-50 border-yellow-200' },
] as const

export default async function HomePage() {
  const featured = await getFeaturedProducts()

  return (
    <div className="overflow-hidden">
      {/* ── HERO ─────────────────────────────────────────── */}
      <section className="relative min-h-[92vh] flex items-center bg-green-deep grain overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-32 -right-32 w-[600px] h-[600px] rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #e8a020 0%, transparent 70%)' }} />
        <div className="absolute -bottom-40 -left-20 w-[500px] h-[500px] rounded-full opacity-8"
          style={{ background: 'radial-gradient(circle, #c4622d 0%, transparent 70%)' }} />

        <div className="section relative z-10 py-24 grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: copy */}
          <div className="animate-fade-up">
            <span className="badge badge-gold mb-6 inline-flex">
              <Leaf size={12} /> Fresh from Bhopal Farms
            </span>

            <h1 className="font-serif text-5xl sm:text-6xl lg:text-7xl leading-tight text-white mb-6">
              Farm to Your
              <br />
              <span style={{ color: 'var(--gold)' }}>Table,</span>
              <br />
              <span className="text-white/80">No Middleman</span>
            </h1>

            <p className="text-lg text-white/70 max-w-md mb-10 leading-relaxed">
              Buy fresh vegetables, fruits, and grains directly from local farmers
              in Bhopal. Honest prices. Guaranteed freshness. Escrow-protected payments.
            </p>

            <div className="flex flex-wrap gap-4">
              <Link href="/marketplace" className="btn-terra text-base px-7 py-3">
                Shop Now <ArrowRight size={18} />
              </Link>
              <Link href="/auth/register?role=farmer"
                className="inline-flex items-center gap-2 px-7 py-3 rounded-lg font-medium text-base border border-white/30 text-white hover:bg-white/10 transition-all">
                I&apos;m a Farmer
              </Link>
            </div>

            {/* Social proof */}
            <div className="mt-12 flex items-center gap-3">
              <div className="flex -space-x-2">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className="w-9 h-9 rounded-full border-2 border-green-deep overflow-hidden"
                    style={{ background: `hsl(${i * 60}, 60%, 60%)` }} />
                ))}
              </div>
              <p className="text-sm text-white/70">
                <strong className="text-white">2,000+</strong> happy consumers trust us
              </p>
            </div>
          </div>

          {/* Right: floating product cards */}
          <div className="hidden lg:block relative h-[500px]">
            {featured.slice(0, 3).map((p, i) => {
              const offsets = [
                'top-0 right-0',
                'top-32 right-24',
                'top-64 right-8',
              ]
              return (
                <div key={p.id}
                  className={`absolute ${offsets[i]} w-52 card p-3 shadow-xl animate-fade-up`}
                  style={{ animationDelay: `${i * 0.15}s` }}>
                  <div className="w-full h-28 rounded-lg overflow-hidden mb-2 bg-cream-dark flex items-center justify-center text-4xl">
                    {p.images[0]
                      ? <Image src={p.images[0]} alt={p.name} width={208} height={112} className="w-full h-full object-cover" />
                      : <span>{CATEGORY_EMOJIS[p.category]}</span>
                    }
                  </div>
                  <p className="text-sm font-medium text-soil truncate">{p.name}</p>
                  <p className="text-xs text-muted">{(p.farmer as any)?.farm_name ?? (p.farmer as any)?.full_name}</p>
                  <p className="text-sm font-semibold text-green-deep mt-1">
                    ₹{p.price_per_unit}/{p.unit}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── STATS BAR ─────────────────────────────────────── */}
      <section className="bg-terra py-10">
        <div className="section stagger">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {STATS.map(({ icon: Icon, label, value }) => (
              <div key={label} className="text-white">
                <Icon className="mx-auto mb-2 opacity-80" size={22} />
                <div className="font-serif text-3xl font-bold">{value}</div>
                <div className="text-sm opacity-70 mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CATEGORY GRID ────────────────────────────────── */}
      <section className="py-20 bg-cream-dark">
        <div className="section">
          <div className="text-center mb-12">
            <h2 className="font-serif text-4xl text-soil mb-3">Shop by Category</h2>
            <p className="text-muted">Seasonal produce, directly from the farm</p>
          </div>
          <div className="stagger grid grid-cols-2 sm:grid-cols-3 gap-4">
            {CATEGORIES.map(cat => (
              <Link key={cat.key} href={`/marketplace?category=${cat.key}`}
                className={`card-hover card border p-6 flex flex-col items-center gap-3 text-center cursor-pointer ${cat.color}`}>
                <span className="text-5xl">{CATEGORY_EMOJIS[cat.key]}</span>
                <span className="font-medium text-soil">{cat.label}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURED PRODUCTS ────────────────────────────── */}
      {featured.length > 0 && (
        <section className="py-20">
          <div className="section">
            <div className="flex items-center justify-between mb-10">
              <div>
                <h2 className="font-serif text-4xl text-soil mb-2">Fresh Today</h2>
                <p className="text-muted">Harvested and listed within 24 hours</p>
              </div>
              <Link href="/marketplace" className="btn-secondary hidden sm:flex">
                View All <ArrowRight size={16} />
              </Link>
            </div>

            <div className="stagger grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {featured.map(product => (
                <FeaturedProductCard key={product.id} product={product} />
              ))}
            </div>

            <div className="text-center mt-10 sm:hidden">
              <Link href="/marketplace" className="btn-primary">
                View All Products <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── TRUST FEATURES ───────────────────────────────── */}
      <section className="py-20 bg-green-light">
        <div className="section">
          <div className="text-center mb-12">
            <h2 className="font-serif text-4xl text-soil mb-3">Why FarmDirect?</h2>
            <p className="text-muted max-w-lg mx-auto">
              We built the trust layer that makes farmer-consumer transactions safe for everyone
            </p>
          </div>
          <div className="stagger grid md:grid-cols-3 gap-8">
            {TRUST_FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="card p-8 text-center">
                <div className="w-14 h-14 rounded-full bg-green-deep/10 flex items-center justify-center mx-auto mb-5">
                  <Icon size={26} className="text-green-deep" />
                </div>
                <h3 className="font-serif text-xl text-soil mb-3">{title}</h3>
                <p className="text-muted text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FARMER CTA ───────────────────────────────────── */}
      <section className="py-20">
        <div className="section">
          <div className="rounded-2xl overflow-hidden relative bg-soil p-12 text-center grain">
            <div className="absolute inset-0 opacity-5"
              style={{ backgroundImage: 'repeating-linear-gradient(45deg, #e8a020 0, #e8a020 1px, transparent 0, transparent 50%)' ,
              backgroundSize: '8px 8px' }} />
            <div className="relative z-10">
              <Leaf className="mx-auto mb-4 text-gold opacity-80" size={36} />
              <h2 className="font-serif text-4xl text-white mb-4">
                Are you a Farmer?
              </h2>
              <p className="text-white/70 mb-8 max-w-lg mx-auto">
                Join 200+ farmers already selling directly to consumers in Bhopal.
                Set your own prices. Keep more of your earnings.
              </p>
              <Link href="/auth/register?role=farmer" className="btn-terra text-base px-8 py-3">
                Start Selling Today <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

// ── Sub-component: Featured Product Card ──────────────────────
function FeaturedProductCard({ product }: { product: Product }) {
  const farmer = product.farmer as any
  const reviews = (product as any).reviews as Array<{ rating: number }> | undefined
  const avgRating = reviews?.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : null

  return (
    <Link href={`/marketplace/${product.id}`} className="card card-hover block group">
      {/* Image */}
      <div className="relative h-48 bg-cream-dark overflow-hidden flex items-center justify-center text-6xl">
        {product.images[0] ? (
          <Image src={product.images[0]} alt={product.name} fill className="object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <span>{CATEGORY_EMOJIS[product.category]}</span>
        )}
        {product.is_organic && (
          <span className="absolute top-3 left-3 badge badge-green text-xs">
            <Leaf size={10} /> Organic
          </span>
        )}
        {product.stock_quantity < 5 && product.stock_quantity > 0 && (
          <span className="absolute top-3 right-3 badge badge-terra text-xs">
            Only {product.stock_quantity} left
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <p className="text-xs text-muted mb-1 uppercase tracking-wide">
          {CATEGORY_EMOJIS[product.category]} {product.category}
        </p>
        <h3 className="font-semibold text-soil text-base mb-1 truncate">{product.name}</h3>

        <div className="flex items-center justify-between mt-3">
          <div>
            <span className="font-bold text-green-deep text-lg">₹{product.price_per_unit}</span>
            <span className="text-muted text-sm">/{product.unit}</span>
          </div>
          {avgRating && (
            <span className="flex items-center gap-1 text-sm text-gold font-medium">
              <Star size={13} fill="currentColor" /> {avgRating}
            </span>
          )}
        </div>

        <p className="text-xs text-muted mt-2 truncate">
          by {farmer?.farm_name ?? farmer?.full_name ?? 'Local Farmer'} · {farmer?.city ?? 'Bhopal'}
        </p>
      </div>
    </Link>
  )
}

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ShoppingCart, Leaf, Menu, X, LogOut, User, LayoutDashboard, Package } from 'lucide-react'
import type { Profile } from '@/types'

export function Navbar() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [cartCount, setCartCount] = useState(0)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    let mounted = true

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !mounted) { setLoading(false); return }

      const { data: prof } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()
      if (mounted) setProfile(prof as Profile)

      if (prof?.role === 'consumer') {
        const { count } = await supabase
          .from('cart_items')
          .select('*', { count: 'exact', head: true })
          .eq('consumer_id', user.id)
        if (mounted) setCartCount(count ?? 0)
      }
      if (mounted) setLoading(false)
    }
    load()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => { load() })
    return () => { mounted = false; subscription.unsubscribe() }
  }, [supabase])

  // Real-time cart badge
  useEffect(() => {
    if (!profile || profile.role !== 'consumer') return
    const channel = supabase.channel('cart-count')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'cart_items', filter: `consumer_id=eq.${profile.id}` },
        async () => {
          const { count } = await supabase
            .from('cart_items').select('*', { count: 'exact', head: true }).eq('consumer_id', profile.id)
          setCartCount(count ?? 0)
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [profile, supabase])

  async function handleSignOut() {
    await supabase.auth.signOut()
    setProfile(null)
    setCartCount(0)
    router.push('/')
    router.refresh()
  }

  const isFarmer = profile?.role === 'farmer'
  const isConsumer = profile?.role === 'consumer'

  const navLinks = [
    { href: '/marketplace', label: 'Marketplace', always: true },
    ...(isFarmer ? [{ href: '/dashboard', label: 'Dashboard', always: false }] : []),
  ]

  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-border">
      <div className="section flex items-center justify-between h-16 gap-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-serif text-xl text-green-deep flex-shrink-0">
          <Leaf size={22} className="text-terra" />
          FarmDirect
        </Link>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-6 flex-1">
          {navLinks.map(l => (
            <Link key={l.href} href={l.href}
              className={`text-sm font-medium link-underline transition-colors ${pathname.startsWith(l.href) ? 'text-green-deep' : 'text-soil-mid hover:text-soil'}`}>
              {l.label}
            </Link>
          ))}
        </div>

        {/* Desktop right actions */}
        <div className="hidden md:flex items-center gap-3">
          {loading ? (
            <div className="skeleton w-20 h-8 rounded-lg" />
          ) : profile ? (
            <>
              {isConsumer && (
                <Link href="/cart" className="relative p-2 rounded-lg text-soil-mid hover:text-green-deep hover:bg-green-light transition-all">
                  <ShoppingCart size={20} />
                  {cartCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-terra text-white text-xs rounded-full flex items-center justify-center font-medium">
                      {cartCount > 9 ? '9+' : cartCount}
                    </span>
                  )}
                </Link>
              )}
              <div className="relative group">
                <button className="flex items-center gap-2 pl-1 pr-3 py-1.5 rounded-full border border-border hover:border-green-mid transition-all text-sm">
                  <div className="w-7 h-7 rounded-full bg-green-deep text-white flex items-center justify-center text-xs font-medium">
                    {profile.full_name?.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-soil-mid max-w-[100px] truncate">{profile.full_name?.split(' ')[0]}</span>
                </button>
                {/* Dropdown */}
                <div className="absolute right-0 top-full mt-2 w-52 card shadow-lg py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 origin-top-right">
                  <div className="px-4 py-2 border-b border-border">
                    <p className="text-xs font-medium text-soil truncate">{profile.full_name}</p>
                    <p className="text-xs text-muted capitalize">{profile.role}</p>
                  </div>
                  {isFarmer && (
                    <Link href="/dashboard" className="flex items-center gap-2 px-4 py-2.5 text-sm text-soil-mid hover:bg-cream hover:text-soil transition-colors">
                      <LayoutDashboard size={15} /> Dashboard
                    </Link>
                  )}
                  {isConsumer && (
                    <Link href="/orders" className="flex items-center gap-2 px-4 py-2.5 text-sm text-soil-mid hover:bg-cream hover:text-soil transition-colors">
                      <Package size={15} /> My Orders
                    </Link>
                  )}
                  <Link href="/profile" className="flex items-center gap-2 px-4 py-2.5 text-sm text-soil-mid hover:bg-cream hover:text-soil transition-colors">
                    <User size={15} /> Profile
                  </Link>
                  <div className="border-t border-border mt-1">
                    <button onClick={handleSignOut}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
                      <LogOut size={15} /> Sign out
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <Link href="/auth/login" className="btn-secondary text-sm">Sign in</Link>
              <Link href="/auth/register" className="btn-primary text-sm">Get started</Link>
            </>
          )}
        </div>

        {/* Mobile: cart + hamburger */}
        <div className="flex md:hidden items-center gap-2">
          {isConsumer && (
            <Link href="/cart" className="relative p-2 text-soil-mid">
              <ShoppingCart size={20} />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-terra text-white text-xs rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </Link>
          )}
          <button onClick={() => setMobileOpen(o => !o)} className="p-2 text-soil-mid">
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-white animate-fade-in">
          <div className="section py-4 flex flex-col gap-1">
            {navLinks.map(l => (
              <Link key={l.href} href={l.href}
                onClick={() => setMobileOpen(false)}
                className="px-3 py-2.5 rounded-lg text-sm font-medium text-soil-mid hover:bg-cream hover:text-soil transition-colors">
                {l.label}
              </Link>
            ))}
            {profile ? (
              <>
                {isConsumer && (
                  <Link href="/orders" onClick={() => setMobileOpen(false)}
                    className="px-3 py-2.5 rounded-lg text-sm font-medium text-soil-mid hover:bg-cream hover:text-soil transition-colors">
                    My Orders
                  </Link>
                )}
                <button onClick={() => { handleSignOut(); setMobileOpen(false) }}
                  className="px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 text-left transition-colors">
                  Sign out
                </button>
              </>
            ) : (
              <div className="flex gap-2 mt-2">
                <Link href="/auth/login" onClick={() => setMobileOpen(false)} className="btn-secondary flex-1 text-center text-sm">Sign in</Link>
                <Link href="/auth/register" onClick={() => setMobileOpen(false)} className="btn-primary flex-1 text-center text-sm">Get started</Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}

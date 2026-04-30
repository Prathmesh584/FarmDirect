'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Leaf, Eye, EyeOff, AlertCircle, Sprout, ShoppingBag, CheckCircle } from 'lucide-react'
import type { UserRole } from '@/types'

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [role, setRole] = useState<UserRole>((searchParams.get('role') as UserRole) ?? 'consumer')
  const [form, setForm] = useState({ fullName: '', email: '', password: '', phone: '', farmName: '' })
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!form.fullName.trim()) return setError('Full name is required')
    if (!form.email.trim()) return setError('Email is required')
    if (form.password.length < 8) return setError('Password must be at least 8 characters')
    if (!form.phone.trim()) return setError('Phone number is required')
    if (role === 'farmer' && !form.farmName.trim()) return setError('Farm name is required for farmers')

    setLoading(true)
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            full_name: form.fullName.trim(),
            role,
          },
          emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
        },
      })

      if (signUpError) {
        if (signUpError.message.includes('already registered')) {
          setError('An account with this email already exists. Please sign in.')
        } else {
          setError(signUpError.message)
        }
        return
      }

      // Update profile with phone and farm name
      if (data.user) {
        await supabase.from('profiles').update({
          phone: form.phone.trim(),
          farm_name: role === 'farmer' ? form.farmName.trim() : null,
        }).eq('id', data.user.id)
      }

      setSuccess(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-cream-dark flex items-center justify-center py-12 px-4">
        <div className="card p-10 max-w-md w-full text-center">
          <CheckCircle size={52} className="mx-auto text-green-mid mb-5" />
          <h2 className="font-serif text-2xl text-soil mb-3">Account created!</h2>
          <p className="text-muted text-sm mb-6 leading-relaxed">
            We&apos;ve sent a verification email to <strong>{form.email}</strong>.<br />
            Click the link in that email to activate your account.
          </p>
          <Link href="/auth/login" className="btn-primary w-full justify-center">
            Go to Sign In
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream-dark flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 font-serif text-2xl text-green-deep mb-6">
            <Leaf size={24} className="text-terra" /> FarmDirect
          </Link>
          <h1 className="font-serif text-3xl text-soil mb-2">Create an account</h1>
          <p className="text-muted text-sm">Join the Bhopal farm-to-table community</p>
        </div>

        <div className="card p-8">
          {/* Role selector */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            {([
              { value: 'consumer', icon: ShoppingBag, label: 'I want to buy', sub: 'Consumer' },
              { value: 'farmer',   icon: Sprout,      label: 'I want to sell', sub: 'Farmer' },
            ] as const).map(({ value, icon: Icon, label, sub }) => (
              <button
                key={value}
                type="button"
                onClick={() => setRole(value)}
                className={`p-4 rounded-xl border-2 text-left transition-all ${
                  role === value
                    ? 'border-green-deep bg-green-light'
                    : 'border-border hover:border-green-mid/50'
                }`}>
                <Icon size={20} className={role === value ? 'text-green-deep' : 'text-muted'} />
                <p className={`font-medium text-sm mt-2 ${role === value ? 'text-green-deep' : 'text-soil'}`}>{label}</p>
                <p className="text-xs text-muted">{sub}</p>
              </button>
            ))}
          </div>

          {error && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-5">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-soil-mid mb-1.5">Full name *</label>
              <input type="text" value={form.fullName} onChange={e => set('fullName', e.target.value)}
                placeholder="Ramesh Kumar" required autoComplete="name" className="input" />
            </div>

            {role === 'farmer' && (
              <div>
                <label className="block text-sm font-medium text-soil-mid mb-1.5">Farm name *</label>
                <input type="text" value={form.farmName} onChange={e => set('farmName', e.target.value)}
                  placeholder="e.g. Kumar Organic Farm" required className="input" />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-soil-mid mb-1.5">Email address *</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                placeholder="you@example.com" required autoComplete="email" className="input" />
            </div>

            <div>
              <label className="block text-sm font-medium text-soil-mid mb-1.5">Phone number *</label>
              <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)}
                placeholder="+91 98765 43210" required className="input" />
            </div>

            <div>
              <label className="block text-sm font-medium text-soil-mid mb-1.5">Password *</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => set('password', e.target.value)}
                  placeholder="Min. 8 characters"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="input pr-11"
                />
                <button type="button" onClick={() => setShowPw(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-soil">
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base mt-2">
              {loading ? (
                <span className="flex items-center gap-2 justify-center">
                  <span className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                  Creating account…
                </span>
              ) : `Create ${role} account`}
            </button>
          </form>

          <p className="text-center text-sm text-muted mt-6">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-green-mid hover:text-green-deep font-medium transition-colors">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-cream-dark flex items-center justify-center"><div className="skeleton w-96 h-96 rounded-xl" /></div>}>
      <RegisterForm />
    </Suspense>
  )
}

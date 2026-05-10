'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Leaf, User, Phone, MapPin, FileText, Tractor, Save, ArrowLeft, CheckCircle } from 'lucide-react'
import type { Profile } from '@/types'

export default function ProfilePage() {
  const router = useRouter()
  const supabase = createClient() as any

  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form fields
  const [fullName, setFullName]   = useState('')
  const [phone, setPhone]         = useState('')
  const [city, setCity]           = useState('')
  const [state, setState]         = useState('')
  const [pincode, setPincode]     = useState('')
  const [address, setAddress]     = useState('')
  const [bio, setBio]             = useState('')
  const [farmName, setFarmName]   = useState('')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (data) {
        setProfile(data as Profile)
        setFullName(data.full_name ?? '')
        setPhone(data.phone ?? '')
        setCity(data.city ?? '')
        setState(data.state ?? '')
        setPincode(data.pincode ?? '')
        setAddress(data.address ?? '')
        setBio(data.bio ?? '')
        setFarmName(data.farm_name ?? '')
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(false)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        full_name: fullName.trim(),
        phone:     phone.trim() || null,
        city:      city.trim(),
        state:     state.trim(),
        pincode:   pincode.trim() || null,
        address:   address.trim() || null,
        bio:       bio.trim() || null,
        farm_name: farmName.trim() || null,
      })
      .eq('id', user.id)

    if (updateError) {
      setError('Failed to save. Please try again.')
    } else {
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-cream-dark flex items-center justify-center">
        <div className="text-muted">Loading profile…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-cream-dark">
      {/* Header */}
      <div className="bg-green-deep text-white py-8">
        <div className="section">
          <Link href={profile?.role === 'farmer' ? '/dashboard' : '/marketplace'}
            className="inline-flex items-center gap-2 text-white/70 hover:text-white text-sm mb-4 transition-colors">
            <ArrowLeft size={16} /> Back
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
              <User size={28} className="text-white" />
            </div>
            <div>
              <h1 className="font-serif text-2xl">{profile?.full_name}</h1>
              <p className="text-white/60 text-sm capitalize">{profile?.role}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="section py-8 max-w-2xl">
        <form onSubmit={handleSave} className="space-y-6">

          {/* Success / Error */}
          {success && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 rounded-xl p-4">
              <CheckCircle size={18} /> Profile saved successfully!
            </div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
              {error}
            </div>
          )}

          {/* Basic Info */}
          <div className="card p-6 space-y-4">
            <h2 className="font-serif text-lg text-soil flex items-center gap-2">
              <User size={18} className="text-terra" /> Basic Info
            </h2>

            <div>
              <label className="block text-sm font-medium text-soil-mid mb-1.5">Full Name</label>
              <input className="input" value={fullName} onChange={e => setFullName(e.target.value)}
                placeholder="Your full name" required />
            </div>

            <div>
              <label className="block text-sm font-medium text-soil-mid mb-1.5">Phone Number</label>
              <div className="relative">
                <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input className="input pl-9" value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="9876543210" type="tel" />
              </div>
            </div>
          </div>

          {/* Farmer Info — only shown for farmers */}
          {profile?.role === 'farmer' && (
            <div className="card p-6 space-y-4">
              <h2 className="font-serif text-lg text-soil flex items-center gap-2">
                <Tractor size={18} className="text-terra" /> Farm Details
              </h2>

              <div>
                <label className="block text-sm font-medium text-soil-mid mb-1.5">Farm Name</label>
                <div className="relative">
                  <Leaf size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                  <input className="input pl-9" value={farmName} onChange={e => setFarmName(e.target.value)}
                    placeholder="e.g. Yadav Organic Farm" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-soil-mid mb-1.5">Bio</label>
                <textarea className="input min-h-[100px] resize-none" value={bio}
                  onChange={e => setBio(e.target.value)}
                  placeholder="Tell buyers about your farm, farming methods, specialities…" />
              </div>
            </div>
          )}

          {/* Address */}
          <div className="card p-6 space-y-4">
            <h2 className="font-serif text-lg text-soil flex items-center gap-2">
              <MapPin size={18} className="text-terra" /> Location
            </h2>

            <div>
              <label className="block text-sm font-medium text-soil-mid mb-1.5">Address</label>
              <input className="input" value={address} onChange={e => setAddress(e.target.value)}
                placeholder="Street / Village / Locality" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-soil-mid mb-1.5">City</label>
                <input className="input" value={city} onChange={e => setCity(e.target.value)}
                  placeholder="Bhopal" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-soil-mid mb-1.5">Pincode</label>
                <input className="input" value={pincode} onChange={e => setPincode(e.target.value)}
                  placeholder="462001" maxLength={6} />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-soil-mid mb-1.5">State</label>
              <input className="input" value={state} onChange={e => setState(e.target.value)}
                placeholder="Madhya Pradesh" required />
            </div>
          </div>

          <button type="submit" disabled={saving}
            className="btn-primary w-full py-3 flex items-center justify-center gap-2">
            <Save size={16} />
            {saving ? 'Saving…' : 'Save Profile'}
          </button>

        </form>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'

const STEPS = [
  { id: 1, title: 'Farm Details',    emoji: '🌾' },
  { id: 2, title: 'Inventory',       emoji: '📦' },
  { id: 3, title: 'Verify Identity', emoji: '🪪' },
  { id: 4, title: 'Review & Submit', emoji: '✅' },
]

const FARMING_TYPES = [
  { value: 'organic',      label: 'Fully Organic',        desc: 'No pesticides or chemical fertilisers' },
  { value: 'conventional', label: 'Conventional',         desc: 'Standard farming practices' },
  { value: 'mixed',        label: 'Mixed / Transitional', desc: 'Partial organic, working toward full organic' },
  { value: 'natural',      label: 'Natural Farming',      desc: 'Zero budget natural farming (ZBNF)' },
]

const CROP_OPTIONS = [
  'Vegetables', 'Fruits', 'Grains & Cereals', 'Pulses & Legumes',
  'Spices & Herbs', 'Dairy', 'Oilseeds', 'Sugarcane', 'Cotton', 'Flowers',
]

export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClient() as any
  const [step, setStep]             = useState(1)
  const [loading, setLoading]       = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [userId, setUserId]         = useState<string | null>(null)

  // Step 1
  const [farmName, setFarmName]       = useState('')
  const [phone, setPhone]             = useState('')
  const [city, setCity]               = useState('')
  const [state, setState]             = useState('')
  const [pincode, setPincode]         = useState('')
  const [address, setAddress]         = useState('')
  const [bio, setBio]                 = useState('')
  const [farmSize, setFarmSize]       = useState('')
  const [farmingType, setFarmingType] = useState('')

  // Step 2
  const [cropsGrown, setCropsGrown]         = useState<string[]>([])
  const [hasStorage, setHasStorage]         = useState(false)
  const [hasColdStorage, setHasColdStorage] = useState(false)
  const [hasTransport, setHasTransport]     = useState(false)

  // Step 3
  const [aadhaarNumber, setAadhaarNumber]   = useState('')
  const [aadhaarFile, setAadhaarFile]       = useState<File | null>(null)
  const [aadhaarPreview, setAadhaarPreview] = useState<string | null>(null)
  const [selfieFile, setSelfieFile]         = useState<File | null>(null)
  const [selfiePreview, setSelfiePreview]   = useState<string | null>(null)
  const aadhaarRef = useRef<HTMLInputElement>(null)
  const selfieRef  = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function check() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (!profile || profile.role !== 'farmer') { router.push('/marketplace'); return }
      if (profile.onboarding_complete) { router.push('/dashboard'); return }
      setUserId(user.id)
      setFarmName(profile.farm_name ?? '')
      setPhone(profile.phone ?? '')
      setCity(profile.city ?? '')
      setState(profile.state ?? '')
      setLoading(false)
    }
    check()
  }, [])

  const toggleCrop = (crop: string) =>
    setCropsGrown(prev => prev.includes(crop) ? prev.filter(c => c !== crop) : [...prev, crop])

  const handleFileChange = (file: File | null, setFile: (f: File | null) => void, setPreview: (s: string | null) => void) => {
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setError('File must be under 5 MB'); return }
    setFile(file); setPreview(URL.createObjectURL(file)); setError(null)
  }

  const uploadFile = async (file: File, path: string): Promise<string> => {
    const { data, error } = await supabase.storage.from('farmer-documents').upload(path, file, { upsert: true })
    if (error) throw new Error(`Upload failed: ${error.message}`)
    const { data: urlData } = supabase.storage.from('farmer-documents').getPublicUrl(data.path)
    return urlData.publicUrl
  }

  const validate = (): boolean => {
    setError(null)
    if (step === 1) {
      if (!farmName.trim()) { setError('Farm name is required'); return false }
      if (!phone.trim())    { setError('Phone number is required'); return false }
      if (!city.trim())     { setError('City is required'); return false }
      if (!state.trim())    { setError('State is required'); return false }
      if (!farmingType)     { setError('Please select your farming type'); return false }
    }
    if (step === 2 && cropsGrown.length === 0) { setError('Select at least one crop / product type'); return false }
    if (step === 3) {
      if (aadhaarNumber.replace(/\s/g, '').length !== 12) { setError('Enter a valid 12-digit Aadhaar number'); return false }
      if (!aadhaarFile) { setError('Please upload your Aadhaar card photo'); return false }
      if (!selfieFile)  { setError('Please upload a selfie for verification'); return false }
    }
    return true
  }

  const handleNext = () => { if (!validate()) return; setStep(s => s + 1); window.scrollTo(0, 0) }

  const handleSubmit = async () => {
    if (!userId) return
    setSubmitting(true); setError(null)
    try {
      const aadhaarUrl = aadhaarFile ? await uploadFile(aadhaarFile, `${userId}/aadhaar.${aadhaarFile.name.split('.').pop()}`) : null
      const selfieUrl  = selfieFile  ? await uploadFile(selfieFile,  `${userId}/selfie.${selfieFile.name.split('.').pop()}`)  : null
      const { error: err } = await supabase.from('profiles').update({
        farm_name: farmName.trim(), phone: phone.trim(), city: city.trim(),
        state: state.trim(), pincode: pincode.trim() || null, address: address.trim() || null,
        bio: bio.trim() || null, farm_size_acres: farmSize ? Number(farmSize) : null,
        farming_type: farmingType, crops_grown: cropsGrown,
        storage_facility: hasStorage, cold_storage: hasColdStorage, transport_available: hasTransport,
        aadhaar_number: aadhaarNumber.replace(/\s/g, ''), aadhaar_photo_url: aadhaarUrl, selfie_url: selfieUrl,
        onboarding_complete: true, verification_status: 'under_review',
      }).eq('id', userId)
      if (err) throw new Error(err.message)
      router.push('/dashboard')
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong. Please try again.')
    } finally { setSubmitting(false) }
  }

  const s = { fontFamily:"'DM Sans',sans-serif" }
  const green = '#2d4a1e'

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#f7f3ee', display:'flex', alignItems:'center', justifyContent:'center', ...s }}>
      <p style={{ color:'#6b7c5c', fontSize:14 }}>Loading…</p>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'#f7f3ee', ...s }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,600&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing:border-box; }
        .inp { width:100%; padding:10px 14px; border:1.5px solid #e0d8ce; border-radius:10px; background:#faf8f5; font-size:14px; color:#2c3320; outline:none; font-family:'DM Sans',sans-serif; }
        .inp:focus { border-color:#5a7a3a; background:white; }
        .inp::placeholder { color:#aaa49a; }
        textarea.inp { resize:none; }
        select.inp { appearance:none; }
        .lbl { display:block; font-size:11px; font-weight:500; color:#6b7c5c; text-transform:uppercase; letter-spacing:.05em; margin-bottom:6px; }
        .ubtn { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; padding:18px; border:2px dashed #c8c0b0; border-radius:12px; font-size:13px; color:#6b7c5c; cursor:pointer; background:#faf8f5; font-family:'DM Sans',sans-serif; width:100%; }
        .ubtn:hover { border-color:#5a7a3a; color:#3d6228; }
        @keyframes spin { to { transform:rotate(360deg); } }
      `}</style>

      {/* Header */}
      <div style={{ background:'linear-gradient(135deg,#2d4a1e,#4a6e2a)', padding:'32px 16px', textAlign:'center', color:'white' }}>
        <p style={{ fontSize:10, letterSpacing:'0.1em', textTransform:'uppercase', color:'#86efac', margin:'0 0 8px' }}>Farmer Registration</p>
        <h1 style={{ fontFamily:'Fraunces,serif', fontSize:26, fontWeight:300, margin:'0 0 6px' }}>Complete Your Profile</h1>
        <p style={{ fontSize:13, color:'#bbf7d0', margin:0 }}>Set up your farm shop in a few quick steps</p>
      </div>

      <div style={{ maxWidth:520, margin:'0 auto', padding:'24px 16px 48px' }}>

        {/* Stepper */}
        <div style={{ display:'flex', alignItems:'flex-start', marginBottom:28 }}>
          {STEPS.map((st, i) => (
            <div key={st.id} style={{ display:'flex', alignItems:'center', flex:1 }}>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', minWidth:0 }}>
                <div style={{
                  width:36, height:36, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:13, background: step >= st.id ? green : 'white',
                  color: step >= st.id ? 'white' : '#aaa49a', border: step < st.id ? '2px solid #d8d0c7' : 'none',
                  boxShadow: step === st.id ? `0 0 0 4px rgba(45,74,30,.15)` : 'none', flexShrink:0,
                }}>
                  {step > st.id ? '✓' : st.emoji}
                </div>
                <span style={{ fontSize:9, marginTop:4, color: step === st.id ? green : '#aaa49a', fontWeight: step === st.id ? 600 : 400, textAlign:'center', lineHeight:1.2 }}>
                  {st.title}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ flex:1, height:2, margin:'0 4px', marginBottom:18, background: step > st.id ? green : '#e0d8ce' }} />
              )}
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div style={{ background:'#fef2f2', border:'1px solid #fecaca', color:'#dc2626', borderRadius:12, padding:'12px 16px', fontSize:13, marginBottom:16 }}>
            ⚠️ {error}
          </div>
        )}

        {/* STEP 1 */}
        {step === 1 && (
          <div style={{ background:'white', borderRadius:16, border:'1px solid #e8e0d5', padding:24, display:'flex', flexDirection:'column', gap:16 }}>
            <h2 style={{ fontFamily:'Fraunces,serif', fontSize:20, color:'#2c3320', margin:0 }}>Tell us about your farm</h2>
            <div><label className="lbl">Farm Name *</label><input className="inp" value={farmName} onChange={e => setFarmName(e.target.value)} placeholder="e.g. Yadav Organic Farm" /></div>
            <div><label className="lbl">Phone Number *</label><input className="inp" value={phone} onChange={e => setPhone(e.target.value)} placeholder="10-digit mobile" type="tel" maxLength={10} /></div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div><label className="lbl">City *</label><input className="inp" value={city} onChange={e => setCity(e.target.value)} placeholder="Bhopal" /></div>
              <div><label className="lbl">Pincode</label><input className="inp" value={pincode} onChange={e => setPincode(e.target.value)} placeholder="462001" maxLength={6} /></div>
            </div>
            <div><label className="lbl">State *</label><input className="inp" value={state} onChange={e => setState(e.target.value)} placeholder="Madhya Pradesh" /></div>
            <div><label className="lbl">Village / Address</label><input className="inp" value={address} onChange={e => setAddress(e.target.value)} placeholder="Village, Tehsil, District" /></div>
            <div><label className="lbl">Farm Size (acres)</label><input className="inp" type="number" value={farmSize} onChange={e => setFarmSize(e.target.value)} placeholder="e.g. 5.5" min="0.1" step="0.1" /></div>
            <div><label className="lbl">About Your Farm</label><textarea className="inp" value={bio} onChange={e => setBio(e.target.value)} placeholder="Tell consumers about your farming story…" rows={3} /></div>
            <div>
              <label className="lbl">Farming Type *</label>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {FARMING_TYPES.map(ft => (
                  <label key={ft.value} style={{ display:'flex', alignItems:'flex-start', gap:12, padding:12, borderRadius:12, border: farmingType === ft.value ? `2px solid #5a7a3a` : '2px solid #e8e0d5', background: farmingType === ft.value ? '#f0f7e8' : 'white', cursor:'pointer' }}>
                    <input type="radio" name="ft" value={ft.value} checked={farmingType === ft.value} onChange={() => setFarmingType(ft.value)} style={{ marginTop:2, accentColor: green }} />
                    <div><p style={{ fontSize:13, fontWeight:500, color:'#2c3320', margin:0 }}>{ft.label}</p><p style={{ fontSize:11, color:'#8a9070', margin:'2px 0 0' }}>{ft.desc}</p></div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 2 */}
        {step === 2 && (
          <div style={{ background:'white', borderRadius:16, border:'1px solid #e8e0d5', padding:24, display:'flex', flexDirection:'column', gap:20 }}>
            <h2 style={{ fontFamily:'Fraunces,serif', fontSize:20, color:'#2c3320', margin:0 }}>Inventory & Facilities</h2>
            <div>
              <label className="lbl">What do you grow / produce? * <span style={{ textTransform:'none', color:'#aaa49a', fontWeight:400 }}>(select all)</span></label>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {CROP_OPTIONS.map(crop => (
                  <label key={crop} style={{ display:'flex', alignItems:'center', gap:10, padding:10, borderRadius:10, border: cropsGrown.includes(crop) ? '2px solid #5a7a3a' : '2px solid #e8e0d5', background: cropsGrown.includes(crop) ? '#f0f7e8' : 'white', cursor:'pointer' }}>
                    <input type="checkbox" checked={cropsGrown.includes(crop)} onChange={() => toggleCrop(crop)} style={{ accentColor: green, width:15, height:15 }} />
                    <span style={{ fontSize:13, color:'#2c3320' }}>{crop}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="lbl">Storage & Logistics</label>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {[
                  { label:'Storage Facility', desc:'Warehouse or room to store produce', val:hasStorage, set:setHasStorage },
                  { label:'Cold Storage Access', desc:'Refrigerated storage for perishables', val:hasColdStorage, set:setHasColdStorage },
                  { label:'Own Transport', desc:'Vehicle available for delivery', val:hasTransport, set:setHasTransport },
                ].map(item => (
                  <div key={item.label} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:12, background:'#faf8f5', borderRadius:12 }}>
                    <div><p style={{ fontSize:13, fontWeight:500, color:'#2c3320', margin:0 }}>{item.label}</p><p style={{ fontSize:11, color:'#8a9070', margin:'2px 0 0' }}>{item.desc}</p></div>
                    <button type="button" onClick={() => item.set(!item.val)} style={{ width:44, height:24, borderRadius:12, background: item.val ? green : '#d8d0c7', border:'none', cursor:'pointer', position:'relative', transition:'background .2s', flexShrink:0 }}>
                      <div style={{ position:'absolute', top:3, width:18, height:18, background:'white', borderRadius:'50%', boxShadow:'0 1px 3px rgba(0,0,0,.2)', transition:'transform .2s', transform: item.val ? 'translateX(20px)' : 'translateX(3px)' }} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* STEP 3 */}
        {step === 3 && (
          <div style={{ background:'white', borderRadius:16, border:'1px solid #e8e0d5', padding:24, display:'flex', flexDirection:'column', gap:20 }}>
            <div>
              <h2 style={{ fontFamily:'Fraunces,serif', fontSize:20, color:'#2c3320', margin:0 }}>Identity Verification</h2>
              <p style={{ fontSize:12, color:'#8a9070', margin:'4px 0 0' }}>Documents stored securely — never shared publicly.</p>
            </div>

            <div>
              <label className="lbl">Aadhaar Number *</label>
              <input className="inp" style={{ letterSpacing:'0.1em' }} value={aadhaarNumber}
                onChange={e => { const v = e.target.value.replace(/\D/g,'').slice(0,12); setAadhaarNumber(v.match(/.{1,4}/g)?.join(' ') ?? v) }}
                placeholder="XXXX XXXX XXXX" maxLength={14} />
              <p style={{ fontSize:11, color:'#aaa49a', marginTop:4 }}>12-digit — formatted automatically</p>
            </div>

            <div>
              <label className="lbl">Aadhaar Card Photo *</label>
              {aadhaarPreview ? (
                <div style={{ position:'relative', borderRadius:12, overflow:'hidden', aspectRatio:'16/9', background:'#f0ebe3' }}>
                  <Image src={aadhaarPreview} alt="Aadhaar" fill style={{ objectFit:'contain' }} />
                  <button type="button" onClick={() => { setAadhaarFile(null); setAadhaarPreview(null) }}
                    style={{ position:'absolute', top:8, right:8, background:'rgba(0,0,0,.6)', color:'white', border:'none', borderRadius:8, padding:'4px 10px', fontSize:12, cursor:'pointer' }}>Remove</button>
                </div>
              ) : (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <button type="button" className="ubtn" onClick={() => { if(aadhaarRef.current){aadhaarRef.current.capture='environment';aadhaarRef.current.click()} }}>📷<span>Take Photo</span></button>
                  <button type="button" className="ubtn" onClick={() => { if(aadhaarRef.current){aadhaarRef.current.removeAttribute('capture');aadhaarRef.current.click()} }}>🖼️<span>From Gallery</span></button>
                </div>
              )}
              <input ref={aadhaarRef} type="file" accept="image/*" style={{ display:'none' }}
                onChange={e => handleFileChange(e.target.files?.[0] ?? null, setAadhaarFile, setAadhaarPreview)} />
              <p style={{ fontSize:11, color:'#aaa49a', marginTop:6 }}>Front side showing your name and Aadhaar number</p>
            </div>

            <div>
              <label className="lbl">Selfie for Verification *</label>
              {selfiePreview ? (
                <div style={{ position:'relative', width:160, height:160, margin:'0 auto', borderRadius:12, overflow:'hidden', background:'#f0ebe3' }}>
                  <Image src={selfiePreview} alt="Selfie" fill style={{ objectFit:'cover' }} />
                  <button type="button" onClick={() => { setSelfieFile(null); setSelfiePreview(null) }}
                    style={{ position:'absolute', top:8, right:8, background:'rgba(0,0,0,.6)', color:'white', border:'none', borderRadius:8, padding:'4px 10px', fontSize:12, cursor:'pointer' }}>Retake</button>
                </div>
              ) : (
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <button type="button" className="ubtn" onClick={() => { if(selfieRef.current){selfieRef.current.capture='user';selfieRef.current.click()} }}>🤳<span>Take Selfie</span></button>
                  <button type="button" className="ubtn" onClick={() => { if(selfieRef.current){selfieRef.current.removeAttribute('capture');selfieRef.current.click()} }}>🖼️<span>From Gallery</span></button>
                </div>
              )}
              <input ref={selfieRef} type="file" accept="image/*" style={{ display:'none' }}
                onChange={e => handleFileChange(e.target.files?.[0] ?? null, setSelfieFile, setSelfiePreview)} />
              <p style={{ fontSize:11, color:'#aaa49a', marginTop:6 }}>Clear face photo — compared against your Aadhaar</p>
            </div>

            <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:12, padding:14, fontSize:12, color:'#1d4ed8', lineHeight:1.6 }}>
              🔒 <strong>Privacy:</strong> Your Aadhaar is encrypted before storage. Photos are in a private bucket, accessible only to FarmDirect admins for review.
            </div>
          </div>
        )}

        {/* STEP 4 — Review */}
        {step === 4 && (
          <div style={{ background:'white', borderRadius:16, border:'1px solid #e8e0d5', padding:24 }}>
            <h2 style={{ fontFamily:'Fraunces,serif', fontSize:20, color:'#2c3320', margin:'0 0 16px' }}>Review & Submit</h2>
            {[
              { label:'Farm Name',    value: farmName },
              { label:'Phone',        value: phone },
              { label:'Location',     value: `${city}, ${state}${pincode ? ` — ${pincode}` : ''}` },
              { label:'Address',      value: address || '—' },
              { label:'Farm Size',    value: farmSize ? `${farmSize} acres` : '—' },
              { label:'Farming Type', value: FARMING_TYPES.find(f => f.value === farmingType)?.label ?? '—' },
              { label:'Produces',     value: cropsGrown.join(', ') || '—' },
              { label:'Facilities',   value: [hasStorage && 'Storage', hasColdStorage && 'Cold Storage', hasTransport && 'Transport'].filter(Boolean).join(', ') || 'None' },
              { label:'Aadhaar',      value: aadhaarNumber },
              { label:'Documents',    value: [aadhaarFile && 'Aadhaar ✓', selfieFile && 'Selfie ✓'].filter(Boolean).join(', ') },
            ].map(row => (
              <div key={row.label} style={{ display:'flex', gap:12, padding:'10px 0', borderBottom:'1px solid #f0e8dc' }}>
                <span style={{ fontSize:12, color:'#8a9070', width:100, flexShrink:0 }}>{row.label}</span>
                <span style={{ fontSize:13, color:'#2c3320', fontWeight:500 }}>{row.value}</span>
              </div>
            ))}
            <div style={{ background:'#f0f7e8', border:'1px solid #c8d8b0', borderRadius:12, padding:14, fontSize:13, color:'#3d6228', marginTop:16, lineHeight:1.6 }}>
              📋 Your profile will be reviewed within <strong>24–48 hours</strong>. You can start adding products right away while verification is in progress.
            </div>
          </div>
        )}

        {/* Buttons */}
        <div style={{ display:'flex', gap:12, marginTop:20 }}>
          {step > 1 && (
            <button onClick={() => setStep(s => s - 1)}
              style={{ flex:1, background:'white', color:'#4a5a35', border:'1.5px solid #c8d0b8', borderRadius:12, padding:13, fontSize:15, fontWeight:500, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
              ← Back
            </button>
          )}
          {step < 4 ? (
            <button onClick={handleNext}
              style={{ flex:1, background: green, color:'white', border:'none', borderRadius:12, padding:13, fontSize:15, fontWeight:500, cursor:'pointer', fontFamily:"'DM Sans',sans-serif" }}>
              Continue →
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={submitting}
              style={{ flex:1, background: green, color:'white', border:'none', borderRadius:12, padding:13, fontSize:15, fontWeight:500, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1, fontFamily:"'DM Sans',sans-serif" }}>
              {submitting
                ? <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                    <span style={{ width:16, height:16, border:'2px solid rgba(255,255,255,.4)', borderTopColor:'white', borderRadius:'50%', animation:'spin 1s linear infinite', display:'inline-block' }} />
                    Submitting…
                  </span>
                : 'Submit & Go to Dashboard 🚀'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

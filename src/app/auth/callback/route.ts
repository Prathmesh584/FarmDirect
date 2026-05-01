import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = (await createClient()) as any
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      // Redirect farmer to dashboard, consumer to marketplace
      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', data.user.id).single()

      const redirectPath = profile?.role === 'farmer' ? '/dashboard' : '/marketplace'
      return NextResponse.redirect(`${origin}${redirectPath}`)
    }
  }

  // Error fallback
  return NextResponse.redirect(`${origin}/auth/login?error=verification_failed`)
}

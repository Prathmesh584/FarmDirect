import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ApiResponse, Product } from '@/types'

type Params = { params: Promise<{ id: string }> }

// ─── GET /api/products/[id] ───────────────────────────────────
export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = (await createClient()) as any

    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        farmer:profiles!farmer_id(id, full_name, farm_name, city, bio, avatar_url, is_verified),
        reviews(id, rating, comment, created_at, consumer:profiles!consumer_id(full_name, avatar_url))
      `)
      .eq('id', id)
      .single()

    if (error) {
      const status = error.code === 'PGRST116' ? 404 : 500
      return NextResponse.json<ApiResponse<null>>(
        { data: null, error: status === 404 ? 'Product not found' : 'Failed to fetch product' },
        { status }
      )
    }

    const reviews = (data as any).reviews as Array<{ rating: number }> | undefined
    const product = {
      ...data,
      avg_rating: reviews?.length
        ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
        : null,
      review_count: reviews?.length ?? 0,
    }

    return NextResponse.json<ApiResponse<Product>>({ data: product as unknown as Product, error: null })
  } catch (err) {
    console.error('[GET /api/products/:id] unexpected', err)
    return NextResponse.json<ApiResponse<null>>(
      { data: null, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ─── PATCH /api/products/[id] ─────────────────────────────────
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = (await createClient()) as any

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json<ApiResponse<null>>(
        { data: null, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify ownership (RLS also enforces, but explicit check gives better error message)
    const { data: existing } = await supabase
      .from('products')
      .select('farmer_id')
      .eq('id', id)
      .single()

    if (!existing) {
      return NextResponse.json<ApiResponse<null>>(
        { data: null, error: 'Product not found' },
        { status: 404 }
      )
    }

    if (existing.farmer_id !== user.id) {
      return NextResponse.json<ApiResponse<null>>(
        { data: null, error: 'You can only edit your own products' },
        { status: 403 }
      )
    }

    const body = await request.json()

    // Whitelist updatable fields
    const allowedFields = [
      'name', 'description', 'price_per_unit', 'unit', 'stock_quantity',
      'min_order_qty', 'images', 'is_organic', 'is_available', 'harvest_date',
      'tags', 'category',
    ]
    const updates: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) updates[field] = body[field]
    }

    if (updates.price_per_unit !== undefined && Number(updates.price_per_unit) <= 0) {
      return NextResponse.json<ApiResponse<null>>(
        { data: null, error: 'Price must be greater than 0' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('[PATCH /api/products/:id]', error)
      return NextResponse.json<ApiResponse<null>>(
        { data: null, error: 'Failed to update product' },
        { status: 500 }
      )
    }

    return NextResponse.json<ApiResponse<Product>>({ data: data as unknown as Product, error: null })
  } catch (err) {
    console.error('[PATCH /api/products/:id] unexpected', err)
    return NextResponse.json<ApiResponse<null>>(
      { data: null, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ─── DELETE /api/products/[id] ────────────────────────────────
export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = (await createClient()) as any

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json<ApiResponse<null>>(
        { data: null, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if product has associated orders — block deletion to preserve history
    const { count: orderCount } = await supabase
      .from('order_items')
      .select('*', { count: 'exact', head: true })
      .eq('product_id', id)

    if (orderCount && orderCount > 0) {
      // Soft-delete: mark unavailable instead
      const { error } = await supabase
        .from('products')
        .update({ is_available: false })
        .eq('id', id)
        .eq('farmer_id', user.id)

      if (error) throw error
      return NextResponse.json({ data: { softDeleted: true }, error: null })
    }

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id)
      .eq('farmer_id', user.id) // RLS double-check

    if (error) {
      console.error('[DELETE /api/products/:id]', error)
      return NextResponse.json<ApiResponse<null>>(
        { data: null, error: 'Failed to delete product' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: { deleted: true }, error: null })
  } catch (err) {
    console.error('[DELETE /api/products/:id] unexpected', err)
    return NextResponse.json<ApiResponse<null>>(
      { data: null, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

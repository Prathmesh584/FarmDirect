import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ProductFilters, ApiResponse, Product } from '@/types'

// ─── GET /api/products ────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const filters: ProductFilters = {
      category:  searchParams.get('category') as ProductFilters['category'] ?? 'all',
      search:    searchParams.get('search') ?? undefined,
      minPrice:  searchParams.get('minPrice') ? Number(searchParams.get('minPrice')) : undefined,
      maxPrice:  searchParams.get('maxPrice') ? Number(searchParams.get('maxPrice')) : undefined,
      isOrganic: searchParams.get('isOrganic') === 'true' ? true : undefined,
      sortBy:    searchParams.get('sortBy') as ProductFilters['sortBy'] ?? 'newest',
      page:      Number(searchParams.get('page') ?? 1),
    }

    const pageSize = 12
    const from = (filters.page! - 1) * pageSize
    const to = from + pageSize - 1

    let query = supabase
      .from('products')
      .select(`
        *,
        farmer:profiles!farmer_id(id, full_name, farm_name, city, is_verified),
        reviews(rating)
      `, { count: 'exact' })
      .eq('is_available', true)
      .gt('stock_quantity', 0)

    // Category filter
    if (filters.category && filters.category !== 'all') {
      query = query.eq('category', filters.category)
    }

    // Full-text search
    if (filters.search?.trim()) {
      query = query.textSearch('name', filters.search.trim(), { type: 'websearch' })
    }

    // Price range
    if (filters.minPrice !== undefined) query = query.gte('price_per_unit', filters.minPrice)
    if (filters.maxPrice !== undefined) query = query.lte('price_per_unit', filters.maxPrice)

    // Organic filter
    if (filters.isOrganic) query = query.eq('is_organic', true)

    // Sorting
    switch (filters.sortBy) {
      case 'price_asc':  query = query.order('price_per_unit', { ascending: true }); break
      case 'price_desc': query = query.order('price_per_unit', { ascending: false }); break
      case 'newest':
      default:           query = query.order('created_at', { ascending: false }); break
    }

    const { data, error, count } = await query.range(from, to)

    if (error) {
      console.error('[GET /api/products]', error)
      return NextResponse.json<ApiResponse<null>>(
        { data: null, error: 'Failed to fetch products' },
        { status: 500 }
      )
    }

    // Compute avg_rating inline (avoids a separate RPC)
    const products = (data ?? []).map((p: any) => ({
      ...p,
      avg_rating: p.reviews?.length
        ? p.reviews.reduce((s: number, r: any) => s + r.rating, 0) / p.reviews.length
        : null,
      review_count: p.reviews?.length ?? 0,
      reviews: undefined, // strip raw array from response
    }))

    return NextResponse.json({
      data: products,
      count: count ?? 0,
      page: filters.page,
      pageSize,
      error: null,
    })
  } catch (err) {
    console.error('[GET /api/products] unexpected', err)
    return NextResponse.json<ApiResponse<null>>(
      { data: null, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ─── POST /api/products ───────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Auth check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json<ApiResponse<null>>(
        { data: null, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Role check
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'farmer') {
      return NextResponse.json<ApiResponse<null>>(
        { data: null, error: 'Only farmers can list products' },
        { status: 403 }
      )
    }

    const body = await request.json()

    // Validate required fields
    const required = ['name', 'category', 'price_per_unit', 'unit', 'stock_quantity']
    for (const field of required) {
      if (body[field] === undefined || body[field] === '') {
        return NextResponse.json<ApiResponse<null>>(
          { data: null, error: `Missing required field: ${field}` },
          { status: 400 }
        )
      }
    }

    if (Number(body.price_per_unit) <= 0) {
      return NextResponse.json<ApiResponse<null>>(
        { data: null, error: 'Price must be greater than 0' },
        { status: 400 }
      )
    }

    if (Number(body.stock_quantity) < 0) {
      return NextResponse.json<ApiResponse<null>>(
        { data: null, error: 'Stock quantity cannot be negative' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('products')
      .insert({
        farmer_id:      user.id,
        name:           String(body.name).trim(),
        description:    body.description ? String(body.description).trim() : null,
        category:       body.category,
        price_per_unit: Number(body.price_per_unit),
        unit:           String(body.unit),
        stock_quantity: Number(body.stock_quantity),
        min_order_qty:  Number(body.min_order_qty ?? 1),
        images:         Array.isArray(body.images) ? body.images : [],
        is_organic:     Boolean(body.is_organic),
        harvest_date:   body.harvest_date || null,
        tags:           Array.isArray(body.tags) ? body.tags : [],
      })
      .select()
      .single()

    if (error) {
      console.error('[POST /api/products]', error)
      return NextResponse.json<ApiResponse<null>>(
        { data: null, error: 'Failed to create product' },
        { status: 500 }
      )
    }

    return NextResponse.json<ApiResponse<Product>>(
      { data: data as unknown as Product, error: null },
      { status: 201 }
    )
  } catch (err) {
    console.error('[POST /api/products] unexpected', err)
    return NextResponse.json<ApiResponse<null>>(
      { data: null, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

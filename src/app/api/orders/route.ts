import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import type { ApiResponse, Order, CheckoutFormData } from '@/types'

// ─── GET /api/orders ──────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const supabase = (await createClient()) as any
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json<ApiResponse<null>>(
        { data: null, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    let query = supabase
      .from('orders')
      .select(`
        *,
        items:order_items(
          *,
          product:products(id, name, images, unit, category),
          farmer:profiles!farmer_id(id, full_name, farm_name)
        )
      `)
      .order('created_at', { ascending: false })

    // Farmers see orders that contain their products
    if (profile?.role === 'farmer') {
      // Supabase doesn't support nested filter this way — fetch via join
      const { data: farmerOrderIds } = await supabase
        .from('order_items')
        .select('order_id')
        .eq('farmer_id', user.id)

      const ids = [...new Set((farmerOrderIds ?? []).map((r: any) => r.order_id))]
      if (ids.length === 0) return NextResponse.json({ data: [], error: null })
      query = query.in('id', ids)
    } else {
      query = query.eq('consumer_id', user.id)
    }

    const { data, error } = await query

    if (error) {
      console.error('[GET /api/orders]', error)
      return NextResponse.json<ApiResponse<null>>(
        { data: null, error: 'Failed to fetch orders' },
        { status: 500 }
      )
    }

    return NextResponse.json({ data: data ?? [], error: null })
  } catch (err) {
    console.error('[GET /api/orders] unexpected', err)
    return NextResponse.json<ApiResponse<null>>(
      { data: null, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// ─── POST /api/orders ─────────────────────────────────────────
// Escrow order creation flow:
// 1. Validate consumer auth
// 2. Fetch cart items
// 3. Validate stock for each item (edge case: concurrent purchases)
// 4. Create order + order_items in a transaction
// 5. Atomically decrement stock using DB function
// 6. Clear cart
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient() as any
    const adminClient = createAdminClient() as any// bypasses RLS for atomic ops

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json<ApiResponse<null>>(
        { data: null, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Ensure consumer role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'consumer') {
      return NextResponse.json<ApiResponse<null>>(
        { data: null, error: 'Only consumers can place orders' },
        { status: 403 }
      )
    }

    const body = await request.json() as CheckoutFormData & { cartItems?: Array<{ product_id: string; quantity: number }> }

    // Validate delivery info
    if (!body.delivery_address?.trim()) {
      return NextResponse.json<ApiResponse<null>>(
        { data: null, error: 'Delivery address is required' },
        { status: 400 }
      )
    }

    // Fetch cart items from DB (source of truth — not client)
    const { data: cartItems, error: cartError } = await supabase
      .from('cart_items')
      .select('*, product:products(id, price_per_unit, unit, stock_quantity, farmer_id, is_available, name)')
      .eq('consumer_id', user.id)

    if (cartError) throw cartError

    // Edge case: empty cart
    if (!cartItems || cartItems.length === 0) {
      return NextResponse.json<ApiResponse<null>>(
        { data: null, error: 'Your cart is empty' },
        { status: 400 }
      )
    }

    // Validate each item's stock
    const stockErrors: string[] = []
    for (const item of cartItems) {
      const product = item.product as any
      if (!product.is_available) {
        stockErrors.push(`"${product.name}" is no longer available`)
        continue
      }
      if (product.stock_quantity < item.quantity) {
        stockErrors.push(
          `"${product.name}" only has ${product.stock_quantity} ${product.unit} left (you want ${item.quantity})`
        )
      }
    }

    if (stockErrors.length > 0) {
      return NextResponse.json<ApiResponse<null>>(
        { data: null, error: stockErrors.join('; ') },
        { status: 409 } // Conflict
      )
    }

    // Calculate total
    const total = cartItems.reduce((sum: number, item: any) => {
      const product = item.product as any
      return sum + product.price_per_unit * item.quantity
    }, 0)

    // Create order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        consumer_id:      user.id,
        status:           'pending_payment',
        total_amount:     total,
        delivery_address: body.delivery_address.trim(),
        delivery_city:    body.delivery_city?.trim() ?? 'Bhopal',
        delivery_pincode: body.delivery_pincode?.trim() ?? null,
        notes:            body.notes?.trim() ?? null,
      })
      .select()
      .single()

    if (orderError) throw orderError

    // Create order items
    const orderItems = cartItems.map((item: any) => {
      const product = item.product as any
      return {
        order_id:   order.id,
        product_id: product.id,
        farmer_id:  product.farmer_id,
        quantity:   item.quantity,
        unit_price: product.price_per_unit,
      }
    })

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems)

    if (itemsError) {
      // Rollback order
      await supabase.from('orders').delete().eq('id', order.id)
      throw itemsError
    }

    // Atomically decrement stock for each product using DB function
    // This prevents race conditions when multiple users buy simultaneously
    const stockUpdateErrors: string[] = []
    for (const item of cartItems) {
      const product = item.product as any
      const { error: stockError } = await adminClient.rpc('decrement_stock', {
        p_product_id: product.id,
        p_quantity:   item.quantity,
      })
      if (stockError) {
        stockUpdateErrors.push(product.name)
      }
    }

    // If stock decrement fails for any item, cancel order and surface error
    if (stockUpdateErrors.length > 0) {
      await supabase.from('orders').update({ status: 'cancelled' }).eq('id', order.id)
      return NextResponse.json<ApiResponse<null>>(
        {
          data: null,
          error: `Stock conflict for: ${stockUpdateErrors.join(', ')}. Order cancelled. Please refresh and try again.`,
        },
        { status: 409 }
      )
    }

    // Clear cart
    await supabase.from('cart_items').delete().eq('consumer_id', user.id)

    // Mark order as paid (in a real app, integrate Razorpay/UPI here and mark after webhook)
    await supabase.from('orders').update({ status: 'paid' }).eq('id', order.id)

    return NextResponse.json<ApiResponse<Order>>(
      { data: order as unknown as Order, error: null },
      { status: 201 }
    )
  } catch (err) {
    console.error('[POST /api/orders] unexpected', err)
    return NextResponse.json<ApiResponse<null>>(
      { data: null, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

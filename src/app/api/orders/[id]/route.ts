import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ApiResponse, Order } from '@/types'

type Params = { params: Promise<{ id: string }> }

// ─── PATCH /api/orders/[id] ───────────────────────────────────
// Actions:
//  { action: 'confirm_delivery' }  → Consumer confirms receipt → releases escrow
//  { action: 'cancel' }            → Consumer/farmer cancels (only before shipped)
//  { action: 'update_status', status } → Farmer updates shipping status
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json<ApiResponse<null>>(
        { data: null, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const [profileResult, orderResult] = await Promise.all([
      supabase.from('profiles').select('role').eq('id', user.id).single(),
      supabase.from('orders').select('*, items:order_items(farmer_id)').eq('id', id).single(),
    ])

    const profile = profileResult.data
    const order = orderResult.data

    if (!order) {
      return NextResponse.json<ApiResponse<null>>(
        { data: null, error: 'Order not found' },
        { status: 404 }
      )
    }

    // Authorization: consumer owns the order, or farmer has items in it
    const isConsumer = profile?.role === 'consumer' && order.consumer_id === user.id
    const isFarmer = profile?.role === 'farmer' &&
      (order.items as any[])?.some((item: any) => item.farmer_id === user.id)

    if (!isConsumer && !isFarmer) {
      return NextResponse.json<ApiResponse<null>>(
        { data: null, error: 'Access denied' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { action } = body

    // ── Confirm delivery (consumer) ──────────────────────────
    if (action === 'confirm_delivery') {
      if (!isConsumer) {
        return NextResponse.json<ApiResponse<null>>(
          { data: null, error: 'Only the consumer can confirm delivery' },
          { status: 403 }
        )
      }

      if (!['delivered', 'shipped'].includes(order.status)) {
        return NextResponse.json<ApiResponse<null>>(
          { data: null, error: `Cannot confirm delivery for order in status: ${order.status}` },
          { status: 400 }
        )
      }

      const { data, error } = await supabase
        .from('orders')
        .update({
          status:            'completed',
          delivered_at:      new Date().toISOString(),
          escrow_released_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return NextResponse.json<ApiResponse<Order>>({ data: data as unknown as Order, error: null })
    }

    // ── Cancel order ─────────────────────────────────────────
    if (action === 'cancel') {
      const cancellableStatuses = ['pending_payment', 'paid', 'processing']
      if (!cancellableStatuses.includes(order.status)) {
        return NextResponse.json<ApiResponse<null>>(
          { data: null, error: `Order cannot be cancelled in status: ${order.status}` },
          { status: 400 }
        )
      }

      // Restore stock for cancelled orders
      const { data: items } = await supabase
        .from('order_items')
        .select('product_id, quantity')
        .eq('order_id', id)

      if (items) {
        for (const item of items) {
          await supabase
            .from('products')
            .update({ stock_quantity: supabase.rpc('stock_quantity + ' + item.quantity as any) })
            .eq('id', item.product_id)
        }
        // Simpler: use a raw increment
        for (const item of items) {
          await supabase.rpc('decrement_stock', {
            p_product_id: item.product_id,
            p_quantity: -item.quantity, // negative = add back
          }).catch(() => {
            // If the function fails, do a direct update
            supabase.from('products')
              .select('stock_quantity')
              .eq('id', item.product_id)
              .single()
              .then(({ data: p }) => {
                if (p) {
                  supabase.from('products')
                    .update({ stock_quantity: (p as any).stock_quantity + item.quantity })
                    .eq('id', item.product_id)
                }
              })
          })
        }
      }

      const { data, error } = await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return NextResponse.json<ApiResponse<Order>>({ data: data as unknown as Order, error: null })
    }

    // ── Farmer: update shipping status ───────────────────────
    if (action === 'update_status' && isFarmer) {
      const { status: newStatus } = body
      const farmerAllowedStatuses = ['processing', 'shipped', 'delivered']

      if (!farmerAllowedStatuses.includes(newStatus)) {
        return NextResponse.json<ApiResponse<null>>(
          { data: null, error: `Invalid status: ${newStatus}` },
          { status: 400 }
        )
      }

      const { data, error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return NextResponse.json<ApiResponse<Order>>({ data: data as unknown as Order, error: null })
    }

    return NextResponse.json<ApiResponse<null>>(
      { data: null, error: 'Unknown action' },
      { status: 400 }
    )
  } catch (err) {
    console.error('[PATCH /api/orders/:id] unexpected', err)
    return NextResponse.json<ApiResponse<null>>(
      { data: null, error: 'Internal server error' },
      { status: 500 }
    )
  }
}

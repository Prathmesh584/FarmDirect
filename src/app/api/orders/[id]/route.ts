import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ApiResponse, Order } from '@/types'

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params

    // Cast to any to bypass Supabase generated-type inference issues
    // on complex joined queries and update payloads
    const supabase = (await createClient()) as any

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

    const profileRole: string | null = profileResult.data?.role ?? null
    const order: any = orderResult.data

    if (!order) {
      return NextResponse.json<ApiResponse<null>>(
        { data: null, error: 'Order not found' },
        { status: 404 }
      )
    }

    const isConsumer: boolean = profileRole === 'consumer' && order.consumer_id === user.id
    const isFarmer: boolean =
      profileRole === 'farmer' &&
      (order.items ?? []).some((item: any) => item.farmer_id === user.id)

    if (!isConsumer && !isFarmer) {
      return NextResponse.json<ApiResponse<null>>(
        { data: null, error: 'Access denied' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const action: string = body.action

    // ── Confirm delivery (consumer only) ────────────────────
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
          status: 'completed',
          delivered_at: new Date().toISOString(),
          escrow_released_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return NextResponse.json<ApiResponse<Order>>({ data: data as Order, error: null })
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

      // Restore stock for each item
      const { data: items } = await supabase
        .from('order_items')
        .select('product_id, quantity')
        .eq('order_id', id)

      for (const item of (items ?? []) as any[]) {
        const { data: product } = await supabase
          .from('products')
          .select('stock_quantity')
          .eq('id', item.product_id)
          .single()

        if (product) {
          await supabase
            .from('products')
            .update({ stock_quantity: product.stock_quantity + item.quantity })
            .eq('id', item.product_id)
        }
      }

      const { data, error } = await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return NextResponse.json<ApiResponse<Order>>({ data: data as Order, error: null })
    }

    // ── Farmer: update shipping status ───────────────────────
    if (action === 'update_status' && isFarmer) {
      const newStatus: string = body.status
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
      return NextResponse.json<ApiResponse<Order>>({ data: data as Order, error: null })
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
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type TableDef<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: []
}

export type Database = {
  public: {
    Tables: {
      profiles: TableDef<
        {
          id: string
          email: string | null
          first_name: string | null
          last_name: string | null
          phone: string | null
          role: 'customer' | 'admin'
          created_at: string
          updated_at: string
        },
        {
          id: string
          email?: string | null
          first_name?: string | null
          last_name?: string | null
          phone?: string | null
          role?: 'customer' | 'admin'
        }
      >
      addresses: TableDef<{
        id: string
        user_id: string
        title: string | null
        first_name: string
        last_name: string
        phone: string
        city: string
        district: string | null
        neighborhood: string | null
        address_line: string
        postal_code: string | null
        is_default: boolean
        created_at: string
        updated_at: string
      }>
      inventory: TableDef<{
        id: string
        sku: string
        product_id: string
        variant_id: string | null
        quantity: number
        reserved_quantity: number
        updated_at: string
      }>
      carts: TableDef<{
        id: string
        user_id: string | null
        guest_token: string | null
        coupon_code: string | null
        created_at: string
        updated_at: string
      }>
      cart_items: TableDef<{
        id: string
        cart_id: string
        product_id: string
        variant_id: string | null
        sku: string
        quantity: number
        created_at: string
        updated_at: string
      }>
      favorites: TableDef<{
        id: string
        user_id: string
        product_id: string
        created_at: string
      }>
      coupons: TableDef<{
        id: string
        code: string
        type: 'percent' | 'fixed'
        value: number
        min_subtotal: number | null
        max_discount: number | null
        starts_at: string | null
        ends_at: string | null
        usage_limit: number | null
        per_user_limit: number | null
        is_active: boolean
        created_at: string
      }>
      coupon_usages: TableDef<{
        id: string
        coupon_id: string
        user_id: string | null
        order_id: string | null
        guest_email: string | null
        used_at: string
      }>
      orders: TableDef<{
        id: string
        order_number: string
        user_id: string | null
        guest_email: string | null
        cart_id: string | null
        status:
          | 'pending_payment'
          | 'payment_received'
          | 'preparing'
          | 'shipped'
          | 'delivered'
          | 'cancelled'
          | 'returned'
        payment_status: 'pending' | 'authorized' | 'paid' | 'failed' | 'refunded' | 'partially_refunded'
        subtotal: number
        discount_total: number
        shipping_cost: number
        total: number
        currency: string
        coupon_code: string | null
        shipping_method: string | null
        shipping_address: Json
        billing_address: Json | null
        tracking_number: string | null
        notes: string | null
        idempotency_key: string | null
        created_at: string
        updated_at: string
      }>
      order_items: TableDef<{
        id: string
        order_id: string
        product_id: string
        product_name_snapshot: string
        product_sku_snapshot: string
        product_image_snapshot: string | null
        unit_price_snapshot: number
        quantity: number
        variant_snapshot: Json | null
        created_at: string
      }>
      payments: TableDef<{
        id: string
        order_id: string
        provider: string
        provider_payment_id: string | null
        amount: number
        currency: string
        status: 'pending' | 'authorized' | 'paid' | 'failed' | 'refunded' | 'partially_refunded'
        raw_response: Json | null
        idempotency_key: string | null
        created_at: string
        updated_at: string
      }>
      reviews: TableDef<{
        id: string
        user_id: string
        product_id: string
        order_id: string
        rating: number
        title: string | null
        comment: string | null
        verified_purchase: boolean
        is_approved: boolean
        created_at: string
      }>
      return_requests: TableDef<{
        id: string
        order_id: string
        user_id: string
        status:
          | 'requested'
          | 'reviewing'
          | 'approved'
          | 'rejected'
          | 'awaiting_shipment'
          | 'received'
          | 'refunded'
        reason: string
        description: string | null
        admin_notes: string | null
        created_at: string
        updated_at: string
      }>
      return_items: TableDef<{
        id: string
        return_request_id: string
        order_item_id: string
        quantity: number
        photo_urls: string[] | null
      }>
      inventory_ledger: TableDef<{
        id: string
        sku: string
        order_id: string | null
        delta: number
        reason: string
        idempotency_key: string
        created_at: string
      }>
    }
    Views: Record<string, never>
    Functions: {
      reserve_inventory: {
        Args: { p_sku: string; p_qty: number; p_idempotency_key: string }
        Returns: boolean
      }
      commit_inventory: {
        Args: { p_sku: string; p_qty: number; p_order_id: string; p_idempotency_key: string }
        Returns: boolean
      }
      release_inventory: {
        Args: { p_sku: string; p_qty: number; p_idempotency_key: string }
        Returns: boolean
      }
      is_admin: {
        Args: Record<string, never>
        Returns: boolean
      }
    }
    Enums: {
      order_status:
        | 'pending_payment'
        | 'payment_received'
        | 'preparing'
        | 'shipped'
        | 'delivered'
        | 'cancelled'
        | 'returned'
      payment_status: 'pending' | 'authorized' | 'paid' | 'failed' | 'refunded' | 'partially_refunded'
      return_status:
        | 'requested'
        | 'reviewing'
        | 'approved'
        | 'rejected'
        | 'awaiting_shipment'
        | 'received'
        | 'refunded'
    }
    CompositeTypes: Record<string, never>
  }
}

export type OrderStatus = Database['public']['Tables']['orders']['Row']['status']
export type PaymentStatus = Database['public']['Tables']['orders']['Row']['payment_status']

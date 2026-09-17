export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending_payment: 'Ödeme Bekleniyor',
  payment_received: 'Ödeme Alındı',
  preparing: 'Hazırlanıyor',
  shipped: 'Kargoya Verildi',
  delivered: 'Teslim Edildi',
  cancelled: 'İptal Edildi',
  returned: 'İade Edildi',
}

export const RETURN_STATUS_LABELS: Record<string, string> = {
  requested: 'Talep oluşturuldu',
  reviewing: 'İnceleniyor',
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
  awaiting_shipment: 'Kargoya verilmesi bekleniyor',
  received: 'Ürün ulaştı',
  refunded: 'Ücret iade edildi',
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'قيد الانتظار',
  accepted: 'تم قبول طلبك',
  preparing: 'جاري التجهيز',
  on_the_way: 'في الطريق إليك',
  delivered: 'تم التوصيل',
  cancelled: 'ملغي',
};

export function getOrderStatusNotification(status: string): { title: string; body: string } {
  switch (status) {
    case 'accepted':
      return {
        title: 'تم قبول طلبك ✅',
        body: 'تمت الموافقة على طلبك وسيتم تجهيزه قريباً',
      };
    case 'preparing':
      return {
        title: 'جاري تجهيز طلبك 👨‍🍳',
        body: 'طلبك قيد التجهيز الآن',
      };
    case 'on_the_way':
      return {
        title: 'طلبك في الطريق 🚚',
        body: 'السائق في طريقه إليك، استعد لاستلام الطلب',
      };
    case 'pending':
      return {
        title: 'تم استلام طلبك 📦',
        body: 'طلبك قيد المراجعة وسنبلغك عند الموافقة',
      };
    case 'cancelled':
      return {
        title: 'تم إلغاء طلبك ❌',
        body: 'نعتذر، تم إلغاء طلبك. للاستفسار تواصل معنا',
      };
    default:
      return {
        title: 'تحديث على طلبك',
        body: ORDER_STATUS_LABELS[status] || 'تم تحديث حالة طلبك',
      };
  }
}

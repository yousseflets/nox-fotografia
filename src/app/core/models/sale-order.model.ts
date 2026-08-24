export type SalePaymentMethod = 'pix' | 'credit_card';
export type SaleOrderStatus = 'pending' | 'paid' | 'cancelled' | 'failed';

export interface SaleOrderItem {
  photoId: string;
  eventId: string;
  filename: string;
  previewUrl: string;
  priceCents: number;
}

export interface SaleOrderBuyer {
  name: string;
  email: string;
  phone: string;
  cpf: string;
}

export interface SaleOrder {
  id?: string;
  eventId: string;
  eventTitle: string;
  items: SaleOrderItem[];
  buyer: SaleOrderBuyer;
  paymentMethod: SalePaymentMethod;
  status: SaleOrderStatus;
  totalCents: number;
  mpPreferenceId?: string;
  mpPaymentId?: string;
  accessToken?: string;
  createdAt: string;
  paidAt?: string;
}

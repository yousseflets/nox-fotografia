export type SalePaymentMethod = 'pix' | 'credit_card';
export type SaleOrderStatus = 'pending' | 'paid' | 'cancelled' | 'failed';

export const SALE_ORDER_STATUS_LABELS: Record<SaleOrderStatus, string> = {
  pending: 'Aguardando Pix',
  paid: 'Pago',
  cancelled: 'Cancelado',
  failed: 'Falhou',
};

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

export interface SaleOrderDownloadFile {
  filename: string;
  url: string;
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
  downloadFiles?: SaleOrderDownloadFile[];
}

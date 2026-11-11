import { CurrencyCode } from '../types';

export interface ProviderQuoteRequest {
  fromAmount: string;
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  recipientEmail?: string;
}

export interface ProviderQuoteResponse {
  isQuoteAvailable: boolean;
  quoteId: string | null;
  quotedAmount: string | null;
  quotedCurrency: CurrencyCode | null;
  providerFxRate: string | null;
  expiresAt: string | null;
  status: 'QUOTE_AVAILABLE' | 'UNAVAILABLE' | 'QUOTE_EXPIRED';
  unavailableReason?: string;
  transparencyNote: string;
}

export interface CreateOrderRequest {
  transferId: string;
  amount: string;
  currency: CurrencyCode;
  description: string;
  customId?: string;
  returnUrl?: string;
  cancelUrl?: string;
}

export interface CreateOrderResponse {
  providerOrderId: string;
  approvalUrl?: string;
  status: string;
}

export interface CaptureOrderRequest {
  providerOrderId: string;
  transferId: string;
}

export interface NormalizedCaptureResponse {
  providerCaptureId: string;
  status: 'COMPLETED' | 'PENDING' | 'FAILED';
  grossAmount: string;
  grossCurrency: CurrencyCode;
  feeAmount: string;
  feeCurrency: CurrencyCode;
  netAmount: string;
  netCurrency: CurrencyCode;
  effectiveFxRate: string | null;
  receivableAmount: string | null;
  receivableCurrency: CurrencyCode | null;
  capturedAt: string;
  rawSanitizedPayload: Record<string, any>;
  transparencyNotice: string;
}

export interface PaymentProvider {
  name: string;
  isSandbox: boolean;
  createTransaction(req: CreateOrderRequest): Promise<CreateOrderResponse>;
  getQuote(req: ProviderQuoteRequest): Promise<ProviderQuoteResponse>;
  captureTransaction(req: CaptureOrderRequest): Promise<NormalizedCaptureResponse>;
  getTransactionStatus(providerOrderId: string): Promise<string>;
  normalizeTransactionResponse(rawResponse: any): NormalizedCaptureResponse;
}
